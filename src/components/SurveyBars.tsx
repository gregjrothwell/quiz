interface SurveyBarsProps {
  options: readonly string[];
  /** How many picked each option in part one. */
  counts: readonly number[];
  /** The options tied for most picked: lit. */
  top: readonly number[];
}

/**
 * Survey Says: how the room split in part one, shown at part two's reveal.
 * Numbers only — nobody's own answer is ever on screen (T3).
 */
export function SurveyBars({ options, counts, top }: SurveyBarsProps) {
  const most = Math.max(1, ...counts);
  const total = counts.reduce((sum, count) => sum + count, 0);

  return (
    <figure className="survey-bars" aria-label={`How the room answered, ${total} in all`}>
      <figcaption className="eyebrow">What the office said</figcaption>
      {options.map((option, index) => {
        const count = counts[index] ?? 0;
        const lit = top.includes(index);
        return (
          <div key={option} className={lit ? 'survey-bars__row survey-bars__row--top' : 'survey-bars__row'}>
            <span className="survey-bars__label">{option}</span>
            <span className="survey-bars__track" aria-hidden="true">
              <span className="survey-bars__fill" style={{ width: `${(count / most) * 100}%` }} />
            </span>
            <span className="survey-bars__count">{count}</span>
          </div>
        );
      })}
    </figure>
  );
}
