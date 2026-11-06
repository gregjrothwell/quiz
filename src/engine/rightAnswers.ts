import type { Answer } from './state';

/**
 * What each player got right this round, as one running count on the room.
 *
 * Only the tie-break for a place in Share or Shaft reads it: most right answers,
 * then the least time spent on them. It has to live on the room because the
 * answers do not: `lastPicks` holds one question, and the per-question log is
 * kept per device, so a device that reloaded holds a short one and could reach
 * a different finalist. See docs/decisions/share-or-shaft.md.
 */
export interface RightTally {
  right: number;
  /** Total `elapsedMs` over those right answers only. */
  ms: number;
}

export type RightAnswers = Readonly<Record<string, RightTally>>;

/** One question's right answers added to the count, or taken back with `sign` -1. */
export function foldRight(
  count: RightAnswers,
  answers: Readonly<Record<string, Answer>>,
  isRight: (answer: Answer) => boolean,
  sign: 1 | -1 = 1,
): Record<string, RightTally> {
  const next: Record<string, RightTally> = { ...count };
  for (const [uid, answer] of Object.entries(answers)) {
    if (!isRight(answer)) continue;
    const held = next[uid] ?? { right: 0, ms: 0 };
    const right = held.right + sign;
    if (right <= 0) delete next[uid];
    else next[uid] = { right, ms: Math.max(0, held.ms + sign * answer.elapsedMs) };
  }
  return next;
}

/** Two rounds' counts added together, for the morning in The Double. */
export function addRight(left: RightAnswers, right: RightAnswers): Record<string, RightTally> {
  const sum: Record<string, RightTally> = { ...left };
  for (const [uid, tally] of Object.entries(right)) {
    const held = sum[uid] ?? { right: 0, ms: 0 };
    sum[uid] = { right: held.right + tally.right, ms: held.ms + tally.ms };
  }
  return sum;
}

/**
 * Better first: more right, then less time. Zero when level on both, which is
 * the only case the coin still decides.
 */
export function byRightAnswers(count: RightAnswers, a: string, b: string): number {
  const left = count[a] ?? { right: 0, ms: 0 };
  const right = count[b] ?? { right: 0, ms: 0 };
  return right.right - left.right || left.ms - right.ms;
}
