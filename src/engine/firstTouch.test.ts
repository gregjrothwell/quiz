import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { carryFirstMs, firstTouchOf, liveAnswers, TOO_FAST_TO_READ_MS } from './answers';
import { replayTimeline } from './replay';
import { tallyQuestion } from './scoring';
import type { Answer, Player } from './state';

const player = (name: string): Player => ({ name, joinedAt: 0 });
const players: Record<string, Player> = { ann: player('Ann'), bo: player('Bo') };

describe('firstTouchOf', () => {
  it('reads an unchanged answer as its own first touch', () => {
    expect(firstTouchOf({ optionIndex: 1, elapsedMs: 4000 })).toBe(4000);
  });

  it('reads a changed answer as the moment it was first committed', () => {
    expect(firstTouchOf({ optionIndex: 1, elapsedMs: 4000, firstMs: 50 })).toBe(50);
  });

  it('reads a zero first touch as zero and not as absent', () => {
    // `?? ` and not `|| `. A touch on the very first millisecond is the whole
    // behaviour this exists to record, and `||` would throw it away.
    expect(firstTouchOf({ optionIndex: 1, elapsedMs: 4000, firstMs: 0 })).toBe(0);
  });
});

describe('carryFirstMs', () => {
  it('writes nothing for a first pick', () => {
    expect(carryFirstMs(undefined, 4000)).toEqual({});
  });

  it('carries the earlier touch once a pick is changed', () => {
    expect(carryFirstMs(50, 4000)).toEqual({ firstMs: 50 });
  });

  it('keeps the original touch across a second and third change', () => {
    const afterFirst = carryFirstMs(50, 4000);
    const afterSecond = carryFirstMs(afterFirst.firstMs, 6000);
    expect(afterSecond).toEqual({ firstMs: 50 });
  });

  it('writes nothing when the pick being made is itself the earliest', () => {
    // Keeps an unchanged answer byte-identical to every round before the field
    // existed, which is what narrows the damage if this ships before the paste.
    expect(carryFirstMs(4000, 4000)).toEqual({});
    expect(carryFirstMs(4000, 3000)).toEqual({});
  });

  it('survives four presses inside a burst that never round-trips', () => {
    // The case the whole field exists for. Firestore cannot be read back
    // synchronously, so a spammer's second, third and fourth presses see the
    // document exactly as it was before the first. Threading the earliest touch
    // forward is what keeps 50ms on the answer instead of losing it.
    let earliest: number | undefined;
    const written: Array<{ firstMs?: number }> = [];
    for (const ms of [50, 60, 70, 80]) {
      const carried = carryFirstMs(earliest, ms);
      written.push(carried);
      earliest = Math.min(earliest ?? ms, ms);
    }
    expect(written).toEqual([{}, { firstMs: 50 }, { firstMs: 50 }, { firstMs: 50 }]);
  });
});

describe('liveAnswers carries the first touch', () => {
  it('keeps firstMs when the document has one', () => {
    const docs = { ann: { optionIndex: 1, elapsedMs: 4000, firstMs: 50, questionIndex: 3 } };
    expect(liveAnswers(players, 3, docs)).toEqual({
      ann: { optionIndex: 1, elapsedMs: 4000, firstMs: 50 },
    });
  });

  it('leaves the shape untouched when the document has none', () => {
    // An answer written by a bundle that predates this field must come through
    // as exactly the object it always did, or every equality test in the engine
    // starts failing on a key nothing set.
    const docs = { ann: { optionIndex: 1, elapsedMs: 4000, questionIndex: 3 } };
    expect(liveAnswers(players, 3, docs)).toEqual({ ann: { optionIndex: 1, elapsedMs: 4000 } });
  });
});

