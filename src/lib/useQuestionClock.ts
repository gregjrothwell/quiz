import { useCallback, useEffect, useRef, useState } from 'react';

export interface QuestionClock {
  elapsedMs: number;
  remainingMs: number;
  /** Whole seconds left, for the timer face. */
  secondsLeft: number;
  expired: boolean;
}

/** The clock a device answers with: the face, plus a reading taken at the press. */
export interface LiveQuestionClock extends QuestionClock {
  /**
   * Elapsed time now, not at the last tick. The face repaints every 100ms, and
   * an answer stamped with the face's reading was up to 100ms fast — and 0 for
   * a press before the first tick, which room Y86U recorded once (PROJ-78).
   * Capped at the window, as the face is.
   */
  elapsedNow: () => number;
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
 * the security rules will hold the vault shut for.
 *
 * > **Correction, 20 August 2026.** This note used to end: *"It is measured from
 * > when this device saw the question open, which is necessarily after the server
 * > stamped it — so a local clock always expires a little after the gate does,
 * > never before, and the auto-reveal never arrives early."*
 * >
 * > That is true of every device except the one that reveals. The quizmaster is
 * > the device that *wrote* the question open, and Firestore's latency
 * > compensation delivers that write back as a local snapshot before the server
 * > has seen it — so their `startedAt` is roughly the click, while `openedAt` is
 * > stamped a hop later. The two writes' latencies then cancel, leaving a margin
 * > of single-digit milliseconds: measured at about 7ms on the live project, with
 * > 100ms early refused (`npm run reveal-probe`).
 * >
 * > The clock is unchanged and still deliberately local — scoring depends on it.
 * > What changed is that the auto-reveal no longer trusts it for the gate; see
 * > `src/engine/revealGate.ts`.
 *
 * > **Superseded in part, 20 August 2026.** `originMs` now carries the moment the
 * > question opened *on this device's clock*, worked out from the server's
 * > `openedAt` and this device's own measured offset — so the countdown is the
 * > room's rather than this tab's, and neither the quizmaster's clock nor
 * > anybody's latency appears in it. The local fallback below is unchanged and
 * > is what runs whenever there is no origin to use.
 * > See `src/engine/roomClock.ts` and docs/decisions/shared-clock.md.
 */
export function useQuestionClock(
  isOpen: boolean,
  questionIndex: number,
  durationMs: number,
  /**
   * When the question opened, on this device's clock. Null falls back to
   * counting from the moment this device saw it, which is what every round
   * before this did.
   */
  originMs: number | null = null,
): LiveQuestionClock {
  const [reading, setReading] = useState<Reading>({ questionIndex, elapsedMs: 0 });
  // The same start the face counts from, kept where a press can read it.
  const startedRef = useRef<{ questionIndex: number; startedAt: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // The start time lives in the effect closure, so there is no ref to read
    // during render and no need to seed state from inside the effect body.
    //
    // The origin arrives a moment after the phase does — it needs the
    // server-confirmed snapshot — so this effect deliberately depends on it and
    // re-runs once when it lands. That re-run is the correction being applied,
    // and it can only ever move the start *earlier*: `questionOriginMs` pins the
    // origin at this device's own arrival and never past it.
    const startedAt = originMs ?? Date.now();
    startedRef.current = { questionIndex, startedAt };

    // 100ms keeps the arc visibly smooth without repainting every frame.
    const interval = setInterval(() => {
      setReading({ questionIndex, elapsedMs: Date.now() - startedAt });
    }, 100);

    // No immediate reading: setting state from an effect body is what
    // `react-hooks/set-state-in-effect` exists to stop, and the cost of not
    // doing it is that a correction landing mid-question shows on the next tick
    // instead of the next frame. That is a tenth of a second, once.
    return () => clearInterval(interval);
  }, [isOpen, questionIndex, originMs]);

  // A reading left over from the previous question counts as zero, so the new
  // question never inherits the old elapsed time for the frame before the first
  // interval tick lands.
  const elapsedMs =
    isOpen && reading.questionIndex === questionIndex ? Math.max(0, reading.elapsedMs) : 0;
  const remainingMs = Math.max(0, durationMs - elapsedMs);

  const elapsedNow = useCallback((): number => {
    const started = startedRef.current;
    if (!isOpen || started?.questionIndex !== questionIndex) return 0;
    return Math.min(durationMs, Math.max(0, Date.now() - started.startedAt));
  }, [isOpen, questionIndex, durationMs]);

  return {
    elapsedMs,
    remainingMs,
    secondsLeft: Math.ceil(remainingMs / 1000),
    expired: isOpen && remainingMs === 0,
    elapsedNow,
  };
}
