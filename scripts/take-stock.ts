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

  /*
    How many rooms a TTL policy can actually reach.

    `orderBy` on a field only matches documents that carry it, so this is the
    count of rooms created since `expiresAt` shipped — which is the number that
    says how much of the backlog a TTL policy will reap and how much predates it
    and will sit there forever. It is also the check that the field is still
    being written: if this stops climbing while `rooms` does, something dropped
    it from the create path.
  */
  const [rooms, expirable, vault, players, recovery, claims] = await Promise.all([
    count('rooms'),
    (await db.collection('rooms').orderBy('expiresAt').count().get()).data().count,
    count('vault'),
    count(`seasons/${SEASON}/players`),
    count('recovery'),
    count('claims'),
  ]);

  /*
    The soonest a TTL policy could remove anything.

    Reported because `expiresAt` has to be an expiry rather than a creation
    stamp — a TTL policy deletes a document once the field is in the *past*, and
    takes no duration of its own. A date in the past here means every room is
    eligible the moment it is made, which is the mistake this line exists to
    make loud rather than silent. One document read.
  */
  const soonest = await db.collection('rooms').orderBy('expiresAt').limit(1).get();
  const soonestAt = soonest.docs[0]?.get('expiresAt') as { toDate(): Date } | undefined;

  console.log(`\nFirestore, ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(`  rooms                    ${rooms.toLocaleString('en-GB')}`);
  console.log(
    `    with expiresAt         ${expirable.toLocaleString('en-GB')}`
      + `   (${(rooms - expirable).toLocaleString('en-GB')} predate it, so no TTL policy will ever reap them)`,
  );
  if (soonestAt) {
    const at = soonestAt.toDate();
    const days = Math.round((at.getTime() - Date.now()) / 86_400_000);
    console.log(
      `    soonest expiry         ${at.toISOString().slice(0, 10)}`
        + (days >= 0
          ? `   (${days} days off)`
          : `   ⚠ ${-days} days PAST — a TTL policy would reap on sight`),
    );
  }
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
  console.log(`\n  The board line above is the worst case, not the usual one — the table`);
  console.log(`  is cached for a minute, so bouncing in and out of it costs one read set.`);
  console.log(`\n  All of this is for SIX players. The answers subcollection fans out to`);
  console.log(`  every client, so the round itself grows with the SQUARE of the room:`);
  console.log(`  twelve players is roughly 2,700 reads and twenty-five is roughly`);
  console.log(`  10,500. See docs/decisions/cost.md before assuming a bigger room is fine.\n`);

  if (expirable < rooms) {
    console.log(`  ${(rooms - expirable).toLocaleString('en-GB')} rooms predate \`expiresAt\` and no TTL policy can reach them.`);
    console.log('  They hold players\' names. Removable from the console if that matters.\n');
  }

  if (rooms > 2_000) {
    console.log('  Rooms only ever grow without a TTL policy. If one is not yet set up:');
    console.log('  Google Cloud console → Firestore → Time-to-live → `rooms`, field `expiresAt`.\n');
  }
}

main().catch((cause: unknown) => {
  console.error(`\ntake-stock failed: ${cause instanceof Error ? cause.message : String(cause)}`);
  process.exit(1);
});
