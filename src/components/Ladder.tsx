import type { QuizQuestion } from '../engine/state';

const SHORT_LEVEL: Record<QuizQuestion['difficulty'], string> = {
  easy: 'Easy',
  medium: 'Med',
  hard: 'Hard',
};

interface LadderProps {
  questions: readonly QuizQuestion[];
  current: number;
}

/**
 * Where you are in the round, as a climbing ladder of rungs.
 *
 * Each rung carries its question's level, so a ramped round visibly gets
 * steeper as you go — the shape of the round is the interesting thing here, and
 * it is already in the room. Showing per-question scores instead would mean
 * accumulating a history no device other than yours has, for a number the
 * standings screen shows two seconds later anyway.
 *
 * Rendered in ascending order and flipped with `column-reverse` on wide
 * screens, so question one sits at the bottom and the round builds upwards.
 * Doing it that way rather than reversing the array keeps the DOM in reading
 * order for a screen reader.
 */
export function Ladder({ questions, current }: LadderProps) {
  return (
    <div>
      <p className="ladder__cap">The ladder</p>
      <ol className="ladder">
        {questions.map((question, index) => {
          const state =
            index === current ? 'rung rung--live' : index < current ? 'rung rung--done' : 'rung';

          return (
            <li className={state} key={question.id}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <span className="rung__score">
                {index === current ? 'Live' : SHORT_LEVEL[question.difficulty]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
