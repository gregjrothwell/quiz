import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore/lite';
import type { QuizQuestion } from '../engine/state';

/*
  What is pinned here is that the four are asked **at once, over Firestore
  Lite**, and the answer comes back with the first acceptance. Lite sends each
  write as its own request, so a refusal costs that request and nothing else —
  unlike the main SDK, where every refusal closed the write stream and the next
  write waited for a new one (#70 asked one at a time for that reason). The
  gate itself is not under test; `npm run check-rules` proves it against the
  live rules, both ways.
*/
const setDoc = vi.fn();
const getDoc = vi.fn();
vi.mock('firebase/firestore/lite', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  setDoc: (...args: unknown[]) => setDoc(...args),
  getDoc: (...args: unknown[]) => getDoc(...args),
}));

const { resolveAnswer } = await import('./vault');

const DB = {} as Firestore;

const QUESTION: QuizQuestion = {
  id: 'q1',
  prompt: 'Which?',
  options: ['A', 'B', 'C', 'D'],
  correctIndex: null,
  category: 'General Knowledge',
  difficulty: 'easy',
};

const refused = Object.assign(new Error('Missing or insufficient permissions.'), {
  code: 'permission-denied',
});

/** The vault accepts `answer` and refuses everything else. */
function vaultHolds(answer: string): void {
  setDoc.mockImplementation((_ref: unknown, data: { answer: string }) =>
    data.answer === answer ? Promise.resolve() : Promise.reject(refused),
  );
}

function asked(): string[] {
  return setDoc.mock.calls.map(([, data]) => (data as { answer: string }).answer);
}

beforeEach(() => {
  setDoc.mockReset();
  getDoc.mockReset();
});

describe('resolveAnswer', () => {
  test('asks all four at once, without waiting for a refusal', async () => {
    // #given writes that never settle
    setDoc.mockImplementation(() => new Promise<void>(() => undefined));

    // #when the reveal starts
    void resolveAnswer(DB, 'ROOM', QUESTION);
    await Promise.resolve();

    // #then every candidate is already in flight
    expect(asked()).toEqual(['A', 'B', 'C', 'D']);
  });

  test('answers with the first acceptance, whichever option it is', async () => {
    vaultHolds('C');

    await expect(resolveAnswer(DB, 'ROOM', QUESTION)).resolves.toBe(2);
    expect(getDoc).not.toHaveBeenCalled();
  });

  test('does not wait for the refusals once the hit has landed', async () => {
    // #given the hit accepted while the three refusals are still out
    setDoc.mockImplementation((_ref: unknown, data: { answer: string }) =>
      data.answer === 'B' ? Promise.resolve() : new Promise<void>(() => undefined),
    );

    // #then the answer is back regardless
    await expect(resolveAnswer(DB, 'ROOM', QUESTION)).resolves.toBe(1);
  });

  test('all four refused reads back a reveal that is already there', async () => {
    vaultHolds('nothing matches');
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ answer: 'D' }) });

    await expect(resolveAnswer(DB, 'ROOM', QUESTION)).resolves.toBe(3);
    expect(asked()).toEqual(['A', 'B', 'C', 'D']);
  });

  test('all four refused and nothing recorded is the vault refusing, as before', async () => {
    vaultHolds('nothing matches');
    getDoc.mockResolvedValue({ exists: () => false });

    await expect(resolveAnswer(DB, 'ROOM', QUESTION)).rejects.toThrow(
      'The vault would not confirm an answer',
    );
  });

  test('anything other than a refusal surfaces, rather than reading as no answer', async () => {
    setDoc.mockRejectedValue(Object.assign(new Error('offline'), { code: 'unavailable' }));

    await expect(resolveAnswer(DB, 'ROOM', QUESTION)).rejects.toThrow('offline');
    expect(getDoc).not.toHaveBeenCalled();
  });

  test('a failure beside the hit does not hide the answer', async () => {
    // #given the hit accepted and one other candidate failing for another reason
    setDoc.mockImplementation((_ref: unknown, data: { answer: string }) => {
      if (data.answer === 'D') return Promise.resolve();
      if (data.answer === 'A') return Promise.reject(Object.assign(new Error('offline'), { code: 'unavailable' }));
      return Promise.reject(refused);
    });

    await expect(resolveAnswer(DB, 'ROOM', QUESTION)).resolves.toBe(3);
  });
});
