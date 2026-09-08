import type { Answer, Player } from './state';

/**
 * Below this, a first touch cannot have been a read.
 *
 * Not a scoring threshold and not enforced anywhere — the only thing it decides
 * is whether the reveal says out loud that somebody committed before they could
 * have read the question.
 *
 * **One second, against measurement.** Across 38 answers read off five live
 * rooms on 8 September 2026, the fastest anybody answered at all was 1.54s and
 * the next was 3.44s; only one of the 38 was under three seconds. A second is
 * comfortably below the fastest thing a human has been observed doing here, so
 * it cannot fire on honest play — which matters more than catching every guess,
 * because a marker that ever appears over an honest player is worse than
 * useless. It is the dial if that turns out wrong.
 */
export const TOO_FAST_TO_READ_MS = 1000;

/**
 * When this answer's player first touched a lectern.
 *
 * `firstMs` is absent whenever the pick has never been changed, so absent means
 * the first touch and the last are the same moment. Every reader goes through
 * here rather than reaching for the field, which is what stops "no `firstMs`"
 * being mistaken for "no early touch" — the exact reading that would let the
 * lucky quarter of a guess go unmarked.
 */
export function firstTouchOf(answer: Answer): number {
  return answer.firstMs ?? answer.elapsedMs;
}

/**
 * The `firstMs` to write with a pick, given the earliest touch already known.
 *
 * Returns a spreadable rather than a number, matching `staked` in the two
 * places this is used, so "there is nothing to add" stays the empty case
 * instead of a zero that means something else. Omitted when this pick *is* the
 * earliest, which keeps an unchanged answer byte-identical to every round
 * before the field existed — the argument the stake makes for itself.
 *
 * **The caller decides what "already known" means, and that is the whole
 * subtlety.** The obvious source is the answer held on the document, and it is
 * not enough on its own: four presses inside 200ms do not round-trip, so the
 * second, third and fourth would each see no held answer and write nothing —
 * losing the early touch on precisely the input this exists to catch.
 * `useRoom` therefore reconciles the document with a synchronous ref; the
 * reducer, whose state is its own, just reads it back.
 */
export function carryFirstMs(earliestMs: number | undefined, elapsedMs: number): { firstMs?: number } {
  if (earliestMs === undefined) return {};
  // `min` rather than the value handed in: a change is normally later, but
  // nothing guarantees it, and the earliest touch is the earliest either way.
  const first = Math.min(earliestMs, elapsedMs);
  return first === elapsedMs ? {} : { firstMs: first };
}

/** An answer as it is stored, which carries the question it was given to. */
export interface AnswerDoc extends Answer {
  questionIndex: number;
}

/**
 * The answers that count, out of everything sitting in the subcollection.
 *
 * **Extracted so it is written once.** It was in `useRoom` alone until the
 * terminal harness needed it too, and a second copy is exactly the shape of
 * mistake `roomStandings` was pulled out to prevent: this filter decides what
 * gets scored, so two versions of it would not look like a rendering bug — they
 * would score a live round differently on different clients.
 *
 * Two rules, and each closes something real:
 *
 * - **Only the question in play.** The subcollection holds one document per
 *   player and overwrites it each question, so a player who has not answered yet
 *   still has last question's answer sitting there. Scoring it again would
 *   credit them for a question they never touched.
 * - **Only people the room lists.** Nothing checks membership on the way in —
 *   the room code is the capability, as everywhere else — so a client can write
 *   an answer to a room it never joined. It no longer scores and no longer
 *   inflates the "how many have answered" pips.
 */
export function liveAnswers(
  players: Record<string, Player>,
  index: number,
  docs: Record<string, AnswerDoc>,
): Record<string, Answer> {
  const live: Record<string, Answer> = {};

  for (const [uid, answer] of Object.entries(docs)) {
    if (answer.questionIndex !== index) continue;
    if (!players[uid]) continue;
    // Rebuilt field by field on purpose, so a stray field on the document
    // cannot reach the reducer — which means a new one has to be added here
    // deliberately. `wager` and `firstMs` are spread conditionally rather than
    // written as `wager: answer.wager`, so an answer without one keeps the
    // exact shape the rounds before each of them produced.
    live[uid] = {
      optionIndex: answer.optionIndex,
      elapsedMs: answer.elapsedMs,
      ...(answer.firstMs === undefined ? {} : { firstMs: answer.firstMs }),
      ...(answer.wager === undefined ? {} : { wager: answer.wager }),
    };
  }

  return live;
}
