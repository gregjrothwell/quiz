/**
 * Counts what is actually in Firestore, cheaply. Run with:
 *
 *   npm run take-stock
 *
 * **This is the script to reach for instead of `seed-vault`.** That one reads
 * every answer to work out what is new — 13,500 reads a run, against a free tier
 * of 50,000 a day — and four runs in one afternoon once took the game down until
 * the quota reset. An aggregate count bills about one read per *thousand* index
 * entries, so the whole of this costs single-digit reads.
 *
 * Needs the service account, because `list` is denied to clients on `/rooms` and
 * `/recovery` and a count is a query. The admin SDK bypasses the rules, which is
 * the same key `seed-vault` uses and the same warning applies: it can rewrite
 * every answer and every season row, so keep it under `.secrets/`.
 */

import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SEASON = 'season-2';

/** Free-tier daily allowances, for putting the counts in proportion. */
const DAILY_READS = 50_000;
const DAILY_WRITES = 20_000;

async function main(): Promise<void> {
  const keyPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
  if (!keyPath) {
    throw new Error(
      'No GOOGLE_APPLICATION_CREDENTIALS in .env.local. This script needs the '
        + 'service account: `list` is denied to clients on /rooms and /recovery, '
        + 'and a count is a query.',
    );
  }

  const key: unknown = JSON.parse(readFileSync(keyPath, 'utf8'));
  const app = initializeApp({ credential: cert(key as Parameters<typeof cert>[0]) }, 'take-stock');
  const db = getFirestore(app);

  const count = async (path: string): Promise<number> =>
    (await db.collection(path).count().get()).data().count;

  const [rooms, vault, players, recovery, claims] = await Promise.all([
    count('rooms'),
    count('vault'),
    count(`seasons/${SEASON}/players`),
    count('recovery'),
    count('claims'),
  ]);

  console.log(`\nFirestore, ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(`  rooms                    ${rooms.toLocaleString('en-GB')}`);
  console.log(`  vault answers            ${vault.toLocaleString('en-GB')}`);
  console.log(`  ${SEASON} players        ${players.toLocaleString('en-GB')}`);
  console.log(`  recovery codes           ${recovery.toLocaleString('en-GB')}`);
  console.log(`  identity claims          ${claims.toLocaleString('en-GB')}`);

  /*
    A game is roughly 800–1,500 reads, measured before any of the season work.
    What that work added is small and worth stating exactly, because the shape of
    this project is that everything is paid for out of one free tier:

      - the opening titles: one read per player, once, by whoever starts
      - banking a game: one transaction read per player, as before
      - a claimed identity: one extra rule read per season write, once per game
      - the season table: up to 50 reads per person who opens it
  */
  const perGame = 1_500 + 12;
  const boardVisits = 6 * 50;
  const perNight = perGame + boardVisits;

  console.log(`\n  reads, six players, worst case`);
  console.log(`    the round itself         ~${(1_500).toLocaleString('en-GB')}`);
  console.log(`    the opening titles       ~12   (six for the digest, six for the fan-out)`);
  console.log(`    everyone opening the board ${boardVisits}   (the table is capped at 50 rows)`);
  console.log(`    ────────────────────────────`);
  console.log(`    a full quiz night        ~${perNight.toLocaleString('en-GB')}`);
  console.log(`\n  So about ${Math.floor(DAILY_READS / perNight)} full nights a day against the ${DAILY_READS.toLocaleString('en-GB')}-read free tier —`);
  console.log(`  and this is a weekly quiz. Writes are nowhere near: a game is well`);
  console.log(`  under 200 against ${DAILY_WRITES.toLocaleString('en-GB')} a day.`);
  console.log(`\n  The board is the only line worth watching. It is user-driven rather`);
  console.log(`  than per-game, and the final screen now points at it.\n`);

  if (rooms > 2_000) {
    console.log('  Rooms only ever grow — there is no TTL and no delete. Worth a');
    console.log('  cleanup policy if this keeps climbing; see docs/HANDOVER.md.\n');
  }
}

main().catch((cause: unknown) => {
  console.error(`\ntake-stock failed: ${cause instanceof Error ? cause.message : String(cause)}`);
  process.exit(1);
});
