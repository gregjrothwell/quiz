/**
 * When a device may first ask the vault to confirm an answer.
 *
 * The rules refuse a reveal until the server agrees the answer window has
 * passed — `request.time > openedAt + durationSecs * 1000`, a strict comparison
 * against a clock no client can read. So a client cannot know the moment; it can
 * only pick a local moment it can *prove* is after it.
 *
 * **`useQuestionClock` is not that moment, on the one device that reveals.**
 * The reveal is fired by the quizmaster, who is the device that wrote the
 * question open, and Firestore's latency compensation delivers that write back
 * as a local snapshot before the server has seen it. So the countdown starts at
 * roughly the click, while `openedAt` is stamped when the write lands — and the
 * two writes' upstream latencies then cancel, leaving a margin of a few
 * milliseconds decided by nothing but jitter.
 *
 * Measured on the live project, 20 August 2026 (`npm run reveal-probe`): the
 * pending local snapshot arrived 6–12ms after the write was issued, and the
 * first attempt cleared the gate by about **7ms**. Asking 100ms early was
 * refused; asking 250ms early was refused. That is not a design with slack, it
 * is a coin flip, and the app pays `REVEAL_RETRY_MS` every time it loses one.
 *
 * ## The moment that is provable
 *
 * A **server-confirmed** snapshot of the open question cannot reach this device
 * before the server stamped `openedAt` on it — the stamping happens first, in
 * the same server, and the snapshot travels afterwards. So:
 *
 *     confirmedAt (local, real time)  >  openedAt (server, real time)
 *
 * and a reveal issued at `confirmedAt + durationMs` therefore reaches the server
 * strictly later than `openedAt + durationMs`, whatever the latency and whatever
 * the clock skew. **Neither quantity appears in the arithmetic**, which is the
 * whole point: they cancel rather than being estimated.
 *
 * That also covers the case the quizmaster did *not* open the question — the
 * role changing hands mid-round — because there the first snapshot is already
 * server-confirmed and the same inequality holds.
 */

/**
 * Guards nothing but `Date.now()` going backwards under an NTP correction.
 *
 * **The correctness does not come from this number.** It comes from the ordering
 * above, which holds at zero slack. Do not "tune" it upwards to fix a reveal
 * that is being refused — a refusal means the anchor is wrong, and a bigger
 * number would only hide it behind a longer wait.
 */
export const REVEAL_GATE_SLACK_MS = 100;

export interface RevealGate {
  /**
   * When this device received the first *server-confirmed* snapshot of the
   * question now in play, on its own clock. Null while only the pending local
   * write has been seen — which is the state the quizmaster's device is in for
   * one round trip after opening a question.
   */
  confirmedAt: number | null;
  /** The room's answer window, in milliseconds. */
  durationMs: number;
  /** This device's clock, now. */
  now: number;
  slackMs?: number;
}

/**
 * Whether the vault's gate is certain to be open, so a reveal is worth asking
 * for.
 *
 * Deliberately conservative: unknown reads as *not yet*. A device that has not
 * seen the server acknowledge the question has no proof of anything, and asking
 * anyway is what costs a retry.
 */
export function revealGateIsOpen({
  confirmedAt,
  durationMs,
  now,
  slackMs = REVEAL_GATE_SLACK_MS,
}: RevealGate): boolean {
  if (confirmedAt === null) return false;
  return now >= confirmedAt + durationMs + slackMs;
}

/**
 * How long until it will be, in milliseconds. Zero once it is open, and null
 * while there is nothing to count from.
 *
 * Used to wake the reveal up at the right moment rather than polling for it: the
 * effect that fires the reveal has no other reason to re-run between the local
 * clock expiring and the gate opening, and a room where everybody has already
 * answered is writing nothing that would nudge it.
 */
export function msUntilRevealGate({
  confirmedAt,
  durationMs,
  now,
  slackMs = REVEAL_GATE_SLACK_MS,
}: RevealGate): number | null {
  if (confirmedAt === null) return null;
  return Math.max(0, confirmedAt + durationMs + slackMs - now);
}

/**
 * How long to wait before asking again after a refusal.
 *
 * A flat 1500ms was the old shape, and it was picked when a refusal was thought
 * to mean "the server disagrees by a second or so". It does not: the miss is one
 * network hop, so the first retry should be quick and only a genuinely stuck
 * vault should be waited on. Escalating keeps the write budget where it was
 * while turning the common recovery from a second and a half into a third of one.
 *
 * The tail repeats rather than growing without limit, because the caller caps
 * the attempts and an ever-longer wait would only make the last few useless.
 */
const REVEAL_BACKOFF_MS = [300, 600, 1_200] as const;

/** What every attempt after the ramp waits. Named, because it is also the fallback. */
const REVEAL_BACKOFF_TAIL_MS = 1_500;

export function revealBackoffMs(attempt: number): number {
  const index = Math.max(attempt, 0);
  // Indexing with a number still widens to `number | undefined` under
  // noUncheckedIndexedAccess, so the tail doubles as the fallback rather than
  // being asserted away.
  return REVEAL_BACKOFF_MS[index] ?? REVEAL_BACKOFF_TAIL_MS;
}