describe('the replay marks a snap pick', () => {
  const timeline = (answers: Record<string, Answer>) =>
    Object.fromEntries(replayTimeline(answers).map((a) => [a.uid, a]));

  it('marks a guess that was kept, where elapsedMs is itself the early one', () => {
    const marked = timeline({ ann: { optionIndex: 0, elapsedMs: 50 } });
    expect(marked.ann?.snap).toBe(true);
    expect(marked.ann?.firstMs).toBe(50);
  });

  it('marks a guess that was revised, where only firstMs shows it', () => {
    const marked = timeline({ ann: { optionIndex: 0, elapsedMs: 4000, firstMs: 50 } });
    expect(marked.ann?.snap).toBe(true);
    expect(marked.ann?.firstMs).toBe(50);
  });

  it('leaves an honest change of mind unmarked', () => {
    // 3s to 7s is somebody reconsidering, and the room does not get told.
    const marked = timeline({ ann: { optionIndex: 0, elapsedMs: 7000, firstMs: 3000 } });
    expect(marked.ann?.snap).toBe(false);
  });

  it('leaves the fastest answer ever measured in a live room unmarked', () => {
    // 1.54s, room 3QDV, 8 September 2026. The threshold has to sit below the
    // fastest thing a human has actually done here or it libels somebody.
    const marked = timeline({ ann: { optionIndex: 0, elapsedMs: 1540 } });
    expect(marked.ann?.snap).toBe(false);
    expect(TOO_FAST_TO_READ_MS).toBeLessThan(1540);
  });

  it('does not move where an arrival lands in the replay', () => {
    // The marker is a label on the story, not a change to it.
    const [plain] = replayTimeline({ ann: { optionIndex: 0, elapsedMs: 4000 } });
    const [snapped] = replayTimeline({ ann: { optionIndex: 0, elapsedMs: 4000, firstMs: 50 } });
    expect(snapped?.atMs).toBe(plain?.atMs);
    expect(snapped?.elapsedMs).toBe(plain?.elapsedMs);
    expect(plain).toBeDefined();
  });

  it('ranks on elapsedMs, so a revised guess does not jump the queue', () => {
    const order = replayTimeline({
      ann: { optionIndex: 0, elapsedMs: 4000, firstMs: 50 },
      bo: { optionIndex: 1, elapsedMs: 2000 },
    }).map((a) => a.uid);
    expect(order).toEqual(['bo', 'ann']);
  });
});

/**
 * The same guard the answer window has, for the same reason: `firestore.rules`
 * is pasted into the console by hand, so the repo copy and the client can drift
 * silently. `npm run check-rules` proves the *published* ruleset, but it needs
 * the network and a live project. This reads the repo copy, so a client that
 * starts writing a field the rules do not list fails in the run that did it —
 * and that particular drift is not a cosmetic one. `hasOnly` refuses the whole
 * document, so an unlisted `firstMs` means every change of mind in the room is
 * rejected, on every question, for everybody.
 */
describe('firstMs agrees with the security rules', () => {
  const RULES = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const start = RULES.indexOf('match /answers/{uid}');
  const end = RULES.indexOf('match /reveal/{questionId}');
  const answersBlock = RULES.slice(start, end);

  it('is in the answer document hasOnly list', () => {
    const hasOnly = /hasOnly\(\[([^\]]*)\]\)/.exec(answersBlock)?.[1];
    expect(hasOnly).toBeDefined();
    expect(hasOnly).toContain("'firstMs'");
  });

  it('is bounded the same way elapsedMs is, since it is the same clock', () => {
    const ceiling = /request\.resource\.data\.firstMs <= (\d+)/.exec(answersBlock)?.[1];
    const elapsedCeiling = /request\.resource\.data\.elapsedMs <= (\d+)/.exec(answersBlock)?.[1];
    expect(ceiling).toBeDefined();
    expect(ceiling).toBe(elapsedCeiling);
  });

  it('is optional in the rules, so an old bundle still scores', () => {
    // The deploy-order argument in one assertion. The rules must accept a
    // document with no `firstMs` at all, or publishing them refuses every
    // answer written by the bundle that is live at the time.
    expect(answersBlock).toMatch(/!\('firstMs' in request\.resource\.data\.keys\(\)\)/);
  });

  it('cannot claim a first touch later than the stamp that stands', () => {
    expect(answersBlock).toMatch(/firstMs <= request\.resource\.data\.elapsedMs/);
  });
});

