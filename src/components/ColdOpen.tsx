import type { FormFact } from '../engine/form';
import type { Player } from '../engine/state';

interface ColdOpenProps {
  facts: FormFact[];
  players: Record<string, Player>;
  isQuizmaster: boolean;
  onStart: () => void;
  onBack: () => void;
}

/**
 * The wording, kept out of the engine for the same reason the awards' and the
 * review's are: this is the most tempting place in the app to bake copy into a
 * tested rule, and the worst place to have done it, because on a title card the
 * wording *is* the feature.
 */
function describe(fact: FormFact, names: string): { label: string; line: string } {
  switch (fact.id) {
    case 'champion':
      return {
        label: 'Defending champion',
        line: `${names} — ${fact.wins} ${fact.wins === 1 ? 'win' : 'wins'} this season`,
      };
    case 'best':
      return {
        label: 'Best round of the season',
        line: `${names} — ${fact.points.toLocaleString('en-GB')}`,
      };
    case 'rosettes':
      return {
        label: 'Most rosettes',
        line: `${names} — ${fact.count} so far`,
      };
    case 'newcomers':
      return {
        label: fact.uids.length === 1 ? 'First round' : 'First round for',
        line: names,
      };
  }
}

/**
 * The opening titles: who the season already knows about, before question one.
 *
 * Shown in the lobby, which is not where a title card obviously belongs until
 * you notice the alternative. The answering window is stamped by the server the
 * moment a question opens, so anything laid over question one comes straight out
 * of the room's thinking time — the same reasoning that puts the round title
 * card on the standings screen rather than over the question.
 */
export function ColdOpen({ facts, players, isQuizmaster, onStart, onBack }: ColdOpenProps) {
  const named = facts
    .map((fact) => {
      const names = fact.uids
        .map((uid) => players[uid]?.name)
        .filter((name): name is string => Boolean(name));

      // A fact about somebody who has since left the room is not a fact about
      // this room any more, the same principle as an award going with its winner.
      return names.length > 0 ? { fact, names: names.join(' & ') } : null;
    })
    .filter((entry): entry is { fact: FormFact; names: string } => entry !== null);

  if (named.length === 0) return null;

  return (
    <section className="cold-open">
      <p className="eyebrow">Tonight’s field</p>
      <ul className="cold-open__list">
        {named.map(({ fact, names }, index) => {
          const { label, line } = describe(fact, names);

          return (
            <li
              className="cold-open__fact"
              key={fact.id}
              // Staggered in the cascade rather than with JS, because a delayed
              // `motion` animation does not fire under StrictMode's double mount
              // and leaves the content permanently invisible. `backwards`, never
              // `both`: `both` keeps the final keyframe above normal
              // declarations and silently beats every state a tile changes into.
              style={{ animationDelay: `${index * 260}ms` }}
            >
              <p className="cold-open__label">{label}</p>
              <p className="cold-open__line">{line}</p>
            </li>
          );
        })}
      </ul>

      {/*
        The card waits here. Nothing starts the round but this button, so the
        quizmaster keeps the moment the quiz begins — which is exactly what an
        auto-start took away: time to let the room read the card, and to ask
        whether everyone is ready.
      */}
      {isQuizmaster ? (
        <div className="btn-row">
          <button type="button" className="btn btn--primary" onClick={onStart}>
            Start the round
          </button>
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            Back
          </button>
        </div>
      ) : (
        <p className="muted">Waiting for the quizmaster to start the round…</p>
      )}
    </section>
  );
}
