import { useCallback, useEffect, useState } from 'react';
import { LeagueBoard } from '../components/LeagueBoard';
import { RecoveryPanel } from '../components/RecoveryPanel';
import { SquadPanel } from '../components/SquadPanel';
import { playerIdFor } from '../lib/identity';
import { loadTable, type SeasonRow } from '../lib/season';

interface SeasonProps {
  youUid: string | null;
  onBack: () => void;
}

type Load = { state: 'loading' } | { state: 'ready'; rows: SeasonRow[] } | { state: 'error'; message: string };

export function Season({ youUid, onBack }: SeasonProps) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  const [reloads, setReloads] = useState(0);
  const [claimed, setClaimed] = useState<string | null>(null);

  /*
    Which row is yours is a question about the identity, not the browser. They
    are the same string until somebody claims a record with a recovery code, and
    the whole point of claiming is that afterwards they are not.

    Derived on every render rather than captured once. `playerIdFor` reads
    storage, which nothing re-renders on, so holding it in state alone would go
    stale — a screen mounted before auth landed would sit on `null` for as long
    as it was open and never highlight anybody's row. What a claim changes is
    passed straight back from the panel instead of being re-read.
  */
  const youPlayerId = youUid ? (claimed ?? playerIdFor(youUid)) : null;

  const onClaimed = useCallback((playerId: string) => {
    setClaimed(playerId);
    setReloads((n) => n + 1);
  }, []);

  // Shared with the squad panel, which changes a row this screen is showing.
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    loadTable()
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

  const youRow =
    load.state === 'ready' && youPlayerId
      ? load.rows.find((row) => row.playerId === youPlayerId)
      : undefined;

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
        <LeagueBoard rows={load.rows} youPlayerId={youPlayerId} />
      ) : null}

      {/*
        Only once there is a row to amend. The rules require `name`, `played`
        and the rest, so there is nothing to write for somebody who has not
        finished a round — and nothing to correct either.
      */}
      {load.state === 'ready' && youRow ? (
        <SquadPanel playerId={youRow.playerId} current={youRow.squad} onChanged={reload} />
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
