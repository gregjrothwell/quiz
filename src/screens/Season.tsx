import { useCallback, useEffect, useState } from 'react';
import { RecoveryPanel } from '../components/RecoveryPanel';
import { playerIdFor } from '../lib/identity';
import { loadSeason, type SeasonRow } from '../lib/season';

interface SeasonProps {
  youUid: string | null;
  onBack: () => void;
}

type Load = { state: 'loading' } | { state: 'ready'; rows: SeasonRow[] } | { state: 'error'; message: string };

export function Season({ youUid, onBack }: SeasonProps) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  /*
    Which row is yours is a question about the identity, not the browser. They
    are the same string until somebody claims a record with a recovery code, and
    the whole point of claiming is that afterwards they are not.
  */
  const [youPlayerId, setYouPlayerId] = useState(() => (youUid ? playerIdFor(youUid) : null));
  const [reloads, setReloads] = useState(0);

  const onClaimed = useCallback(() => {
    if (youUid) setYouPlayerId(playerIdFor(youUid));
    setReloads((n) => n + 1);
  }, [youUid]);

  useEffect(() => {
    let cancelled = false;

    loadSeason()
      .then((rows) => {
        if (!cancelled) setLoad({ state: 'ready', rows });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setLoad({
          state: 'error',
          message: cause instanceof Error ? cause.message : 'Could not load the season table',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [reloads]);

  return (
    <>
      <header className="row row--between">
        <div>
          <p className="eyebrow">The season</p>
          <h1 className="display" style={{ fontSize: 'clamp(2rem, 7vw, 3.4rem)' }}>
            Standings
          </h1>
        </div>
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Back
        </button>
      </header>

      {load.state === 'loading' ? <p className="lede">Reading the board…</p> : null}
      {load.state === 'error' ? <p className="notice">{load.message}</p> : null}

      {load.state === 'ready' && load.rows.length === 0 ? (
        <p className="lede">
          Nothing on the board yet. Season standings start filling up once a round finishes.
        </p>
      ) : null}

      {load.state === 'ready' && load.rows.length > 0 ? (
        <div className="season-wrap">
          <table className="season">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Position</span>
                </th>
                <th scope="col">Contender</th>
                <th scope="col">Played</th>
                <th scope="col">Wins</th>
                <th scope="col">Best</th>
                <th scope="col">Rosettes</th>
                <th scope="col">Points</th>
              </tr>
            </thead>
            <tbody>
              {load.rows.map((row, index) => {
                const rosettes = row.fastest + row.comeback + row.loneWolf + row.contrarian;
                const yours = row.playerId === youPlayerId;

                return (
                  <tr key={row.playerId} data-you={yours ? '' : undefined}>
                    <td>{index + 1}</td>
                    <td>
                      {row.name}
                      {yours ? <span className="you">You</span> : null}
                    </td>
                    <td>{row.played}</td>
                    <td>{row.wins}</td>
                    <td>{row.best.toLocaleString('en-GB')}</td>
                    {/* A dash rather than a nought: most rows predate honours
                        entirely, and a column of zeroes reads as a season of
                        failure rather than a column with no history behind it. */}
                    <td>{rosettes > 0 ? rosettes : '—'}</td>
                    <td>{row.points.toLocaleString('en-GB')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {youUid ? <RecoveryPanel uid={youUid} onClaimed={onClaimed} /> : null}

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        There is no sign-up, so a record starts out belonging to one browser — a new laptop,
        cleared site data or a private window begins a fresh one. A recovery code is how it
        moves.
      </p>
    </>
  );
}
