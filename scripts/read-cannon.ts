/**
 * What the office made of each Slop Cannon shot (docs/decisions/slop-cannon.md,
 * D4). Run with:
 *
 *   npm run read-cannon
 *
 * Per shot: the rounds it was loaded into (from `games/`), Keep, Bin, and how
 * many players in those rounds left no verdict.
 *
 * **Needs a service account**, as `read-games` does: no client may read
 * `games/` or `cannonVerdicts/`. The arithmetic is `scripts/cannon-report.ts`,
 * which `npm test` covers.
 */

import { readFile } from 'node:fs/promises';
import { cert, initializeApp as initAdmin, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { formatTally, tallyShots, type KeptRound, type VerdictRow } from './cannon-report';
import { seatedNames, testRunOf } from '../src/engine/testRun';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — point it at a service account key under .secrets/`);
  return value;
}

function keysOf(value: unknown): string[] {
  return typeof value === 'object' && value !== null ? Object.keys(value) : [];
}

async function main(): Promise<void> {
  const key = JSON.parse(await readFile(required('GOOGLE_APPLICATION_CREDENTIALS'), 'utf8')) as ServiceAccount;
  const db = getAdminFirestore(initAdmin({ credential: cert(key) }, 'read-cannon-admin'));

  // Only rounds that carried a shot. `cannon` is absent on every other round,
  // and an orderBy on a field excludes documents without it.
  // A test round's Keep or Bin is not the office's (PROJ-74).
  const games = (await db.collection('games').orderBy('cannon').get()).docs
    .filter((game) => !testRunOf(game.id, seatedNames(game.get('players'))));
  const rounds: KeptRound[] = games.map((game) => ({
    gameId: game.id,
    players: keysOf(game.get('players')),
    shots: keysOf(game.get('cannon')),
  }));

  const counted = new Set(rounds.map((round) => round.gameId));
  const verdicts: VerdictRow[] = [];
  for (const row of (await db.collection('cannonVerdicts').get()).docs) {
    const data = row.data();
    const { gameId, shot, uid, verdict } = data;
    if (typeof gameId === 'string' && counted.has(gameId) && typeof shot === 'string' && typeof uid === 'string'
      && (verdict === 'keep' || verdict === 'bin')) {
      verdicts.push({ gameId, shot, uid, verdict });
    }
  }

  console.log(`The Slop Cannon on ${required('VITE_FIREBASE_PROJECT_ID')}: ${rounds.length} rounds carried a shot.\n`);
  const tallies = tallyShots(rounds, verdicts);
  if (tallies.length === 0) console.log('Nothing fired yet.');
  for (const tally of tallies) console.log(formatTally(tally));
}

main().then(
  () => process.exit(0),
  (cause: unknown) => {
    console.error(cause instanceof Error ? cause.message : cause);
    process.exit(1);
  },
);
