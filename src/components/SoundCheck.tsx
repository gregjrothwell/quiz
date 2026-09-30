import { useEffect, useRef } from 'react';
import { playPreview, stopPreview, useSound } from '../lib/sound';
import { SOUND_CHECK, SOUND_CHECK_SECONDS } from '../lib/soundCheck';
import { VolumeSlider } from './VolumeSlider';

/**
 * Ten seconds of music in the lobby, so the level is right before question one
 * rather than on it.
 *
 * On each player's own device and nowhere else — no room field, no phase, no
 * rules paste. Through `playPreview`, the path a tune takes, so what is heard
 * is the level the round plays at, and the press is the gesture a link
 * auto-join never gives the page. See docs/decisions/sound-check.md.
 */
export function SoundCheck() {
  const { muted, toggle } = useSound();
  const playedRef = useRef(false);

  // Leaving the lobby stops it, so the clip never runs into question one. Only
  // if it was ever pressed: there is nothing of ours to stop otherwise.
  useEffect(
    () => () => {
      if (playedRef.current) stopPreview();
    },
    [],
  );

  const play = (): void => {
    // Unmuted first, as the replay does: a button that plays nothing is worse
    // than no button. `toggle` also wakes the audio context on the way.
    if (muted) toggle();
    playedRef.current = true;
    playPreview(SOUND_CHECK.previewUrl, 0, SOUND_CHECK_SECONDS);
  };

  return (
    <div className="stack sound-check">
      <p className="eyebrow">Sound check</p>
      <p className="muted hint">
        Ten seconds at the level a music round plays at. Set it so you can still hear the
        call over it.
      </p>
      <div className="sound-check__row">
        <button type="button" className="btn btn--ghost" onClick={play}>
          Play the sound check
        </button>
        <VolumeSlider />
      </div>
      <p className="tune-credit">
        {SOUND_CHECK.title} · {SOUND_CHECK.artist} — Provided courtesy of iTunes
      </p>
    </div>
  );
}
