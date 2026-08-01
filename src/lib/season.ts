import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
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

/** Bump to start a new season. Old rows stay put under their own id. */
export const SEASON = 'season-1';

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
