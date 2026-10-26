import { useState } from 'react';
import { CANNON_VERDICTS, type Asked, type CannonVerdict } from '../engine/cannon';

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
}

export function CannonVerdicts({ rows, onVerdict }: CannonVerdictsProps) {
  const [chosen, setChosen] = useState<Record<string, CannonVerdict>>({});
  if (rows.length === 0) return null;

  return (
    <section className="panel stack cannon" aria-label="New this round">
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
