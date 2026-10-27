import { firstTouchOf, TOO_FAST_TO_READ_MS } from './answers';
import type { Answer } from './state';

/**
 * Where a player's answer lands in the replay.
 *
 * `atMs` is measured from the start of the reveal, not from the start of the
 * question — the replay is a retelling of the question window, not the window
 * itself.
 */
export interface Arrival {
  uid: string;
  optionIndex: number;
  elapsedMs: number;
  atMs: number;
  /**
   * When this player first touched a lectern, and whether that was sooner than
   * anybody could have read the question.
   *
   * Carried on the arrival rather than looked up at render, so the replay stays
   * a pure function of the answers — the same reason `elapsedMs` is here.
   */
  firstMs: number;
  snap: boolean;
}

export interface ReplayShape {
  /** A beat before the first arrival, so the replay does not start mid-motion. */
  leadMs: number;
  /** The window the arrivals themselves occupy. */
  spreadMs: number;
  /** A beat after the last arrival, before the verdict lands. */
  tailMs: number;
  /**
   * The real span at which the replay uses its whole window.
   *
   * Normalising against the span of the answers alone would stretch a
   * photo-finish into a comfortable win: four people answering within 200ms of
   * each other would arrive over the full spread, which is not what happened and
   * would misrepresent a scoreline decided on those 200ms. Dividing by at least
   * this instead means the replay compresses a long tail but never exaggerates a
   * short one — a tight race stays tight, and ends sooner because there is
   * nothing to watch.
   */
  fullSpreadFromMs: number;
}

export const REPLAY_SHAPE: ReplayShape = {
  leadMs: 260,
  spreadMs: 1140,
  tailMs: 420,
  fullSpreadFromMs: 2500,
};

/**
 * Turns a question's answers into the order they arrived, timed for playback.
 *
 * Sorted by elapsed time, with the uid breaking ties so two identical times
 * always replay in the same order — otherwise the same question replays
 * differently on each device, and the room sees two versions of who was first.
 */
/**
 * The picks the replay may land on a lectern.
 *
 * A late answer stays in `answers` so the player can be told it missed the
 * cut-off (`verdictFor`'s `lost`). It is not a counted pick, and a chip with
 * their name on it is what makes a missed answer look as if it scored.
 * `lastPicks` is the counted set, written at the fold. A fixture with no
 * `lastPicks` — the gallery, a test — uses the tally instead: everyone
 * `deltas` names who also answered. A steal can put a uid into `deltas` who
 * never answered; they have no chip either way.
 */
export function answersForReplay(
  answers: Record<string, Answer>,
  lastPicks: Record<string, Answer>,
  deltas: Record<string, number>,
): Record<string, Answer> {
  if (Object.keys(lastPicks).length > 0) return lastPicks;
  return Object.fromEntries(
    Object.entries(answers).filter(([uid]) => Object.hasOwn(deltas, uid)),
  );
}

export function replayTimeline(
  answers: Record<string, Answer>,
  shape: ReplayShape = REPLAY_SHAPE,
): Arrival[] {
  const entries = Object.entries(answers).sort(
    ([uidA, a], [uidB, b]) => a.elapsedMs - b.elapsedMs || uidA.localeCompare(uidB),
  );

  const earliest = entries[0]?.[1].elapsedMs ?? 0;
  const latest = entries[entries.length - 1]?.[1].elapsedMs ?? 0;
  const divisor = Math.max(latest - earliest, shape.fullSpreadFromMs);

  return entries.map(([uid, answer]) => ({
    uid,
    optionIndex: answer.optionIndex,
    elapsedMs: answer.elapsedMs,
    atMs: shape.leadMs + ((answer.elapsedMs - earliest) / divisor) * shape.spreadMs,
    // Both cases the exploit has, in one reading: a snap guess that was kept
    // shows up here because its `elapsedMs` is the early one, and a snap guess
    // that was revised shows up because `firstMs` is. Neither moves `atMs` —
    // the replay still tells the story of when answers actually landed.
    firstMs: firstTouchOf(answer),
    snap: firstTouchOf(answer) < TOO_FAST_TO_READ_MS,
  }));
}

/**
 * How long the reveal should hold before the verdict lands.
 *
 * Falls back to the caller's own hush when nobody answered: a replay of an
 * empty room is just a pause, and it should be the pause the reveal always had
 * rather than a longer one that looks like the app has stalled.
 */
export function replayDurationMs(
  arrivals: Arrival[],
  fallbackMs: number,
  shape: ReplayShape = REPLAY_SHAPE,
): number {
  const last = arrivals[arrivals.length - 1];
  if (!last) return fallbackMs;
  return Math.round(last.atMs + shape.tailMs);
}

/** The arrivals that have landed by `atMs`, for a replay played out in steps. */
export function arrivalsBy(arrivals: Arrival[], atMs: number): Arrival[] {
  return arrivals.filter((arrival) => arrival.atMs <= atMs);
}
