import type { Highlight } from '../engine/awards';
import type { QuizQuestion } from '../engine/state';

interface ReviewProps {
  review: Highlight[];
  questions: QuizQuestion[];
}

/**
 * The wording, kept out of the engine for the same reason the awards' is — the
 * engine names a question by index and counts who it happened to, and rewording
 * the panel should never mean touching a tested rule.
 */
function describe(highlight: Highlight): { title: string; detail: string } {
  switch (highlight.id) {
    case 'stumper':
      return {
        title: 'The one that beat everybody',
        detail: `${highlight.attempts} answers, not one of them right.`,
      };
    case 'sweep':
      return {
        title: 'Nobody missed it',
        detail: `All ${highlight.attempts} of you had this one.`,
      };
  }
}

export function Review({ review, questions }: ReviewProps) {
  if (review.length === 0) return null;

  return (
    <section className="stack">
      <p className="eyebrow">The round itself</p>
      <ul className="review">
        {review.map((highlight) => {
          const question = questions[highlight.index];

          // A highlight whose question is not in the room any more has nothing
          // to show but a number, on the same principle as an award going with
          // its winner rather than staying pinned to nobody.
          if (!question) return null;

          const { title, detail } = describe(highlight);

          // Only worth saying for the question nobody got — on a clean sweep the
          // whole room has just demonstrated it knows the answer. Null while a
          // question is unrevealed, which on this screen it never is.
          const answer =
            highlight.id === 'stumper' && question.correctIndex !== null
              ? question.options[question.correctIndex]
              : undefined;

          return (
            <li className="review__item" key={highlight.id}>
              <p className="review__title">{title}</p>
              <p className="review__prompt">{question.prompt}</p>
              <p className="review__detail">
                {answer ? `The answer was ${answer}. ${detail}` : detail}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
