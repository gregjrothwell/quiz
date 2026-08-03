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

export interface SeasonRow {
  uid: string;
  name: string;
  played: number;
  wins: number;
  points: number;
  best: number;
}

interface SeasonDoc {
  name: string;
  played: number;
  wins: number;
  points: number;
  best: number;
  /** The last game banked for this player, so the same one cannot count twice. */
  lastGame: string;
  lastPlayed: number;
}

function playerDoc(uid: string) {
  return doc(firestore(), 'seasons', SEASON, 'players', uid);
}

export interface GameResult {
  uid: string;
  name: string;
  gameId: string;
  score: number;
  won: boolean;
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
  const reference = playerDoc(result.uid);

  await runTransaction(firestore(), async (transaction) => {
    const snapshot = await transaction.get(reference);
    const existing = snapshot.exists() ? (snapshot.data() as SeasonDoc) : null;

    if (existing?.lastGame === result.gameId) return;

    const next: SeasonDoc = {
      name: result.name,
      played: (existing?.played ?? 0) + 1,
      wins: (existing?.wins ?? 0) + (result.won ? 1 : 0),
      points: (existing?.points ?? 0) + result.score,
      best: Math.max(existing?.best ?? 0, result.score),
      lastGame: result.gameId,
      lastPlayed: Date.now(),
    };

    transaction.set(reference, next);
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
      uid: entry.id,
      name: data.name,
      played: data.played,
      wins: data.wins,
      points: data.points,
      best: data.best,
    };
  });
}
