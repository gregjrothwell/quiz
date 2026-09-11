/**
 * Gives a promise a deadline.
 *
 * Written for one caller, and worth a file of its own because the reason is not
 * obvious: **Firestore does not reject a write when the connection stalls.** It
 * queues the write locally and leaves the returned promise *pending* until the
 * server acknowledges it. For a player's answer that is exactly right — the
 * answer lands when the line comes back and nobody notices. For the reveal it is
 * the wrong shape, because the quizmaster's device is the only one that can open
 * the vault and nothing else in the round moves until it has.
 *
 * A pending promise is also invisible to a `catch`, so the reveal's whole
 * recovery apparatus — the backoff ladder in `src/engine/revealGate.ts`, the
 * retry counter in `App`, and the quizmaster's own Reveal button — sat behind a
 * promise that was never going to settle. See the note on `REVEAL_TIMEOUT_MS`.
 *
 * **The work is not cancelled, because a Firestore write cannot be.** The queued
 * writes still flush when the connection returns. That is safe for the one
 * caller: a reveal document is immutable once created, so a late flush is
 * refused exactly like a wrong guess, and `resolveAnswer` falls through to
 * reading the answer back.
 */

/** Thrown when the deadline passes. Named so a caller can tell it from a refusal. */
export class TimeoutError extends Error {
  constructor(what: string, ms: number) {
    super(`${what} did not finish within ${String(ms)}ms. The connection may have dropped.`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  // `ReturnType` rather than `number`: this file is typechecked with Node's
  // globals in scope as well as the DOM's, and the two disagree about what a
  // timer handle is.
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;

  const deadline = new Promise<never>((_resolve, reject) => {
    timer = globalThis.setTimeout(() => reject(new TimeoutError(what, ms)), ms);
  });

  // Cleared on both paths: a timer left running holds the callback alive, and in
  // Node it would keep the process up long enough for a test to notice.
  return Promise.race([work, deadline]).finally(() => {
    globalThis.clearTimeout(timer);
  });
}
