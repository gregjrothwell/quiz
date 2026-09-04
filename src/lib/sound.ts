import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * The house audio.
 *
 * Every cue is synthesised on the fly rather than shipped as a file. Six or
 * seven stings at ~30 kB each would have been a third again on a bundle the
 * handover already calls heavy, for sounds that are a handful of oscillators.
 * It also means no asset can 404 behind a corporate proxy and leave the round
 * silent with nothing on screen to say why.
 */

export type Cue = 'lock' | 'gong' | 'correct' | 'wrong' | 'sting' | 'fanfare';

const STORAGE_KEY = 'vibequiz.sound';

/** Quiet enough to play at a desk without anyone reaching for the volume key. */
const MASTER_GAIN = 0.22;

/**
 * One oscillator's worth of a cue. `to` bends the pitch across the note, which
 * is most of the difference between a buzzer and a beep.
 */
export interface Voice {
  type: OscillatorType;
  from: number;
  to?: number;
  /** Seconds after the cue starts. */
  start: number;
  duration: number;
  /** Relative to the master gain, so cues balance against each other. */
  gain: number;
  /** Low-pass corner. Absent leaves the oscillator unfiltered. */
  cutoff?: number;
}

const A2 = 110.0;
const C3 = 130.81;
const D3 = 146.83;
const DS3 = 155.56;
const E3 = 164.81;
const F3 = 174.61;
const G3 = 196.0;
const GS3 = 207.65;
const E4 = 329.63;
const F4 = 349.23;
const G4 = 392.0;
const GS4 = 415.3;
const A4 = 440.0;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

const CUES: Record<Cue, Voice[]> = {
  // A click riding a short pitch drop: the sound of something mechanical
  // committing, so an answer feels posted rather than merely registered.
  lock: [
    { type: 'sine', from: 320, to: 90, start: 0, duration: 0.16, gain: 1.1 },
    { type: 'square', from: 1200, start: 0, duration: 0.02, gain: 0.45, cutoff: 3000 },
  ],

  /*
    Time's up, and the beat between the clock stopping and the verdict landing.

    A struck gong, which is the one thing every countdown in broadcasting has
    ended on since long before television. Built from partials at deliberately
    non-whole-number ratios — that inharmonicity is the whole difference between
    a bell and a bass note, because a struck plate does not vibrate in neat
    octaves. It rings for the best part of two seconds and the replay runs over
    the top of it.
  */
  gong: [
    // Tuned to A, so it is not merely a noise at zero but the tonic the walk
    // has been climbing towards for nine seconds. The bed ends on a leading
    // tone; this is the chord it wanted, arriving a beat later than comfortable.
    { type: 'sine', from: A2, start: 0, duration: 2.1, gain: 0.9 },
    { type: 'sine', from: 166, start: 0, duration: 1.6, gain: 0.4 },
    { type: 'triangle', from: 235, start: 0, duration: 1.15, gain: 0.28 },
    { type: 'sine', from: 298, start: 0, duration: 0.9, gain: 0.2, cutoff: 2400 },
    { type: 'triangle', from: 421, start: 0, duration: 0.62, gain: 0.14, cutoff: 2400 },
    { type: 'sine', from: 572, start: 0, duration: 0.44, gain: 0.09, cutoff: 2400 },
    // The stick hitting the metal, before any of it starts ringing.
    { type: 'square', from: 1100, start: 0, duration: 0.02, gain: 0.2, cutoff: 3000 },
  ],

  correct: [
    { type: 'triangle', from: C5, start: 0, duration: 0.12, gain: 0.8 },
    { type: 'triangle', from: E5, start: 0.07, duration: 0.12, gain: 0.8 },
    { type: 'triangle', from: G5, start: 0.14, duration: 0.16, gain: 0.8 },
    { type: 'sine', from: C6, start: 0.21, duration: 0.5, gain: 0.7 },
  ],

  // Two saws a few hertz apart beat against each other, which is what makes a
  // buzzer sound like a buzzer instead of a low note.
  wrong: [
    { type: 'sawtooth', from: 150, to: 96, start: 0, duration: 0.38, gain: 0.55, cutoff: 900 },
    { type: 'sawtooth', from: 143, to: 92, start: 0, duration: 0.38, gain: 0.55, cutoff: 900 },
  ],

  sting: [
    { type: 'sawtooth', from: 180, to: 900, start: 0, duration: 0.28, gain: 0.35, cutoff: 2200 },
    { type: 'triangle', from: C5, start: 0.26, duration: 0.42, gain: 0.7 },
    { type: 'triangle', from: G5, start: 0.26, duration: 0.42, gain: 0.55 },
  ],

  fanfare: [
    { type: 'triangle', from: G4, start: 0, duration: 0.14, gain: 0.8 },
    { type: 'triangle', from: G4, start: 0.15, duration: 0.14, gain: 0.8 },
    { type: 'triangle', from: C5, start: 0.3, duration: 0.2, gain: 0.85 },
    { type: 'triangle', from: E5, start: 0.5, duration: 0.2, gain: 0.85 },
    { type: 'triangle', from: G5, start: 0.7, duration: 0.75, gain: 0.9 },
    { type: 'sine', from: C6, start: 0.7, duration: 0.75, gain: 0.5 },
  ],
};

