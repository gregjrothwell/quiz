import type { Player } from '../engine/state';

interface AnswerLampsProps {
  players: Record<string, Player>;
  /** Who has answered, as uids. See `lamps` in useRoom. */
  lit: ReadonlySet<string>;
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
 * this says a name has answered, never what they answered. Since W3 the answers
 * themselves are the host's alone, so who has answered comes from the lamps on
 * the Realtime Database, which cost no Firestore read at all.
 *
 * Ordered by arrival in the room and never by answer state, so a name keeps its
 * place all question. Sorting the answered to the front would make the row
 * reshuffle under the eye of the person trying to read it.
 */
export function AnswerLamps({ players, lit, youUid }: AnswerLampsProps) {
  const seats = Object.entries(players).sort(
    ([aUid, a], [bUid, b]) => a.joinedAt - b.joinedAt || aUid.localeCompare(bUid),
  );

  const answered = seats.filter(([uid]) => lit.has(uid)).length;

  return (
    <div className="lamps">
      <span className="sr-only">
        {answered} of {seats.length} answered
      </span>
      {seats.map(([uid, player]) => {
        const classes = [
          'lamp',
          lit.has(uid) ? 'lamp--in' : '',
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
