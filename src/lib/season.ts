import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import type { Honours } from '../engine/awards';
import type { FormRecord } from '../engine/form';
import { bankGame, foldRecords, type GameOutcome, type PlayerRecord } from '../engine/records';
import { cleanTeam } from '../engine/team';
import { weekId } from '../engine/week';
import { firestore } from '../firebase';

/**
 * Standings that outlive a single room.
 *
 * Identity is the anonymous auth uid, which is durable per browser with no
 * sign-up. That is the whole appeal and also the whole limitation: it follows
 * the browser rather than the person, so cleared storage, a private window or a
 * second device all start a fresh record. iOS Safari is the sharp edge — it
 * evicts site storage after roughly a week without a visit, so a fortnight off
 * loses a phone player's history.
 *
 * Every client writes only its own row, which is the one thing here the
 * security rules can enforce exactly. Nothing stops someone editing their own
 * numbers from the console; that is the same trust model as the rest of the
 * game.
 */

/**
 * Bump to start a new season. Old rows stay put under their own id.
 *
 * `season-1` was development and testing. `season-2` is the first one played
 * with the office, started 3 August 2026 — bumping rather than deleting because
 * it gives an empty board just the same, keeps the old rows recoverable if a
 * number ever needs checking, and needs no destructive write against live data.
 *
 * A new season also starts with an empty question history (`asked/{packId}`
 * lives under the season), so the first rounds can serve anything.
 */
export const SEASON = 'season-2';

/** More than an office will fill, small enough to stay one cheap read. */
const TABLE_LIMIT = 50;

export interface SeasonRow extends Honours {
  playerId: string;
  name: string;
  played: number;
  wins: number;
  points: number;
  best: number;
  /** Empty for the many rows that predate leagues, or a player who set none. */
  team: string;
}

/**
 * Shared with `src/engine/records.ts`, which owns the arithmetic for folding two
 * of these together — the one part of this file that can quietly corrupt a
 * season, and the one part a test can reach.
 */
type SeasonDoc = PlayerRecord;

/**
 * Keyed on the playerId rather than the auth uid — see `src/lib/identity.ts` for
 * why, and note that the two are the same string for anybody who has never
 * claimed an identity, which is what lets every existing row stand untouched.
 */
function playerDoc(playerId: string, bucket: string = SEASON) {
  return doc(firestore(), 'seasons', bucket, 'players', playerId);
}

/**
 * The two tables a finished game lands on.
 *
 * A week is a season id and nothing more. `seasons/{season}/players/{playerId}`
 * takes an unconstrained wildcard, so the week bucket is the same document
 * under a different name, validated by the same published rule and needing no
 * hand-paste in the console — which is the entire reason it is shaped this way
 * rather than as a `weeks` collection or a field on the row.
 *
 * Read in the same order they are written, so the season is always the one a
 * caller gets first.
 */
function bucketsFor(at: Date): string[] {
  return [SEASON, weekId(at)];
}

export interface GameResult extends GameOutcome {
  /**
   * Which record this lands on — routing, not arithmetic, which is why it is
   * here and not on `GameOutcome`. The same outcome is banked against the
   * season row and the week row under this one id.
   */
  playerId: string;
}

/**
 * Banks one finished game — against the season, and against this week.
 *
 * Runs in a transaction rather than using `increment` because `best` is a
 * maximum, which has no server-side sentinel — and because reading the stored
 * `lastGame` inside the same transaction is what makes a repeat write a no-op.
 * Without that, reloading the final screen would count the game again.
 *
 * **One transaction for both buckets**, so a night either lands on both tables
 * or on neither. The alternative — two transactions — would leave a season
 * total and a weekly one describing different sets of games after any partial
 * failure, and nothing would ever reconcile them.
 *
 * The arithmetic is `bankGame` in `src/engine/records.ts`, where a test can
 * reach it. This half does nothing but decide which documents it applies to.
 *
 * **Costs one extra read and one extra write per player per game.** Against a
 * six-player night's counted 1,812 reads that is under half a percent. A player
 * who has claimed a recovery code now pays two `claims` reads rather than one,
 * because `ownsPlayer` is evaluated per document; an unclaimed player still
 * pays none at all, since the uid branch short-circuits in front of it.
 */
