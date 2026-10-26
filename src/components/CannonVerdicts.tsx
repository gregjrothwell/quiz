import { useEffect, useRef, useState } from 'react';
import { CANNON_VERDICTS, type Asked, type CannonVerdict } from '../engine/cannon';
import { play } from '../lib/sound';
import { Confetti } from './Confetti';

/**
 * Keep / Bin on each shot the Slop Cannon fired this round, and each new lobby
 * mode the round used (docs/decisions/slop-cannon.md, D1–D2, E5).
 *
 * The eyebrow says "New this round", not "Slop Cannon": Mr Fries is a finished
 * feature, and the heading would call it slop.
 *
 * **Under the podium, never over it**: it sits in the part of Final that is held
 * back until the podium has landed, so nothing is inserted above the risers and
 * nothing moves them — 22 October's judder was a notice pushing the podium down
 * mid-build.
 *
 * One tap and done. Unlike a question vote there is no change of mind: the
 * rules allow `create` only, so the buttons go once one is pressed.
 */
const LABELS: Record<CannonVerdict, string> = {
  keep: 'Keep',
  bin: 'Bin',
};

interface CannonVerdictsProps {
  rows: readonly Asked[];
  onVerdict: (id: string, verdict: CannonVerdict) => void;
  /** Final says it is time: after the fanfare, on a podium seen for the first time (F1). */
  fire?: boolean;
  /** The paper and the puff. False under reduced motion; the boom still plays (F6). */
  burst?: boolean;
}

export function CannonVerdicts({ rows, onVerdict, fire = false, burst = true }: CannonVerdictsProps) {
  const [chosen, setChosen] = useState<Record<string, CannonVerdict>>({});
  const panelRef = useRef<HTMLElement>(null);
  /** Where the cannon went off, in viewport pixels; null until it has. */
  const [firedFrom, setFiredFrom] = useState<{ x: number; y: number } | null>(null);

  /*
    The cannon (docs/decisions/slop-cannon.md, F1–F4). Once, and only where it
    can be seen: if the panel is below the fold — a phone still looking at the
    podium — it waits for the panel to scroll in (F2). This component is keyed
    on the game, so "once" is once a round.
  */
  const hasRows = rows.length > 0;
  useEffect(() => {
    const panel = panelRef.current;
    if (!fire || !hasRows || !panel) return;
    let done = false;
    const go = (): void => {
      if (done) return;
      done = true;
      play('cannon');
      const box = panel.getBoundingClientRect();
      setFiredFrom({ x: box.left, y: box.top + box.height / 2 });
    };
    if (typeof IntersectionObserver === 'undefined') {
      const timer = window.setTimeout(go, 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        go();
      },
      { threshold: 0.5 },
    );
    observer.observe(panel);
    return () => observer.disconnect();
  }, [fire, hasRows]);

  if (!hasRows) return null;

  return (
    <section ref={panelRef} className="panel stack cannon" aria-label="New this round">
      {firedFrom && burst ? (
        <>
          {/* F5: a puff that fades, never a flash. */}
          <span className="cannon__puff" aria-hidden="true" />
          <Confetti fire from={firedFrom} />
        </>
      ) : null}
      <p className="eyebrow">New this round · keep it?</p>
      {rows.map((row) => {
        const verdict = chosen[row.id];
        return (
          <div key={row.id} className="lamps lamps--vote cannon__row">
            <span className="lamp lamp--label">{row.title}</span>
            {verdict ? (
              <span className="lamp lamp--vote lamp--in">{LABELS[verdict]} · noted</span>
            ) : (
              CANNON_VERDICTS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="lamp lamp--vote"
                  onClick={() => {
                    setChosen((current) => ({ ...current, [row.id]: option }));
                    onVerdict(row.id, option);
                  }}
                >
                  {LABELS[option]}
                </button>
              ))
            )}
          </div>
        );
      })}
    </section>
  );
}
