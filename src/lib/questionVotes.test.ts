import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';

/*
  The one decision this module makes on the way back is what a failure *means*
  — hide the numbers, do not take the reveal down — and that is worth pinning
  offline. Firestore itself is not under test; `npm run check-rules` proves
  the count against the live rules.
*/
const setDoc = vi.fn();
const getCountFromServer = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  query: (col: { path: string }, ...clauses: unknown[]) => ({ col, clauses }),
  where: (field: string, op: string, value: string) => ({ field, op, value }),
  setDoc: (...args: unknown[]) => setDoc(...args),
  getCountFromServer: (...args: unknown[]) => getCountFromServer(...args),
}));

const { fetchVoteTally, recordVote } = await import('./questionVotes');

const DB = {} as Firestore;

beforeEach(() => {
  setDoc.mockReset();
  getCountFromServer.mockReset();
});

describe('fetchVoteTally', () => {
  test('counts each side without fetching documents', async () => {
    // #given two aggregate replies, and nothing that looks like a snapshot of rows
    getCountFromServer
      .mockResolvedValueOnce({ data: () => ({ count: 4 }) })
      .mockResolvedValueOnce({ data: () => ({ count: 2 }) });

    // #when
    const tally = await fetchVoteTally(DB, 'q1');

    // #then
    expect(tally).toEqual({ good: 4, bad: 2 });
    expect(getCountFromServer).toHaveBeenCalledTimes(2);
    const paths = getCountFromServer.mock.calls.map(
      ([queryArg]: [{ col: { path: string } }]) => queryArg.col.path,
    );
    expect(paths).toEqual(['questionVotes/q1/votes', 'questionVotes/q1/votes']);
    const filters = getCountFromServer.mock.calls.map(
      ([queryArg]: [{ clauses: { field: string; op: string; value: string }[] }]) =>
        queryArg.clauses[0],
    );
    expect(filters).toEqual([
      { field: 'verdict', op: '==', value: 'good' },
      { field: 'verdict', op: '==', value: 'bad' },
    ]);
  });

  test('a question nobody has voted on is two zeroes, not null', async () => {
    // #given
    getCountFromServer.mockResolvedValue({ data: () => ({ count: 0 }) });

    // #when
    const tally = await fetchVoteTally(DB, 'q-new');

    // #then
    expect(tally).toEqual({ good: 0, bad: 0 });
  });

  test('a refused count is null, so the reveal stays up', async () => {
    // #given — the list grant has not been pasted
    getCountFromServer.mockRejectedValue({
      code: 'permission-denied',
      message: 'Missing or insufficient permissions.',
    });

    // #when
    const tally = await fetchVoteTally(DB, 'q1');

    // #then
    expect(tally).toBeNull();
  });

  test('anything else is also null, not a throw', async () => {
    // #given — offline on the reveal
    getCountFromServer.mockRejectedValue({ code: 'unavailable', message: 'The client is offline.' });

    // #when
    const tally = await fetchVoteTally(DB, 'q1');

    // #then
    expect(tally).toBeNull();
  });
});

describe('recordVote', () => {
  test('writes this uid\'s verdict and does not throw when the write is refused', async () => {
    // #given
    setDoc.mockRejectedValue({ code: 'permission-denied' });

    // #when / #then — a nicety must not reject into the reveal
    await expect(recordVote(DB, 'q1', 'greg', 'bad')).resolves.toBeUndefined();
  });
});
