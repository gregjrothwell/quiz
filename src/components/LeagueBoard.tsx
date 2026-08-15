import { useState } from 'react';
import { teamKey, teamsOf } from '../engine/team';
import type { SeasonRow } from '../lib/season';

interface LeagueBoardProps {
  rows: SeasonRow[];
  /** Which row belongs to whoever is looking, or null before sign-in lands. */
  youPlayerId: string | null;
}

/**
 * The season table, and the league filter that sits on top of it.
 *
 * Split out from the screen so the gallery can render it on fixtures: `Season`
 * fetches, which is why it has never been in `#/preview`, and this is the half
 * with the layout worth checking.
 *
 * **The filter sits on top of the whole board rather than replacing it.** Most
 * rows carry no team at all — every row written before leagues existed, and
 * everybody who leaves the box blank — so a team-only view would hide most of
 * the season, and the office-wide table is what the league is currently for.
 */
export function LeagueBoard({ rows, youPlayerId }: LeagueBoardProps) {
  const [team, setTeam] = useState('');

  const teams = teamsOf(rows);
  // Compared on the key, so "Engineering" and "engineering" are one league even
  // though each row still shows the spelling it was given.
  const shown = team === '' ? rows : rows.filter((row) => teamKey(row.team) === teamKey(team));

  return (
    <>
      {teams.length > 0 ? (
        <div className="league-filter" role="group" aria-label="Filter by team">
          <button
            type="button"
            className={team === '' ? 'chip chip--on' : 'chip'}
            onClick={() => setTeam('')}
          >
            Everyone
          </button>
          {teams.map((name) => (
            <button
              key={name}
              type="button"
              className={teamKey(name) === teamKey(team) ? 'chip chip--on' : 'chip'}
              onClick={() => setTeam(name)}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p className="lede">Nobody in {team} has finished a round yet.</p>
      ) : (
        <div className="season-wrap">
          <table className="season">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Position</span>
                </th>
                <th scope="col">Contender</th>
                <th scope="col">Team</th>
                <th scope="col">Played</th>
                <th scope="col">Wins</th>
                <th scope="col">Best</th>
                <th scope="col">Rosettes</th>
                <th scope="col">Points</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row, index) => {
                const rosettes = row.fastest + row.comeback + row.loneWolf + row.contrarian;
                const yours = row.playerId === youPlayerId;

                return (
                  <tr key={row.playerId} data-you={yours ? '' : undefined}>
                    <td>{index + 1}</td>
                    <td>
                      {row.name}
                      {yours ? <span className="you">You</span> : null}
                    </td>
                    {/* A dash rather than an empty cell, here and for the
                        rosettes, because a blank reads as a rendering fault
                        where a dash reads as "none". */}
                    <td>{row.team || '—'}</td>
                    <td>{row.played}</td>
                    <td>{row.wins}</td>
                    <td>{row.best.toLocaleString('en-GB')}</td>
                    <td>{rosettes > 0 ? rosettes : '—'}</td>
                    <td>{row.points.toLocaleString('en-GB')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
