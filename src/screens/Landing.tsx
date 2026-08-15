import { useState } from 'react';
import { isValidRoomCode, normaliseRoomCode, ROOM_CODE_LENGTH } from '../engine/roomCode';
import { MAX_TEAM_LENGTH } from '../engine/team';
import { MAX_NAME_LENGTH, rememberedName } from '../lib/rememberedName';
import { rememberedTeam } from '../lib/rememberedTeam';

interface LandingProps {
  busy: boolean;
  error: string | null;
  /** Carried in from a join link, so a phone only has to supply a name. */
  initialCode?: string;
  onCreate: (name: string, team: string) => void;
  onJoin: (code: string, name: string, team: string) => void;
  onSeason: () => void;
}

export function Landing({
  busy,
  error,
  initialCode = '',
  onCreate,
  onJoin,
  onSeason,
}: LandingProps) {
  // Read once, on mount. The box stays editable and the stored name is only ever
  // where it starts, so `remembered` is kept separately: it is what this browser
  // arrived believing, which is the thing worth saying out loud below.
  const [remembered] = useState(rememberedName);
  const [name, setName] = useState(remembered);
  const [team, setTeam] = useState(rememberedTeam);
  const [code, setCode] = useState(initialCode);

  const trimmedName = name.trim();
  const canCreate = trimmedName.length > 0 && !busy;
  const codeReady = isValidRoomCode(code);
  const canJoin = canCreate && codeReady;

  /**
   * A disabled button with no explanation reads as a broken one.
   *
   * The name field now sits above both panels so it reads as shared, which is
   * the real fix. This is the belt to that pair of braces: somebody who fills
   * the code first still gets told what is missing rather than left guessing at
   * a dead button. Scanning the QR makes that order more likely, since the code
   * arrives already filled.
   */
  const blocker = codeReady && trimmedName.length === 0 ? 'name' : null;

  return (
    <>
      <header>
        <p className="eyebrow">The office quiz</p>
        <div className="chrome-wrap">
          <h1 className="wordmark chrome">
            Vibe
            <br />
            Quiz
          </h1>
        </div>
        <hr className="wordmark__rule" />
      </header>

      <p className="lede">
        Whoever creates the room runs the show — pick a set, set the level, and start the clock.
        Everyone else plays along at their own desk, and the fastest correct answer takes the
        points.
      </p>

      {/*
        Above both panels, not inside one.
        It used to live in the panel whose button reads "Start a new room",
        which made it look like part of creating a room — so somebody joining
        filled in the code, found the button dead, and had nothing telling them
        a name was the missing piece. It is needed either way, so it sits above
        either way, in both the two-column and the stacked layout.
      */}
      <section className="panel stack">
        <h2 className="display" style={{ fontSize: '1.6rem' }}>
          Your name
        </h2>
        <label className="field">
          <span className="field__label">Shown on the leaderboard — needed either way</span>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Greg"
            maxLength={MAX_NAME_LENGTH}
            autoComplete="given-name"
          />
        </label>
        {/*
          A box that fills itself in is a box somebody stops reading, and the
          one case that matters is the borrowed laptop — where the name already
          sitting there belongs to whoever played on it last.
        */}
        {remembered ? (
          <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
            Remembered from last time — change it if you aren&rsquo;t {remembered}.
          </p>
        ) : null}

        {/*
          Optional, and second, because it is: a quiz you cannot join without
          naming a department is a quiz people stop joining. Left blank it
          changes nothing at all — see `GameResult.team` for why an empty box
          never clears a team somebody set elsewhere.
        */}
        <label className="field">
          <span className="field__label">Team — optional, for the league table</span>
          <input
            className="input"
            value={team}
            onChange={(event) => setTeam(event.target.value)}
            placeholder="e.g. Engineering"
            maxLength={MAX_TEAM_LENGTH}
            autoComplete="organization"
          />
        </label>
      </section>

      <div className="split split--two">
        <section className="panel stack">
          <h2 className="display" style={{ fontSize: '1.6rem' }}>
            Run the show
          </h2>
          {/*
            Deliberately not a restatement of the lede above, which already
            says what running the show involves.
          */}
          <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
            You&rsquo;ll be the quizmaster, and everyone else joins with your code.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canCreate}
            onClick={() => onCreate(trimmedName, team)}
          >
            Start a new room
          </button>
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
          <p
            id="code-hint"
            className={blocker ? 'nudge' : 'muted'}
            style={{ fontSize: '0.85rem', margin: 0 }}
          >
            {blocker === 'name'
              ? 'Now put your name in the box above — you need one to join.'
              : initialCode
                ? 'Filled in from the link — just add your name.'
                : 'Use the quizmaster’s link if they’ve shared one, or ask them to read the code out.'}
          </p>

          <button
            type="button"
            className="btn"
            disabled={!canJoin}
            onClick={() => onJoin(code, trimmedName, team)}
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
