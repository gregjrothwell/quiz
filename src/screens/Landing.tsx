import { useState } from 'react';
import { isValidRoomCode, normaliseRoomCode, ROOM_CODE_LENGTH } from '../engine/roomCode';
import { SQUADS } from '../engine/squad';
import { MAX_NAME_LENGTH, rememberedName } from '../lib/rememberedName';
import { rememberedPlayingWith, rememberedSquad } from '../lib/rememberedSquad';

interface LandingProps {
  busy: boolean;
  error: string | null;
  /** Carried in from a join link, so a phone only has to supply a name. */
  initialCode?: string;
  onCreate: (name: string, squad: string, playingWith: string) => void;
  onJoin: (code: string, name: string, squad: string, playingWith: string) => void;
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
  const [squad, setSquad] = useState<string>(rememberedSquad);
  const [playingWith, setPlayingWith] = useState<string>(rememberedPlayingWith);
  const [code, setCode] = useState(initialCode);

  // Only a Lurker is asked, because only a Lurker has a side to choose. For
  // anybody else the answer is their own squad and the question is noise.
  const asksWhoWith = squad === 'Lurkers';
  // Sent as empty by everyone else, so the week row simply agrees with the
  // season row — see `GameResult.playingWith`.
  const withWhom = asksWhoWith ? playingWith : '';

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
        <h2 className="display display--panel">
          Your name
        </h2>
        <div className="identity">
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
            Optional, and second, because it is: a quiz you cannot join without
            naming a squad is a quiz people stop joining. Left unchosen it
            changes nothing at all — see `GameResult.squad` for why an empty
            value never clears a squad somebody set elsewhere.

            A list rather than the free text this used to be. Three names is a
            list somebody can actually be wrong about typing, and a board split
            in two by a stray capital is worse than no board.
          */}
          <label className="field">
            <span className="field__label">Squad — optional, for the league table</span>
            <select
              className="input"
              value={squad}
              onChange={(event) => setSquad(event.target.value)}
            >
              <option value="">Not saying</option>
              {SQUADS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          {/*
            A Lurker belongs to no side for the season and can still sit with
            one tonight. This is the only thing the two boards are ever told
            differently: the week's table counts these points for whoever they
            played with, and the season record still says Lurkers.
          */}
          {asksWhoWith ? (
            <label className="field">
              <span className="field__label">Playing with — just for this week</span>
              <select
                className="input"
                value={playingWith}
                onChange={(event) => setPlayingWith(event.target.value)}
              >
                <option value="">On my own</option>
                {SQUADS.filter((name) => name !== 'Lurkers').map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        {/*
          A box that fills itself in is a box somebody stops reading, and the
          one case that matters is the borrowed laptop — where the name already
          sitting there belongs to whoever played on it last.
        */}
        {remembered ? (
          <p className="muted hint">
            Remembered from last time — change it if you aren&rsquo;t {remembered}.
          </p>
        ) : null}

      </section>

      <div className="split split--two">
        <section className="panel stack">
          <h2 className="display display--panel">
            Run the show
          </h2>
          {/*
            Deliberately not a restatement of the lede above, which already
            says what running the show involves.
          */}
          <p className="muted hint">
            You&rsquo;ll be the quizmaster, and everyone else joins with your code.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canCreate}
            onClick={() => onCreate(trimmedName, squad, withWhom)}
          >
            Start a new room
          </button>
        </section>

        <section className="panel stack">
          <h2 className="display display--panel">
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
            className={blocker ? 'nudge hint' : 'muted hint'}
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
            onClick={() => onJoin(code, trimmedName, squad, withWhom)}
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
