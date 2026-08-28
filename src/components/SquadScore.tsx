import { squadStandings } from '../engine/squadScore';
import type { Player } from '../engine/state';

interface SquadScoreProps {
  players: Record<string, Player>;
  scores: Record<string, number>;
}

/**
 * Hermes against Bundae, while the round is still running.
 *
 * **Hidden below two squads, deliberately.** One side on its own is a bar
 * saying "Hermes: all of it", which is worse than nothing — it takes room from
 * the standings to state something everybody can already see. A room where
 * nobody has named a squad shows nothing at all.
 *
 * The bar is proportional to the round so far, so overtaking is something you
 * watch rather than infer — the same reasoning behind the standings animating
 * between positions. No motion of its own: it sits under a table that is
 * already moving, and two things sliding at once is noise.
 */
export function SquadScore({ players, scores }: SquadScoreProps) {
  const rows = squadStandings(players, scores);
  if (rows.length < 2) return null;

  const total = rows.reduce((sum, row) => sum + row.score, 0);
  const lead = rows[0];
  const second = rows[1];
  // A round nobody has scored in yet splits the bar evenly rather than dividing
  // by zero — every side is level, which is exactly what it should look like.
  const share = (score: number): string =>
    total > 0 ? `${(score / total) * 100}%` : `${100 / rows.length}%`;

  return (
    <section className="squads" aria-label="Squad scores">
      <div className="squads__bar">
        {rows.map((row, order) => (
          <div
            key={row.squad}
            className={order === 0 ? 'squads__seg squads__seg--lead' : 'squads__seg'}
            style={{ width: share(row.score) }}
          />
        ))}
      </div>

      <ul className="squads__keys">
        {rows.map((row, order) => (
          <li className="squads__key" key={row.squad}>
            <span
              className={order === 0 ? 'squads__dot squads__dot--lead' : 'squads__dot'}
              aria-hidden="true"
            />
            <span className="squads__name">{row.squad}</span>
            <span className="squads__count">{row.players}</span>
            <span className="squads__score">{row.score.toLocaleString('en-GB')}</span>
          </li>
        ))}
      </ul>

      {/*
        Said in words as well as drawn, because the bar alone is not readable by
        somebody using a screen reader and "who is winning" is the entire point
        of the thing. Level is called level rather than given to whoever sorts
        first.
      */}
      <p className="squads__line">
        {lead && second && lead.score === second.score
          ? `Level on ${lead.score.toLocaleString('en-GB')}`
          : lead && second
            ? `${lead.squad} lead by ${(lead.score - second.score).toLocaleString('en-GB')}`
            : null}
      </p>
    </section>
  );
}
