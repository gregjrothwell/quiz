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
import { foldRecords, type PlayerRecord } from '../engine/records';
import { cleanTeam } from '../engine/team';
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
function playerDoc(playerId: string) {
  return doc(firestore(), 'seasons', SEASON, 'players', playerId);
}

export interface GameResult {
  playerId: string;
  name: string;
  gameId: string;
  score: number;
  won: boolean;
  /**
   * The league this player is in, if this browser knows of one.
   *
   * An empty string means "leave whatever the record already says", not "no
   * team". The team lives on the season record but is remembered per browser, so
   * a regular who set their team on a laptop and then plays from a phone would
   * otherwise clear it by banking one game — and would have no idea they had.
   * Taking a team *off* a record is done by editing it on the season screen.
   */
  team: string;
  /**
   * The rosettes this player took tonight, or none.
   *
   * None is also what a device sends when it did not see the whole game — the
   * final screen withholds the awards in that case, and banking honours it
   * cannot stand behind would be worse than banking none. It is not evidence
   * nothing was won.
   */
  honours: Honours;
}

/**
 * Banks one finished game against a player's season row.
 *
 * Runs in a transaction rather than using `increment` because `best` is a
 * maximum, which has no server-side sentinel — and because reading the stored
 * `lastGame` inside the same transaction is what makes a repeat write a no-op.
 * Without that, reloading the final screen would count the game again.
 */
export async function recordGame(result: GameResult): Promise<void> {
  const reference = playerDoc(result.playerId);

  await runTransaction(firestore(), async (transaction) => {
    const snapshot = await transaction.get(reference);
    const existing = snapshot.exists() ? (snapshot.data() as SeasonDoc) : null;

    if (existing?.lastGame === result.gameId) return;

    // The transaction already holds the row, so the rosettes cost no read of
    // their own — the same reason `best` is worked out here rather than with a
    // server-side sentinel it does not have.
    // `set` is a whole-document overwrite, so anything not named here is erased
    // by every game anybody plays. An empty incoming team therefore means "keep
    // what is there" rather than "clear it" — see `GameResult.team`.
    const team = cleanTeam(result.team) || cleanTeam(existing?.team);

    const next: SeasonDoc = {
      ...(team ? { team } : {}),
      name: result.name,
      played: (existing?.played ?? 0) + 1,
      wins: (existing?.wins ?? 0) + (result.won ? 1 : 0),
      points: (existing?.points ?? 0) + result.score,
      best: Math.max(existing?.best ?? 0, result.score),
      fastest: (existing?.fastest ?? 0) + result.honours.fastest,
      comeback: (existing?.comeback ?? 0) + result.honours.comeback,
      loneWolf: (existing?.loneWolf ?? 0) + result.honours.loneWolf,
      contrarian: (existing?.contrarian ?? 0) + result.honours.contrarian,
      lastGame: result.gameId,
      lastPlayed: Date.now(),
    };

    transaction.set(reference, next);
  });
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

  return runTransaction(firestore(), async (transaction) => {
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
 */
export async function recordAsked(packId: string, ids: readonly string[]): Promise<void> {
  const previous = await loadAsked(packId);
  const merged = [...ids, ...[...previous].filter((id) => !ids.includes(id))];

  await setDoc(askedDoc(packId), {
    ids: merged.slice(0, ASKED_LIMIT),
    at: Date.now(),
  });
}

/**
 * The season records of just the people in this room, for the opening titles.
 *
 * **Not `loadSeason`.** That reads the whole board — up to fifty documents — to
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
 * The season table, highest total first. Read on demand rather than subscribed
 * to: standings do not change while you are looking at them, and a live
 * listener on every client is the kind of fan-out this app spends care avoiding.
 */
export async function loadSeason(): Promise<SeasonRow[]> {
  const snapshot = await getDocs(
    query(
      collection(firestore(), 'seasons', SEASON, 'players'),
      orderBy('points', 'desc'),
      limit(TABLE_LIMIT),
    ),
  );

  return snapshot.docs.map((entry) => {
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
}
