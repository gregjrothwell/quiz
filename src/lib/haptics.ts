import { useEffect, useRef } from 'react';

/**
 * A buzz in the hand, for the moments that belong to the person holding the
 * phone: locking in, the verdict on their own answer, and being shafted.
 *
 * **Android only, and nothing may depend on it.** Safari has never shipped
 * `navigator.vibrate`, so on an iPhone this does nothing at all, and a laptop
 * has nothing to vibrate. Every moment that buzzes is already said on screen
 * and in sound; this is the third channel, never the only one.
 *
 * Chrome also refuses a vibration before the page has had a tap. Every moment
 * that buzzes comes after the person has played, so that only ever matters to a
 * screen that has done nothing but watch.
 */

/** Short and single: something was committed. */
export const BUZZ_LOCK = 30;
export const BUZZ_CORRECT: number[] = [40, 60, 40];
export const BUZZ_WRONG = 180;
/** The longest, because it is the worst thing that can happen to you here. */
export const BUZZ_SHAFTED: number[] = [90, 50, 220];

export function buzz(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  // Asking before the page has had a tap is refused anyway, and logged as an
  // error — so a screen that only ever watched does not ask.
  if ('userActivation' in navigator && !navigator.userActivation.hasBeenActive) return;
  navigator.vibrate(pattern);
}

/**
 * Buzzes once for each distinct `key`, while `enabled` — `useCue`'s contract,
 * for the same reason: a re-render must never buzz twice for one moment.
 */
export function useBuzz(pattern: number | number[], key: string | number, enabled = true): void {
  const buzzedRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!enabled || buzzedRef.current === key) return;
    buzzedRef.current = key;
    buzz(pattern);
  }, [pattern, key, enabled]);
}
