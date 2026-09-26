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
import { roomStandings, seatedLast } from '../src/engine/scoring';
import type { Player } from '../src/engine/state';

/**
 * Every bucket under `seasons/`, and how many rows each holds.
 *
 * This used to be `const SEASON = 'season-2'` and one count. Weekly boards ship a
 * *week* as a season id — `seasons/week-2026-W34/players` — so from the moment
 * they landed this script was reporting a fraction of what was there and saying
 * nothing about the rest. A hardcoded id could only ever have gone stale again at
 * the next one, so there is now no id here to go stale: `listDocuments` returns
 * the implicit parents of the subcollections that actually exist, which is the
 * question being asked.
 *
 * Still cheap. One read per bucket id returned, plus one aggregate query per
 * bucket — an aggregate bills about one read per *thousand* index entries. Tens
 * of reads all in, which is the whole point of this script over `seed-vault`.
 */
async function seasonBuckets(
  db: FirebaseFirestore.Firestore,
): Promise<{ id: string; players: number }[]> {
  const parents = await db.collection('seasons').listDocuments();
  const counted = await Promise.all(
    parents.map(async (parent) => ({
      id: parent.id,
      players: (await parent.collection('players').count().get()).data().count,
    })),
  );
  // Seasons first, then weeks newest last — the ids sort chronologically by
  // construction, which is half the reason `weekId` pads the week number.
  return counted.filter((bucket) => bucket.players > 0).sort((a, b) => a.id.localeCompare(b.id));
}

/** Free-tier daily allowances, for putting the counts in proportion. */
const DAILY_READS = 50_000;
const DAILY_WRITES = 20_000;

/** How many rounds back the listing below goes. One document read each. */
const RECENT_ROUNDS = 10;

interface Round {
  code: string;
  /** When the last question was opened, which is a server timestamp. */
  played: string;
  pack: string;
  players: number;
  questions: number;
  finished: boolean;
  wager: boolean;
  /**
   * Whether a stake was actually paid, and whether the rank bonus actually
   * awarded an order. **Both are read off the scores rather than trusted.**
   *
   * `stakeFor` rounds a percentage of a score to whole points, so it is the only
   * thing in the game that can produce a total which is not a multiple of 100 —
   * `14,475` in room FWAP. And every question pays 1,000 to the first correct
   * answer and 900/800/700/600 to the rest, so a total that is a multiple of 100
   * but *not* of 1,000 can only have come from a bonus below first — `6,100` in
   * FUWH, which predates the wager entirely.
   *
   * This is here because both of those facts were sitting in the database on
   * 4 September while `HANDOVER.md` said neither feature had ever been played.
   * Nothing surfaced them, so nobody's memory was ever going to be corrected by
   * anything but a real round. See docs/decisions/round-types.md.
   */
  staked: boolean;
  ranked: boolean;
  /** Everyone level at the bottom, by the same rule the chair uses. */
  seated: number;
  lowest: number;
}

/**
 * The last {@link RECENT_ROUNDS} rooms, newest first.
 *
 * Ordered by `expiresAt` rather than `openedAt` because that is the field the
 * rest of this script already orders on, so it needs no second index — and the
 * two agree, `expiresAt` being stamped when the room is made and `openedAt` a
 * few minutes later when the round actually runs.
 *
 * Rooms created before `expiresAt` existed are invisible here, exactly as they
 * are to the expiry count above: `orderBy` only matches documents carrying the
 * field. They are also the oldest rooms in the project, so a listing of recent
 * rounds is the one place that costs nothing.
 */
async function recentRounds(db: FirebaseFirestore.Firestore): Promise<Round[]> {
  const snap = await db
    .collection('rooms')
    .orderBy('expiresAt', 'desc')
    .limit(RECENT_ROUNDS)
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    const players = (data['players'] ?? {}) as Record<string, Player>;
    const scores = (data['scores'] ?? {}) as Record<string, number>;
    const values = Object.values(scores);
    const rows = roomStandings(players, scores);
    const seated = seatedLast(rows);
    const openedAt = data['openedAt'] as { toDate(): Date } | undefined;

    return {
      code: doc.id,
      played: openedAt ? openedAt.toDate().toISOString().slice(0, 10) : '—',
      pack: (data['packTitle'] as string | undefined) ?? '',
      players: Object.keys(players).length,
      questions: ((data['questions'] ?? []) as unknown[]).length,
      finished: data['phase'] === 'finished',
      wager: data['wagerEnabled'] === true,
      staked: values.some((score) => score % 100 !== 0),
      ranked: values.some((score) => score % 100 === 0 && score % 1_000 !== 0),
      seated: seated.length,
      lowest: seated[0] ? (scores[seated[0]] ?? 0) : 0,
    };
  });
}