/**
 * How long the clock is audible for, whatever the answer window is.
 *
 * Not the whole question: fifteen of these in a row is a lot of music, and the
 * bed earns its tension by arriving rather than by having always been there.
 */
export const CLOCK_LEAD_SECONDS = 9;

/**
 * One second of the clock, held by *how many seconds are left* rather than by
 * how many have passed.
 *
 * That indexing is the whole design. The bed is not a fixed piece stretched to
 * fit the answer window — it is composed backwards from the buzzer, so a 10, 15
 * or 20 second question all land the identical cadence and only differ in how
 * much of the walk they get in front of it. A window shorter than the lead (an
 * imported room can be as low as five seconds) simply starts further down the
 * table, and still finishes on the same note.
 *
 * The notes are ours, and that is the only line that actually matters. What is
 * protected in the Countdown clock is Alan Hawkshaw's melody, which Channel 4
 * owns and which appears nowhere here. What is not protectable — and what does
 * most of the work of sounding like teatime television — is the furniture
 * around it: a walking bass under a metronome, brass marking the phrase, and a
 * gong at zero. Those are ideas, and ideas are free.
 *
 * The accents fall every third second, so the walk groups into threes and
 * carries a waltz lilt rather than a march.
 */
interface ClockCell {
  /** The walk. One note per second, which is also the clock. */
  bass: number;
  /** A brass stab, voiced as a chord rather than a single note. */
  stab?: readonly number[];
  /** A ride cymbal on the swung offbeat. */
  ride?: boolean;
  /** The vibraslap that opens the bed. */
  rattle?: boolean;
}

/**
 * Read backwards: the first entry is the last second before the buzzer.
 *
 * The harmony is a iv–V–i turnaround in A minor, which is furniture rather than
 * invention — it is the progression under a good half of the standards written
 * before 1960, and progressions of that kind are not anybody's property. The
 * walk approaches the V chromatically from below, because that is what a bass
 * player does and it is the single thing that most separates a walking line
 * from an arpeggio.
 */
const CLOCK: readonly ClockCell[] = [
  // The third of the V chord: a leading tone, left hanging. It wants to resolve
  // up to A and never does — the gong is tuned to land on exactly that note,
  // which is what makes zero feel finished rather than merely quiet.
  { bass: GS3, ride: true },
  { bass: G3, ride: true },
  { bass: E3, stab: [GS4, D5, G5], ride: true },
  { bass: DS3, ride: true },
  { bass: D3 },
  { bass: F3, stab: [F4, A4, D5] },
  { bass: E3 },
  { bass: C3 },
  { bass: A2, stab: [E4, G4, C5], rattle: true },
];

/**
 * A ride cymbal, as close as oscillators get to one: high partials at ratios
 * that belong to no scale, decaying fast. Real cymbals are noise, and there is
 * no noise source here — but a handful of inharmonic tones above 3 kHz reads as
 * metal to the ear, which is all the cue has to do.
 */
function ride(start: number): Voice[] {
  return [
    { type: 'square', from: 3300, start, duration: 0.09, gain: 0.09, cutoff: 9000 },
    { type: 'square', from: 4730, start, duration: 0.07, gain: 0.07, cutoff: 9000 },
    { type: 'sawtooth', from: 6140, start, duration: 0.05, gain: 0.045, cutoff: 9000 },
  ];
}

/**
 * A vibraslap: the wooden rattle that opens the bed and says the clock has
 * started. Eight clicks falling in pitch and volume, spaced unevenly because an
 * evenly spaced rattle is a machine gun.
 */
const RATTLE_OFFSETS = [0, 0.045, 0.083, 0.118, 0.152, 0.184, 0.219, 0.257];

function rattle(start: number): Voice[] {
  return RATTLE_OFFSETS.map((offset, index) => ({
    type: 'square' as const,
    from: 2400 - index * 95,
    start: start + offset,
    duration: 0.03,
    gain: 0.13 * Math.pow(0.79, index),
    cutoff: 6000,
  }));
}

/**
 * Where the offbeat falls. Two thirds of the way through the beat rather than
 * halfway, which is swing — the difference between a big band and a metronome,
 * and worth more to how this reads than any note choice in the table above.
 */
