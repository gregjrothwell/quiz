import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/**
 * The stylesheet already flattens every animation and transition for this
 * preference. What it cannot reach is a sequence timed in JavaScript — the
 * reveal replay lands one player at a time over more than a second, which is
 * motion whether or not any of it is a CSS animation.
 *
 * Read through `useSyncExternalStore` rather than an effect, so the first paint
 * already knows the answer instead of animating once and then correcting.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
