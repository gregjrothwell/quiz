import type { ReactNode } from 'react';
import type { Phase } from '../engine/state';
import { SoundToggle } from './SoundToggle';

/**
 * The studio: a back wall of light columns and an overhead halo from the
 * stylesheet, four beams from the rig, and a centred content column.
 *
 * The beams are real elements rather than another pseudo-element because they
 * blend with `mix-blend-mode: screen` and drift independently of the wall
 * behind them, and `.stage` has only two pseudo-elements to give.
 *
 * **`mood` is what the rig is doing, and it is only ever the phase.** Passed
 * from the one call site that is inside a room; the other five — setup, the
 * gallery, a connection error, the season board and the landing — leave it
 * undefined, which omits the attribute and lights the set the way it always
 * was. Nothing here decides anything: the stylesheet reads `data-mood` and the
 * whole effect lives there, so a lighting change never costs a render.
 */
export function Stage({ children, mood }: { children: ReactNode; mood?: Phase }) {
  return (
    <div className="stage" data-mood={mood}>
      <div className="beams" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <SoundToggle />
      <div className="stage__inner">{children}</div>
    </div>
  );
}