const SWING = 2 / 3;

/**
 * The bed as a flat list of voices, offset so that each cell lands on its own
 * whole second of the countdown.
 *
 * Offsets are measured from the real time remaining rather than from whenever
 * this was called, because the caller is driven by a 100ms interval. Scheduling
 * relative to the call would put the music up to a tenth of a second out from
 * the timer face — inaudible on a lone beep, but a pulse that wanders is the
 * difference between a clock and a fault.
 */
export function clockVoices(remainingMs: number): Voice[] {
  const voices: Voice[] = [];
  const audibleFrom = Math.min(Math.floor(remainingMs / 1000), CLOCK_LEAD_SECONDS);

  for (const [position, cell] of CLOCK.entries()) {
    const left = position + 1;
    if (left > audibleFrom) break;

    const start = Math.max(0, (remainingMs - left * 1000) / 1000);

    // Fundamental plus an octave below it. The sub is what stops the walk
    // reading as a synth arpeggio and starts it reading as somebody playing a
    // bass, which is most of the difference between a phone game and a studio.
    voices.push({ type: 'triangle', from: cell.bass, start, duration: 0.4, gain: 0.42, cutoff: 1100 });
    voices.push({ type: 'sine', from: cell.bass / 2, start, duration: 0.34, gain: 0.3 });

    voices.push({
      type: 'square',
      from: left % 2 === 0 ? 1800 : 1400,
      start,
      duration: 0.03,
      gain: 0.34,
      cutoff: 4000,
    });

    if (cell.stab !== undefined) {
      // Each note of the chord doubled a few hertz apart, filtered. Two saws
      // beating against each other is the same trick as the buzzer, but tuned
      // and stacked it lands as a brass section rather than a klaxon — and
      // three notes at once is what makes it a section rather than a trumpet.
      for (const note of cell.stab) {
        voices.push({ type: 'sawtooth', from: note, start, duration: 0.45, gain: 0.1, cutoff: 2000 });
        voices.push({
          type: 'sawtooth',
          from: note * 1.006,
          start,
          duration: 0.45,
          gain: 0.1,
          cutoff: 2000,
        });
      }
    }

    if (cell.rattle) voices.push(...rattle(start));
    if (cell.ride) voices.push(...ride(start + SWING));
  }

  return voices;
}

/** The voices behind a cue, for tests and for rendering previews offline. */
export function cueVoices(cue: Cue): readonly Voice[] {
  return CUES[cue];
}

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    // Private windows and locked-down profiles throw on access. Silence is the
    // wrong default for a quiz show, so an unreadable preference means sound on.
    return false;
  }
}

let context: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * Browsers refuse to start an AudioContext outside a user gesture, and one
 * created too early is born suspended. Both are handled by creating it on
 * demand and resuming on every play — `resume()` on a running context is a
 * no-op, so there is nothing to track.
 */
function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;

  if (!context || !master) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(context.destination);
  }

  return { ctx: context, out: master };
}

function strike(ctx: AudioContext, out: GainNode, voice: Voice, at: number): OscillatorNode {
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();

  oscillator.type = voice.type;
  const startAt = at + voice.start;
  const endAt = startAt + voice.duration;

  oscillator.frequency.setValueAtTime(voice.from, startAt);
  if (voice.to !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(voice.to, endAt);
  }

  // A 6 ms attack rather than an instant one: a square wave that starts at full
  // amplitude clicks on every device, which reads as a blown speaker.
  envelope.gain.setValueAtTime(0.0001, startAt);
  envelope.gain.exponentialRampToValueAtTime(voice.gain, startAt + 0.006);
  envelope.gain.exponentialRampToValueAtTime(0.0001, endAt);

  if (voice.cutoff === undefined) {
    oscillator.connect(envelope);
  } else {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = voice.cutoff;
    oscillator.connect(filter);
    filter.connect(envelope);
  }

  envelope.connect(out);
  oscillator.start(startAt);
  oscillator.stop(endAt + 0.02);

  return oscillator;
}

export function play(cue: Cue): void {
  if (muted) return;

  const nodes = audio();
  if (!nodes) return;

  const { ctx, out } = nodes;
  if (ctx.state === 'suspended') void ctx.resume();

  const at = ctx.currentTime;
  for (const voice of CUES[cue]) strike(ctx, out, voice, at);
}

let clockNodes: { gain: GainNode; sources: OscillatorNode[] } | null = null;
let sequenceNodes: { gain: GainNode; sources: OscillatorNode[] } | null = null;

