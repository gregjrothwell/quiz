import { useEffect } from 'react';
import { unlock, useSound } from '../lib/sound';

/**
 * The house sound switch, parked in the corner of every screen, with the
 * volume under it.
 *
 * It also carries the one-time gesture handler that wakes the audio stack.
 * Browsers start an AudioContext suspended until a real click or keypress, and
 * the first gesture in a round is always somebody joining or answering — so by
 * the time a cue is due, the context is already running and the sound lands on
 * the beat instead of a tenth of a second late.
 *
 * **The slider is here rather than in the lobby because the moment it is
 * wanted is mid-clip.** 10 September 2026: a tunes round played over a Teams
 * call and the music covered whoever was talking. A control you have to leave
 * the question to reach is no use to somebody who wants it down *now* — and
 * this corner is the one piece of furniture on every screen of the round.
 *
 * Left live while muted on purpose: setting the level before turning the sound
 * back on is the sensible order, and a disabled slider would make you unmute
 * at whatever the last level was to find out.
 */
export function SoundToggle() {
  const { muted, toggle, volume, setVolume } = useSound();
  const percent = Math.round(volume * 100);

  useEffect(() => {
    const wake = (): void => unlock();
    window.addEventListener('pointerdown', wake, { once: true });
    window.addEventListener('keydown', wake, { once: true });
    return () => {
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, []);

  return (
    <div className={muted ? 'sound-rig sound-rig--off' : 'sound-rig'}>
      <button
        type="button"
        className={muted ? 'sound sound--off' : 'sound'}
        onClick={toggle}
        aria-pressed={!muted}
        title={muted ? 'Turn sound on' : 'Turn sound off'}
      >
        <span className="sr-only">{muted ? 'Turn sound on' : 'Turn sound off'}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
          {muted ? (
            <g className="sound__cross">
              <path d="M16 9.5l5 5" />
              <path d="M21 9.5l-5 5" />
            </g>
          ) : (
            <g className="sound__waves">
              <path d="M15.5 9a4.5 4.5 0 0 1 0 6" />
              <path d="M18 6.5a8 8 0 0 1 0 11" />
            </g>
          )}
        </svg>
      </button>

      {/*
        `step` of 5 rather than 1: this is a corner control the size of a
        thumbnail, and a hundred stops on it means the arrow keys take forever
        and no drag lands where you meant. Twenty is plenty of resolution for
        "under the person talking".
      */}
      <input
        type="range"
        className="sound-volume"
        min={0}
        max={100}
        step={5}
        value={percent}
        aria-label="Volume"
        aria-valuetext={`${percent}%`}
        title={`Volume ${percent}%`}
        onChange={(event) => setVolume(Number(event.target.value) / 100)}
      />
    </div>
  );
}
