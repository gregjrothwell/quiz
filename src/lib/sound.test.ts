import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { HAPPY_BIRTHDAY } from '../questions/melody-voices';
import {
  CLOCK_LEAD_SECONDS,
  clockVoices,
  cueVoices,
  playSequence,
  sequenceDurationMs,
  setMuted,
  startClock,
  stopClock,
  stopSequence,
  type Voice,
} from './sound';

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

describe('sequenceDurationMs', () => {
  test('is the last voice going quiet, not the last attack', () => {
    // #given two notes that overlap, the second starting before the first ends
    const voices: Voice[] = [
      { type: 'triangle', from: 440, start: 0, duration: 1, gain: 0.7 },
      { type: 'triangle', from: 494, start: 0.5, duration: 0.2, gain: 0.7 },
    ];

    // #when the clip length is measured
    const durationMs = sequenceDurationMs(voices);

    // #then it is the first note's tail, not the second attack
    expect(durationMs).toBe(1000);
  });

  test('is zero for an empty sequence', () => {
    expect(sequenceDurationMs([])).toBe(0);
  });

  test('matches the Happy Birthday fixture', () => {
    // last note: start 1.5 + duration 0.55
    expect(sequenceDurationMs(HAPPY_BIRTHDAY)).toBe(2050);
  });
});

const CLIP: Voice[] = [
  { type: 'triangle', from: 440, start: 0, duration: 0.2, gain: 0.7 },
  { type: 'triangle', from: 494, start: 0.25, duration: 0.2, gain: 0.7 },
];

function installFakeAudio(): void {
  class FakeParam {
    value = 1;
    setValueAtTime(): FakeParam {
      return this;
    }
    exponentialRampToValueAtTime(): FakeParam {
      return this;
    }
    cancelScheduledValues(): FakeParam {
      return this;
    }
  }

  class FakeNode {
    connect(): FakeNode {
      return this;
    }
    disconnect(): void {}
  }

  class FakeOscillator extends FakeNode {
    type: OscillatorType = 'sine';
    frequency = new FakeParam();
    start(): void {}
    stop(): void {}
  }

  class FakeGain extends FakeNode {
    gain = new FakeParam();
  }

  class FakeFilter extends FakeNode {
    type = 'lowpass';
    frequency = new FakeParam();
  }

  class FakeAudioContext {
    currentTime = 0;
    state: AudioContextState = 'running';
    destination = new FakeNode();
    createOscillator(): FakeOscillator {
      return new FakeOscillator();
    }
    createGain(): FakeGain {
      return new FakeGain();
    }
    createBiquadFilter(): FakeFilter {
      return new FakeFilter();
    }
    resume(): Promise<void> {
      return Promise.resolve();
    }
  }

  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('localStorage', {
    getItem: (): string | null => null,
    setItem: (): void => undefined,
    removeItem: (): void => undefined,
    clear: (): void => undefined,
    key: (): string | null => null,
    length: 0,
  });
  vi.stubGlobal('window', globalThis);
}

describe('playSequence end callback', () => {
  beforeAll(() => {
    installFakeAudio();
  });

  afterEach(() => {
    stopSequence();
    stopClock();
    setMuted(false);
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  test('fires once the last note has finished, not before', () => {
    vi.useFakeTimers();
    const onEnded = vi.fn();

    // #given a 450ms clip
    playSequence(CLIP, onEnded);

    // #when the last note is still sounding
    vi.advanceTimersByTime(sequenceDurationMs(CLIP) - 1);

    // #then the bed-resume has not been offered yet
    expect(onEnded).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  test('does not fire if the sequence is stopped first', () => {
    vi.useFakeTimers();
    const onEnded = vi.fn();

    // #given a clip that has started
    playSequence(CLIP, onEnded);

    // #when it is cancelled the way reveal, mute and unmount cancel it
    stopSequence();
    vi.advanceTimersByTime(sequenceDurationMs(CLIP) + 1_000);

    // #then the bed does not come back
    expect(onEnded).not.toHaveBeenCalled();
  });

  test('does not fire if the clock is stopped first', () => {
    vi.useFakeTimers();
    const onEnded = vi.fn();

    playSequence(CLIP, onEnded);
    stopClock();
    vi.advanceTimersByTime(sequenceDurationMs(CLIP) + 1_000);

    expect(onEnded).not.toHaveBeenCalled();
  });

  test('a re-tap cancels the first callback so they do not stack', () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const second = vi.fn();

    // #given a clip already playing
    playSequence(CLIP, first);

    // #when it is asked for again before it has finished
    vi.advanceTimersByTime(100);
    playSequence(CLIP, second);
    vi.advanceTimersByTime(sequenceDurationMs(CLIP));

    // #then only the second clip's end is reported
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('startClock after the clip does not cancel a callback that already ran', () => {
    vi.useFakeTimers();
    const onEnded = vi.fn(() => {
      startClock(5_000);
    });

    // #given a melody whose end resumes the bed
    playSequence(CLIP, onEnded);
    vi.advanceTimersByTime(sequenceDurationMs(CLIP));

    // #then the resume ran, and startClock's stopSequence did not eat it
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  test('startClock during a clip cancels the end callback', () => {
    vi.useFakeTimers();
    const onEnded = vi.fn();

    // #given a sequence still playing — the non-melody startClock path
    playSequence(CLIP, onEnded);
    startClock(5_000);
    vi.advanceTimersByTime(sequenceDurationMs(CLIP) + 1_000);

    // #then the bed the caller just started is the only one that will run
    expect(onEnded).not.toHaveBeenCalled();
  });

  test('muting cancels the end callback', () => {
    vi.useFakeTimers();
    const onEnded = vi.fn();

    playSequence(CLIP, onEnded);
    setMuted(true);
    vi.advanceTimersByTime(sequenceDurationMs(CLIP) + 1_000);

    expect(onEnded).not.toHaveBeenCalled();
  });

  test('does not arm a callback while muted', () => {
    vi.useFakeTimers();
    const onEnded = vi.fn();

    setMuted(true);
    playSequence(CLIP, onEnded);
    vi.advanceTimersByTime(sequenceDurationMs(CLIP) + 1_000);

    expect(onEnded).not.toHaveBeenCalled();
  });
});

describe('Happy Birthday', () => {
  test('is a smoke-test fixture, not a published pack tune', () => {
    expect(HAPPY_BIRTHDAY.every((voice) => voice.type === 'triangle')).toBe(true);
    expect(HAPPY_BIRTHDAY.length).toBeGreaterThan(0);
  });
});