/**
 * Starts the closing clock, given the milliseconds actually left on it.
 *
 * The whole bed is scheduled in one call rather than a note at a time, so the
 * pulse is sample-accurate for the rest of the question no matter what the
 * render loop is doing — a dropped frame or a slow snapshot cannot make it
 * stumble. The cost is that it commits to an ending, which is why `stopClock`
 * exists: anything that ends the question early has to come and cancel it.
 */
/**
 * Plays an arbitrary note sequence through its own gain node.
 *
 * The missing export a melody round needs. Same shape as {@link startClock}:
 * schedule the lot in one call, cancel with {@link stopSequence}. A muted
 * player hears nothing — the lobby has to force that issue when a melody
 * pack actually exists.
 */
export function playSequence(voices: Voice[]): void {
  stopSequence();
  stopClock();
  if (muted || voices.length === 0) return;

  const nodes = audio();
  if (!nodes) return;

  const { ctx, out } = nodes;
  if (ctx.state === 'suspended') void ctx.resume();

  const gain = ctx.createGain();
  gain.connect(out);

  const at = ctx.currentTime;
  const sources = voices.map((voice) => strike(ctx, gain, voice, at));

  sequenceNodes = { gain, sources };
}

/** Silences a running sequence. Safe to call when there isn't one. */
export function stopSequence(): void {
  const running = sequenceNodes;
  if (!running || !context) return;
  sequenceNodes = null;

  const now = context.currentTime;
  running.gain.gain.cancelScheduledValues(now);
  running.gain.gain.setValueAtTime(running.gain.gain.value, now);
  running.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

  for (const source of running.sources) source.stop(now + 0.05);
  window.setTimeout(() => running.gain.disconnect(), 200);
}

export function startClock(remainingMs: number): void {
  stopSequence();
  stopClock();
  if (muted || remainingMs <= 0) return;

  const nodes = audio();
  if (!nodes) return;

  const { ctx, out } = nodes;
  if (ctx.state === 'suspended') void ctx.resume();

  // Its own gain node, so the fade in `stopClock` takes the bed without
  // ducking any cue that happens to be ringing at the same moment.
  const gain = ctx.createGain();
  gain.connect(out);

  const at = ctx.currentTime;
  const sources = clockVoices(remainingMs).map((voice) => strike(ctx, gain, voice, at));

  clockNodes = { gain, sources };
}

/** Silences a running clock. Safe to call when there isn't one. */
export function stopClock(): void {
  const running = clockNodes;
  if (!running || !context) return;
  clockNodes = null;

  // Cutting the oscillators dead mid-cycle pops. A 40ms fade is short enough to
  // read as immediate and long enough that the speaker never hears an edge.
  const now = context.currentTime;
  running.gain.gain.cancelScheduledValues(now);
  running.gain.gain.setValueAtTime(running.gain.gain.value, now);
  running.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

  for (const source of running.sources) source.stop(now + 0.05);
  window.setTimeout(() => running.gain.disconnect(), 200);
}

/**
 * Wakes the audio stack on a real user gesture. Called from the first click or
 * keypress, so the first cue of a round plays on time rather than being the one
 * that pays for starting the context.
 */
export function unlock(): void {
  const nodes = audio();
  if (nodes && nodes.ctx.state === 'suspended') void nodes.ctx.resume();
}

export function setMuted(next: boolean): void {
  muted = next;
  // The bed is scheduled to the buzzer the moment it starts, so muting has to
  // reach in and cancel it rather than wait for the next note not to play.
  if (next) {
    stopClock();
    stopSequence();
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? 'off' : 'on');
  } catch {
    // A preference that cannot be stored still applies for this session.
  }
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Fires `cue` once for each distinct `key`, while `enabled`.
 *
 * The key is what makes this safe to call from a component: StrictMode
 * double-invokes effects in development, a re-render for any other reason
 * re-runs them in production, and a buzzer that plays twice sounds broken.
 * Passing the question index — or the game id — means the cue is tied to the
 * moment it belongs to rather than to a render.
 */
export function useCue(cue: Cue, key: string | number, enabled = true): void {
  const playedRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!enabled || playedRef.current === key) return;
    playedRef.current = key;
    play(cue);
  }, [cue, key, enabled]);
}

export interface SoundControls {
  muted: boolean;
  toggle: () => void;
  play: (cue: Cue) => void;
}

export function useSound(): SoundControls {
  const isMuted = useSyncExternalStore(
    subscribe,
    () => muted,
    () => true,
  );

  const toggle = useCallback(() => {
    // Unmuting is itself a gesture, so it is the natural moment to start the
    // context for anyone whose browser has been holding it suspended.
    if (isMuted) unlock();
    setMuted(!isMuted);
  }, [isMuted]);

  return { muted: isMuted, toggle, play };
}
