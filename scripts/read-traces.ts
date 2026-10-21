/**
 * Reads back what each device saw of question one. Run with:
 *
 *   npm run read-traces                  # the last forty
 *   npm run read-traces -- --last 100
 *   npm run read-traces -- --name cass   # one player, by the name in the kept round
 *
 * Each line ends on a reading — `late delivery` (the device saw question one
 * seconds after the server opened it), `slow write` (on time, but its answer
 * took seconds to be acknowledged), `both` or `neither`. Why it exists, and
 * what each reading would mean for a fix: docs/decisions/cass-q1.md.
 *
 * **Needs a service account**, as `read-games` does: the rules let no client
 * read `q1Traces`. Point `GOOGLE_APPLICATION_CREDENTIALS` at a key under
 * `.secrets/`. Names come from `games/{gameId}`, one read per round shown; a
 * round still being played has no record yet and shows its uid instead.
 *
 * Not part of the build or the tests: it talks to the live project. The line
 * is `scripts/trace-report.ts`, which `npm test` covers.
 */

import { readFile } from 'node:fs/promises';
import { cert, initializeApp as initAdmin, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { parseTrace } from '../src/engine/q1Trace';
import { formatTrace } from './trace-report';

const DEFAULT_LAST = 40;

interface Options {
  last: number;
  name: string | null;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { last: DEFAULT_LAST, name: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--last' && value !== undefined) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`--last wants a positive number, got ${value}`);
      options.last = parsed;
      i += 1;
    } else if (flag === '--name' && value !== undefined) {
      options.name = value.toLowerCase();
      i += 1;
    }
  }
  return options;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — point it at a service account key under .secrets/`);
  return value;
}

/** The Admin SDK's timestamp, without importing its class for one method. */
function when(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const toDate = (value as { toDate: unknown }).toDate;
    if (typeof toDate === 'function') {
      const date: unknown = (toDate as () => unknown).call(value);
      if (date instanceof Date) return date.toISOString().slice(0, 16).replace('T', ' ');
    }
  }
  return 'unstamped       ';
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const key = JSON.parse(await readFile(required('GOOGLE_APPLICATION_CREDENTIALS'), 'utf8')) as ServiceAccount;
  const db = getAdminFirestore(initAdmin({ credential: cert(key) }, 'read-traces-admin'));

  const snapshots = (await db.collection('q1Traces').orderBy('at', 'desc').limit(options.last).get()).docs;
  console.log(`Reading the last ${options.last} question-one traces from ${key.projectId ?? 'the project'}.\n`);

  const names = new Map<string, Record<string, string>>();
  async function nameOf(gameId: string, uid: string): Promise<string> {
    if (!names.has(gameId)) {
      const game: unknown = (await db.collection('games').doc(gameId).get()).data();
      const players =
        typeof game === 'object' && game !== null && 'players' in game
          ? (game as { players: unknown }).players
          : null;
      const seated: Record<string, string> = {};
      if (typeof players === 'object' && players !== null) {
        for (const [seatUid, player] of Object.entries(players)) {
          const name: unknown =
            typeof player === 'object' && player !== null ? Reflect.get(player, 'name') : undefined;
          if (typeof name === 'string') seated[seatUid] = name;
        }
      }
      names.set(gameId, seated);
    }
    return names.get(gameId)?.[uid] ?? `${uid.slice(0, 6)}…`;
  }

  let shown = 0;
  let malformed = 0;
  for (const snapshot of snapshots) {
    const data = snapshot.data();
    const trace = parseTrace(data);
    if (!trace) {
      malformed += 1;
      continue;
    }
    const name = await nameOf(trace.gameId, trace.uid);
    if (options.name && !name.toLowerCase().includes(options.name)) continue;
    console.log(formatTrace(trace, name, when(data['at'])));
    shown += 1;
  }

  console.log(`\n${shown} shown of ${snapshots.length} read${malformed ? `, ${malformed} malformed` : ''}.`);
  console.log('seen late = arrival − openedAt + the RTDB server offset; write = the last answer write to its ack.');
}

main().then(
  () => process.exit(0),
  (cause: unknown) => {
    console.error(cause instanceof Error ? cause.message : cause);
    process.exit(1);
  },
);
