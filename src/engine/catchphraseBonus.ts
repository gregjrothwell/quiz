/**
 * Bonus Catchphrase: every fifth question of a Catchphrase round, the picture
 * hidden under nine squares that lift one at a time.
 *
 * The office round on 5 October 2026 went 93%, the median answer 1.7 s after
 * the options landed: the pictures were being solved at a glance during the
 * hold. Squares make an early answer a guess from part of the picture, which
 * makes *solving* harder rather than matching harder. Story approved by Greg
 * the same day — docs/decisions/catchphrase-difficulty.md.
 *
 * **Chosen by position, so nothing new is stored.** Every screen holds the
 * pack and the index, and that is all it takes to agree which question is a
 * bonus, which squares are up, and what it scored — no field in the room or
 * the game record, no rule change, no paste. `read-games` can tell which
 * questions were bonus from their index alone.
 */

import type { PackId } from '../questions/types';
import { scrambleTiles } from './jigsaw';

/** The 5th, 10th, 15th, 20th and 25th: every round length ends on one. */
export const BONUS_EVERY = 5;

/** A 3×3 over the picture, as on the programme. */
export const BONUS_SQUARES = 9;

/**
 * What a bonus is worth against an ordinary question: base and rank both
 * doubled, so first takes 2,000 and the floor 1,200. Greg, 5 October 2026.
 * Not the stake, and not a steal — see `tallyQuestion`.
 */
export const BONUS_MULTIPLIER = 2;

/** Read in place of the pack's *Say what you see*. */
export const BONUS_PROMPT = 'Bonus Catchphrase';

export function isBonusCatchphrase(packId: PackId | null, index: number): boolean {
  return packId === 'catchphrase' && (index + 1) % BONUS_EVERY === 0;
}

/**
 * How many squares are up: one every tenth of the clock, so the picture is
 * whole for the last tenth. On a 15 s clock that is one every 1.5 s, whole from
 * 13.5 s, and five up when the options land at half.
 *
 * Tenths rather than ninths so the last square is not lifting at the buzzer —
 * Greg, "ok for now".
 */
export function liftedSquareCount(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return BONUS_SQUARES;
  const elapsed = Math.max(0, elapsedMs);
  return Math.min(BONUS_SQUARES, Math.floor((elapsed / durationMs) * (BONUS_SQUARES + 1)));
}

/**
 * Cells 0..8 in the order they lift, seeded from ids every client already
 * holds — the jigsaw's scramble, which has the same job: the same square has
 * to lift at the same moment on every screen, or the rank bonus is unfair.
 */
export function liftOrder(questionId: string, gameId: string): number[] {
  return scrambleTiles(questionId, gameId);
}
