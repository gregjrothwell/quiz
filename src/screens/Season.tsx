import { useEffect, useState } from 'react';
import { loadSeason, type SeasonRow } from '../lib/season';

interface SeasonProps {
  youUid: string | null;
  onBack: () => void;
}

type Load = { state: 'loading' } | { state: 'ready'; rows: SeasonRow[] } | { state: 'error'; message: string };

export function Season({ youUid, onBack }: SeasonProps) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });

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
  }, []);

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
                <th scope="col">Points</th>
              </tr>
            </thead>
            <tbody>
              {load.rows.map((row, index) => (
                <tr key={row.uid} data-you={row.uid === youUid ? '' : undefined}>
                  <td>{index + 1}</td>
                  <td>
                    {row.name}
                    {row.uid === youUid ? <span className="you">This device</span> : null}
                  </td>
                  <td>{row.played}</td>
                  <td>{row.wins}</td>
                  <td>{row.best.toLocaleString('en-GB')}</td>
                  <td>{row.points.toLocaleString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Standings follow the browser, not the person — there is no sign-up. A new laptop, cleared
        site data or a private window starts a fresh record.
      </p>
    </>
  );
}
