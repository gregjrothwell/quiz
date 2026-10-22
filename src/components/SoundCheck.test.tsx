import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type * as SoundModule from '../lib/sound';
import { SOUND_CHECK, SOUND_CHECK_SECONDS } from '../lib/soundCheck';
import { SoundCheck } from './SoundCheck';

/**
 * The lobby's sound check: ten seconds of a real preview, at the level a music
 * round plays at, pressed by the player. See docs/decisions/sound-check.md.
 */

const sound = vi.hoisted(() => ({
  playPreview: vi.fn(),
  stopPreview: vi.fn(),
}));

vi.mock('../lib/sound', async (importOriginal) => {
  const actual = await importOriginal<typeof SoundModule>();
  return { ...actual, playPreview: sound.playPreview, stopPreview: sound.stopPreview };
});

const actual = await vi.importActual<typeof SoundModule>('../lib/sound');
const { setMuted } = actual;

beforeEach(() => {
  sound.playPreview.mockReset();
  sound.stopPreview.mockReset();
  setMuted(false);
});
afterEach(cleanup);

/**
 * The real playback path under the spies, against a stand-in `<audio>` whose
 * clock a test can move — so the label is proved against what `sound.ts`
 * actually publishes rather than against a mock of it.
 */
class FakeAudio {
  static made: FakeAudio[] = [];
  preload = '';
  loop = false;
  volume = 1;
  src = '';
  currentTime = 0;
  paused = true;
  listeners: Record<string, Array<() => void>> = {};
  constructor() {
    FakeAudio.made.push(this);
  }
  addEventListener(type: string, handler: () => void): void {
    (this.listeners[type] ??= []).push(handler);
  }
  load(): void {}
  pause(): void {
    this.paused = true;
  }
  removeAttribute(): void {}
  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }
  tick(to: number): void {
    this.currentTime = to;
    for (const handler of this.listeners.timeupdate ?? []) handler();
  }
}

function withRealPlayback(run: () => void): void {
  const globals = globalThis as { Audio?: unknown };
  const original = globals.Audio;
  FakeAudio.made = [];
  globals.Audio = FakeAudio;
  sound.playPreview.mockImplementation(actual.playPreview);
  sound.stopPreview.mockImplementation(actual.stopPreview);
  try {
    run();
  } finally {
    actual.stopPreview();
    if (original === undefined) delete globals.Audio;
    else globals.Audio = original;
  }
}

const button = (container: HTMLElement): HTMLButtonElement => {
  const found = [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    /sound check/i.test(b.textContent ?? ''),
  );
  if (!found) throw new Error('no sound check button');
  return found;
};

describe('the sound check', () => {
  test('plays the clip from its start, for ten seconds', () => {
    const { container } = render(<SoundCheck />);
    fireEvent.click(button(container));
    expect(sound.playPreview).toHaveBeenCalledTimes(1);
    expect(sound.playPreview).toHaveBeenCalledWith(SOUND_CHECK.previewUrl, 0, SOUND_CHECK_SECONDS);
  });

  /*
    Was "a second press restarts rather than stacks" until 22 October 2026, when
    Greg asked for the same button to stop it: ten seconds of a song nobody can
    cut short is a long ten seconds in a quiet office.
  */
  test('a second press stops it, and the button says so while it plays', () => {
    withRealPlayback(() => {
      const { container } = render(<SoundCheck />);
      expect(button(container).textContent).toBe('Play the sound check');

      // #when it is pressed
      fireEvent.click(button(container));

      // #then the clip is playing and the button offers to stop it
      expect(FakeAudio.made[0]?.paused).toBe(false);
      expect(button(container).textContent).toBe('Stop the sound check');

      // #when it is pressed again
      fireEvent.click(button(container));

      // #then it stops, rather than starting over
      expect(sound.playPreview).toHaveBeenCalledTimes(1);
      expect(sound.stopPreview).toHaveBeenCalledTimes(1);
      expect(FakeAudio.made[0]?.paused).toBe(true);
      expect(button(container).textContent).toBe('Play the sound check');
    });
  });

  test('goes back to Play by itself when the ten seconds are up', () => {
    withRealPlayback(() => {
      const { container } = render(<SoundCheck />);
      fireEvent.click(button(container));
      expect(button(container).textContent).toBe('Stop the sound check');

      // #when the clip reaches its cut
      act(() => FakeAudio.made[0]?.tick(SOUND_CHECK_SECONDS + 0.2));

      // #then nobody is offered a stop for a clip that has already ended
      expect(button(container).textContent).toBe('Play the sound check');
    });
  });

  test('a third press plays it again', () => {
    withRealPlayback(() => {
      const { container } = render(<SoundCheck />);
      fireEvent.click(button(container));
      fireEvent.click(button(container));
      fireEvent.click(button(container));
      expect(sound.playPreview).toHaveBeenCalledTimes(2);
      expect(button(container).textContent).toBe('Stop the sound check');
    });
  });

  test('unmutes a muted player before playing', () => {
    // #given somebody whose sound is off
    setMuted(true);
    const { container } = render(<SoundCheck />);

    // #when they press it
    fireEvent.click(button(container));

    // #then the sound comes on and the clip plays — a button that did nothing
    // would be worse than no button
    expect(container.querySelector('input[type="range"]')).not.toBeNull();
    expect(sound.playPreview).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('vibequiz.sound')).toBe('on');
  });

  test('has a volume slider beside it', () => {
    const { container } = render(<SoundCheck />);
    const slider = container.querySelector<HTMLInputElement>('input[type="range"]');
    expect(slider?.getAttribute('aria-label')).toBe('Volume');
  });

  test('credits iTunes, as a question with a preview does', () => {
    const { container } = render(<SoundCheck />);
    expect(container.textContent).toContain('Provided courtesy of iTunes');
  });

  test('leaving the lobby stops a check that was played', () => {
    const { container, unmount } = render(<SoundCheck />);
    fireEvent.click(button(container));
    unmount();
    expect(sound.stopPreview).toHaveBeenCalledTimes(1);
  });

  test('leaving the lobby touches nothing if it was never pressed', () => {
    const { unmount } = render(<SoundCheck />);
    unmount();
    expect(sound.stopPreview).not.toHaveBeenCalled();
  });
});