export async function recordGame(result: GameResult): Promise<void> {
  const references = bucketsFor(new Date()).map((bucket) => playerDoc(result.playerId, bucket));

  await runTransaction(firestore(), async (transaction) => {
    // Every read before any write, which Firestore requires of a transaction.
    // In parallel because they are independent documents and the round-trips
    // would otherwise be serial for no reason.
    const snapshots = await Promise.all(references.map((reference) => transaction.get(reference)));

    references.forEach((reference, index) => {
      const snapshot = snapshots[index];
      const existing = snapshot?.exists() ? (snapshot.data() as SeasonDoc) : null;

      // Guarded per bucket rather than once for the pair. They cannot normally
      // disagree, but if a write ever half-lands the retry has to finish the
      // job rather than skip it because the other half looked done.
      if (existing?.lastGame === result.gameId) return;

      transaction.set(reference, bankGame(existing, result));
    });
  });

  // Your own game is the one you will go straight to the board to look for.
  invalidateSeason();
}

/**
 * Folds one record into another and removes the first, for a browser that has
 * just claimed an identity.
 *
 * Without this, claiming leaves the record the claiming browser had built up
 * sitting on the board forever under the same person's name — nothing writes to
 * it again, and nothing removes it. Two rows, one human, on a table the office
 * looks at.
 *
 * **Run after the claim, never before.** Writing `into` needs `ownsPlayer` to
 * pass, which needs the claim already in place; deleting `from` keeps working
 * either way, because a browser always satisfies the uid branch for its own uid.
 *
 * Idempotent, which is what makes a failure survivable: the source is deleted in
 * the same transaction that folds it in, so running it twice does nothing the
 * second time. A merge that fails leaves a visible duplicate rather than a
 * corrupt total, and claiming again retries it.
 *
 * The arithmetic itself is `foldRecords` in `src/engine/records.ts`, where a
 * test can reach it. This half does nothing but read two documents, call it, and
 * write one back.
 */
export async function mergeRecords(from: string, into: string): Promise<boolean> {
  if (from === into) return false;

  const merged = await runTransaction(firestore(), async (transaction) => {
    // Both reads before either write: Firestore transactions require it.
    const source = await transaction.get(playerDoc(from));
    if (!source.exists()) return false;

    const target = await transaction.get(playerDoc(into));

    transaction.set(
      playerDoc(into),
      foldRecords(
        source.data() as SeasonDoc,
        target.exists() ? (target.data() as SeasonDoc) : null,
      ),
    );

    transaction.delete(playerDoc(from));
    return true;
  });

  // A merge removes one row and rewrites another, so a cached table would show
  // the duplicate this exists to get rid of.
  if (merged) invalidateSeason();

  return merged;
}

/**
 * How many question ids to remember per pack.
 *
 * Deliberately not "all of them". The point is to stop last month's questions
 * coming round again, not to guarantee a pack is exhausted before anything
 * repeats — and a list that grows without limit eventually costs more to carry
 * than the repetition costs to sit through. 400 covers roughly six months of a
 * weekly round and still leaves every pack something fresh to draw on.
 */
const ASKED_LIMIT = 400;

function askedDoc(packId: string) {
  return doc(firestore(), 'seasons', SEASON, 'asked', packId);
}

/**
 * Which questions this season has already served from a pack.
 *
 * Season-scoped rather than per-room, because a room lasts one sitting and the
 * complaint — "we had this one last week" — is about the sitting before. Read
 * only by whoever is starting a round, so it costs one document read per game
 * rather than one per player.
 *
 * A failure here is deliberately swallowed by the caller: a round that repeats
 * a question is a much smaller problem than a round that will not start.
 */
export async function loadAsked(packId: string): Promise<Set<string>> {
  const snapshot = await getDoc(askedDoc(packId));
  if (!snapshot.exists()) return new Set();

  const { ids } = snapshot.data() as { ids?: unknown };
  return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
}

/**
 * Records what a round served, newest first, capped at {@link ASKED_LIMIT}.
 *
 * Written whole rather than appended with `arrayUnion` because the cap has to
 * be applied somewhere, and `arrayUnion` has no notion of oldest. Ordering the
 * array newest-first means the cap drops the questions nobody remembers anyway.
 *
 * **`previous` is passed in rather than read here**, because the caller has
 * already read it — `selectQuestions` needs the same set to choose what to
 * serve, so reading it again is the same document twice in one round start. It
 * widens the read-to-write gap from nothing to the length of a round start, so
 * two rooms opening the same pack in the same season within that window would
 * see one overwrite the other's history. The cost of losing that race is a
 * repeated question, which is what this whole mechanism is a best effort
 * against in the first place — the caller already swallows a failure here for
 * the same reason.
 */
export async function recordAsked(
  packId: string,
  ids: readonly string[],
  previous: ReadonlySet<string>,
): Promise<void> {
  const merged = [...ids, ...[...previous].filter((id) => !ids.includes(id))];

  await setDoc(askedDoc(packId), {
    ids: merged.slice(0, ASKED_LIMIT),
    at: Date.now(),
  });
}

