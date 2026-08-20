/**
 * How long a question has really been open, on a clock the whole room agrees on.
 *
 * Every device counts the answer window from the moment *it* saw the question
 * open, which is deliberate and was nearly right: syncing to `questionOpenedAt`
 * would fold the writer's wall clock into everybody's speed score, and office
 * laptops disagree by more than any bonus is worth. What it costs is that a
 * device whose snapshot arrives late runs a window the room is not running — on
 * 17 August a player's started five seconds late, and the reveal killed his
 * lecterns while his own face still read five seconds.
 *
 * `openedAt` is a `serverTimestamp()`, and that is the way through. On this
 * device's clock:
 *
 *     arrival = openedAt + skew + latency
 *
 * `latency` is never negative, so the **minimum** of `arrival − openedAt` across
 * a round approaches `skew` alone — this device's own offset from the server,
 * with nobody else's clock in the arithmetic anywhere.
 *
 * See docs/decisions/shared-clock.md.
 */

/**
 * The largest correction that can be a clock offset rather than a fault.
 *
 * Ten minutes is far more than any plausible laptop drift and far less than the
 * hour-sized errors a wrong timezone or a botched NTP correction produce. The
 * point is not to be precise about the boundary: it is that a reading big enough
 * to move a ten-second window by a visible amount for the wrong reason is
 * refused, and the device falls back to the clock it already had.
 */
export const MAX_CORRECTION_MS = 10 * 60 * 1000;

/**
 * One reading per question — how far after `openedAt` this device saw it.
 *
 * Keyed by question rather than kept as a list so a question that updates again
 * cannot contribute twice, and so the shape says what it holds.
 */
export type ClockDeltas = Record<string, number>;

/**
 * Records a reading, keeping the **first** for each question.
 *
 * A later update to a question already open says nothing about how long that
 * question took to arrive — it is a scoreboard write or somebody joining — so
 * taking it would pollute the estimate with the age of the question.
 */
export function rememberDelta(held: ClockDeltas, key: string, deltaMs: number): ClockDeltas {
  if (Object.hasOwn(held, key)) return held;
  return { ...held, [key]: deltaMs };
}

/**
 * This device's clock offset from the server, or null while it cannot be known.
 *
 * The minimum, because every reading is `skew + latency` and latency is never
 * negative — so the least-delayed question of the round is the closest thing to
 * a pure measurement, and the estimate can only sharpen as a round goes on.
 *
 * Null rather than zero for no readings. Zero is a measurement, and treating the
 * absence of one as "this device is perfectly in step" is exactly the confident
 * lie this module exists to avoid.
 */
export function estimateSkew(held: ClockDeltas): number | null {
  const readings = Object.values(held);
  if (readings.length === 0) return null;
  return Math.min(...readings);
}

export interface OriginInput {
  /** `openedAt` from the room, in milliseconds. Null until the server's stamp lands. */
  openedAtMs: number | null;
  skewMs: number | null;
  /** When the first server-confirmed snapshot of this question reached this device. */
  arrivedAt: number | null;
}

/**
 * When the question opened, translated onto this device's clock — or null when
 * it cannot be worked out, in which case the caller keeps counting from its own
 * arrival exactly as it did before any of this existed.
 *
 * **Two guards, and both only ever fall back:**
 *
 * - The origin is never later than the snapshot actually arrived. Every way this
 *   arithmetic can go wrong has the same shape — a correction that claims the
 *   question opened after this device heard about it — and pinning to the
 *   arrival is precisely today's behaviour.
 * - A correction larger than {@link MAX_CORRECTION_MS} is refused outright. That
 *   is a clock that jumped, not a network that was slow.
 *
 * Together they give the property the whole change rests on: **the correction
 * can take time away from a device and can never give it more than it already
 * had.** A player can still be shown slightly too much time. They can never be
 * shown too little, which is the failure that costs somebody an answer.
 */
export function questionOriginMs({ openedAtMs, skewMs, arrivedAt }: OriginInput): number | null {
  if (openedAtMs === null || skewMs === null || arrivedAt === null) return null;
  if (Math.abs(skewMs) > MAX_CORRECTION_MS) return arrivedAt;

  return Math.min(openedAtMs + skewMs, arrivedAt);
}
