import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 750;

/** Ease-out so the number decelerates into its final value instead of stopping dead. */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

interface ScoreTickerProps {
  value: number;
  /**
   * Where to start counting from on the very first render.
   *
   * Without it a ticker that mounts already holding its final number just
   * prints it, which is what the standings screen did: it is a fresh mount
   * every question, so the scores arrived fully updated and the count-up only
   * ever ran for players whose row happened to survive a re-render.
   */
  from?: number;
}

/**
 * Counts up to `value` rather than snapping to it — the small piece of theatre
 * that makes a score reveal feel like a score reveal.
 */
export function ScoreTicker({ value, from }: ScoreTickerProps) {
  const [shown, setShown] = useState(from ?? value);
  const fromRef = useRef(from ?? value);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    const startedAt = performance.now();

    const step = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / DURATION_MS);
      setShown(Math.round(from + (value - from) * easeOut(progress)));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
      }
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value]);

  return <>{shown.toLocaleString('en-GB')}</>;
}
