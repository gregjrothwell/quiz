import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

/**
 * jsdom has no `matchMedia`, and `useReducedMotion` calls it on mount.
 *
 * Here rather than in one test file because it is a gap in the environment
 * rather than anything a test wants to say — without it, the first component
 * test to render anything animated dies on a missing browser API and reads
 * like a fault in the component.
 *
 * Reports "no preference", which is the setting almost everybody has. A test
 * that cares about the reduced-motion path stubs it itself.
 */
if (typeof window !== 'undefined' && window.matchMedia === undefined) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

/**
 * jsdom does not implement media playback at all, so `play()` is undefined and
 * the `.catch()` every caller puts on its promise throws.
 *
 * A real browser always returns a promise here — the rejected one is how it
 * says autoplay was blocked, which `sound.ts` handles and `audio-stack.md`
 * describes. Resolving is the "it played" case; a test about the blocked path
 * rejects this itself.
 */
if (typeof HTMLMediaElement !== 'undefined') {
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => {};
  HTMLMediaElement.prototype.load = () => {};
}

afterEach(cleanup);
