import { positionForVolume, useSound, volumeForPosition } from '../lib/sound';

/**
 * The volume control, wherever it appears: the corner of every screen, and
 * beside the lobby's sound check. Both are bound to the one stored level, so
 * moving either moves the other.
 *
 * `step` of 5 rather than 1: in the corner this is a control the size of a
 * thumbnail, and a hundred stops on it means the arrow keys take forever and no
 * drag lands where you meant. Twenty is plenty of resolution for "under the
 * person talking" — and on the decibel travel each of those stops is a flat
 * 2 dB, so every one of them is worth pressing.
 *
 * The position is not the amplitude. `volumeForPosition` converts, and the
 * amplitude is what gets stored, so a level somebody already chose by hand
 * survives at the loudness they chose it at.
 */
export function VolumeSlider() {
  const { volume, setVolume } = useSound();
  // The slider's own units, not the amplitude. They are not the same thing and
  // treating them as one is what put every useful level in the bottom tenth of
  // the travel — see `volumeForPosition`.
  const percent = Math.round(positionForVolume(volume) * 100);

  return (
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
      onChange={(event) => setVolume(volumeForPosition(Number(event.target.value) / 100))}
    />
  );
}
