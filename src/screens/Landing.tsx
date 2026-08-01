import { useState } from 'react';
import { isValidRoomCode, normaliseRoomCode, ROOM_CODE_LENGTH } from '../engine/roomCode';

interface LandingProps {
  busy: boolean;
  error: string | null;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onSeason: () => void;
}

export function Landing({ busy, error, onCreate, onJoin, onSeason }: LandingProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const trimmedName = name.trim();
  const canCreate = trimmedName.length > 0 && !busy;
  const canJoin = canCreate && isValidRoomCode(code);

  return (
    <>
      <header>
        <p className="eyebrow">Tonight, on your device</p>
        <div className="chrome-wrap">
          <h1 className="wordmark chrome">
            The
            <br />
            Round
          </h1>
        </div>
        <hr className="wordmark__rule" />
      </header>

      <p className="lede">
        One quizmaster, everyone else on their phones. Whoever creates the room runs the show —
        pick a set, start the clock, and the fastest correct answer takes the points.
      </p>

      <div className="split split--two">
        <section className="panel stack">
          <h2 className="display" style={{ fontSize: '1.6rem' }}>
            Your name
          </h2>
          <label className="field">
            <span className="field__label">Shown on the leaderboard</span>
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Greg"
              maxLength={24}
              autoComplete="given-name"
            />
          </label>

          <button
            type="button"
            className="btn btn--primary"
            disabled={!canCreate}
            onClick={() => onCreate(trimmedName)}
          >
            Start a new room
          </button>
          <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
            You&rsquo;ll be the quizmaster.
          </p>
        </section>

        <section className="panel stack">
          <h2 className="display" style={{ fontSize: '1.6rem' }}>
            Join a room
          </h2>
          <label className="field">
            <span className="field__label">{ROOM_CODE_LENGTH}-character code</span>
            <input
              className="input input--code"
              value={code}
              onChange={(event) => setCode(normaliseRoomCode(event.target.value))}
              placeholder="––––"
              maxLength={ROOM_CODE_LENGTH}
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby="code-hint"
            />
          </label>
          <p id="code-hint" className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
            Ask the quizmaster to read it out.
          </p>

          <button
            type="button"
            className="btn"
            disabled={!canJoin}
            onClick={() => onJoin(code, trimmedName)}
          >
            Join the round
          </button>
        </section>
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn--ghost" onClick={onSeason}>
          Season table
        </button>
      </div>

      {error ? <p className="notice">{error}</p> : null}
    </>
  );
}
