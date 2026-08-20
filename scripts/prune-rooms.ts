/**
 * Deletes rooms that are past their expiry. Run with:
 *
 *   npm run prune-rooms                    # says what it would delete, deletes nothing
 *   npm run prune-rooms -- --go            # actually deletes
 *   npm run prune-rooms -- --list          # every room, with who is in it
 *   npm run prune-rooms -- --code AB12     # a named room, whatever its expiry
 *   npm run prune-rooms -- --probe-rows    # stale season rows the preflight left behind
 *
 * **This exists because Firestore's own TTL policies need billing enabled.**
 * The obvious answer to "rooms are never deleted" is a TTL policy on
 * `expiresAt`, and that is what the field was added for — but creating one on a
 * Spark project fails with `403: billing disabled`. Rather than move the whole
 * project to Blaze to tidy up a few dozen documents, this does the same job
 * from a machine that already holds the service-account key.
 *
 * It is strictly better than the TTL policy would have been, in two ways:
 *
 *   - **It deletes the subcollections too.** A TTL sweep removes the room
 *     document and orphans `answers` and `reveal` underneath it, forever.
 *   - **It can reach the rooms that predate `expiresAt`**, with `--legacy`,
 *     which a TTL policy can never touch because they carry no field to expire.
 *
 * What it is worse at is being automatic. Nothing runs this; somebody does,
 * occasionally. At roughly one room per game that is a job for once a quarter,
 * and `npm run take-stock` is what says whether it is due.
 *
 * Needs the service account, for the same reason `take-stock` does: `list` is
 * denied to clients on `/rooms`, and finding expired rooms is a query.
 */

import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
// Pure, and stays that way — `scripts/imports.test.ts` fails if anything under
// `scripts/` reaches `src/firebase.ts`. Shared rather than copied so this script
// and the preflight can never disagree about which bucket is a probe.
import { weekId } from '../src/engine/week';

/** Subcollections a room can carry. Both are created lazily, so both may be absent. */
const SUBCOLLECTIONS = ['answers', 'reveal'] as const;

/**
 * Rooms `check-rules` owns, which `--legacy` would otherwise sweep up every run.
 *
 * They carry no `expiresAt` and never will — the preflight reuses them rather
 * than minting one per run, precisely so it does not litter. Deleting them is
 * harmless, since `openProbeQuestion` recreates a missing one, but it would
 * mean this script and the preflight quietly undoing each other forever. They
 * hold no player data: the name in them is 'Rules check'.
 */
const RESERVED = new Set(['rules-check-live', 'rules-check-room']);

/**
 * How many rooms to delete in one run.
 *
 * A cap rather than "everything", because this is the one script here that
 * destroys data and a runaway is not recoverable. Run it again if it says there
 * is more.
 */
const BATCH = 200;

interface Doomed {
  code: string;
  expiresAt: Date | null;
  /**
   * When a question was last opened in this room, which is the only record of
   * activity a room document carries — `openedAt` is stamped by the server on
   * every transition into a question, and nothing clears it.
   *
   * Reported before anything is deleted because the rooms that predate
   * `expiresAt` have no age on them at all, and "is anybody still using this?"
   * is the one question worth answering before a destructive run. A room that
   * never reached a question shows nothing, which is itself the answer: it was
   * abandoned in the lobby.
   */
  lastActive: Date | null;
  /**
   * Who is in the room, which is the thing actually being destroyed.
   *
   * Printed before any deletion because a room code says nothing about whether
   * a room matters. "Rules check" or "Header probe" is obviously disposable;
   * four colleagues' names is a decision worth making deliberately.
   */
  players: string[];
}

/** The names in a room document, for the listing. */
function playersOf(room: FirebaseFirestore.DocumentSnapshot): string[] {
  const map = (room.get('players') ?? {}) as Record<string, { name?: unknown }>;
  return Object.values(map)
    .map((player) => (typeof player.name === 'string' ? player.name : '?'))
    .sort((a, b) => a.localeCompare(b, 'en-GB'));
}

/**
 * Rooms named outright on the command line, expired or not.
 *
 * The other two paths answer "what has aged out"; this one answers "get rid of
 * that one" — a test room, or a room somebody wants their name taken out of.
 * Until this existed the only way to remove a specific room was the console,
 * because `allow delete: if false` means no client can do it and a live room
 * has thirty days to run before any sweep would reach it.
 *
 * A code that does not exist is reported rather than skipped silently: the
 * whole input is four characters, and a typo should not look like success.
 */
async function findNamed(db: Firestore, codes: string[]): Promise<Doomed[]> {
  const found: Doomed[] = [];

  for (const code of codes) {
    if (RESERVED.has(code)) {
      console.log(`  ${code} is owned by check-rules and is skipped.`);
      continue;
    }

    const room = await db.collection('rooms').doc(code).get();
    if (!room.exists) {
      console.log(`  ${code} does not exist.`);
      continue;
    }

    found.push({
      code,
      expiresAt: (room.get('expiresAt') as Timestamp | undefined)?.toDate() ?? null,
      lastActive: (room.get('openedAt') as Timestamp | undefined)?.toDate() ?? null,
      players: playersOf(room),
    });
  }

  return found;
}

