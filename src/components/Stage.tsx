import type { ReactNode } from 'react';

/** The darkened studio: spotlight pool, floor falloff, and a centred content column. */
export function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="stage">
      <div className="stage__inner">{children}</div>
    </div>
  );
}
