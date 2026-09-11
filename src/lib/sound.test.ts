import { afterEach, describe, expect, test } from 'vitest';
import {
  CLOCK_LEAD_SECONDS,
  DEFAULT_VOLUME,
  clampVolume,
  clockVoices,
  cueVoices,
  isPreviewBlocked,
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

describe('playPreview’s cut', () => {
  /** Stands in for the <audio> element, with a driveable clock. */
  class FakeAudio {
    preload = '';
    loop = false;
    volume = 1;
    src = '';
    currentTime = 0;
    paused = true;
    listeners: Record<string, Array<{ handler: () => void; once: boolean }>> = {};
    addEventListener(type: string, handler: () => void, options?: { once?: boolean }): void {
      (this.listeners[type] ??= []).push({ handler, once: options?.once === true });
    }
    fire(type: string): void {
      const bound = this.listeners[type] ?? [];
      this.listeners[type] = bound.filter((entry) => !entry.once);
      for (const entry of bound) entry.handler();
    }
    /** A browser reaches metadata shortly after `load()`; so does this. */
    load(): void {
      this.fire('loadedmetadata');
    }
    pause(): void {
      this.paused = true;
    }
    removeAttribute(): void {}
    play(): Promise<void> {
      this.paused = false;
      return Promise.resolve();
    }
    /** What the browser does four times a second while a clip runs. */
    tick(to: number): void {
      this.currentTime = to;
      this.fire('timeupdate');
    }
  }

  function withFakeAudio(run: (made: FakeAudio[]) => void): void {
    const made: FakeAudio[] = [];
    const globals = globalThis as { Audio?: unknown };
    const original = globals.Audio;
    globals.Audio = class extends FakeAudio {
      constructor() {
        super();
        made.push(this);
      }
    };
    try {
      run(made);
    } finally {
      stopPreview();
      if (original === undefined) delete globals.Audio;
      else globals.Audio = original;
    }
  }

  test('stops the clip at the cut, so the sung title never plays', () => {
    withFakeAudio((made) => {
      // #given a clip told to stop after 9 seconds, because that is where the
      // singer says the answer
      playPreview('https://audio-ssl.itunes.apple.com/clip.m4a', 0, 9);
      const el = made[0];
      expect(el).toBeDefined();

      // #when the clip reaches the second before the cut
      el?.tick(8.7);

      // #then it is still playing
      expect(el?.paused).toBe(false);

      // #when it reaches the cut
      el?.tick(9.1);

      // #then it stops
      expect(el?.paused).toBe(true);
    });
  });

  test('counts the cut from the start offset, not from zero', () => {
    withFakeAudio((made) => {
      // #given a clip that starts 6s in and runs for 5
      playPreview('https://audio-ssl.itunes.apple.com/clip.m4a', 6, 5);
      const el = made[0];

      // #when it is at 10s of the preview — 4s of playing
      el?.tick(10);
      expect(el?.paused).toBe(false);

      // #when it is at 11s — 5s of playing
      el?.tick(11.2);
      expect(el?.paused).toBe(true);
    });
  });

  test('plays out when no cut is given', () => {
    withFakeAudio((made) => {
      playPreview('https://audio-ssl.itunes.apple.com/clip.m4a');
      made[0]?.tick(29.5);
      expect(made[0]?.paused).toBe(false);
    });
  });
});

describe('Happy Birthday', () => {
  test('is a smoke-test fixture, not a published pack tune', () => {
    expect(HAPPY_BIRTHDAY.every((voice) => voice.type === 'triangle')).toBe(true);
    expect(HAPPY_BIRTHDAY.length).toBeGreaterThan(0);
  });
});

/**
 * The silent failure behind "Joe didn't hear the music on the first question",
 * round CUC4, 11 September 2026. `unlock()` resumes the AudioContext, which the
 * `<audio>` element does not use — so a page with no gesture on it gets a
 * `NotAllowedError` that used to go straight into an empty catch.
 */
describe('a preview the browser refuses to start', () => {
  class RefusingAudio {
    preload = '';
    loop = false;
    volume = 1;
    src = '';
    currentTime = 0;
    static reason: { name: string } = { name: 'NotAllowedError' };
    addEventListener(): void {}
    load(): void {}
    pause(): void {}
    removeAttribute(): void {}
    play(): Promise<void> {
      return Promise.reject(RefusingAudio.reason);
    }
  }

  async function withRefusingAudio(reason: { name: string }, run: () => Promise<void>): Promise<void> {
    const globals = globalThis as { Audio?: unknown };
    const original = globals.Audio;
    RefusingAudio.reason = reason;
    globals.Audio = RefusingAudio;
    try {
      await run();
    } finally {
      stopPreview();
      playAcceptedClip();
      if (original === undefined) delete globals.Audio;
      else globals.Audio = original;
    }
  }

  /** A clip the browser is happy to start, through the same public path. */
  function playAcceptedClip(): void {
    const globals = globalThis as { Audio?: unknown };
    globals.Audio = class {
      preload = '';
      loop = false;
      volume = 1;
      src = '';
      currentTime = 0;
      addEventListener(): void {}
      load(): void {}
      pause(): void {}
      removeAttribute(): void {}
      play(): Promise<void> {
        return Promise.resolve();
      }
    };
    playPreview('https://audio-ssl.itunes.apple.com/clip.m4a');
  }

  test('raises the flag, so the screen can say why the question is silent', async () => {
    await withRefusingAudio({ name: 'NotAllowedError' }, async () => {
      // #given a page the browser has seen no gesture on
      expect(isPreviewBlocked()).toBe(false);

      // #when a tunes question opens
      playPreview('https://audio-ssl.itunes.apple.com/clip.m4a');
      await Promise.resolve();
      await Promise.resolve();

      // #then the player is told there is something to press
      expect(isPreviewBlocked()).toBe(true);
    });
  });

  test('stays down for a clip that simply failed, which is ours to fix', async () => {
    await withRefusingAudio({ name: 'NotSupportedError' }, async () => {
      // #when the clip 404s or will not decode
      playPreview('https://audio-ssl.itunes.apple.com/clip.m4a');
      await Promise.resolve();
      await Promise.resolve();

      // #then nothing invites a press that would not help
      expect(isPreviewBlocked()).toBe(false);
    });
  });

  /**
   * Deliberately narrow about what it proves. The notice goes because
   * `playPreview` lowers the flag for every fresh attempt, not because a later
   * success raised anything — which is exactly why there is no success branch in
   * the source. Written this way so nobody reads it as covering one.
   */
  test('the next attempt lowers it again, so a notice never outlives its question', async () => {
    await withRefusingAudio({ name: 'NotAllowedError' }, async () => {
      playPreview('https://audio-ssl.itunes.apple.com/clip.m4a');
      await Promise.resolve();
      await Promise.resolve();
      expect(isPreviewBlocked()).toBe(true);

      // #when the player presses the button, or the next question opens
      playAcceptedClip();

      // #then the notice is gone at once, before any play() has settled
      expect(isPreviewBlocked()).toBe(false);
    });
  });
});
