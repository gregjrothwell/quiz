import type { Honours } from './awards';
import { cleanSquad } from './squad';

/**
 * Last N rounds the form window holds, and how many of them count.
 *
 * Golf's dropped scores: best four of the last six. Fewer than four rounds
 * still sum whatever is there — the qualifying floor (three games, same as
 * the old average board) is a ranking rule, not an arithmetic one.
 */
export const FORM_WINDOW = 6;
export const FORM_KEPT = 4;

/**
 * One finished round inside the form window.
 *
 * `gameId` is what keeps `lastGame` honest on a fold: two devices that both
 * banked the same night must not push it twice. `at` is what lets a claim
 * merge two windows into one chronological last-six rather than concatenating
 * them, which would either invent an order or drop the older device's form.
 */
export interface RecentRound {
  gameId: string;
  score: number;
  at: number;
}

export const RECENT_ROUND_KEYS = ['gameId', 'score', 'at'] as const satisfies readonly (keyof RecentRound)[];

/**
 * One player's season record, as it is stored.
 *
 * Honours are optional because almost every row on the board predates them, and
 * a client one deploy behind writes none. Absent means none rather than unknown.
 *
 * `recent` and `form` are the same shape of optional: every row on the board
 * predates them. `bankGame` and `foldRecords` write both from this branch, so
 * the published `hasOnly` list refuses those writes until the rules are pasted.
 */
export interface PlayerRecord {
  name: string;
  played: number;
  wins: number;
  points: number;
  best: number;
  fastest?: number;
  comeback?: number;
  loneWolf?: number;
  contrarian?: number;
  /**
   * Which squad this record belongs to.
   *
   * **Named `team` because that is the field name in `firestore.rules`**, where
   * it is bounded by name and the row is validated with `hasOnly`. Renaming it
   * would cost a hand-paste in the console and orphan every value already
   * written; everywhere else in the app calls it a squad, and the two names
   * meet only in `src/lib/season.ts`.
   *
   * **It is carried through every write here for exactly that reason.** Both
   * paths that write a row use `set`, which is a whole-document overwrite, so a
   * field this type does not know about is erased by the next game anybody
   * plays. That would have made the published bound worse than useless: teams
   * would appear to work and quietly clear themselves overnight.
   */
  team?: string;
  /** The last six scores, oldest first, for the form figure. */
  recent?: RecentRound[];
  /**
   * Best four of {@link recent}. Stored so the board can `orderBy` it — an
   * average never could, which is why `loadTable` used to ask for the top
   * fifty by points and silently mis-rank the tail.
   */
  form?: number;
  /** The last game banked here, so the same one cannot count twice. */
  lastGame: string;
  lastPlayed: number;
}

/**
 * Every key a season row may carry, so the ruleset's `hasOnly` list can be
 * tested against this rather than kept in step by hand. Optional fields sit
 * on the list because `hasOnly` is an allow-list: an unlisted key is a refused
 * write, not an ignored one.
 */
export const PLAYER_RECORD_KEYS = [
  'name',
  'played',
  'wins',
  'points',
  'best',
  'fastest',
  'comeback',
  'loneWolf',
  'contrarian',
  'team',
  'recent',
  'form',
  'lastGame',
  'lastPlayed',
] as const satisfies readonly (keyof PlayerRecord)[];

/**
 * One finished game, as far as a record is concerned.
 *
 * Deliberately says nothing about *which* record it lands on. `playerId` is
 * routing and lives on `GameResult` in `src/lib/season.ts`; the same outcome is
 * banked against the season and against the week, and neither is more real
 * than the other.
 */
export interface GameOutcome {
  name: string;
  gameId: string;
  score: number;
  won: boolean;
  /** Empty means "keep what the record says", not "no squad". See `bankGame`. */
  squad: string;
  honours: Honours;
}

/**
 * Sum of the best {@link FORM_KEPT} scores. Fewer than that in the window
 * sums them all — three good nights are three good nights, not a refusal to
 * compute until the fourth.
 */
export function formOf(scores: readonly number[]): number {
  return [...scores]
    .sort((left, right) => right - left)
    .slice(0, FORM_KEPT)
    .reduce((sum, score) => sum + score, 0);
}

function scoresOf(recent: readonly RecentRound[]): number[] {
  return recent.map((entry) => entry.score);
}

function pushRecent(
  previous: readonly RecentRound[] | undefined,
  outcome: GameOutcome,
  at: number,
): RecentRound[] {
  const held = previous ?? [];
  if (held.some((entry) => entry.gameId === outcome.gameId)) return [...held];
  return [...held, { gameId: outcome.gameId, score: outcome.score, at }].slice(-FORM_WINDOW);
}

/**
 * Union of two windows, unique on `gameId`, last {@link FORM_WINDOW} by `at`.
 *
 * Taking only the newer record's window would wipe a phone's last six the
 * moment a laptop claimed it after one night. Concatenating them would either
 * overflow the bound or invent an order. The timestamps are why `at` exists.
 */
function foldRecent(
  source: readonly RecentRound[] | undefined,
  target: readonly RecentRound[] | undefined,
): RecentRound[] {
  const combined = new Map<string, RecentRound>();
  for (const entry of target ?? []) combined.set(entry.gameId, entry);
  for (const entry of source ?? []) {
    const held = combined.get(entry.gameId);
    if (!held || entry.at >= held.at) combined.set(entry.gameId, entry);
  }
  return [...combined.values()]
    .sort((left, right) => left.at - right.at)
    .slice(-FORM_WINDOW);
}

