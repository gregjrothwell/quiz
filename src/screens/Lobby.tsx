import { useState } from 'react';
import { LEVELS, resolveQuizmaster, type Level, type RoomState } from '../engine/state';
import type { PackId, PackSummary } from '../questions/types';

const ROUND_LENGTHS = [10, 15, 20, 25] as const;

const LEVEL_META: Record<Level, { title: string; blurb: string }> = {
  mixed: { title: 'As it comes', blurb: 'Whatever the pack deals' },
  easy: { title: 'Gentle', blurb: 'Warm-up questions' },
  medium: { title: 'Standard', blurb: 'The house level' },
  hard: { title: 'Fiendish', blurb: 'For the specialists' },
  ramp: { title: 'The Ladder', blurb: 'Builds across the round' },
};

/**
 * How many questions a pack can supply at a given level. `mixed` and `ramp`
 * draw on everything; a flat level is capped by its own bucket, which is what
 * stops "Fiendish, 20" quietly turning into a six-question round.
 */
export function availableFor(pack: PackSummary, level: Level): number {
  if (level === 'mixed' || level === 'ramp') return pack.count;
  return pack.counts[level];
}

interface LobbyProps {
  room: RoomState;
  youUid: string | null;
  isQuizmaster: boolean;
  packs: PackSummary[];
  busy: boolean;
  onStart: (packId: PackId, count: number, level: Level) => void;
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
  const [level, setLevel] = useState<Level>('ramp');

  const quizmasterUid = resolveQuizmaster(room.players);
  const quizmasterName = quizmasterUid ? room.players[quizmasterUid]?.name : undefined;
  const playerEntries = Object.entries(room.players).sort(
    ([, a], [, b]) => a.joinedAt - b.joinedAt,
  );
  const selected = packs.find((pack) => pack.id === packId);
  const available = selected ? availableFor(selected, level) : 0;
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
            <p className="eyebrow">Set the level</p>
            <div className="picker">
              {LEVELS.map((option) => {
                const supply = selected ? availableFor(selected, option) : null;
                const meta = LEVEL_META[option];
                return (
                  <button
                    type="button"
                    key={option}
                    className="pick"
                    aria-pressed={option === level}
                    disabled={supply === 0}
                    onClick={() => setLevel(option)}
                  >
                    <b>{meta.title}</b>
                    <span>{meta.blurb}</span>
                    {supply === null ? null : (
                      <i>
                        {supply < count
                          ? `${supply} — short of ${count}`
                          : `${supply.toLocaleString('en-GB')} available`}
                      </i>
                    )}
                  </button>
                );
              })}
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
                {selected.title} has {available} at this level, so the round will be{' '}
                {effectiveCount}.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            className="btn btn--primary"
            disabled={!packId || busy || playerEntries.length === 0 || effectiveCount === 0}
            onClick={() => packId && onStart(packId, effectiveCount, level)}
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
