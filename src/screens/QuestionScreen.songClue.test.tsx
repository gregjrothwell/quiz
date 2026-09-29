import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRoom, type QuizQuestion, type RoomState } from '../engine/state';
import type * as SoundModule from '../lib/sound';
import type { QuestionClock } from '../lib/useQuestionClock';
import { QuestionScreen } from './QuestionScreen';

/**
 * A sleeve's song arrives at half the clock, and not a moment before.
 *
 * The cover is the question; the song is the clue. Whoever places the cover on
 * sight answers first and takes the rank bonus, and the song rescues everybody
 * else. **Any route to the song before half-clock gives the fast players' edge
 * away**, and the replay button and the `R` key are both routes — so both are
 * pinned here as well as the autoplay. See docs/decisions/sleeves-song.md.
 */

const sound = vi.hoisted(() => ({
  playPreview: vi.fn(),
  primePreview: vi.fn(),
  stopPreview: vi.fn(),
  startClock: vi.fn(),
}));

vi.mock('../lib/sound', async (importOriginal) => {
  const actual = await importOriginal<typeof SoundModule>();
  return {
    ...actual,
    playPreview: sound.playPreview,
    primePreview: sound.primePreview,
    stopPreview: sound.stopPreview,
    startClock: sound.startClock,
  };
});

beforeEach(() => {
  for (const fn of Object.values(sound)) fn.mockClear();
});
afterEach(cleanup);

const noop = () => {};
const PREVIEW = 'https://audio-ssl.itunes.apple.com/itunes-assets/x.m4a';

const SLEEVE: QuizQuestion = {
  id: 'q1',
  prompt: 'Which album is this?',
  options: ['In Utero', 'Nevermind', 'Siamese Dream', 'Ten'],
  correctIndex: null,
  category: 'Sleeves',
  difficulty: 'easy',
  artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg',
  storeUrl: 'https://music.apple.com/gb/album/1440783617',
  previewUrl: PREVIEW,
  previewStart: 2,
  previewSeconds: 9,
};

const TUNE: QuizQuestion = {
  id: 'q1',
  prompt: 'Name this tune.',
  options: ['A', 'B', 'C', 'D'],
  correctIndex: null,
  category: 'Name that Tune',
  difficulty: 'easy',
  previewUrl: PREVIEW,
  storeUrl: 'https://music.apple.com/gb/album/1440717563?i=1440717826',
};

/** A 10s room, so the clue lands at 5s. */
function roomWith(question: QuizQuestion): RoomState {
  return {
    ...createRoom('HKQ7'),
    phase: 'question',
    packId: 'sleeves',
    packTitle: 'Sleeves',
    durationSecs: 10,
    players: { greg: { name: 'Greg', joinedAt: 100 } },
    questions: [question],
  };
}

function at(elapsedMs: number): QuestionClock {
  const remainingMs = Math.max(0, 10_000 - elapsedMs);
  return {
    elapsedMs,
    remainingMs,
    secondsLeft: Math.ceil(remainingMs / 1000),
    expired: remainingMs === 0,
  };
}

function screen(question: QuizQuestion, clock: QuestionClock, revealed = false) {
  return (
    <QuestionScreen
      room={roomWith(question)}
      youUid="greg"
      isQuizmaster
      clock={clock}
      revealed={revealed}
      onAnswer={noop}
      onReveal={noop}
      onNext={noop}
      onVote={noop}
    />
  );
}

/** The tune's own button, by what it says — the quizmaster has others in rows. */
const replayButton = (container: HTMLElement): HTMLButtonElement | null =>
  [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
    /hear it|play the tune|halfway/i.test(button.textContent ?? ''),
  ) ?? null;

