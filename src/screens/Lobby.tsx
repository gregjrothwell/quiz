import { useState } from 'react';
import { resolveQuizmaster, type RoomState } from '../engine/state';
import type { PackId } from '../questions/types';
import type { PackSummary } from '../lib/usePacks';

const ROUND_LENGTHS = [10, 15, 20, 25] as const;

interface LobbyProps {
  room: RoomState;
  youUid: string | null;
  isQuizmaster: boolean;
  packs: PackSummary[];
  busy: boolean;
  onStart: (packId: PackId, count: number) => void;
  onLeave: () => void;
}

export function Lobby({
  room,
  youUid,
  isQuizmaster,
  packs,
  busy,
  onStart,
  onLeave,
}: LobbyProps) {
  const [packId, setPackId] = useState<PackId | null>(null);
  const [count, setCount] = useState<number>(15);

  const quizmasterUid = resolveQuizmaster(room.players);
  const quizmasterName = quizmasterUid ? room.players[quizmasterUid]?.name : undefined;
  const playerEntries = Object.entries(room.players).sort(
    ([, a], [, b]) => a.joinedAt - b.joinedAt,
  );
  const selected = packs.find((pack) => pack.id === packId);
  const available = selected?.count ?? 0;
  const effectiveCount = Math.min(count, available);

  return (
    <>
      <header className="row row--between">
        <div>
          <p className="eyebrow">Room code</p>
          <div className="roomcode" aria-label={`Room code ${room.code}`}>
            {[...room.code].map((character, position) => (
              <span className="roomcode__char" key={`${character}-${position}`} aria-hidden="true">
                {character}
              </span>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn--ghost" onClick={onLeave}>
          Leave
        </button>
      </header>

      <section className="stack">
        <p className="eyebrow">In the room · {playerEntries.length}</p>
        <ul className="plates">
          {playerEntries.map(([uid, player]) => (
            <li className={uid === quizmasterUid ? 'plate plate--host' : 'plate'} key={uid}>
              <span className="plate__name">{player.name}</span>
              {uid === quizmasterUid ? <span className="plate__role">quizmaster</span> : null}
              {uid === youUid ? <span className="plate__role">you</span> : null}
            </li>
          ))}
        </ul>
      </section>

      {isQuizmaster ? (
        <section className="stack stack--loose">
          <div className="stack">
            <p className="eyebrow">Choose a set</p>
            <div className="packs">
              {packs.map((pack) => (
                <button
                  type="button"
                  key={pack.id}
                  className="pack"
                  aria-pressed={pack.id === packId}
                  onClick={() => setPackId(pack.id)}
                >
                  <span className="pack__title">{pack.title}</span>
                  <span className="pack__blurb">{pack.blurb}</span>
                  <span className="pack__count">{pack.count.toLocaleString('en-GB')} questions</span>
                </button>
              ))}
            </div>
          </div>

          <div className="stack">
            <p className="eyebrow">Questions this round</p>
            <div className="btn-row">
              {ROUND_LENGTHS.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={option === count ? 'btn' : 'btn btn--ghost'}
                  onClick={() => setCount(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            {selected && available < count ? (
              <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                {selected.title} only has {available} questions, so this round will be{' '}
                {effectiveCount}.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            className="btn btn--primary"
            disabled={!packId || busy || playerEntries.length === 0}
            onClick={() => packId && onStart(packId, effectiveCount)}
          >
            {busy ? 'Loading questions…' : 'Start the show'}
          </button>
        </section>
      ) : (
        <p className="lede centre">
          Waiting for {quizmasterName ?? 'the quizmaster'} to choose a set and start the round.
        </p>
      )}
    </>
  );
}
