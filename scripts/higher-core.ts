/**
 * Higher or Lower's arithmetic: pure, so it is tested offline on invented
 * prices. The data and the build are `hand-higher-data.ts` and
 * `write-higher-pack.ts`. See docs/decisions/higher-or-lower.md.
 *
 * The two options carry prices — *Higher, £x* and *Lower, £y* — one of them
 * the hidden item's real price, so the reveal shows it without the vault
 * holding anything but the option (D1 (c), 24 October 2026). The other is the
 * real price mirrored about the shown one, so both are the same distance away
 * and neither reads as the nearer, further or rounder guess.
 */

import { formatPence, roundTo, stepPence } from './prices-core';
import type { Difficulty } from '../src/questions/types';

/** Closer than this and another month's quotes could flip the answer: not asked. */
export const HIGHER_FLOOR = 1.1;

/** Further apart than this and the mirrored price stops being believable. */
export const HIGHER_CAP = 4;

/** The spread at which each level starts: closer is harder. */
const BANDS: Record<Difficulty, number> = { hard: HIGHER_FLOOR, medium: 1.3, easy: 2 };

/** Spreads are computed from rounded prices, so compare them with room for float error. */
const EPSILON = 1e-9;

/** The level a spread reads as — the larger price over the smaller — or null outside the floor and cap. */
export function levelOfPair(ratio: number): Difficulty | null {
  if (ratio < BANDS.hard - EPSILON || ratio > HIGHER_CAP + EPSILON) return null;
  if (ratio >= BANDS.easy - EPSILON) return 'easy';
  if (ratio >= BANDS.medium - EPSILON) return 'medium';
  return 'hard';
}

/** The shown price as the question gives it, rounded on the step its own size sets. */
export function shownPence(pence: number): number {
  return roundTo(pence, stepPence(pence));
}

/** The real price reflected about the shown one: as far the other way, as a ratio. */
export function mirrorDecoy(shown: number, real: number, step: number): number {
  return roundTo((shown * shown) / real, step);
}

/**
 * The two prices for a shown price (as given) and the hidden item's real
 * price, both rounded on the shown price's step, and which one is right.
 */
export function higherPrices(
  shown: number,
  realPence: number,
): { higher: number; lower: number; step: number; correctIndex: 0 | 1 } {
  const step = stepPence(shown);
  const real = roundTo(realPence, step);
  const decoy = mirrorDecoy(shown, real, step);
  const dearer = real > shown;
  return dearer
    ? { higher: real, lower: decoy, step, correctIndex: 0 }
    : { higher: decoy, lower: real, step, correctIndex: 1 };
}

/** The two options as the lecterns read them, and which one is right. */
export function higherOptions(shown: number, realPence: number): { options: [string, string]; correctIndex: 0 | 1 } {
  const { higher, lower, step, correctIndex } = higherPrices(shown, realPence);
  return { options: [`Higher, ${formatPence(higher, step)}`, `Lower, ${formatPence(lower, step)}`], correctIndex };
}

export function higherQuestion({
  shown,
  hidden,
  shownPence: pence,
}: {
  shown: string;
  hidden: string;
  shownPence: number;
}): string {
  const given = shownPence(pence);
  return `In August 2026, ${shown} cost about ${formatPence(given, stepPence(given))}. Does ${hidden} cost more or less?`;
}
