/**
 * When a question's options appear.
 *
 * A Catchphrase picture is meant to be solved — say what you see — and four
 * options on screen from the first frame let anybody solve it by matching
 * instead. Greg, 2 October 2026: one option "will obviously stand out as a
 * catchphrase". So the picture plays alone for half the clock. Whoever has
 * worked the phrase out taps the moment the options land and takes the rank
 * bonus; whoever needs them is reading and matching, and is slower.
 *
 * **A Bonus Catchphrase is the exception**: its options are there from the
 * first frame, so people guess as the squares come off rather than after half
 * of them already have. Greg, 6 October 2026. The squares do the job the hold
 * does on an ordinary question — an early answer is a guess from part of the
 * picture — so holding the options as well was hiding the game behind itself.
 *
 * Keyed on the pack and the position, like `isBonusCatchphrase`, because the
 * hold belongs to what kind of puzzle the round is rather than to any one
 * question in it.
 *
 * Measured against the room's shared clock (`elapsedMs`), not against when a
 * screen happened to render — options that land later on one laptop than
 * another are a head start in a round scored on speed. The same rule as the
 * song clue's, for the same reason: `src/engine/songClue.ts`.
 *
 * See docs/decisions/catchphrase.md.
 */

import type { PackId } from '../questions/types';
import { isBonusCatchphrase } from './catchphraseBonus';

/**
 * The share of the answer window a Catchphrase picture plays alone.
 *
 * Half, Greg's pick. The first round played on it is the measurement:
 * `read-games` shows whether the answers bunch at the moment the options land
 * (people who knew) or spread across the second half (people matching).
 */
export const OPTIONS_HOLD_SHARE = 0.5;

/** Milliseconds into the question the options appear; zero for every other pack. */
export function optionsAtMs(packId: PackId | null, index: number, durationMs: number): number {
  if (packId !== 'catchphrase' || isBonusCatchphrase(packId, index)) return 0;
  return durationMs * OPTIONS_HOLD_SHARE;
}

export function optionsDue(elapsedMs: number, atMs: number): boolean {
  return elapsedMs >= atMs;
}
