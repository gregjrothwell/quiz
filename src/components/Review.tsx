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
function optionNames(question: QuizQuestion, indexes: readonly number[]): string[] {
  return indexes
    .map((index) => question.options[index])
    .filter((option): option is string => typeof option === 'string' && option.length > 0);
}

/** "Alpha", "Alpha and Beta", "Alpha, Beta and Gamma". */
function listed(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  const last = names[names.length - 1] ?? '';
  if (names.length === 2) return `${names[0]} and ${last}`;
  return `${names.slice(0, -1).join(', ')} and ${last}`;
}

/**
 * The answer a stumper card quotes.
 *
 * An ordinary question has one. A Survey Says guess can tie, and every tied
 * option was right — `correctIndex` is only the lowest of them, so quoting
 * that one would leave another right answer off the card.
 */
function missedIndexes(question: QuizQuestion): readonly number[] {
  const tied = question.survey?.top;
  if (tied && tied.length > 0) return tied;
  if (question.correctIndex === null) return [];
  return [question.correctIndex];
}

function missedClause(question: QuizQuestion): string | undefined {
  const names = optionNames(question, missedIndexes(question));
  if (names.length === 0) return undefined;
  if (names.length === 1) return `The answer was ${names[0]}.`;
  return `The answers were ${listed(names)}.`;
}

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
          // whole room has just demonstrated it knows the answer. Absent while a
          // question is unrevealed, which on this screen it never is.
          const missed = highlight.id === 'stumper' ? missedClause(question) : undefined;

          return (
            <li className="review__item" key={highlight.id}>
              <p className="review__title">{title}</p>
              <p className="review__prompt">{question.prompt}</p>
              <p className="review__detail">{missed ? `${missed} ${detail}` : detail}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
