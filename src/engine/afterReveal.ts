import { finalistsAfterLast } from './double';
import { currentQuestion, type RoomState } from './state';
import { isTell } from './survey';

/**
 * Where one press of Next goes from a reveal (PROJ-182,
 * docs/decisions/reveal-line.md).
 *
 * The full table used to follow every question, fifteen times in a seven-minute
 * round. It now comes at the breaks: every fifth question, before a final, and
 * at the end. In between, each player has their own line on the reveal
 * (`ownLine.ts`) and one press opens the next question.
 *
 * The reducer and every button naming the next step read this one answer, so a
 * button cannot say something the reducer will not do.
 */

/** The table comes round after every fifth question (Greg, 25 November 2026). */
export const TABLE_EVERY = 5;

export type AfterReveal = 'question' | 'table' | 'results';

export function afterReveal(room: RoomState): AfterReveal {
  /*
    The last question goes straight to the results unless a final follows. A
    full table with the winner on top, one press before the drum roll, left the
    podium nothing to reveal. docs/decisions/round-end.md. Before a final the
    table stays: it is who is about to play, and for how much.
  */
  if (room.index + 1 >= room.questions.length) return finalistsAfterLast(room) ? 'table' : 'results';
  // Survey Says asks five tells and then five guesses, so its fifth question has
  // scored nobody and its table would be a column of noughts.
  const question = currentQuestion(room);
  if (question && isTell(question)) return 'question';
  return (room.index + 1) % TABLE_EVERY === 0 ? 'table' : 'question';
}