/**
 * The season records of just the people in this room, for the opening titles.
 *
 * **Not `loadTable`.** That reads the whole board — up to fifty documents — to
 * answer a question about six people, and it would be read by every client
 * rather than one. This is one `getDoc` per player, run once by whoever starts
 * the round, and everybody else learns the result from the room update they were
 * already receiving. Six reads for the room instead of three hundred.
 *
 * A player with no record yet comes back as zeroes rather than being dropped,
 * because "has never finished a round" is itself something the titles say.
 */
export async function loadForm(players: { uid: string; playerId: string }[]): Promise<FormRecord[]> {
  const snapshots = await Promise.all(
    players.map((player) => getDoc(playerDoc(player.playerId))),
  );

  return snapshots.map((snapshot, index) => {
    const player = players[index];
    const data = snapshot.exists() ? (snapshot.data() as SeasonDoc) : null;

    return {
      uid: player?.uid ?? '',
      played: data?.played ?? 0,
      wins: data?.wins ?? 0,
      best: data?.best ?? 0,
      rosettes:
        (data?.fastest ?? 0)
        + (data?.comeback ?? 0)
        + (data?.loneWolf ?? 0)
        + (data?.contrarian ?? 0),
    };
  });
}

/**
 * How long a loaded table is reused before another open pays for it again.
 *
 * The board is {@link TABLE_LIMIT} documents, it is the one read here that is
 * user-driven rather than per-game, and the final screen now points every
 * player straight at it. What actually costs is one person bouncing in and out
 * of it — final screen, board, back, board — not one person looking once. A
 * minute covers that bounce and still guarantees the table corrects itself
 * while the room is standing around talking about it.
 *
 * Anything *this* device writes clears the cache outright, so your own game and
 * your own claim always show immediately. The window can only ever hide
 * somebody else's row, for less than a minute, on a board nobody reads twice in
 * that time expecting a different answer.
 */
const TABLE_CACHE_MS = 60_000;

/**
 * One entry per bucket. It was a single slot while there was one table; a week
 * board and a season board reading through the same slot would evict each
 * other on every switch, which is the opposite of what a cache is for.
 */
const cached = new Map<string, { rows: SeasonRow[]; at: number }>();

/**
 * Drops every cached table, for a write that has just changed what one holds.
 *
 * All of them rather than the bucket that was written, because banking a game
 * touches two and claiming an identity moves rows between them. Clearing a map
 * of at most a handful of entries costs nothing, and a selective version would
 * be one more place to forget a bucket.
 *
 * Called by the writers here rather than by their callers, so a future writer
 * that forgets is the only way this goes stale — and all of them are in this
 * file, where the omission is visible.
 */
export function invalidateSeason(): void {
  cached.clear();
}

/**
 * One table, highest total first — the season by default, or a week if asked
 * for one. Read on demand rather than subscribed to: standings do not change
 * while you are looking at them, and a live listener on every client is the
 * kind of fan-out this app spends care avoiding.
 *
 * `orderBy('points')` is the right order for a week and the wrong one for the
 * season, which ranks on points ÷ played and is re-sorted by the caller. It
 * stays here because an average cannot be ordered server-side without storing
 * it, and storing it means a new field on the row — which means a rules
 * republish. Fifty rows is well inside what a client can sort.
 *
 * Handed out as a copy. Nothing sorts or splices it today, but the cache holds
 * the only reference, and an in-place sort added later would quietly corrupt
 * every later read rather than failing where it was written.
 */
export async function loadTable(bucket: string = SEASON): Promise<SeasonRow[]> {
  const hit = cached.get(bucket);
  if (hit && Date.now() - hit.at < TABLE_CACHE_MS) return [...hit.rows];

  const snapshot = await getDocs(
    query(
      collection(firestore(), 'seasons', bucket, 'players'),
      orderBy('points', 'desc'),
      limit(TABLE_LIMIT),
    ),
  );

  const rows = snapshot.docs.map((entry) => {
    const data = entry.data() as SeasonDoc;
    return {
      playerId: entry.id,
      name: data.name,
      played: data.played,
      wins: data.wins,
      points: data.points,
      best: data.best,
      team: cleanTeam(data.team),
      // Absent on every row written before honours existed, which is most of
      // them, and zero is the honest reading of a row that never counted any.
      fastest: data.fastest ?? 0,
      comeback: data.comeback ?? 0,
      loneWolf: data.loneWolf ?? 0,
      contrarian: data.contrarian ?? 0,
    };
  });

  cached.set(bucket, { rows, at: Date.now() });
  return [...rows];
}
