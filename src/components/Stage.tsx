import type { ReactNode } from 'react';
import type { Phase } from '../engine/state';

/**
 * The phases that are a new screen rather than a new state of the same one.
 *
 * Not `question`: the clock starts the moment it opens, so a band of light
 * crossing the prompt would cost somebody the first look at it. Not `reveal`
 * either: the reveal opens on the drum roll with the set deliberately dark, and
 * a sweep of light is the opposite of that.
 */
const WIPED: ReadonlySet<Phase> = new Set(['lobby', 'scoreboard', 'standoff', 'finished']);
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
      {/* Keyed on the phase, so each new screen remounts it and it crosses once —
          the television stinger between segments. Never in the way: it is
          `pointer-events: none` and off the edge of the stage when it stops. */}
      {mood && WIPED.has(mood) ? <i className="stage__wipe" key={mood} aria-hidden="true" /> : null}
      <SoundToggle />
      <div className="stage__inner">{children}</div>
    </div>
  );
}
