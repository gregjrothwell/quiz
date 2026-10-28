import { meetRivals, rivalsFrom, tookPart, type NightOpponent, type Rival } from '../src/engine/rivals';

/**
 * The only bucket this backfill writes. Week rows are not "this season", and
 * `season-1` was development. Hardcoded rather than imported from
 * `src/lib/season.ts`, which reaches `src/firebase.ts`. Same bucket as
 * `backfill-finals`.
 */
export const RIVALS_BACKFILL_SEASON = 'season-2';

export function rivalsBackfillWillWrite(argv: readonly string[]): boolean {
  return argv.includes('--go');
}

/** One seat in a kept round. `games/` stores the uid, not the playerId. */
export interface KeptRivalPlayer {
  name: string;
}

/**
 * One finished round, as much of `games/{id}` as a head-to-head needs.
 *
 * `at` is `finishedAt` in milliseconds, or null when the document has none.
 * A missing stamp sorts first, so a later stamped meeting supplies the name.
 */
export interface KeptRivalGame {
  id: string;
  at: number | null;
  players: Record<string, KeptRivalPlayer>;
  scores: Record<string, number>;
  /**
   * Uids with an answer on any of the round's questions. A seat is not a game
   * played: joining seeds a score of 0 ({@link tookPart}).
   */
  answered: ReadonlySet<string>;
  /** Round one's game id, on round two of a double only. */
  doubleOf?: string;
}

export interface SeasonRivalRow {
  id: string;
  name: string;
  played: unknown;
  rivals: unknown;
}

export interface RivalsReplay {
  /** playerId → the map `games/` can account for. Empty maps are absent. */
  maps: Map<string, Record<string, Rival>>;
  /** Kept rounds this player was ranked in, ties included. */
  kept: Map<string, number>;
  skipped: { id: string; reason: string }[];
}

export type RivalsBackfillPlan =
  | {
      action: 'write';
      id: string;
      name: string;
      before: Record<string, Rival>;
      after: Record<string, Rival>;
    }
  | { action: 'unchanged'; id: string; name: string; rivals: Record<string, Rival> }
  | { action: 'missing'; id: string };

export interface HistoryGap {
  id: string;
  name: string;
  played: number;
  kept: number;
}

function finite(scores: Record<string, number>, uid: string): number | undefined {
  const score = scores[uid];
  return typeof score === 'number' && Number.isFinite(score) ? score : undefined;
}

/**
 * The table the room ranked.
 *
 * An ordinary round, and round one of a double, uses its own scores. Round
 * two adds round one: that is the morning, and the podium. The residual would
 * name the wrong person. A round two whose first half is not in `games/` is
 * skipped whole — there is nothing honest to rank.
 */
function rankedScores(
  game: KeptRivalGame,
  byId: ReadonlyMap<string, KeptRivalGame>,
): Record<string, number> | 'missing-half' | 'empty' {
  if (game.doubleOf) {
    if (game.doubleOf === game.id) return 'missing-half';
    const first = byId.get(game.doubleOf);
    if (!first) return 'missing-half';
    const totals: Record<string, number> = {};
    for (const uid of Object.keys(game.players)) {
      const earlier = finite(first.scores, uid);
      const later = finite(game.scores, uid);
      if (earlier === undefined && later === undefined) continue;
      totals[uid] = (earlier ?? 0) + (later ?? 0);
    }
    return Object.keys(totals).length === 0 ? 'empty' : totals;
  }

  const totals: Record<string, number> = {};
  for (const uid of Object.keys(game.players)) {
    const score = finite(game.scores, uid);
    if (score === undefined) continue;
    totals[uid] = score;
  }
  return Object.keys(totals).length === 0 ? 'empty' : totals;
}

