/**
 * Reads back the rounds the app has kept. Run with:
 *
 *   npm run read-games                 # the last ten
 *   npm run read-games -- --last 25    # the last twenty-five
 *   npm run read-games -- --game <id>  # one round, every question
 *   npm run read-games -- --pack melody
 *
 * Each finished round is written once by the quizmaster's device to
 * `games/{gameId}` — see `src/engine/gameRecord.ts` for what it holds and
 * `docs/decisions/game-record.md` for why. Nothing in the app reads it back;
 * this is the only thing that ever does, and it exists because writing data
 * nothing reads is how the vault reached 13,712 answers that no command could
 * answer a question about.
 *
 * **Needs a service account.** `read` is denied to every client on `games` —
 * see firestore.rules — and the Admin SDK is not subject to rules at all, the
 * same asymmetry the vault and the votes rely on. Point
 * `GOOGLE_APPLICATION_CREDENTIALS` at a key under `.secrets/`.
 *
 * Not part of the build or the test suite: it talks to the live project. The
 * arithmetic is `scripts/game-report.ts`, which is pure and is covered by
 * `npm test` — this file fetches documents and prints.
 *
 * `--pack` filters in memory rather than in the query, so it needs no
 * composite index; it reads `--last` rounds and shows the ones that match.
 */

