import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import type { QuizQuestion } from '../engine/state';

/*
  What is pinned here is the *order* the vault is asked in, because that is
  what the reveal's speed rests on. Every refused candidate closes Firestore's
  write stream and makes the next write wait for a new one, so asking after the
  hit is pure cost — and the room update queued behind it pays too. The gate
  itself is not under test; `npm run check-rules` proves it against the live
  rules, both ways.
*/
const setDoc = vi.fn();
const getDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
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
  test('a hit on the first option is one write and nothing else', async () => {
    vaultHolds('A');

    await expect(resolveAnswer(DB, 'ROOM', QUESTION)).resolves.toBe(0);
    expect(asked()).toEqual(['A']);
    expect(getDoc).not.toHaveBeenCalled();
  });

  test('asks in option order and stops at the hit — nothing after it is written', async () => {
    vaultHolds('C');

    await expect(resolveAnswer(DB, 'ROOM', QUESTION)).resolves.toBe(2);
    expect(asked()).toEqual(['A', 'B', 'C']);
  });

  test('asks one at a time: the next candidate waits for the last to be refused', async () => {
    const settle: Array<() => void> = [];
    setDoc.mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          settle.push(() => reject(refused));
        }),
    );

    const pending = resolveAnswer(DB, 'ROOM', QUESTION).catch(() => undefined);
    await Promise.resolve();
    expect(setDoc).toHaveBeenCalledTimes(1);

    settle[0]?.();
    await vi.waitFor(() => expect(setDoc).toHaveBeenCalledTimes(2));

    getDoc.mockResolvedValue({ exists: () => false });
    settle[1]?.();
    await vi.waitFor(() => expect(setDoc).toHaveBeenCalledTimes(3));
    settle[2]?.();
    await vi.waitFor(() => expect(setDoc).toHaveBeenCalledTimes(4));
    settle[3]?.();
    await pending;
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

  test('anything other than a refusal surfaces at once, without asking further', async () => {
    setDoc.mockRejectedValue(Object.assign(new Error('offline'), { code: 'unavailable' }));

    await expect(resolveAnswer(DB, 'ROOM', QUESTION)).rejects.toThrow('offline');
    expect(asked()).toEqual(['A']);
    expect(getDoc).not.toHaveBeenCalled();
  });
});