function byTime(left: KeptRivalGame, right: KeptRivalGame): number {
  const leftAt = left.at ?? Number.NEGATIVE_INFINITY;
  const rightAt = right.at ?? Number.NEGATIVE_INFINITY;
  if (leftAt !== rightAt) return leftAt - rightAt;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

/**
 * Replays kept rounds through the same `meetRivals` the bank uses.
 *
 * `claims` maps a uid onto the playerId they play as now. `games/` only has
 * the uid. Without the map, a claimed player would be filed on a row the
 * board no longer shows, and split across two keys.
 *
 * Two seats that claim the same playerId in one round count once. The uid
 * that sorts first supplies the score.
 */
export function replayRivals(
  games: readonly KeptRivalGame[],
  claims: ReadonlyMap<string, string> = new Map(),
): RivalsReplay {
  const skipped: { id: string; reason: string }[] = [];
  const seenIds = new Set<string>();
  const unique: KeptRivalGame[] = [];
  for (const game of games) {
    if (seenIds.has(game.id)) {
      skipped.push({ id: game.id, reason: 'duplicate id' });
      continue;
    }
    seenIds.add(game.id);
    unique.push(game);
  }

  const byId = new Map(unique.map((game) => [game.id, game]));
  const maps = new Map<string, Record<string, Rival>>();
  const kept = new Map<string, number>();

  for (const game of [...unique].sort(byTime)) {
    const totals = rankedScores(game, byId);
    if (totals === 'missing-half') {
      skipped.push({ id: game.id, reason: `first half missing (${game.doubleOf ?? '?'})` });
      continue;
    }
    if (totals === 'empty') {
      skipped.push({ id: game.id, reason: 'no scores' });
      continue;
    }

    const seats: { uid: string; playerId: string; name: string; score: number }[] = [];
    for (const [uid, player] of Object.entries(game.players)) {
      if (!Object.hasOwn(totals, uid)) continue;
      const score = totals[uid];
      if (score === undefined) continue;
      // Round two of a double: an answer in either half is having played.
      const first = game.doubleOf ? byId.get(game.doubleOf) : undefined;
      if (!tookPart(uid, score, game.answered) && !first?.answered.has(uid)) continue;
      seats.push({ uid, playerId: claims.get(uid) ?? uid, name: player.name, score });
    }
    if (seats.length === 0) {
      skipped.push({ id: game.id, reason: 'no scores' });
      continue;
    }

    seats.sort((left, right) => (left.uid < right.uid ? -1 : left.uid > right.uid ? 1 : 0));
    const byPlayer = new Map<string, (typeof seats)[number]>();
    for (const seat of seats) {
      if (!byPlayer.has(seat.playerId)) byPlayer.set(seat.playerId, seat);
    }

    for (const seat of byPlayer.values()) {
      kept.set(seat.playerId, (kept.get(seat.playerId) ?? 0) + 1);
      const seen = new Set<string>([seat.playerId]);
      const opponents: NightOpponent[] = [];
      for (const other of byPlayer.values()) {
        if (other.playerId === seat.playerId || seen.has(other.playerId)) continue;
        seen.add(other.playerId);
        opponents.push({ playerId: other.playerId, name: other.name, score: other.score });
      }
      opponents.sort((left, right) =>
        left.playerId < right.playerId ? -1 : left.playerId > right.playerId ? 1 : 0,
      );
      const next = meetRivals(maps.get(seat.playerId), seat.score, opponents);
      if (next) maps.set(seat.playerId, next);
    }
  }

  return { maps, kept, skipped };
}

/**
 * Counts already on the row are kept when they are higher.
 *
 * A re-run must not add the history on top of itself, and must not wipe a
 * meeting `games/` does not have — a round banked whose record was refused,
 * or one played after the last read. The name follows whichever side has met
 * them more; a tie takes the history, which was replayed in order. The result
 * is capped the same way a bank is, so the write stays inside the rules.
 */
export function raiseRivals(
  stored: Readonly<Record<string, Rival>> | undefined,
  computed: Readonly<Record<string, Rival>> | undefined,
): Record<string, Rival> | undefined {
  const ids = new Set([...Object.keys(stored ?? {}), ...Object.keys(computed ?? {})]);
  const raised: Record<string, Rival> = {};
  for (const id of ids) {
    const left = stored?.[id];
    const right = computed?.[id];
    if (!left && !right) continue;
    const beaten = Math.max(left?.beaten ?? 0, right?.beaten ?? 0);
    const lost = Math.max(left?.lost ?? 0, right?.lost ?? 0);
    const storedMeetings = (left?.beaten ?? 0) + (left?.lost ?? 0);
    const computedMeetings = (right?.beaten ?? 0) + (right?.lost ?? 0);
    const name =
      storedMeetings > computedMeetings ? (left?.name ?? right?.name ?? '') : (right?.name ?? left?.name ?? '');
    if ((beaten === 0 && lost === 0) || !name) continue;
    raised[id] = { name, beaten, lost };
  }
  return meetRivals(raised, Number.NaN, []);
}

function sameMap(
  left: Readonly<Record<string, Rival>> | undefined,
  right: Readonly<Record<string, Rival>> | undefined,
): boolean {
  const a = left ?? {};
  const b = right ?? {};
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) {
    const x = a[id];
    const y = b[id];
    if (!x || !y) return false;
    if (x.name !== y.name || x.beaten !== y.beaten || x.lost !== y.lost) return false;
  }
  return true;
}

