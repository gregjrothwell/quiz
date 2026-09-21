/**
 * Per-player reading of the rounds the app has kept. Run with:
 *
 *   npm run audit-players
 *   npm run audit-players -- --last 25
 *
 * Prints hit rate, median elapsed split by right and wrong, the right→wrong
 * gap, sub-1s count, and — once a round has been played with the `at` stamp —
 * implied network delay. Also the two integrity checks that were previously
 * a transcript: stored scores versus summed deltas, and season rows versus
 * the rounds that produced them.
 *
 * **Needs a service account.** `games/` is `allow read: if false` for every
 * client. Point `GOOGLE_APPLICATION_CREDENTIALS` at a key under `.secrets/`.
 *
 * Not part of `npm test`: it talks to the live project. The arithmetic is
 * `scripts/player-report.ts`, which is pure and is covered offline. Do not
 * import this file from a test — and it does not call `main()` at import,
 * which is the trap `read-games.ts` documents.
 */

import { readFile } from 'node:fs/promises';
import { cert, initializeApp as initAdmin, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import type { GameRecord } from '../src/engine/gameRecord';
import { parseGameRecord } from './game-report';
import {
  compareSeason,
  scoreIntegrity,
  scoredByName,
  tallyPlayers,
  type SeasonRow,
} from './player-report';

const DEFAULT_LAST = 50;
const SEASON = 'season-2';

interface Options {
  last: number;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { last: DEFAULT_LAST };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--last' && value !== undefined) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`--last wants a positive number, got ${value}`);
      }
      options.last = parsed;
      i += 1;
    }
  }
  return options;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — run with --env-file=.env.local`);
  return value;
}

function formatMs(value: number | null): string {
  if (value === null) return '—';
  return `${Math.round(value)}`;
}

function formatRate(value: number | null): string {
  if (value === null) return '—';
  return `${Math.round(value * 100)}%`;
}

async function loadKept(
  keyPath: string,
  last: number,
): Promise<{ gameId: string; record: GameRecord }[]> {
  const key = JSON.parse(await readFile(keyPath, 'utf8')) as ServiceAccount;
  const app = initAdmin({ credential: cert(key) }, 'player-audit-admin');
  const db = getAdminFirestore(app);
  const snapshots = await db.collection('games').orderBy('finishedAt', 'desc').limit(last).get();

  const kept: { gameId: string; record: GameRecord }[] = [];
  for (const snapshot of snapshots.docs) {
    const record = parseGameRecord(snapshot.data());
    if (record) kept.push({ gameId: snapshot.id, record });
  }
  return kept;
}

async function loadSeason(keyPath: string): Promise<SeasonRow[]> {
  const key = JSON.parse(await readFile(keyPath, 'utf8')) as ServiceAccount;
  const app = initAdmin({ credential: cert(key) }, 'player-audit-season');
  const db = getAdminFirestore(app);
  const snapshots = await db.collection('seasons').doc(SEASON).collection('players').get();

  const rows: SeasonRow[] = [];
  for (const snapshot of snapshots.docs) {
    const data = snapshot.data();
    if (typeof data.name !== 'string') continue;
    if (typeof data.points !== 'number' || typeof data.played !== 'number') continue;
    rows.push({ name: data.name, points: data.points, played: data.played });
  }
  return rows;
}

function printStats(stats: ReturnType<typeof tallyPlayers>): void {
  console.log(
    'name'.padEnd(16)
      + 'rounds'.padStart(7)
      + 'ans'.padStart(6)
      + 'hit'.padStart(6)
      + 'med'.padStart(7)
      + 'right'.padStart(7)
      + 'wrong'.padStart(7)
      + 'gap'.padStart(7)
      + '<1s'.padStart(5)
      + 'delay'.padStart(8),
  );
  for (const row of stats) {
    console.log(
      row.name.slice(0, 16).padEnd(16)
        + String(row.rounds).padStart(7)
        + String(row.answers).padStart(6)
        + formatRate(row.hitRate).padStart(6)
        + formatMs(row.medianElapsedMs).padStart(7)
        + formatMs(row.medianElapsedRightMs).padStart(7)
        + formatMs(row.medianElapsedWrongMs).padStart(7)
        + formatMs(row.rightWrongGapMs).padStart(7)
        + String(row.sub1s).padStart(5)
        + formatMs(row.medianImpliedDelayMs).padStart(8),
    );
  }
  console.log(
    '\n`delay` is (at − openedAt) − elapsedMs, with openedAt estimated per '
      + 'question as the median of at − elapsedMs. Absent until a round is '
      + 'played with the server stamp. A floored elapsedMs shows up large and '
      + 'positive; honest writes cluster near zero.',
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const keyPath = required('GOOGLE_APPLICATION_CREDENTIALS');
  const kept = await loadKept(keyPath, options.last);

  if (kept.length === 0) {
    console.log('Nothing kept yet.');
    return;
  }

  console.log(`${kept.length} kept round(s).\n`);
  const stats = tallyPlayers(kept);
  printStats(stats);

  const mismatches = scoreIntegrity(kept);
  console.log(`\nScore integrity: ${mismatches.length === 0 ? 'clean' : `${mismatches.length} mismatch(es)`}.`);
  for (const row of mismatches) {
    console.log(`  ${row.gameId} ${row.uid}: stored ${row.stored}, summed ${row.summed}`);
  }

  const season = await loadSeason(keyPath);
  const comparison = compareSeason(stats, season, scoredByName(kept));
  console.log(
    `\nSeason ${SEASON} versus these rounds (they will not match for anyone `
      + 'who played before games/ started keeping, 8 September):',
  );
  for (const row of comparison) {
    const seasonPts = row.seasonPoints === null ? 'no row' : String(row.seasonPoints);
    const seasonN = row.seasonPlayed === null ? '—' : String(row.seasonPlayed);
    console.log(
      `  ${row.name}: season ${seasonPts} / ${seasonN} played; `
        + `games ${row.scoredInGames} / ${row.gamesPlayed} rounds`,
    );
  }
}

const runningDirect = process.argv[1]?.includes('player-audit') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('audit-players failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