/** What the bottom of one round's table looked like, in a column's width. */
function bottomOf(round: Round): string {
  if (!round.finished) return 'unfinished';
  if (round.seated === 0) return '—';
  if (round.seated === 1) return `one, on ${round.lowest.toLocaleString('en-GB')}`;
  return `${round.seated} tied on ${round.lowest.toLocaleString('en-GB')}`;
}

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
  const [rooms, expirable, vault, buckets, recovery, claims, rounds] = await Promise.all([
    count('rooms'),
    (await db.collection('rooms').orderBy('expiresAt').count().get()).data().count,
    count('vault'),
    seasonBuckets(db),
    count('recovery'),
    count('claims'),
    recentRounds(db),
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
  // How many are due for `prune-rooms`. One aggregation read.
  const expired = (
    await db.collection('rooms').where('expiresAt', '<', new Date()).count().get()
  ).data().count;
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
  for (const bucket of buckets) {
    console.log(`  ${bucket.id.padEnd(24)} ${bucket.players.toLocaleString('en-GB')}`);
  }
  if (buckets.length === 0) console.log('  seasons                  none');
  console.log(`  recovery codes           ${recovery.toLocaleString('en-GB')}`);
  console.log(`  identity claims          ${claims.toLocaleString('en-GB')}`);

  /*
    What was actually played, which is the question this script could not answer
    until 4 September 2026 — and the reason it could not is the whole point of
    the block. `HANDOVER.md` said the wager and the rank bonus had never been
    played; four of the ten rooms below were played for stakes, one of them with
    nine people, and every count in this script was silent about it.

    Ten document reads, against a script that is otherwise single-digit. That is
    the cost of never having to take a document's word for it again.
  */
  if (rounds.length > 0) {
    const wagered = rounds.filter((round) => round.wager).length;
    const staked = rounds.filter((round) => round.staked).length;
    const ranked = rounds.filter((round) => round.ranked).length;
    const played = rounds.filter((round) => round.finished).length;

    console.log(`\n  the last ${rounds.length} rooms\n`);
    console.log('    played       code  pack                 who  Qs  wager  the bottom');
    for (const round of rounds) {
      console.log(
        `    ${round.played.padEnd(12)} ${round.code.padEnd(5)} ${round.pack.slice(0, 19).padEnd(20)}`
          + ` ${String(round.players).padStart(3)}`
          + ` ${String(round.questions).padStart(3)}`
          + `  ${(round.wager ? 'on' : '—').padEnd(6)}`
          + ` ${bottomOf(round)}`,
      );
    }

    console.log(`\n    ${played} finished · ${wagered} opted into the wager`);
    console.log(
      `    a stake was actually paid in ${staked}`
        + ` · the rank bonus awarded an order in ${ranked}`,
    );
    console.log('    Both are read off the scores, not the flags — see the `Round` type.');
  }

  /*
    What a round costs, sized to the biggest room actually played recently
    rather than to a fixed six. This block used to print six players and "this
    is a weekly quiz" long after the office was playing daily with nine.

    The round is `cost.md`'s formula: every client holds an unfiltered listener
    on the answers, so each answer is delivered to all N — `Q·N²` — plus about
    three room-document transitions per question per client. On top of it:

      - the opening titles: one read per player, once, by whoever starts, and
        one each for the fan-out
      - the season table: up to 50 reads per person who opens it
  */
  const seats = Math.max(6, ...rounds.map((round) => round.players));
  const length = Math.max(15, ...rounds.map((round) => round.questions));
  const roundReads = (players: number): number => length * players * players + 3 * length * players;
  const titles = 2 * seats;
  const boardVisits = seats * 50;
  const perRound = roundReads(seats) + titles + boardVisits;
  const en = (value: number): string => value.toLocaleString('en-GB');

  console.log(`\n  reads, ${seats} players and ${length} questions (the biggest recent room), worst case`);
  console.log(`    the round itself         ~${en(roundReads(seats))}   (Q·N² + 3·Q·N, see cost.md)`);
  console.log(`    the opening titles       ~${en(titles)}`);
  console.log(`    everyone opening the board ${en(boardVisits)}   (the table is capped at 50 rows)`);
  console.log(`    ────────────────────────────`);
  console.log(`    a full round             ~${en(perRound)}`);
  console.log(`\n  So about ${Math.floor(DAILY_READS / perRound)} of those a day against the ${en(DAILY_READS)}-read free tier,`);
  console.log(`  which resets around midnight Pacific — 08:00 in the UK. Writes are nowhere`);
  console.log(`  near: a game is well under 200 against ${en(DAILY_WRITES)} a day.`);
  console.log(`\n  The board line above is the worst case, not the usual one — the table`);
  console.log(`  is cached for a minute, so bouncing in and out of it costs one read set.`);
  console.log(`\n  The round grows with the SQUARE of the room: ${seats * 2} players is roughly`);
  console.log(`  ${en(roundReads(seats * 2))} reads for the round alone. See docs/decisions/cost.md first.`);
  console.log(`\n  A bare \`seed-vault\` reads every vault answer: ${en(vault)} today, ${Math.round((vault / DAILY_READS) * 100)}% of`);
  console.log(`  the day, from the same pool. For a top-up, \`--pack <id>\` reads one pack.\n`);

  if (expired > 0) {
    console.log(`  ${en(expired)} rooms are past their expiry. \`npm run prune-rooms\` lists them;`);
    console.log('  `-- --go` deletes them. Nothing does this automatically on Spark.\n');
  }

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
