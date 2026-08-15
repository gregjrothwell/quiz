/**
 * Deletes rooms that are past their expiry. Run with:
 *
 *   npm run prune-rooms            # says what it would delete, deletes nothing
 *   npm run prune-rooms -- --go    # actually deletes
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
    }));

  if (!legacy || found.length >= BATCH) return found;

  /*
    Rooms with no `expiresAt` at all.

    There is no "field is missing" query in Firestore, so this reads room ids and
    filters in memory. That is affordable only because the collection is small —
    tens of documents, not thousands. If `rooms` ever runs to five figures this
    needs rethinking rather than raising the limit.
  */
  const all = await db.collection('rooms').select('expiresAt', 'openedAt').limit(1_000).get();
  for (const room of all.docs) {
    if (found.length >= BATCH) break;
    if (RESERVED.has(room.id)) continue;
    if (room.get('expiresAt') !== undefined) continue;
    found.push({
      code: room.id,
      expiresAt: null,
      lastActive: (room.get('openedAt') as Timestamp | undefined)?.toDate() ?? null,
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

  const doomed = await findExpired(db, legacy);

  if (doomed.length === 0) {
    console.log(
      legacy
        ? '\nNothing to prune: no room has expired, and none predates `expiresAt`.\n'
        : '\nNothing to prune. Add --legacy to also reach rooms written before `expiresAt` existed.\n',
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
    console.log(`  ${room.code.padEnd(18)}${age.padEnd(34)}${active}`);
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
