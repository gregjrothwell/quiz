import { useState } from 'react';
import { CANNON_VERDICTS, type CannonVerdict, type Shot } from '../engine/cannon';

/**
 * Keep / Bin on each shot the Slop Cannon fired this round
 * (docs/decisions/slop-cannon.md, D1–D2).
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
  shots: readonly Shot[];
  onVerdict: (shot: string, verdict: CannonVerdict) => void;
}

export function CannonVerdicts({ shots, onVerdict }: CannonVerdictsProps) {
  const [chosen, setChosen] = useState<Record<string, CannonVerdict>>({});
  if (shots.length === 0) return null;

  return (
    <section className="panel stack cannon" aria-label="Slop Cannon">
      <p className="eyebrow">Slop Cannon · keep it?</p>
      {shots.map((shot) => {
        const verdict = chosen[shot.id];
        return (
          <div key={shot.id} className="lamps lamps--vote cannon__row">
            <span className="lamp lamp--label">{shot.title}</span>
            {verdict ? (
              <span className="lamp lamp--vote lamp--in">{LABELS[verdict]} · noted</span>
            ) : (
              CANNON_VERDICTS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="lamp lamp--vote"
                  onClick={() => {
                    setChosen((current) => ({ ...current, [shot.id]: option }));
                    onVerdict(shot.id, option);
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
