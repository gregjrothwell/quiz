/**
 * The owed live checks, in one print, after an office round. Run with:
 *
 *   npm run read-owed
 *   npm run read-owed -- --last 40
 *
 *   npm run read-owed -- --since 7d     # errors over a week, not a day
 *
 * Seven sections. The first five are the list in docs/HANDOVER.md ("Live
 * checks still owed"); the last two are `read-errors` and `read-cannon`:
 *
 *   1. The Double — any kept round whose `doubleOf` names round one, and
 *      whether that round is in the same window.
 *   2. Theme Tunes — hit rate by easy / medium / hard. Hard near 100% is the
 *      "a clip may be singing its title" warning.
 *   3. Higher or Lower — % right (correct over answers) against 55–85.
 *   4. Cass — `read-traces -- --name cass` for the same window.
 *   5. Geekend — whether `seasons/season-2-geekend/asked/{pack}` exists.
 *      One read cannot show the office doc was left unchanged; the line says so.
 *   6. Errors players saw, over `--since` (default 1d), grouped as `read-errors`.
 *   7. The Slop Cannon's Keep and Bin, as `read-cannon`, test rounds left out.
 *
 * **Needs a service account**, as `read-games` does. Point
 * `GOOGLE_APPLICATION_CREDENTIALS` at a key under `.secrets/`, and run via
 * the npm script so `.env.local` is loaded. It only reads. It does not seed.
 *
 * Not part of `npm test`: it talks to the live project. The print is
 * `scripts/owed-checks.ts`, which the tests cover. A test that imports this
 * file calls `main()` at import and dies offline.
 */

