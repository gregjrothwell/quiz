import { useEffect } from 'react';
import { commentFor, type Moment } from '../engine/commentary';
import type { RoomState } from '../engine/state';
import { claimLine, commentarySpeechOn, releaseLine } from '../lib/commentarySpeech';
import { speak } from '../lib/sound';

/**
 * The Commentator's line for this moment, as a caption on every screen
 * (docs/decisions/commentator.md, M4). Captions only for players: the spoken
 * voice (M5) came out on 22 October 2026 and comes back only with a story of
 * its own. A test may turn speech on; the same line is then said once per
 * game, including across the standings and the podium and after a remount
 * (PROJ-59). Nothing when there is nothing worth saying.
 */
export function Commentary({ room, moment, show = true, speakHere = false }: {
  room: RoomState;
  moment: Moment;
  /** False to hold the line back, as the reveal does until its verdict lands. */
  show?: boolean;
  /**
   * True on the host's device, the one voice in the room. Ignored unless
   * speech has been turned on for this page.
   */
  speakHere?: boolean;
}) {
  const said = show ? commentFor(room, moment) : null;
  const text = said?.text ?? null;
  const gameId = room.gameId ?? '';

  useEffect(() => {
    if (!text || !speakHere || !commentarySpeechOn()) return;
    if (!claimLine(gameId, text)) return;
    if (!speak(text)) releaseLine(gameId, text);
  }, [text, gameId, speakHere]);

  return said ? (
    <p className="commentary" aria-live="polite">
      {said.text}
    </p>
  ) : null;
}
