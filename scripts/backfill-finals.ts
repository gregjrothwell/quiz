/**
 * Writes Share or Shaft finals onto season-2 rows, from `games/`. Dry run
 * by default:
 *
 *   npm run backfill-finals            # shows what it would write, writes nothing
 *   npm run backfill-finals -- --go    # writes
 *
 * Run after the deploy, so a phone still on yesterday's bundle cannot erase
 * the fields straight away, and again a few days later to repair any row an
 * old bundle did erase. It matches finalists **by uid**: every finalist's uid
 * in `games/` is their season row id, and none of them has claimed a recovery
 * code. Matching by name would be wrong.
 *
 * It never lowers a count already on the row, and it refuses to write a row
 * the rules would refuse. Admin SDK writes bypass the rules, so the refusal
 * is this script's own check — the same bounds as `finalsOk` in
 * `firestore.rules`. A row that fails them gets that player's next bank
 * refused.
 *
 * Season-2 only. It does not touch week buckets.
 */

import { readFile } from 'node:fs/promises';
import { cert, initializeApp as initAdmin, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

import type { FinalsTally } from '../src/engine/finals';
import {
  BACKFILL_SEASON,
  backfillWillWrite,
  planFinalsBackfill,
  tallyKeptFinals,
  type KeptGame,
  type KeptPlayer,
  type SeasonFinalsRow,
} from './finals-backfill';

function playersOf(value: unknown): Record<string, KeptPlayer> {
  if (!value || typeof value !== 'object') return {};
  const players: Record<string, KeptPlayer> = {};
  for (const [uid, player] of Object.entries(value)) {
    if (!player || typeof player !== 'object') continue;
    const standoff = (player as { standoff?: unknown }).standoff;
    if (standoff === undefined) {
      players[uid] = {};
      continue;
    }
    if (!standoff || typeof standoff !== 'object') {
      players[uid] = { standoff: {} };
      continue;
    }
    players[uid] = { standoff: { pick: (standoff as { pick?: unknown }).pick } };
  }
  return players;
}

function rowOf(id: string, data: Record<string, unknown>): SeasonFinalsRow {
  return {
    id,
    name: typeof data.name === 'string' && data.name.length > 0 ? data.name : '?',
    played: data.played,
    finals: data.finals,
    shared: data.shared,
    shafted: data.shafted,
    gotShafted: data.gotShafted,
  };
}

function counts(tally: FinalsTally): string {
  return `${tally.finals} finals, shared ${tally.shared}, shafted ${tally.shafted}, got shafted ${tally.gotShafted}`;
}

async function main(): Promise<void> {
  const go = backfillWillWrite(process.argv);
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath === undefined || keyPath === '') {
    console.error('\nGOOGLE_APPLICATION_CREDENTIALS is not set. It lives in .env.local.\n');
    process.exit(1);
  }

  const key = JSON.parse(await readFile(keyPath, 'utf8')) as ServiceAccount;
  const db = getAdminFirestore(initAdmin({ credential: cert(key) }, 'backfill-finals'));

  const games: KeptGame[] = [];
  const gameSnap = await db.collection('games').get();
  gameSnap.forEach((entry) => {
    games.push({ id: entry.id, players: playersOf(entry.data().players) });
  });

  const { tallies, skipped } = tallyKeptFinals(games);

  const rows = new Map<string, SeasonFinalsRow>();
  const rowSnap = await db.collection('seasons').doc(BACKFILL_SEASON).collection('players').get();
  rowSnap.forEach((entry) => {
    rows.set(entry.id, rowOf(entry.id, entry.data()));
  });

  const plans = planFinalsBackfill(tallies, rows);
  const writes = plans.flatMap((plan) => (plan.action === 'write' ? [plan] : []));
  const unchanged = plans.filter((plan) => plan.action === 'unchanged').length;
  const refused = plans.flatMap((plan) => (plan.action === 'refuse' ? [plan] : []));
  const missing = plans.flatMap((plan) => (plan.action === 'missing' ? [plan] : []));

  console.log(`\n${go ? 'Writing' : 'Dry run —'} ${writes.length} ${BACKFILL_SEASON} row(s), from ${tallies.size} finalist(s).`);
  console.log(`${unchanged} already hold at least these counts and are left alone.\n`);

  for (const plan of writes) {
    console.log(`  write  ${plan.name.slice(0, 18).padEnd(18)} ${counts(plan.before)}  →  ${counts(plan.after)}`);
  }
  for (const plan of plans) {
    if (plan.action === 'unchanged') {
      console.log(`  keep   ${plan.name.slice(0, 18).padEnd(18)} ${counts(plan.tally)}`);
    }
  }
  for (const plan of refused) {
    console.log(`  REFUSE ${plan.name.slice(0, 18).padEnd(18)} ${plan.reason}`);
  }
  for (const plan of missing) {
    console.log(`  missing season row for uid ${plan.id} — not created`);
  }
  if (skipped.length > 0) {
    console.log(`\nSkipped ${skipped.length} game(s) that were not exactly two countable finalists:`);
    for (const id of skipped) console.log(`  games/${id}`);
  }

  if (!go) {
    console.log('\nNothing written. Re-run with `-- --go` to apply.\n');
    if (refused.length > 0) process.exit(1);
    return;
  }

  if (writes.length > 0) {
    const batch = db.batch();
    for (const plan of writes) {
      batch.update(db.collection('seasons').doc(BACKFILL_SEASON).collection('players').doc(plan.id), {
        finals: plan.after.finals,
        shared: plan.after.shared,
        shafted: plan.after.shafted,
        gotShafted: plan.after.gotShafted,
      });
    }
    await batch.commit();
    console.log(`\nWrote ${writes.length} ${BACKFILL_SEASON} row(s).`);
  } else {
    console.log('\nNothing to write.');
  }

  if (refused.length > 0) {
    console.error(`\n${refused.length} row(s) were refused and not written.\n`);
    process.exit(1);
  }
  console.log('');
}

void main().then(() => process.exit(0));
