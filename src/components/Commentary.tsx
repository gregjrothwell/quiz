import { commentFor, type Moment } from '../engine/commentary';
import type { RoomState } from '../engine/state';

/**
 * The Commentator's line for this moment, as a caption on every screen
 * (docs/decisions/commentator.md, M4). Captions only: the spoken voice (M5)
 * came out on 22 October 2026 and comes back only with a story of its own.
 * Nothing when there is nothing worth saying.
 */
export function Commentary({ room, moment, show = true }: {
  room: RoomState;
  moment: Moment;
  /** False to hold the line back, as the reveal does until its verdict lands. */
  show?: boolean;
}) {
  const said = show ? commentFor(room, moment) : null;

  return said ? (
    <p className="commentary" aria-live="polite">
      {said.text}
    </p>
  ) : null;
}