/**
 * What to write onto season rows. Does not create a row for somebody who has
 * games and no season document. Never clears `rivals`, and never lowers a count.
 */
export function planRivalsBackfill(
  maps: ReadonlyMap<string, Record<string, Rival>>,
  rows: ReadonlyMap<string, SeasonRivalRow>,
): RivalsBackfillPlan[] {
  const plans: RivalsBackfillPlan[] = [];

  for (const id of [...maps.keys()].sort()) {
    const computed = maps.get(id) ?? {};
    const row = rows.get(id);
    if (!row) {
      plans.push({ action: 'missing', id });
      continue;
    }

    const before = rivalsFrom(row.rivals);
    const after = raiseRivals(before, computed) ?? {};
    // An empty result is not a clear. The row keeps what it had.
    if (Object.keys(after).length === 0 || sameMap(before, after)) {
      plans.push({ action: 'unchanged', id, name: row.name, rivals: before });
      continue;
    }
    plans.push({ action: 'write', id, name: row.name, before, after });
  }

  return plans;
}

/** A present `played` must be a whole number ≥ 0. Absent or junk is unknown. */
function wholePlayed(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  return null;
}

/**
 * Where the row's `played` and the rounds `games/` still has do not match.
 *
 * `played` counts rounds from 3 August. `games/` starts on 8 September, and a
 * refused record never landed. Neither is recoverable: `recent` stores your
 * score, not the table. `kept` of 0 means the caption cannot be built at all.
 */
export function historyGaps(
  rows: ReadonlyMap<string, SeasonRivalRow>,
  kept: ReadonlyMap<string, number>,
): HistoryGap[] {
  const gaps: HistoryGap[] = [];
  for (const row of rows.values()) {
    const played = wholePlayed(row.played);
    if (played === null || played === 0) continue;
    const seen = kept.get(row.id) ?? 0;
    if (seen === played) continue;
    gaps.push({ id: row.id, name: row.name, played, kept: seen });
  }
  gaps.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  return gaps;
}

export function playersOf(value: unknown): Record<string, KeptRivalPlayer> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const players: Record<string, KeptRivalPlayer> = {};
  for (const [uid, player] of Object.entries(value)) {
    if (!player || typeof player !== 'object') {
      players[uid] = { name: '' };
      continue;
    }
    const name = (player as { name?: unknown }).name;
    players[uid] = { name: typeof name === 'string' ? name : '' };
  }
  return players;
}

/** Who answered anything, off `games/{id}.questions`. */
export function answeredOf(value: unknown): Set<string> {
  const answered = new Set<string>();
  if (!Array.isArray(value)) return answered;
  for (const question of value) {
    if (!question || typeof question !== 'object') continue;
    const answers = (question as { answers?: unknown }).answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) continue;
    for (const uid of Object.keys(answers)) answered.add(uid);
  }
  return answered;
}

export function scoresOf(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const scores: Record<string, number> = {};
  for (const [uid, score] of Object.entries(value)) {
    if (typeof score === 'number' && Number.isFinite(score)) scores[uid] = score;
  }
  return scores;
}

/** `finishedAt` as milliseconds. A Firestore Timestamp, a number, or nothing. */
export function atOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && 'toMillis' in value) {
    const toMillis = (value as { toMillis: unknown }).toMillis;
    if (typeof toMillis !== 'function') return null;
    const ms: unknown = toMillis.call(value);
    return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
  }
  return null;
}

export function doubleOfOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function claimOf(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const playerId = (data as { playerId?: unknown }).playerId;
  if (typeof playerId !== 'string' || playerId.length === 0) return null;
  return playerId;
}

export function rowOf(id: string, data: Record<string, unknown>): SeasonRivalRow {
  return {
    id,
    name: typeof data.name === 'string' && data.name.length > 0 ? data.name : '?',
    played: data.played,
    rivals: data.rivals,
  };
}
