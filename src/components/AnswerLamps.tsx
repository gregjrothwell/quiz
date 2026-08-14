import type { Answer, Player } from '../engine/state';

interface AnswerLampsProps {
  players: Record<string, Player>;
  answers: Record<string, Answer>;
  youUid: string | null;
}

/**
 * Who the room is still waiting on.
 *
 * Named, not anonymous — and that is a change of mind rather than an oversight
 * corrected. The row used to be a strip of identical dots, on the grounds that
 * watching the room commit is most of the tension in a live round. It is, but a
 * dot cannot be chased. The quizmaster's actual question is "who are we waiting
 * for", and counting lit circles does not answer it.
 *
 * What must not leak is *which lectern* somebody picked, and that is untouched:
 * this says a name has answered, never what they answered. Both sides of it are
 * already on every device — the answers subcollection is streamed to everyone —
 * so nothing here costs a read.
 *
 * Ordered by arrival in the room and never by answer state, so a name keeps its
 * place all question. Sorting the answered to the front would make the row
 * reshuffle under the eye of the person trying to read it.
 */
export function AnswerLamps({ players, answers, youUid }: AnswerLampsProps) {
  const seats = Object.entries(players).sort(
    ([aUid, a], [bUid, b]) => a.joinedAt - b.joinedAt || aUid.localeCompare(bUid),
  );

  const answered = seats.filter(([uid]) => answers[uid]).length;

  return (
    <div className="lamps">
      <span className="sr-only">
        {answered} of {seats.length} answered
      </span>
      {seats.map(([uid, player]) => {
        const classes = [
          'lamp',
          answers[uid] ? 'lamp--in' : '',
          uid === youUid ? 'lamp--you' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <span className={classes} key={uid} aria-hidden="true">
            {player.name}
          </span>
        );
      })}
    </div>
  );
}
