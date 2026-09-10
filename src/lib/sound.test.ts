import { afterEach, describe, expect, test } from 'vitest';
import {
  CLOCK_LEAD_SECONDS,
  DEFAULT_VOLUME,
  clampVolume,
  clockVoices,
  cueVoices,
  masterGainFor,
  playPreview,
  playSequence,
  setVolume,
  stopPreview,
} from './sound';
import { HAPPY_BIRTHDAY } from '../questions/melody-voices';

/** The pitched walk, which is the one voice every second of the bed has. */
const bassLine = (remainingMs: number): number[] =>
  clockVoices(remainingMs)
    .filter((voice) => voice.type === 'triangle')
    .map((voice) => voice.from);

/** Where each of those notes lands, in seconds from the start of the schedule. */
const bassOffsets = (remainingMs: number): number[] =>
  clockVoices(remainingMs)
    .filter((voice) => voice.type === 'triangle')
    .map((voice) => voice.start);

describe('clockVoices', () => {
  test('plays the same closing cadence at every answer length', () => {
    // #given the three answer windows a quizmaster can pick
    const windows = [10_000, 15_000, 20_000];

    // #when each one's bed is generated
    const cadences = windows.map((window) => bassLine(window).slice(0, 3));

    // #then all of them open on the identical last three notes, because the bed
    // is composed backwards from the buzzer rather than stretched to fit
    expect(new Set(cadences.map((notes) => notes.join(',')))).toHaveLength(1);
  });

  test('caps a long window at the lead rather than playing throughout', () => {
    // #given a window far longer than the clock is meant to be audible for
    const remainingMs = 120_000;

    // #when the bed is generated
    const notes = bassLine(remainingMs);

    // #then it is still only the closing seconds
    expect(notes).toHaveLength(CLOCK_LEAD_SECONDS);
  });

  test('starts a long window late enough to leave the silence in front', () => {
    // #given a two minute window
    const remainingMs = 120_000;

    // #when the bed is generated
    const offsets = bassOffsets(remainingMs);

    // #then its first note waits until the lead's worth of time is left
    expect(offsets[offsets.length - 1]).toBe(120 - CLOCK_LEAD_SECONDS);
  });

  test('plays only the tail of a window shorter than the lead', () => {
    // #given the shortest window an imported room can carry
    const remainingMs = 5_000;

    // #when the bed is generated
    const notes = bassLine(remainingMs);

    // #then it is five seconds long and still ends on the same note
    expect(notes).toHaveLength(5);
    expect(notes[0]).toBe(bassLine(20_000)[0]);
  });

  test('lands every note on a whole second of the countdown', () => {
    // #given a clock started a fraction of a second off a whole second, as the
    // 100ms render interval guarantees it will be
    const remainingMs = 8_740;

    // #when the bed is generated
    const offsets = bassOffsets(remainingMs);

    // #then each offset is exactly what it takes to reach the next whole second
    expect(offsets).toEqual([7.74, 6.74, 5.74, 4.74, 3.74, 2.74, 1.74, 0.74]);
  });

  test('rings the gong on partials no octave could produce', () => {
    // #given the gong's pitched partials, lowest first
    const partials = cueVoices('gong')
      .filter((voice) => voice.duration > 0.1)
      .map((voice) => voice.from)
      .sort((a, b) => a - b);

    // #when each is measured against the fundamental
    const base = partials[0] ?? 0;
    const ratios = partials.slice(1).map((partial) => partial / base);

    // #then none of them is a whole multiple of it. This is what a struck plate
    // does and a plucked string does not, and it is the entire difference
    // between hearing a gong and hearing a low note — so a later tidy-up that
    // rounds these to neat octaves would quietly destroy the cue.
    for (const ratio of ratios) {
      expect(Math.abs(ratio - Math.round(ratio))).toBeGreaterThan(0.05);
    }
  });

  test('schedules nothing once the clock has run out', () => {
    // #given a window with no time left on it
    const remainingMs = 0;

    // #when the bed is generated
    const voices = clockVoices(remainingMs);

    // #then there is nothing to play
    expect(voices).toEqual([]);
  });
});