/**
 * Rooms whose expiry has passed, or — with `legacy` — those that never had one.
 *
 * The two are separate queries because they are separate decisions. An expired
 * room is one the app itself said could go; a room with no `expiresAt` predates
 * the field entirely, and deleting it is a judgement about how far back to
 * reach rather than something the data asked for.
 */
async function findExpired(db: Firestore, legacy: boolean): Promise<Doomed[]> {
  const expired = await db
    .collection('rooms')
    .where('expiresAt', '<=', Timestamp.now())
    .limit(BATCH)
    .get();

  const found: Doomed[] = expired.docs
    .filter((room) => !RESERVED.has(room.id))
    .map((room) => ({
      code: room.id,
      expiresAt: (room.get('expiresAt') as Timestamp | undefined)?.toDate() ?? null,
      lastActive: (room.get('openedAt') as Timestamp | undefined)?.toDate() ?? null,
      players: playersOf(room),
    }));

  if (!legacy || found.length >= BATCH) return found;

  /*
    Rooms with no `expiresAt` at all.

    There is no "field is missing" query in Firestore, so this reads room ids and
    filters in memory. That is affordable only because the collection is small —
    tens of documents, not thousands. If `rooms` ever runs to five figures this
    needs rethinking rather than raising the limit.
  */
  const all = await db.collection('rooms').select('expiresAt', 'openedAt', 'players').limit(1_000).get();
  for (const room of all.docs) {
    if (found.length >= BATCH) break;
    if (RESERVED.has(room.id)) continue;
    if (room.get('expiresAt') !== undefined) continue;
    found.push({
      code: room.id,
      expiresAt: null,
      lastActive: (room.get('openedAt') as Timestamp | undefined)?.toDate() ?? null,
      players: playersOf(room),
    });
  }

  return found;
}

/**
 * Removes one room and everything under it.
 *
 * Subcollections first. A room document deleted on its own leaves children that
 * nothing can find again without knowing the code — which is exactly the state
 * a TTL policy would have left behind, and the reason this script exists.
 */
async function deleteRoom(db: Firestore, code: string): Promise<number> {
  let documents = 0;

  for (const name of SUBCOLLECTIONS) {
    const children = await db.collection('rooms').doc(code).collection(name).get();
    for (const child of children.docs) {
      await child.ref.delete();
      documents += 1;
    }
  }

  await db.collection('rooms').doc(code).delete();
  return documents + 1;
}

/**
 * Season buckets that belong to `check-rules` and to nothing else.
 *
 * **These are the only ids this script will ever delete a season row from**, and
 * they are literals for that reason — a pattern like "anything starting with
 * `rules-check`" is one typo away from reaching `season-2`. `PROBE_WEEK` is
 * shared with the preflight rather than restated, and is dated 1999 so it cannot
 * collide with a week anybody played in.
 */
const PROBE_SEASONS = ['rules-check', weekId(new Date(1999, 0, 15))] as const;

/**
 * Rows left under a probe season by a preflight run that could not tidy up.
 *
 * **`check-rules` is not leaking.** Its cleanup works — measured on 20 August
 * 2026 by counting the bucket, running the preflight three more times, and
 * counting again: three rows before, three after. What is there is historical,
 * from runs that predate the cleanup, and no client can remove it: a season row
 * may only be deleted by whoever owns it, and these belong to anonymous uids
 * that stopped existing when the script exited. That is what makes this an
 * admin-side job rather than something the preflight can fix about itself.
 *
 * They are invisible to the game — the boards read `season-2` and the current
 * week, never these — and the name in them is 'Rules check'. Clutter, not a
 * correctness problem, which is why it is opt-in rather than part of the default
 * sweep.
 */
async function findProbeRows(
  db: Firestore,
): Promise<{ season: string; id: string; name: string }[]> {
  const found: { season: string; id: string; name: string }[] = [];
  for (const season of PROBE_SEASONS) {
    const rows = await db.collection(`seasons/${season}/players`).get();
    for (const row of rows.docs) {
      found.push({ season, id: row.id, name: String(row.get('name') ?? '—') });
    }
  }
  return found;
}

