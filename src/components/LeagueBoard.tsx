import { useState } from 'react';
import { MIN_GAMES_TO_QUALIFY, averageFor, rankByAverage } from '../engine/table';
import { squadKey, squadsOf } from '../engine/squad';
import type { SeasonRow } from '../lib/season';

interface LeagueBoardProps {
  rows: SeasonRow[];
  /** Which row belongs to whoever is looking, or null before sign-in lands. */
  youPlayerId: string | null;
}

/** Nine columns, so a separator row has to span all of them. */
const COLUMNS = 9;

/**
 * The season table, and the league filter that sits on top of it.
 *
 * Split out from the screen so the gallery can render it on fixtures: `Season`
 * fetches, which is why it has never been in `#/preview`, and this is the half
 * with the layout worth checking.
 *
 * **The filter sits on top of the whole board rather than replacing it.** Most
 * rows carry no squad at all — every row written before squads existed, and
 * everybody who never picked one — so a squad-only view would hide most of the
 * season, and the office-wide table is what the board is currently for.
 *
 * **Ranked on the average, ordered by the query on points.** `loadTable` asks
 * Firestore for the top fifty by total, because an average cannot be ordered
 * server-side without storing it and storing it means a rules republish. The
 * re-sort here is therefore exact only while the board fits inside that fifty —
 * true today at twenty-odd rows, and worth knowing before the fifty-first
 * person joins.
 */
export function LeagueBoard({ rows, youPlayerId }: LeagueBoardProps) {
  const [squad, setSquad] = useState('');

  const squads = squadsOf(rows);
  // Compared on the key, so two spellings of one squad are one filter even
  // though each row still shows the spelling it was given.
  const shown = squad === '' ? rows : rows.filter((row) => squadKey(row.squad) === squadKey(squad));

  // Filtered first, then ranked, so a league's table reads 1, 2, 3 rather than
  // carrying the positions those rows held on the office-wide board.
  const { ranked, provisional } = rankByAverage(shown);

  const cells = (row: SeasonRow, position: string) => {
    const rosettes = row.fastest + row.comeback + row.loneWolf + row.contrarian;
    const yours = row.playerId === youPlayerId;

    return (
      <tr key={row.playerId} data-you={yours ? '' : undefined}>
        <td>{position}</td>
        <td>
          {row.name}
          {yours ? <span className="you">You</span> : null}
        </td>
        {/* Third, directly beside the name, because it is what the board is
            ordered on. It began as the last column, where it inherited the
            table's headline styling for free — and at 375px that put the
            ranking number off the right-hand edge, so the phone showed an order
            with no visible reason for it. The styling moved to the cell rather
            than the cell to the styling.

            Rounded to a whole number: scores run to five figures, so a decimal
            place is noise. The ordering uses the exact value, so two rows can
            show the same number with one above the other. */}
        <td className="season__ranked">{Math.round(averageFor(row)).toLocaleString('en-GB')}</td>
        {/* A dash rather than an empty cell, here and for the rosettes, because
            a blank reads as a rendering fault where a dash reads as "none". */}
        <td>{row.squad || '—'}</td>
        <td>{row.played}</td>
        <td>{row.wins}</td>
        <td>{row.best.toLocaleString('en-GB')}</td>
        <td>{rosettes > 0 ? rosettes : '—'}</td>
        <td>{row.points.toLocaleString('en-GB')}</td>
      </tr>
    );
  };

  return (
    <>
      {squads.length > 0 ? (
        <div className="league-filter" role="group" aria-label="Filter by squad">
          <button
            type="button"
            className={squad === '' ? 'filter-chip filter-chip--on' : 'filter-chip'}
            onClick={() => setSquad('')}
          >
            Everyone
          </button>
          {squads.map((name) => (
            <button
              key={name}
              type="button"
              className={squadKey(name) === squadKey(squad) ? 'filter-chip filter-chip--on' : 'filter-chip'}
              onClick={() => setSquad(name)}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p className="lede">Nobody in {squad} has finished a round yet.</p>
      ) : (
        <div className="season-wrap">
          <table className="season">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Position</span>
                </th>
                <th scope="col">Contender</th>
                <th scope="col">Average</th>
                <th scope="col">Squad</th>
                <th scope="col">Played</th>
                <th scope="col">Wins</th>
                <th scope="col">Best</th>
                <th scope="col">Rosettes</th>
                <th scope="col">Points</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row, index) => cells(row, String(index + 1)))}

              {/* Listed rather than hidden, and said in words rather than left
                  to be inferred from a gap: somebody two rounds short should be
                  able to see what they are two rounds short of. */}
              {provisional.length > 0 ? (
                <tr className="season__break">
                  <td colSpan={COLUMNS}>
                    {MIN_GAMES_TO_QUALIFY} rounds to qualify
                  </td>
                </tr>
              ) : null}

              {provisional.map((row) => cells(row, '—'))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
