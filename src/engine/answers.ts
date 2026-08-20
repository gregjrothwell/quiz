import type { Answer, Player } from './state';

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
    live[uid] = { optionIndex: answer.optionIndex, elapsedMs: answer.elapsedMs };
  }

  return live;
}
