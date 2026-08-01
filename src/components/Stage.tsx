import type { ReactNode } from 'react';

/**
 * The studio: a back wall of light columns and an overhead halo from the
 * stylesheet, four beams from the rig, and a centred content column.
 *
 * The beams are real elements rather than another pseudo-element because they
 * blend with `mix-blend-mode: screen` and drift independently of the wall
 * behind them, and `.stage` has only two pseudo-elements to give.
 */
export function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="stage">
      <div className="beams" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="stage__inner">{children}</div>
    </div>
  );
}
