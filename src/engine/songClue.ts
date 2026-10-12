/**
 * When a question's song starts.
 *
 * Name that Tune's song *is* the question, so it plays from the first frame. A
 * sleeve's is a clue to which album is on screen. It shipped held back for half
 * the clock, so whoever knew the cover on sight answered first; since 30
 * September 2026 it plays from the first frame too ({@link SONG_CLUE_SHARE}).
 * The question becomes "which album is this song on?", which the same-artist
 * options make a real one.
 *
 * Keyed on **a picture and a song**, not on the Sleeves pack, so a later
 * picture pack with audio behaves the same without a second rule.
 *
 * Measured against the room's shared clock (`elapsedMs`), not against when a
 * screen happened to render — a clue that lands later on one laptop than
 * another is a head start in a round scored on speed.
 *
 * Greg, 29 and 30 September 2026. See docs/decisions/sleeves-song.md.
 */

/**
 * The share of the answer window a sleeve plays on its cover alone.
 *
 * **Zero since 30 September 2026 — the song plays from the start, as a tune's
 * does.** It shipped at half, reasoned from Tunes players answering a median
 * 3.1–4.6s after their clip starts. The first round played on it, `XDUF` on a
 * 15s clock, put 133 of 175 answers in before the song had started, and the 42
 * after it were right less often (36%) than the ones before (50%). Greg's call:
 * the music starts straight away.
 *
 * Kept as the dial rather than deleted, because a hold is still the way to give
 * the cover a head start if Sleeves ever gets too easy again.
 */
export const SONG_CLUE_SHARE = 0;

interface Clued {
  previewUrl?: string;
  artworkUrl?: string;
  image?: string;
}

/**
 * Milliseconds into the question the song starts; null when there is no song.
 *
 * `share` is the dial, passed only by tests that pin what a non-zero one does.
 */
export function songClueAtMs(
  question: Clued,
  durationMs: number,
  share: number = SONG_CLUE_SHARE,
): number | null {
  if (!question.previewUrl) return null;
  const hasPicture = Boolean(question.artworkUrl ?? question.image);
  return hasPicture ? durationMs * share : 0;
}

export function songClueDue(elapsedMs: number, clueAtMs: number | null): boolean {
  return clueAtMs !== null && elapsedMs >= clueAtMs;
}
