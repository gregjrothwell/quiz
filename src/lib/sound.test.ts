import { describe, expect, test } from 'vitest';
import {
  CLOCK_LEAD_SECONDS,
  clockVoices,
  cueVoices,
  isMuted,
  playSequence,
  setMuted,
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

  /*
    "Hear it again" shipped on 8 September 2026 by calling `toggleMuted()` on a
    muted player. That writes the preference to localStorage and nothing puts it
    back, so one press to hear one tune left the bed, the buzzer, the stings and
    the fanfare audible for the rest of the round and into the next session — in
    an open-plan office, for somebody who had deliberately muted.

    The button promises one tune. These pin it to that.
  */
  test('playing through a mute does not unmute the player', () => {
    // #given a player who has deliberately turned sound off
    setMuted(true);
    expect(isMuted()).toBe(true);

    // #when they ask to hear the tune once
    playSequence(HAPPY_BIRTHDAY, { evenIfMuted: true });

    // #then they are still muted for everything else
    expect(isMuted()).toBe(true);
  });

  test('leaves the preference alone when it plays normally too', () => {
    // #given a player with sound on
    setMuted(false);

    // #when a tune plays
    playSequence(HAPPY_BIRTHDAY, { evenIfMuted: true });

    // #then nothing about their preference moved
    expect(isMuted()).toBe(false);
  });
});

describe('Happy Birthday', () => {
  test('is a smoke-test fixture, not a published pack tune', () => {
    expect(HAPPY_BIRTHDAY.every((voice) => voice.type === 'triangle')).toBe(true);
    expect(HAPPY_BIRTHDAY.length).toBeGreaterThan(0);
  });
});
