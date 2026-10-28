/**
 * Whether the Commentator may speak on this page.
 *
 * Off for players since 22 October 2026 (docs/decisions/commentator.md). A test
 * turns it on by setting `window.__commentarySpeech` before the app loads;
 * nothing in the live app does. Bringing the voice back is its own story.
 */
export function commentarySpeechOn(): boolean {
  if (typeof window === 'undefined') return false;
  const flag = (window as unknown as { __commentarySpeech?: boolean }).__commentarySpeech;
  return flag === true;
}

const spoken = new Set<string>();

function lineKey(gameId: string, text: string): string {
  return `${gameId}\u0000${text}`;
}

/**
 * Claim `text` for this game. False when this page has already submitted it,
 * including after the caption unmounts — a ref on the component does not
 * survive that, which is how the same line was spoken twice (PROJ-59).
 */
export function claimLine(gameId: string, text: string): boolean {
  const key = lineKey(gameId, text);
  if (spoken.has(key)) return false;
  spoken.add(key);
  return true;
}

/** Give a claim back when speech did not actually start (muted, no engine). */
export function releaseLine(gameId: string, text: string): void {
  spoken.delete(lineKey(gameId, text));
}

/** Tests only: the set lives for the page, so a test has to empty it. */
export function resetSpokenLines(): void {
  spoken.clear();
}

/**
 * Drop whatever the engine is still holding before a new line.
 *
 * Chrome can finish an utterance and leave it `paused` in the queue, and
 * `cancel()` does nothing while paused. The next `speak()` then resumes that
 * queue, so the previous line plays again. Room 5SVU heard the standings'
 * "…is running away with it" a second time when the podium spoke (PROJ-59).
 * `resume()` is what makes `cancel()` clear the queue; together they are
 * synchronous, so the paused line is not played out.
 */
export function flushSpeechQueue(synth: {
  readonly paused: boolean;
  resume(): void;
  cancel(): void;
}): void {
  if (synth.paused) synth.resume();
  synth.cancel();
}

/** One utterance, as little of the DOM type as the queue and `speak` share. */
export interface SpeechUtterance {
  text: string;
  lang: string;
  volume: number;
  voice: { lang: string } | null;
  onend: (() => void) | null;
}

/**
 * The engine room 5SVU was speaking through, reduced to the bug.
 *
 * A finished line stays queued and `paused`. `cancel()` is a no-op in that
 * state. `speak()` resumes the queue — the paused line is heard again — and
 * then speaks the new one. `resume()` alone does not play it; that is what
 * lets {@link flushSpeechQueue} clear the queue without a second hearing.
 * Not used by the app. The e2e recorder in `commentator.spec.ts` is this queue.
 */
export function createStuckQueue(): {
  heard: string[];
  finish: () => void;
  synth: {
    readonly paused: boolean;
    readonly speaking: boolean;
    readonly pending: boolean;
    resume: () => void;
    cancel: () => void;
    speak: (utterance: SpeechUtterance) => void;
    getVoices: () => readonly { lang: string }[];
  };
} {
  const heard: string[] = [];
  let queued: string[] = [];
  let paused = false;
  let speaking = false;
  let active: SpeechUtterance | null = null;

  return {
    heard,
    finish() {
      if (!active) return;
      queued = [active.text];
      speaking = false;
      paused = true;
      const done = active;
      active = null;
      done.onend?.();
    },
    synth: {
      get paused() {
        return paused;
      },
      get speaking() {
        return speaking;
      },
      get pending() {
        return queued.length > (speaking ? 1 : 0);
      },
      getVoices: () => [],
      resume() {
        paused = false;
      },
      cancel() {
        if (paused) return;
        queued = [];
        speaking = false;
        active = null;
      },
      speak(utterance) {
        if (paused && queued.length > 0) {
          paused = false;
          for (const line of queued) heard.push(line);
          queued = [];
        }
        heard.push(utterance.text);
        queued = [utterance.text];
        speaking = true;
        active = utterance;
      },
    },
  };
}
