import { useCallback, useEffect, useState } from 'react';
import { squadKey } from '../engine/squad';
import { invalidateSeason, loadTable, type SeasonRow } from '../lib/season';

interface WeekBoardProps {
  /** Which week to read, as a season id — see `src/engine/week.ts`. */
  bucket: string;
  /**
   * The squad to show, which is the one you played *for* tonight. Empty shows
   * everybody who played this week, which is what somebody with no squad wants
   * and is also the honest answer for a room that has not picked sides.
   */
  squad: string;
  /**
   * Whether this device has finished banking its own game.
   *
   * The board is not read until it has. Every device banks its own row, so
   * loading any earlier reliably shows a table with you missing from it — which
   * reads as a bug rather than as a race.
   */
  ready: boolean;
  /** Which row is yours, so it can be picked out of the list. */
  youPlayerId: string | null;
  /**
   * What an empty week should look like.
   *
   * `hide` on the final screen, where this sits under a podium and absence
   * reads as "not yet". `say` on the season screen, where it is the whole
   * content and silence reads as a screen that failed to load — which is
   * exactly how it read the first time it was tried on a Monday.
   */
  whenEmpty?: 'hide' | 'say';
}

type Load =
  | { state: 'idle' }
  | { state: 'ready'; rows: SeasonRow[] }
  | { state: 'error'; message: string };

/**
 * This week's table, on the screen where the week just happened.
 *
 * **Ranked on points, unlike the season board.** A week is one round, or two at
 * most, and an average over that says nothing a total does not — the qualifying
 * floor the season needs would put everybody below the line on the night they
 * played. So this is the one place the query's own `orderBy('points')` is
 * already the order wanted, and nothing is re-sorted.
 *
 * Costs one read per row, once, on a table holding only the people who played
 * this week — six or so, against fifty on the season board. It shares
 * `loadTable`'s minute-long cache, so bouncing between here and the season
 * screen pays for each once.
 */
export function WeekBoard({
  bucket,
  squad,
  ready,
  youPlayerId,
  whenEmpty = 'hide',
}: WeekBoardProps) {
  const [load, setLoad] = useState<Load>({ state: 'idle' });
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    /*
      No `loading` state to set on the way in, which `react-hooks/set-state-in-effect`
      would reject and which nothing here wants anyway: before the first load
      this renders nothing, and on a refresh the rows already on screen stay put
      until the new ones arrive. Blanking the table for a round trip to say
      "loading" would be a flicker in place of information.
    */
    loadTable(bucket)
      .then((rows) => {
        if (!cancelled) setLoad({ state: 'ready', rows });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setLoad({
          state: 'error',
          message: cause instanceof Error ? cause.message : 'Could not read this week',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [bucket, ready, reloads]);

  /*
    Everybody banks their own row, and they do not all land at once. Somebody
    who finished a second after this loaded is simply not on it yet, and the
    cache would hold that stale answer for a minute — so the refresh drops the
    cached table rather than only re-rendering it.
  */
  const refresh = useCallback(() => {
    invalidateSeason();
    setReloads((n) => n + 1);
  }, []);

  if (!ready || load.state === 'idle') return null;

  if (load.state === 'error') {
    return (
      <section className="recovery">
        <p className="eyebrow">This week</p>
        <p className="notice">{load.message}</p>
      </section>
    );
  }

  return (
    <WeekTable
      rows={load.rows}
      squad={squad}
      youPlayerId={youPlayerId}
      onRefresh={refresh}
      whenEmpty={whenEmpty}
    />
  );
}

interface WeekTableProps {
  rows: SeasonRow[];
  squad: string;
  youPlayerId: string | null;
  onRefresh: () => void;
  whenEmpty?: 'hide' | 'say';
}

/**
 * The week's table itself, with no idea where its rows came from.
 *
 * Split out for the same reason `LeagueBoard` is split from `Season`: the
 * fetching half cannot be put in `#/preview`, and this is the half with layout
 * worth checking.
 */
export function WeekTable({
  rows,
  squad,
  youPlayerId,
  onRefresh,
  whenEmpty = 'hide',
}: WeekTableProps) {
  const shown = squad ? rows.filter((row) => squadKey(row.squad) === squadKey(squad)) : rows;

  if (shown.length === 0) {
    if (whenEmpty === 'hide') return null;

    return (
      <section className="recovery">
        <p className="eyebrow">{squad ? `${squad} this week` : 'This week'}</p>
        <p className="lede">
          {squad
            ? `Nobody in ${squad} has played yet this week.`
            : 'Nobody has played yet this week. It resets every Monday.'}
        </p>
      </section>
    );
  }

  return (
    <section className="recovery">
      <p className="eyebrow">{squad ? `${squad} this week` : 'This week'}</p>

      <div className="season-wrap">
        <table className="season">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Position</span>
              </th>
              <th scope="col">Contender</th>
              <th scope="col">Played</th>
              <th scope="col">Points</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row, index) => (
              <tr key={row.playerId} data-you={row.playerId === youPlayerId ? '' : undefined}>
                <td>{index + 1}</td>
                <td>
                  {row.name}
                  {row.playerId === youPlayerId ? <span className="you">You</span> : null}
                </td>
                <td>{row.played}</td>
                <td className="season__ranked">{row.points.toLocaleString('en-GB')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" className="btn btn--ghost" onClick={onRefresh}>
        Refresh
      </button>
    </section>
  );
}
