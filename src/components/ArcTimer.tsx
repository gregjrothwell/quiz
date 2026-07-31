const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Below this fraction the sweep turns red, as the last-few-seconds cue. */
const LOW_THRESHOLD = 0.25;

interface ArcTimerProps {
  secondsLeft: number;
  remainingMs: number;
  totalMs: number;
}

/**
 * A sweep draining anticlockwise around the countdown, in the manner of every
 * quiz show clock. Uses stroke-dashoffset so it animates on the compositor
 * rather than triggering layout.
 */
export function ArcTimer({ secondsLeft, remainingMs, totalMs }: ArcTimerProps) {
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const low = fraction <= LOW_THRESHOLD;

  return (
    <div
      className="timer"
      role="timer"
      aria-live="off"
      aria-label={`${secondsLeft} seconds remaining`}
    >
      <svg className="timer__svg" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="timer__track" cx="50" cy="50" r={RADIUS} />
        <circle
          className={low ? 'timer__sweep timer__sweep--low' : 'timer__sweep'}
          cx="50"
          cy="50"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
        />
      </svg>
      <span className="timer__count">{secondsLeft}</span>
    </div>
  );
}
