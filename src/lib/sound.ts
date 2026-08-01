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

export type Cue = 'tick' | 'tock' | 'lock' | 'hush' | 'correct' | 'wrong' | 'sting' | 'fanfare';

const STORAGE_KEY = 'vibequiz.sound';

/** Quiet enough to play at a desk without anyone reaching for the volume key. */
const MASTER_GAIN = 0.22;

/**
 * One oscillator's worth of a cue. `to` bends the pitch across the note, which
 * is most of the difference between a buzzer and a beep.
 */
interface Voice {
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

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const G4 = 392.0;

const CUES: Record<Cue, Voice[]> = {
  // Two pitches alternating reads as a clock rather than a repeated beep.
  tick: [{ type: 'square', from: 1800, start: 0, duration: 0.03, gain: 0.5, cutoff: 4000 }],
  tock: [{ type: 'square', from: 1400, start: 0, duration: 0.03, gain: 0.5, cutoff: 4000 }],

  // A click riding a short pitch drop: the sound of something mechanical
  // committing, so an answer feels posted rather than merely registered.
  lock: [
    { type: 'sine', from: 320, to: 90, start: 0, duration: 0.16, gain: 1.1 },
    { type: 'square', from: 1200, start: 0, duration: 0.02, gain: 0.45, cutoff: 3000 },
  ],

  // Under the beat between the clock stopping and the verdict landing. Rising,
  // quiet, and unresolved on purpose — it has to leave somewhere for the chord
  // or the buzzer to arrive.
  hush: [{ type: 'sine', from: 70, to: 190, start: 0, duration: 0.62, gain: 0.5, cutoff: 700 }],

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

function strike(ctx: AudioContext, out: GainNode, voice: Voice, at: number): void {
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