/**
 * The arrival floor on `elapsedMs`. Same reason as the block above: the
 * ruleset is pasted by hand, so a missing `get()`, a `get()` on the read
 * rule, or a grace that drifted from the number defended in answer-window.md
 * would otherwise ship silently.
 */
describe('the elapsedMs arrival floor agrees with the security rules', () => {
  const RULES = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const start = RULES.indexOf('match /answers/{uid}');
  const end = RULES.indexOf('match /reveal/{questionId}');
  const answersBlock = RULES.slice(start, end);

  it('the answers block is where the floor lives', () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(answersBlock).toContain('function arrivalOk()');
    expect(answersBlock).toContain('function elapsedGraceMs()');
  });

  it('the answers read rule does not get the room', () => {
    const read = /allow read: if ([^;]+);/.exec(answersBlock)?.[1];
    expect(read).toBe('signedIn()');
  });

  it('the answers write rule gets the room once, for the arrival floor', () => {
    expect(answersBlock).toMatch(
      /get\(\/databases\/\$\(database\)\/documents\/rooms\/\$\(code\)\)/,
    );
    expect(answersBlock).toMatch(/&& arrivalOk\(\);/);
  });

  it('the grace is eight seconds, as defended in answer-window.md', () => {
    const grace = /function elapsedGraceMs\(\) \{ return (\d+); \}/.exec(answersBlock)?.[1];
    expect(Number(grace)).toBe(8000);
    expect(Number(grace)).toBeGreaterThan(5000);
    expect(Number(grace)).toBeLessThan(9000);
  });

  it('the floor binds elapsedMs only, never firstMs', () => {
    expect(answersBlock).toMatch(
      /request\.resource\.data\.elapsedMs\s*>=\s*request\.time\.toMillis\(\)/,
    );
    expect(answersBlock).not.toMatch(/firstMs\s*>=\s*request\.time/);
  });
});

describe('the first touch is not scored', () => {
  it('pays a revised guess exactly what an untouched answer of the same time pays', () => {
    // The load-bearing claim of the whole change. `firstMs` is shown and never
    // scored, so nobody can lose points to a marker — which is what lets the
    // threshold be a display decision rather than a scoring one, and what makes
    // it safe to be wrong about where the threshold sits.
    const withMarker = tallyQuestion({
      correctIndex: 1,
      answers: {
        ann: { optionIndex: 1, elapsedMs: 4000, firstMs: 50 },
        bo: { optionIndex: 1, elapsedMs: 6000 },
      },
    });

    const without = tallyQuestion({
      correctIndex: 1,
      answers: {
        ann: { optionIndex: 1, elapsedMs: 4000 },
        bo: { optionIndex: 1, elapsedMs: 6000 },
      },
    });

    expect(withMarker).toEqual(without);
    // And spelled out, so a change to the rank bonus does not quietly turn this
    // into a test of nothing: first still pays 1,000 and second still pays 900.
    expect(withMarker).toEqual({ ann: 1000, bo: 900 });
  });

  it('does not let an early first touch take first place', () => {
    // Ann touched at 50ms and settled at 6s; Bo answered once at 4s. Bo is
    // first, because rank reads the answer that stands and nothing else.
    const scores = tallyQuestion({
      correctIndex: 1,
      answers: {
        ann: { optionIndex: 1, elapsedMs: 6000, firstMs: 50 },
        bo: { optionIndex: 1, elapsedMs: 4000 },
      },
    });

    expect(scores).toEqual({ ann: 900, bo: 1000 });
  });
});