/**
 * Folds a record into another, for a browser that has just claimed an identity.
 *
 * Here rather than beside the transaction that writes it because this is the
 * part that can quietly corrupt somebody's season, and a transaction is not
 * something a test can reach. The Firestore half is in `src/lib/season.ts` and
 * does nothing but read two documents, call this, and write one back.
 *
 * Three decisions worth keeping:
 *
 * - **`best` is a maximum, everything else a sum.** A personal best is not made
 *   better by having been achieved on two devices.
 * - **The name comes from the identity being adopted**, which is the one already
 *   on the board the claimer is joining. It falls back to the incoming record's
 *   for a code minted before its owner had ever finished a round, where there
 *   is no target row at all.
 * - **`lastGame` follows whichever side played most recently.** That field is
 *   the guard against a reload banking the same game twice, so it has to
 *   describe the most recent game either side actually played — otherwise
 *   claiming straight after a round and then reloading the final screen would
 *   count that round again.
 *
 * The rules' own bounds survive this: `wins <= played` and each honour
 * `<= played` hold when both sides are summed, and `best <= points` holds
 * because a maximum of two bests cannot exceed the sum of two point totals.
 *
 * **`recent` is merged, not summed and not taken from one side.** See
 * {@link foldRecent}. `form` is then recomputed from that window so a claim
 * cannot leave a stored figure that does not describe the array beside it.
 */
export function foldRecords(source: PlayerRecord, target: PlayerRecord | null): PlayerRecord {
  const newest = target && target.lastPlayed > source.lastPlayed ? target : source;

  // The squad the adopted record already sits in, falling back to the incoming
  // one's. Spread conditionally rather than written as `undefined`, which
  // Firestore rejects outright.
  const squad = target?.team ?? source.team;
  const recent = foldRecent(source.recent, target?.recent);

  return {
    ...(squad === undefined ? {} : { team: squad }),
    name: target?.name ?? source.name,
    played: (target?.played ?? 0) + source.played,
    wins: (target?.wins ?? 0) + source.wins,
    points: (target?.points ?? 0) + source.points,
    best: Math.max(target?.best ?? 0, source.best),
    fastest: (target?.fastest ?? 0) + (source.fastest ?? 0),
    comeback: (target?.comeback ?? 0) + (source.comeback ?? 0),
    loneWolf: (target?.loneWolf ?? 0) + (source.loneWolf ?? 0),
    contrarian: (target?.contrarian ?? 0) + (source.contrarian ?? 0),
    recent,
    form: formOf(scoresOf(recent)),
    lastGame: newest.lastGame,
    lastPlayed: newest.lastPlayed,
  };
}

/**
 * What one finished game does to a record, whatever bucket that record is in.
 *
 * Pulled out of the transaction in `src/lib/season.ts` when a game started
 * being banked into two places at once — the season and the week — because two
 * callers doing this arithmetic slightly differently is exactly how a season
 * total and a weekly one start disagreeing about the same night. It is also the
 * first time this has been reachable by a test; it was inline and unreached
 * before.
 *
 * `existing` is null for the first game in a bucket, which is the normal case
 * for a week rather than an exceptional one — a fresh week starts empty every
 * Monday.
 *
 * The empty-squad rule is the subtle part. An incoming empty string means
 * **keep whatever the record says**, not "clear it": the squad lives on the
 * record but is remembered per browser, so a regular who set theirs on a laptop
 * and then played from a phone would otherwise wipe it by banking one game, and
 * would have no idea they had.
 *
 * A repeat `gameId` is a no-op, matching the transaction guard in
 * `recordGame`. The window is keyed on `gameId` as well, so a caller that
 * skipped the guard still cannot push the same night twice.
 */
export function bankGame(existing: PlayerRecord | null, outcome: GameOutcome): PlayerRecord {
  if (existing?.lastGame === outcome.gameId) return existing;

  const squad = cleanSquad(outcome.squad) || cleanSquad(existing?.team);
  const at = Date.now();
  const recent = pushRecent(existing?.recent, outcome, at);

  return {
    // `set` is a whole-document overwrite, so a field this object does not name
    // is erased by the next game anybody plays. Spread conditionally rather than
    // written as `undefined`, which Firestore rejects outright.
    ...(squad ? { team: squad } : {}),
    name: outcome.name,
    played: (existing?.played ?? 0) + 1,
    wins: (existing?.wins ?? 0) + (outcome.won ? 1 : 0),
    points: (existing?.points ?? 0) + outcome.score,
    // A maximum, not a sum — the one field here that is not accumulated.
    best: Math.max(existing?.best ?? 0, outcome.score),
    fastest: (existing?.fastest ?? 0) + outcome.honours.fastest,
    comeback: (existing?.comeback ?? 0) + outcome.honours.comeback,
    loneWolf: (existing?.loneWolf ?? 0) + outcome.honours.loneWolf,
    contrarian: (existing?.contrarian ?? 0) + outcome.honours.contrarian,
    recent,
    form: formOf(scoresOf(recent)),
    lastGame: outcome.gameId,
    lastPlayed: at,
  };
}