import { readFile } from 'node:fs/promises';
import { cert, initializeApp as initAdmin, type ServiceAccount } from 'firebase-admin/app';
import { Timestamp, getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { parseTrace } from '../src/engine/q1Trace';
import { tallyShots, type KeptRound as CannonRound, type VerdictRow } from './cannon-report';
import { groupErrors, parseErrorRow, parseSince, type ErrorRow } from './error-report';
import { parseGameRecord } from './game-report';
import {
  formatOwedChecks,
  GEEKEND_SEASON,
  OFFICE_SEASON,
  type GeekendAsked,
  type KeptRound,
} from './owed-checks';
import { formatTrace } from './trace-report';
import { seatedNames, testRunOf } from '../src/engine/testRun';

const DEFAULT_LAST = 40;

function sinceArg(argv: readonly string[]): string {
  const at = argv.indexOf('--since');
  return at >= 0 ? argv[at + 1] ?? '1d' : '1d';
}

function keysOf(value: unknown): string[] {
  return typeof value === 'object' && value !== null ? Object.keys(value) : [];
}

function parseLast(argv: readonly string[]): number {
  let last = DEFAULT_LAST;
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--since') {
      i += 1;
      continue;
    }
    if (flag !== '--last') throw new Error(`Unknown argument ${flag ?? ''}. The others are --last and --since.`);
    const value = argv[i + 1];
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`--last wants a positive number, got ${value ?? ''}`);
    last = parsed;
    i += 1;
  }
  return last;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — run with --env-file=.env.local`);
  return value;
}

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

function when(value: unknown): string {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 16).replace('T', ' ') : 'unstamped       ';
}

function idCount(data: unknown): number | null {
  if (typeof data !== 'object' || data === null || !('ids' in data)) return null;
  const ids = (data as { ids: unknown }).ids;
  return Array.isArray(ids) ? ids.length : null;
}

async function main(): Promise<void> {
  const last = parseLast(process.argv.slice(2));
  const keyPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
  if (!keyPath) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS is not set. Reading the owed checks needs a service '
        + 'account — the rules let no client read games, traces or another squad\'s history. '
        + 'Point it at a key under .secrets/.',
    );
  }
  const projectId = required('VITE_FIREBASE_PROJECT_ID');
  const key = JSON.parse(await readFile(keyPath, 'utf8')) as ServiceAccount;
  const db = getAdminFirestore(initAdmin({ credential: cert(key) }, 'read-owed-admin'));

  const gameSnaps = (await db.collection('games').orderBy('finishedAt', 'desc').limit(last).get()).docs;
  const games: KeptRound[] = [];
  let gamesUnreadable = 0;
  let testRuns = 0;
  for (const snapshot of gameSnaps) {
    // The owed checks are about the office's rounds, not a harness's (PROJ-74).
    if (testRunOf(snapshot.id, seatedNames(snapshot.get('players')))) {
      testRuns += 1;
      continue;
    }
    const data: unknown = snapshot.data();
    const record = parseGameRecord(data);
    if (!record) {
      gamesUnreadable += 1;
      continue;
    }
    const finishedAt = typeof data === 'object' && data !== null && 'finishedAt' in data
      ? toDate((data as { finishedAt: unknown }).finishedAt)
      : null;
    games.push({ gameId: snapshot.id, record, finishedAt });
  }

  const traceSnaps = (await db.collection('q1Traces').orderBy('at', 'desc').limit(last).get()).docs;
  const names = new Map<string, Record<string, string>>();
  async function nameOf(gameId: string, uid: string): Promise<string> {
    if (!names.has(gameId)) {
      const game: unknown = (await db.collection('games').doc(gameId).get()).data();
      const players = typeof game === 'object' && game !== null && 'players' in game
        ? (game as { players: unknown }).players
        : null;
      const seated: Record<string, string> = {};
      if (typeof players === 'object' && players !== null) {
        for (const [seatUid, player] of Object.entries(players)) {
          const name: unknown = typeof player === 'object' && player !== null ? Reflect.get(player, 'name') : undefined;
          if (typeof name === 'string') seated[seatUid] = name;
        }
      }
      names.set(gameId, seated);
    }
    return names.get(gameId)?.[uid] ?? `${uid.slice(0, 6)}…`;
  }

  const cassLines: string[] = [];
  for (const snapshot of traceSnaps) {
    const data = snapshot.data();
    const trace = parseTrace(data);
    if (!trace) continue;
    const name = await nameOf(trace.gameId, trace.uid);
    if (!name.toLowerCase().includes('cass')) continue;
    cassLines.push(formatTrace(trace, name, when(data['at'])));
  }

  const geekendSnaps = (await db.collection('seasons').doc(GEEKEND_SEASON).collection('asked').get()).docs;
  const geekendAsked: GeekendAsked[] = geekendSnaps.map((snapshot) => ({
    packId: snapshot.id,
    ids: idCount(snapshot.data()),
  }));
  const officeAsked: Record<string, number | null> = {};
  for (const doc of geekendAsked) {
    const office = await db.collection('seasons').doc(OFFICE_SEASON).collection('asked').doc(doc.packId).get();
    officeAsked[doc.packId] = office.exists ? idCount(office.data()) : null;
  }

  const since = sinceArg(process.argv.slice(2));
  const errorRows: ErrorRow[] = [];
  const errorSnaps = (
    await db.collection('clientErrors')
      .where('at', '>=', Timestamp.fromMillis(Date.now() - parseSince(since)))
      .orderBy('at', 'desc')
      .get()
  ).docs;
  for (const snapshot of errorSnaps) {
    const data = snapshot.data();
    const row = parseErrorRow(data, data['at'] instanceof Timestamp ? data['at'].toMillis() : null);
    if (row) errorRows.push(row);
  }

  // As `read-cannon`: only rounds that carried a shot, test rounds left out,
  // and only verdicts on the rounds counted.
  const cannonRounds: CannonRound[] = (await db.collection('games').orderBy('cannon').get()).docs
    .filter((game) => !testRunOf(game.id, seatedNames(game.get('players'))))
    .map((game) => ({ gameId: game.id, players: keysOf(game.get('players')), shots: keysOf(game.get('cannon')) }));
  const counted = new Set(cannonRounds.map((round) => round.gameId));
  const verdicts: VerdictRow[] = [];
  for (const row of (await db.collection('cannonVerdicts').get()).docs) {
    const { gameId, shot, uid, verdict } = row.data();
    if (typeof gameId === 'string' && counted.has(gameId) && typeof shot === 'string' && typeof uid === 'string'
      && (verdict === 'keep' || verdict === 'bin')) {
      verdicts.push({ gameId, shot, uid, verdict });
    }
  }

  console.log(`Reading owed checks from ${projectId}; ${testRuns} test run(s) skipped.\n`);
  console.log(formatOwedChecks({
    last,
    games,
    gamesUnreadable,
    cassLines,
    tracesRead: traceSnaps.length,
    geekendAsked,
    officeAsked,
    errors: { ...groupErrors(errorRows), since },
    cannon: tallyShots(cannonRounds, verdicts),
  }));
}

main().then(
  () => process.exit(0),
  (cause: unknown) => {
    console.error(cause instanceof Error ? cause.message : cause);
    process.exit(1);
  },
);
