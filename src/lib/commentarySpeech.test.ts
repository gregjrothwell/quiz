import { afterEach, describe, expect, test } from 'vitest';
import {
  claimLine,
  createStuckQueue,
  flushSpeechQueue,
  releaseLine,
  resetSpokenLines,
  type SpeechUtterance,
} from './commentarySpeech';

/**
 * The queue that played the standings line again during the podium
 * (room 5SVU, 22 October 2026, PROJ-59). `createStuckQueue` is that engine:
 * a finished line stays paused, `cancel()` does nothing while it is, and the
 * next `speak()` plays it again.
 */

const RUNAWAY = 'Ann is running away with it.';
const PODIUM = 'Ann’s first win. About time.';

function utter(text: string): SpeechUtterance {
  return { text, lang: '', volume: 1, voice: null, onend: null };
}

/** What release #136 did: `cancel()`, then `speak()`, with no resume. */
function speak136(queue: ReturnType<typeof createStuckQueue>, text: string): void {
  queue.synth.cancel();
  queue.synth.speak(utter(text));
  queue.finish();
}

function speakFixed(queue: ReturnType<typeof createStuckQueue>, text: string): void {
  flushSpeechQueue(queue.synth);
  queue.synth.speak(utter(text));
  queue.finish();
}

afterEach(resetSpokenLines);

describe('the stuck speech queue', () => {
  test('cancel-then-speak plays the standings line again when the podium speaks', () => {
    const queue = createStuckQueue();
    speak136(queue, RUNAWAY);
    speak136(queue, PODIUM);
    expect(queue.heard).toEqual([RUNAWAY, RUNAWAY, PODIUM]);
  });

  test('flushing the paused queue before the podium line plays the standings line once', () => {
    const queue = createStuckQueue();
    speakFixed(queue, RUNAWAY);
    speakFixed(queue, PODIUM);
    expect(queue.heard).toEqual([RUNAWAY, PODIUM]);
  });
});

describe('a line claimed for the game', () => {
  test('the same words once per game, and again in the next one', () => {
    expect(claimLine('5SVU', RUNAWAY)).toBe(true);
    expect(claimLine('5SVU', RUNAWAY)).toBe(false);
    expect(claimLine('5SVU', PODIUM)).toBe(true);
    expect(claimLine('next', RUNAWAY)).toBe(true);
  });

  test('a claim that did not speak can be tried again', () => {
    expect(claimLine('5SVU', RUNAWAY)).toBe(true);
    releaseLine('5SVU', RUNAWAY);
    expect(claimLine('5SVU', RUNAWAY)).toBe(true);
  });
});