describe('a sleeve with a song', () => {
  test('opens on the cover alone, with the song already loading', () => {
    // #given a sleeve, 4s into a 10s question
    render(screen(SLEEVE, at(4_000)));

    // #then nothing plays yet, but the song is being fetched so it can start on
    // time — Apple's CDN latency is not allowed to eat the clue
    expect(sound.playPreview).not.toHaveBeenCalled();
    expect(sound.primePreview).toHaveBeenCalledWith(PREVIEW);
  });

  test('plays the song at half the clock, once, with the audited cut', () => {
    // #given the same question ticking from 4.9s to 5.0s and on
    const { rerender } = render(screen(SLEEVE, at(4_900)));
    expect(sound.playPreview).not.toHaveBeenCalled();

    // #when the clue lands
    rerender(screen(SLEEVE, at(5_000)));

    // #then the song starts, from the audited start and cut
    expect(sound.playPreview).toHaveBeenCalledTimes(1);
    expect(sound.playPreview).toHaveBeenCalledWith(PREVIEW, 2, 9);

    // #and the ticks after it do not start it again
    rerender(screen(SLEEVE, at(5_100)));
    rerender(screen(SLEEVE, at(6_000)));
    expect(sound.playPreview).toHaveBeenCalledTimes(1);
  });

  test('a player who arrives after half-clock hears it at once', () => {
    // #given somebody whose screen first renders the question at 7s
    render(screen(SLEEVE, at(7_000)));

    // #then the song starts, rather than waiting for a moment that has passed
    expect(sound.playPreview).toHaveBeenCalledTimes(1);
  });

  test('the replay button cannot fetch the song early', () => {
    // #given the cover alone, 3s in
    const { container } = render(screen(SLEEVE, at(3_000)));
    const button = replayButton(container);

    // #then the button is there — so nothing jumps when the song arrives — but
    // it is disabled, and says what is coming
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toMatch(/halfway/i);

    // #when somebody clicks it anyway
    if (button) fireEvent.click(button);

    // #then nothing plays
    expect(sound.playPreview).not.toHaveBeenCalled();
  });

  test('neither can the R key', () => {
    render(screen(SLEEVE, at(3_000)));
    fireEvent.keyDown(window, { key: 'r' });
    expect(sound.playPreview).not.toHaveBeenCalled();
  });

  test('once the song is out, the replay works as it does for a tune', () => {
    const { container } = render(screen(SLEEVE, at(6_000)));
    sound.playPreview.mockClear();
    const button = replayButton(container);
    expect(button?.disabled).toBe(false);
    if (button) fireEvent.click(button);
    expect(sound.playPreview).toHaveBeenCalledWith(PREVIEW, 2, 9);
  });

  test('carries the iTunes attribution while the song is still to come', () => {
    // #given Apple's condition (iii) is about a question that has a preview,
    // not about the instant it is audible
    const { container } = render(screen(SLEEVE, at(1_000)));
    expect(container.textContent).toContain('Provided courtesy of iTunes');
  });

  test('offers the album’s store page at the reveal as a place to listen', () => {
    const { container } = render(screen(SLEEVE, at(10_000), true));
    const badge = container.querySelector('.store-badge');
    expect(badge?.getAttribute('href')).toBe(SLEEVE.storeUrl);
  });
});

describe('a sleeve without a song', () => {
  const SILENT = { ...SLEEVE };
  delete SILENT.previewUrl;
  delete SILENT.previewStart;
  delete SILENT.previewSeconds;

  test('plays exactly as it did: no song, no prime, no button', () => {
    const { container } = render(screen(SILENT, at(6_000)));
    expect(sound.playPreview).not.toHaveBeenCalled();
    expect(sound.primePreview).not.toHaveBeenCalled();
    expect(replayButton(container)).toBeNull();
  });
});

describe('a tune', () => {
  test('still plays from the first render, as it always has', () => {
    // #given Name that Tune, where the song is the question
    render(screen(TUNE, at(0)));

    // #then no hold and no prime — the clip starts straight away
    expect(sound.playPreview).toHaveBeenCalledTimes(1);
    expect(sound.primePreview).not.toHaveBeenCalled();
  });
});
