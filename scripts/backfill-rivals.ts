/**
 * Writes who you've beaten, and lost to, onto season-2 rows, from `games/`.
 * Dry run by default:
 *
 *   npm run backfill-rivals            # shows what it would write, writes nothing
 *   npm run backfill-rivals -- --go    # writes
 *
 * Run after the deploy, so a phone still on yesterday's bundle cannot erase
 * the map straight away, and again a few days later to repair any row an old
 * bundle did erase. It is not part of the bank: a client cannot read `games/`.
 *
 * It replays each kept round through `meetRivals`, including the morning for
 * round two of a double. Counts already on the row are never lowered and
 * never added to the history — a re-run is the max, not a sum. A round
 * `games/` does not have cannot be rebuilt: the record starts 8 September
 * 2026, and `recent` stores your score only.
 *
 * Season-2 only. It does not touch week buckets, and it does not create a row.
 */

import { readFile } from 'node:fs/promises';
import { cert, initializeApp as initAdmin, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

import { rivalsCaption } from '../src/engine/rivals';
import {
  RIVALS_BACKFILL_SEASON,
  atOf,
  claimOf,
  doubleOfOf,
  historyGaps,
  planRivalsBackfill,
  playersOf,
  replayRivals,
  rivalsBackfillWillWrite,
  rowOf,
  scoresOf,
  type KeptRivalGame,
  type SeasonRivalRow,
} from './rivals-backfill';

function lineFor(rivals: Readonly<Record<string, { name: string; beaten: number; lost: number }>>): string {
  return rivalsCaption(rivals) ?? '(no line)';
}

async function main(): Promise<void> {
  const go = rivalsBackfillWillWrite(process.argv);
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath === undefined || keyPath === '') {
    console.error('\nGOOGLE_APPLICATION_CREDENTIALS is not set. It lives in .env.local.\n');
    process.exit(1);
  }

  const key = JSON.parse(await readFile(keyPath, 'utf8')) as ServiceAccount;
  const db = getAdminFirestore(initAdmin({ credential: cert(key) }, 'backfill-rivals'));

  const games: KeptRivalGame[] = [];
  const gameSnap = await db.collection('games').get();
  gameSnap.forEach((entry) => {
    const data = entry.data();
    const doubleOf = doubleOfOf(data.doubleOf);
    const game: KeptRivalGame = {
      id: entry.id,
      at: atOf(data.finishedAt),
      players: playersOf(data.players),
      scores: scoresOf(data.scores),
    };
    games.push(doubleOf === undefined ? game : { ...game, doubleOf });
  });

  const claims = new Map<string, string>();
  const claimSnap = await db.collection('claims').get();
  claimSnap.forEach((entry) => {
    const playerId = claimOf(entry.data());
    if (playerId) claims.set(entry.id, playerId);
  });

  const { maps, kept, skipped } = replayRivals(games, claims);

  const rows = new Map<string, SeasonRivalRow>();
  const rowSnap = await db.collection('seasons').doc(RIVALS_BACKFILL_SEASON).collection('players').get();
  rowSnap.forEach((entry) => {
    rows.set(entry.id, rowOf(entry.id, entry.data()));
  });

  const plans = planRivalsBackfill(maps, rows);
  const writes = plans.flatMap((plan) => (plan.action === 'write' ? [plan] : []));
  const unchanged = plans.filter((plan) => plan.action === 'unchanged');
  const missing = plans.flatMap((plan) => (plan.action === 'missing' ? [plan] : []));
  const gaps = historyGaps(rows, kept);

  console.log(
    `\n${go ? 'Writing' : 'Dry run —'} ${writes.length} ${RIVALS_BACKFILL_SEASON} row(s), from ${maps.size} player(s) with a decisive kept round.`,
  );
  console.log(`${unchanged.length} already hold at least these counts and are left alone.\n`);

  for (const plan of writes) {
    const name = plan.name.slice(0, 18).padEnd(18);
    console.log(`  write  ${name} ${lineFor(plan.before)}`);
    console.log(`         ${''.padEnd(18)} →  ${lineFor(plan.after)}`);
  }
  for (const plan of unchanged) {
    console.log(`  keep   ${plan.name.slice(0, 18).padEnd(18)} ${lineFor(plan.rivals)}`);
  }
  for (const plan of missing) {
    console.log(`  missing season row for ${plan.id} — not created`);
  }
  if (gaps.length > 0) {
    console.log(`\n${gaps.length} row(s) whose played count games/ cannot fully explain:`);
    for (const gap of gaps) {
      const tail = gap.kept === 0 ? 'nothing in games/' : `${gap.kept} kept`;
      console.log(`  ${gap.name.slice(0, 18).padEnd(18)} played ${gap.played}, ${tail}`);
    }
  }
  if (skipped.length > 0) {
    console.log(`\nSkipped ${skipped.length} game(s):`);
    for (const skip of skipped) console.log(`  games/${skip.id} — ${skip.reason}`);
  }

  if (!go) {
    console.log('\nNothing written. Re-run with `-- --go` to apply.\n');
    return;
  }

  const CHUNK = 400;
  for (let start = 0; start < writes.length; start += CHUNK) {
    const batch = db.batch();
    const slice = writes.slice(start, start + CHUNK);
    for (const plan of slice) {
      batch.update(db.collection('seasons').doc(RIVALS_BACKFILL_SEASON).collection('players').doc(plan.id), {
        rivals: plan.after,
      });
    }
    await batch.commit();
  }

  console.log(writes.length > 0 ? `\nWrote ${writes.length} ${RIVALS_BACKFILL_SEASON} row(s).\n` : '\nNothing to write.\n');
}

void main().then(() => process.exit(0));
