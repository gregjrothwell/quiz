/**
 * When a question's song starts.
 *
 * Name that Tune's song *is* the question, so it plays from the first frame. A
 * sleeve's is a clue: the cover plays alone for the first half of the clock, so
 * whoever knows it on sight answers first and takes the rank bonus, and then a
 * song from the album rescues everybody else. The question becomes "which
 * album is this song on?", which the same-artist options make a real one.
 *
 * Keyed on **a picture and a song**, not on the Sleeves pack, so a later
 * picture pack with audio behaves the same without a second rule.
 *
 * Measured against the room's shared clock (`elapsedMs`), not against when a
 * screen happened to render — a clue that lands later on one laptop than
 * another is a head start in a round scored on speed.
 *
 * Greg, 29 September 2026. See docs/decisions/sleeves-song.md.
 */

/**
 * The share of the answer window a sleeve plays on its cover alone.
 *
 * Half, and the reasoning is measured: Tunes players answer a median 3.1–4.6s
 * after their clip starts, so the 5s this leaves on a 10s clock is enough song
 * to help. If Sleeves stays under 50% over three rounds, this is the dial.
 */
export const SONG_CLUE_SHARE = 0.5;

interface Clued {
  previewUrl?: string;
  artworkUrl?: string;
  image?: string;
}

/** Milliseconds into the question the song starts; null when there is no song. */
export function songClueAtMs(question: Clued, durationMs: number): number | null {
  if (!question.previewUrl) return null;
  const hasPicture = Boolean(question.artworkUrl ?? question.image);
  return hasPicture ? durationMs * SONG_CLUE_SHARE : 0;
}

export function songClueDue(elapsedMs: number, clueAtMs: number | null): boolean {
  return clueAtMs !== null && elapsedMs >= clueAtMs;
}
