/**
 * How often a device in the lobby sends the small write that keeps its Firestore
 * write stream open.
 *
 * The SDK closes an idle write stream after 60s (`IDLE_TIMEOUT_MS`). No write
 * under 80s in the room has taken over 1.5s, and Cass's took 2.4–6.4s on all
 * seven rounds over it, so question one's answer is suspected of paying to reopen
 * the stream. See docs/decisions/cass-q1-cold-write.md.
 *
 * Well inside the 60s, because a timer in a busy tab fires late.
 */
export const WARM_EVERY_MS = 45_000;

/** How long until the next keep-warm is due. Zero means now. */
export function warmDelayMs({ lastSentAt, now }: { lastSentAt: number | null; now: number }): number {
  if (lastSentAt === null) return 0;
  return Math.min(WARM_EVERY_MS, Math.max(0, lastSentAt + WARM_EVERY_MS - now));
}
