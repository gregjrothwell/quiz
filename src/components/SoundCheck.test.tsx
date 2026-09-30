import { cleanup, fireEvent, render } from '@testing-library/react';
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

const { setMuted } = await vi.importActual<typeof SoundModule>('../lib/sound');

beforeEach(() => {
  sound.playPreview.mockClear();
  sound.stopPreview.mockClear();
  setMuted(false);
});
afterEach(cleanup);

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

  test('a second press goes through playPreview again, which restarts rather than stacks', () => {
    const { container } = render(<SoundCheck />);
    fireEvent.click(button(container));
    fireEvent.click(button(container));
    expect(sound.playPreview).toHaveBeenCalledTimes(2);
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