import { readFile } from 'node:fs/promises';
import { cert, initializeApp as initAdmin, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import type { GameRecord } from '../src/engine/gameRecord';
import {
  KINDS,
  parseGameRecord,
  summariseGame,
  tallyByKind,
  type GameSummary,
  type KindTally,
} from './game-report';

const DEFAULT_LAST = 10;

interface Options {
  last: number;
  game: string | null;
  pack: string | null;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { last: DEFAULT_LAST, game: null, pack: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--last' && value !== undefined) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`--last wants a positive number, got ${value}`);
      options.last = parsed;
      i += 1;
    } else if (flag === '--game' && value !== undefined) {
      options.game = value;
      i += 1;
    } else if (flag === '--pack' && value !== undefined) {
      options.pack = value;
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

interface KeptGame {
  gameId: string;
  record: GameRecord;
  summary: GameSummary;
}

/** The Admin SDK's timestamp, without importing its class for one method. */
function toDate(value: unknown): Date | null {
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const candidate = (value as { toDate: unknown }).toDate;
    if (typeof candidate === 'function') {
      const date: unknown = (candidate as () => unknown).call(value);
      if (date instanceof Date) return date;
    }
  }
  return null;
}

async function readGames(keyPath: string, options: Options): Promise<{ kept: KeptGame[]; malformed: string[] }> {
  const key = JSON.parse(await readFile(keyPath, 'utf8')) as ServiceAccount;
  const app = initAdmin({ credential: cert(key) }, 'read-games-admin');
  const db = getAdminFirestore(app);
  const games = db.collection('games');

  const snapshots = options.game
    ? [await games.doc(options.game).get()]
    : (await games.orderBy('finishedAt', 'desc').limit(options.last).get()).docs;

  const kept: KeptGame[] = [];
  const malformed: string[] = [];
  for (const snapshot of snapshots) {
    if (!snapshot.exists) continue;
    const data: unknown = snapshot.data();
    const record = parseGameRecord(data);
    if (!record) {
      malformed.push(snapshot.id);
      continue;
    }
    const finishedAt = typeof data === 'object' && data !== null && 'finishedAt' in data
      ? toDate((data as { finishedAt: unknown }).finishedAt)
      : null;
    kept.push({ gameId: snapshot.id, record, summary: summariseGame(snapshot.id, record, finishedAt) });
  }

  return { kept, malformed };
}

function percent(rate: number | null): string {
  return rate === null ? '   —' : `${String(Math.round(rate * 100)).padStart(3)}%`;
}

function seconds(ms: number | null): string {
  return ms === null ? '   —' : `${(ms / 1000).toFixed(1).padStart(4)}s`;
}

function when(date: Date | null): string {
  return date ? date.toISOString().slice(0, 16).replace('T', ' ') : 'unstamped';
}

function printGame(game: KeptGame, everyQuestion: boolean): void {
  const { summary } = game;
  const flags = summary.flags.length > 0 ? ` · ${summary.flags.join(', ')}` : '';
  const skipped = summary.skipped > 0 ? ` · ${summary.skipped} skipped` : '';
  console.log(
    `${summary.roomCode}  ${when(summary.finishedAt)}  ${summary.packTitle.padEnd(18)}`
      + `${String(summary.seats).padStart(2)} seats  ${String(summary.questionCount).padStart(2)} Qs  `
      + `${String(summary.durationSecs).padStart(3)}s  hit ${percent(summary.hitRate)}  `
      + `median ${seconds(summary.medianElapsedMs)}  snaps ${String(summary.snaps).padStart(2)}${flags}${skipped}`,
  );
  console.log(`      game ${game.gameId}`);

  if (!everyQuestion) return;

  console.log('\n       #  kind     diff    right  answered  hit   median  snaps');
  for (const question of summary.questions) {
    const right = question.skipped ? '  skipped' : `${String(question.correct).padStart(2)}/${question.seats}`;
    console.log(
      `      ${String(question.index).padStart(2)}  ${question.kind.padEnd(8)} ${question.difficulty.padEnd(7)} `
        + `${right.padEnd(9)} ${String(question.answered).padStart(2)}/${question.seats}     `
        + `${percent(question.hitRate)}  ${seconds(question.medianElapsedMs)}   ${String(question.snaps).padStart(2)}`
        + `  ${question.id}`,
    );
  }
  console.log('');
}

function printKinds(tallies: Record<(typeof KINDS)[number], KindTally>): void {
  console.log('\nBy kind, across everything above (skipped questions left out):\n');
  console.log('  kind     rounds  questions  hit    answered  median  snaps');
  for (const kind of KINDS) {
    const tally = tallies[kind];
    if (tally.questions === 0) continue;
    const answered = tally.seats === 0 ? '   —' : `${String(Math.round((tally.answered / tally.seats) * 100)).padStart(3)}%`;
    console.log(
      `  ${kind.padEnd(8)} ${String(tally.games).padStart(6)}  ${String(tally.questions).padStart(9)}  `
        + `${percent(tally.hitRate)}  ${answered.padStart(8)}  ${seconds(tally.medianElapsedMs)}  ${String(tally.snaps).padStart(5)}`,
    );
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const keyPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
  const projectId = required('VITE_FIREBASE_PROJECT_ID');

  if (!keyPath) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS is not set. Reading games needs a service account — '
        + '`allow read: if false` denies every client, and the Admin SDK is not subject to '
        + 'the rules. Point it at a key under .secrets/.',
    );
  }

  console.log(
    options.game
      ? `Reading game ${options.game} from ${projectId}.\n`
      : `Reading the last ${options.last} kept rounds from ${projectId}.\n`,
  );

  const { kept, malformed } = await readGames(keyPath, options);
  const shown = options.pack ? kept.filter((game) => game.record.packId === options.pack) : kept;

  if (kept.length === 0) {
    console.log(
      'Nothing kept yet. A round is written when its room reaches `finished`, by the '
        + 'quizmaster’s device, against a published `games` block — `npm run check-rules` '
        + 'says whether that paste has landed.',
    );
    return;
  }

  if (shown.length === 0) {
    console.log(`None of the last ${kept.length} rounds were played on the ${options.pack} pack.`);
  }

  for (const game of shown) printGame(game, options.game !== null || shown.length === 1);

  if (shown.length > 1) printKinds(tallyByKind(shown.map((game) => game.record)));

  if (malformed.length > 0) {
    console.log(`\n${malformed.length} document(s) would not parse and were skipped:`);
    for (const id of malformed) console.log(`  games/${id}`);
  }

  console.log(
    `\n${shown.length} shown of ${kept.length} read. Hit rates are correct over seats, so a `
      + 'silent player counts as a miss; medians are over every answer given.',
  );
}

main().catch((error: unknown) => {
  console.error('read-games failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