async function main(): Promise<void> {
  const keyPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
  if (!keyPath) {
    throw new Error(
      'No GOOGLE_APPLICATION_CREDENTIALS in .env.local. This script needs the '
        + 'service account: `list` is denied to clients on /rooms, and finding '
        + 'expired rooms is a query.',
    );
  }

  const go = process.argv.includes('--go');
  const legacy = process.argv.includes('--legacy');

  const key: unknown = JSON.parse(readFileSync(keyPath, 'utf8'));
  const app = initializeApp({ credential: cert(key as Parameters<typeof cert>[0]) }, 'prune-rooms');
  const db = getFirestore(app);

  /*
    `--list` exists because `--code` needs a code, and nothing else here can
    tell you one. `take-stock` counts rooms and clients cannot query the
    collection at all — `list` is denied on `/rooms`, deliberately, since a room
    code is the only thing protecting a room. So without this the only way to
    find a specific room was the console, which is what the whole script exists
    to avoid.
  */
  if (process.argv.includes('--list')) {
    const rooms = await db.collection('rooms').select('expiresAt', 'openedAt', 'players').get();
    console.log(`\n${rooms.size} room(s):\n`);
    for (const room of rooms.docs) {
      const expiry = (room.get('expiresAt') as Timestamp | undefined)?.toDate();
      const who = playersOf(room);
      console.log(
        `  ${room.id.padEnd(18)}`
          + `${(expiry ? `expires ${expiry.toISOString().slice(0, 10)}` : 'no expiry').padEnd(24)}`
          + `${who.length > 0 ? who.join(', ') : 'nobody'}`,
      );
    }
    console.log('');
    return;
  }

  if (process.argv.includes('--probe-rows')) {
    const rows = await findProbeRows(db);
    if (rows.length === 0) {
      console.log('\nNo stale preflight rows. The `check-rules` cleanup is keeping up.\n');
      return;
    }
    console.log(`\n${rows.length} preflight row(s) ${go ? 'to delete' : 'would be deleted'}:\n`);
    for (const row of rows) {
      console.log(`  seasons/${row.season}/players/${row.id.slice(0, 12)}…   ${row.name}`);
    }
    if (!go) {
      console.log('\nNothing was deleted. Re-run with --go to actually remove them.\n');
      return;
    }
    for (const row of rows) {
      await db.doc(`seasons/${row.season}/players/${row.id}`).delete();
    }
    console.log(`\nDeleted ${rows.length}.\n`);
    return;
  }

  // `--code AB12 --code CD34`, or `--code AB12,CD34`.
  const named = process.argv
    .flatMap((arg, index) => (process.argv[index - 1] === '--code' ? arg.split(',') : []))
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code.length > 0);

  const doomed = named.length > 0 ? await findNamed(db, named) : await findExpired(db, legacy);

  if (doomed.length === 0) {
    console.log(
      named.length > 0
        ? '\nNone of those rooms can be deleted — see above.\n'
        : legacy
          ? '\nNothing to prune: no room has expired, and none predates `expiresAt`.\n'
          : '\nNothing to prune. Add --legacy to also reach rooms written before `expiresAt` existed,'
            + '\nor --code AB12 to remove a named room whatever its expiry.\n',
    );
    return;
  }

  console.log(`\n${doomed.length} room(s) ${go ? 'to delete' : 'would be deleted'}:\n`);
  for (const room of doomed) {
    const age = room.expiresAt
      ? `expired ${room.expiresAt.toISOString().slice(0, 10)}`
      : 'no expiresAt — predates the field';
    const active = room.lastActive
      ? `last question ${room.lastActive.toISOString().slice(0, 16).replace('T', ' ')}`
      : 'never reached a question';
    const who = room.players.length > 0 ? room.players.join(', ') : 'nobody';
    console.log(`  ${room.code.padEnd(18)}${age.padEnd(34)}${active}`);
    console.log(`  ${''.padEnd(18)}in it: ${who}`);
  }

  /*
    The newest thing about to go, stated on its own line.

    A room that predates `expiresAt` carries no age, so the only guard against
    deleting one somebody is sitting in is `openedAt` — and a single line saying
    "the most recent of these was active an hour ago" is what makes that guard
    usable rather than something to be reconstructed from eighty rows.
  */
  const active = doomed.map((room) => room.lastActive).filter((at): at is Date => at !== null);
  if (active.length > 0) {
    const newest = new Date(Math.max(...active.map((at) => at.getTime())));
    const hours = Math.round((Date.now() - newest.getTime()) / 3_600_000);
    console.log(
      `\n  Most recent activity in this set: ${newest.toISOString().slice(0, 16).replace('T', ' ')}`
        + ` — ${hours} hours ago.`,
    );
    if (hours < 6) console.log('  ⚠ That is recent enough that somebody could still be in it.');
  }

  if (!go) {
    console.log('\nNothing was deleted. Re-run with --go to actually remove them.');
    console.log('Rooms hold players\' names; the season table is separate and untouched.\n');
    return;
  }

  let documents = 0;
  for (const room of doomed) {
    documents += await deleteRoom(db, room.code);
  }

  console.log(`\nDeleted ${doomed.length} room(s), ${documents} documents including subcollections.`);
  console.log(doomed.length >= BATCH ? 'Hit the batch cap — run it again for the rest.\n' : '\n');
}

main().catch((cause: unknown) => {
  console.error(`\nprune-rooms failed: ${cause instanceof Error ? cause.message : String(cause)}`);
  process.exit(1);
});
