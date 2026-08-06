import { useEffect, useState } from 'react';

export interface QuestionClock {
  elapsedMs: number;
  remainingMs: number;
  /** Whole seconds left, for the timer face. */
  secondsLeft: number;
  expired: boolean;
}

interface Reading {
  questionIndex: number;
  elapsedMs: number;
}

/**
 * Times the current question against *this* device's clock, restarting whenever
 * the question changes.
 *
 * Deliberately local: comparing against the quizmaster's `questionOpenedAt`
 * would fold their clock offset into every player's speed score, and office
 * laptops disagree about the time by more than the speed bonus is worth.
 *
 * `durationMs` comes from the room, so every device counts down the same window
 * the security rules will hold the vault shut for. It is measured from when this
 * device *saw* the question open, which is necessarily after the server stamped
 * it — so a local clock always expires a little after the gate does, never
 * before, and the auto-reveal never arrives early.
 */
export function useQuestionClock(
  isOpen: boolean,
  questionIndex: number,
  durationMs: number,
): QuestionClock {
  const [reading, setReading] = useState<Reading>({ questionIndex, elapsedMs: 0 });

  useEffect(() => {
    if (!isOpen) return;

    // The start time lives in the effect closure, so there is no ref to read
    // during render and no need to seed state from inside the effect body.
    const startedAt = Date.now();

    // 100ms keeps the arc visibly smooth without repainting every frame.
    const interval = setInterval(() => {
      setReading({ questionIndex, elapsedMs: Date.now() - startedAt });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, questionIndex]);

  // A reading left over from the previous question counts as zero, so the new
  // question never inherits the old elapsed time for the frame before the first
  // interval tick lands.
  const elapsedMs =
    isOpen && reading.questionIndex === questionIndex ? Math.max(0, reading.elapsedMs) : 0;
  const remainingMs = Math.max(0, durationMs - elapsedMs);

  return {
    elapsedMs,
    remainingMs,
    secondsLeft: Math.ceil(remainingMs / 1000),
    expired: isOpen && remainingMs === 0,
  };
}
