import { useState } from 'react';
import { QrCode } from '../components/QrCode';
import { RoomLink } from '../components/RoomLink';
import { joinLink } from '../engine/roomCode';
import {
  DEFAULT_DURATION_SECS,
  DURATION_CHOICES,
  LEVELS,
  resolveQuizmaster,
  type Level,
  type RoomState,
} from '../engine/state';
import type { PackId, PackSummary } from '../questions/types';

const ROUND_LENGTHS = [10, 15, 20, 25] as const;

/**
 * Why the window is worth choosing rather than fixing: the vault cannot open
 * before it closes, so a round everybody answers in five seconds still costs the
 * full window on every question.
 */
// Named as a ladder up from the default rather than around a middle, because
// ten is now both the default and the shortest — the picker only ever buys a
// round more time. Deliberately avoids "Standard", which is the level picker's
// middle option and sits directly above this one: two adjacent tiles reading
// the same word, lit differently, is a way to pick the wrong thing.
const DURATION_META: Record<number, { title: string; blurb: string }> = {
  10: { title: 'Brisk', blurb: 'The house pace' },
  15: { title: 'Steady', blurb: 'A beat to think' },
  20: { title: 'Generous', blurb: 'For a harder set' },
};

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
  /**
   * Whether a link put this device in the room without asking anything.
   *
   * The landing screen carries a line reading "change it if you aren't Greg",
   * and it is there for the borrowed laptop — where the remembered name belongs
   * to whoever played on it last. Somebody who came straight in never saw it, so
   * the check has to happen here instead.
   */
  autoJoined?: boolean;
  /** Only shown, and only alongside {@link autoJoined}. */
  squad?: string;
  onStart: (packId: PackId, count: number, level: Level, durationSecs: number) => void;
  onLeave: () => void;
}

export function Lobby({
  room,
  youUid,
  isQuizmaster,
  packs,
  busy,
  autoJoined = false,
  squad = '',
  onStart,
  onLeave,
}: LobbyProps) {
  const [packId, setPackId] = useState<PackId | null>(null);
  const [count, setCount] = useState<number>(15);
  const [level, setLevel] = useState<Level>('ramp');
  const [durationSecs, setDurationSecs] = useState<number>(DEFAULT_DURATION_SECS);

  const youName = youUid ? room.players[youUid]?.name : undefined;
  const quizmasterUid = resolveQuizmaster(room.players);
  const quizmasterName = quizmasterUid ? room.players[quizmasterUid]?.name : undefined;
  const playerEntries = Object.entries(room.players).sort(
    ([, a], [, b]) => a.joinedAt - b.joinedAt,
  );
  const selected = packs.find((pack) => pack.id === packId);
  const available = selected ? availableFor(selected, level) : 0;
  const effectiveCount = Math.min(count, available);
  const link = joinLink(window.location.origin, import.meta.env.BASE_URL, room.code);

  return (
    <>
      <header className="row row--between">
        <div className="entry">
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

          {/*
            The same link the copy button hands out, for a second device that
            isn't in the chat — someone playing on their phone while the call is
            on their laptop. It stays because it costs nothing, but it is the
            third-choice route now, behind the link and the spoken code.
          */}
          <div className="entry__qr">
            <QrCode value={link} label={`Join room ${room.code}`} />
            <p className="entry__hint">Or point a phone at this</p>
          </div>
        </div>

        <button type="button" className="btn btn--ghost" onClick={onLeave}>
          Leave
        </button>
      </header>

      <RoomLink link={link} />

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

        {/*
          Only for somebody a link brought in. For anybody else it is noise —
          they typed the name themselves a moment ago, and the landing screen
          already asked them about it.

          The squad is named as well as the name, because it is the other thing
          that goes wrong silently: it is read off this browser at the whistle,
          not chosen here, so an inherited one banks a stranger's week without
          ever appearing on screen.
        */}
        {autoJoined && youName ? (
          <div className="stack">
            <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
              The link brought you straight in as <strong>{youName}</strong>
              {squad ? <>, playing for {squad}</> : null}.
            </p>
            <div className="btn-row">
              <button type="button" className="btn btn--ghost" onClick={onLeave}>
                Not you? Start again
              </button>
            </div>
          </div>
        ) : null}
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
            <p className="eyebrow">Time to answer</p>
            <div className="picker">
              {DURATION_CHOICES.map((option) => {
                const meta = DURATION_META[option];
                return (
                  <button
                    type="button"
                    key={option}
                    className="pick"
                    aria-pressed={option === durationSecs}
                    onClick={() => setDurationSecs(option)}
                  >
                    <b>{meta?.title ?? `${option}s`}</b>
                    <span>{meta?.blurb}</span>
                    <i>{option} seconds</i>
                  </button>
                );
              })}
            </div>
            {/*
              Worth saying, because it is the one thing about this game that
              surprises people who have played Polly: nobody can cut a question
              short, including the quizmaster. The answer is not on any device
              until the window has closed. See docs/decisions/answer-window.md.
            */}
            <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
              Every question runs the full {durationSecs} seconds — the answer is locked away
              until then, so it can&rsquo;t be revealed early.
            </p>
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
            onClick={() => packId && onStart(packId, effectiveCount, level, durationSecs)}
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
