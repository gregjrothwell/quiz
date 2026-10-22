import { useEffect, useRef } from 'react';
import { commentFor, type Moment } from '../engine/commentary';
import type { RoomState } from '../engine/state';
import { speak } from '../lib/sound';

/**
 * The Commentator's line for this moment, as a caption on every screen and
 * spoken from the host's device only (docs/decisions/commentator.md, M4–M5).
 * Nothing when there is nothing worth saying.
 */
export function Commentary({ room, moment, speakHere, show = true }: {
  room: RoomState;
  moment: Moment;
  /** True on the host's device: the one voice in the room. */
  speakHere: boolean;
  /** False to hold the line back, as the reveal does until its verdict lands. */
  show?: boolean;
}) {
  const said = show ? commentFor(room, moment) : null;
  const key = said ? `${room.gameId ?? ''}:${String(room.index)}:${moment}:${said.fact}` : null;
  const spokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!said || !key || !speakHere || spokenRef.current === key) return;
    spokenRef.current = key;
    speak(said.text);
  }, [key, said, speakHere]);

  return said ? (
    <p className="commentary" aria-live="polite">
      {said.text}
    </p>
  ) : null;
}