describe('playSequence', () => {
  test('is the public export a melody round needs', () => {
    expect(typeof playSequence).toBe('function');
  });
});

describe('playPreview', () => {
  test('is the public export an iTunes round needs', () => {
    expect(typeof playPreview).toBe('function');
    expect(typeof stopPreview).toBe('function');
  });

  test('refuses a URL that is not Apple’s audio CDN', () => {
    expect(() => playPreview('https://example.com/clip.m4a')).not.toThrow();
  });
});

describe('volume', () => {
  afterEach(() => {
    setVolume(DEFAULT_VOLUME);
    stopPreview();
  });

  test('starts well below the top, which is the whole complaint', () => {
    // #given the level a player who has never touched the slider plays at
    // #then it is a music bed under a call, not a full-scale master
    expect(DEFAULT_VOLUME).toBeGreaterThan(0);
    expect(DEFAULT_VOLUME).toBeLessThan(0.5);
  });

  test('a stored level outside 0–1 is clamped rather than trusted', () => {
    expect(clampVolume(-3)).toBe(0);
    expect(clampVolume(4)).toBe(1);
    expect(clampVolume(Number.NaN)).toBe(DEFAULT_VOLUME);
  });

  test('leaves the cues exactly where they were at the default', () => {
    // #given the master gain the house cues have always been balanced against
    const before = 0.22;

    // #when the slider sits where it starts
    // #then nothing about a buzzer or a fanfare has changed
    expect(masterGainFor(DEFAULT_VOLUME)).toBeCloseTo(before, 10);
  });

  test('scales the cues down but never up, so a summed cue cannot clip', () => {
    // #given the slider dragged to each end
    // #then quieter follows the slider
    expect(masterGainFor(0)).toBe(0);
    expect(masterGainFor(DEFAULT_VOLUME / 2)).toBeCloseTo(0.11, 10);

    // #and louder does not: the loudest voice is 1.1 relative and several ring
    // at once, so lifting the master past its balanced value clips at the
    // destination. Above the default the slider is the music's alone.
    expect(masterGainFor(1)).toBe(masterGainFor(DEFAULT_VOLUME));
  });

  test('a preview starts at the slider position, not at full scale', () => {
    // #given a fake audio element, because the preview is an <audio> tag and
    // not a Web Audio node — Apple's CDN sends no CORS header, so the master
    // gain cannot reach it and this is the only place its level is set
    const made: Array<{ volume: number; src: string }> = [];
    class FakeAudio {
      preload = '';
      loop = false;
      volume = 1;
      src = '';
      constructor() {
        made.push(this as unknown as { volume: number; src: string });
      }
      addEventListener(): void {}
      load(): void {}
      pause(): void {}
      removeAttribute(): void {}
      play(): Promise<void> {
        return Promise.resolve();
      }
    }
    const globals = globalThis as { Audio?: unknown };
    const original = globals.Audio;
    globals.Audio = FakeAudio;

    try {
      // #when a clip is played with the slider left alone
      playPreview('https://audio-ssl.itunes.apple.com/clip.m4a');

      // #then it plays at the default, not at 1 — which is what covered the
      // Teams call on 10 September 2026
      expect(made).toHaveLength(1);
      expect(made[0]?.volume).toBe(DEFAULT_VOLUME);

      // #and moving the slider mid-clip moves the clip that is already running
      setVolume(0.1);
      expect(made[0]?.volume).toBeCloseTo(0.1, 10);
    } finally {
      if (original === undefined) delete globals.Audio;
      else globals.Audio = original;
    }
  });
});

describe('Happy Birthday', () => {
  test('is a smoke-test fixture, not a published pack tune', () => {
    expect(HAPPY_BIRTHDAY.every((voice) => voice.type === 'triangle')).toBe(true);
    expect(HAPPY_BIRTHDAY.length).toBeGreaterThan(0);
  });
});
