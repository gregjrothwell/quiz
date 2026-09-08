import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import type { GameRecord } from '../engine/gameRecord';

/*
  The one decision this module makes is what a failure *means* — whether the
  caller should try again — and that is worth pinning offline, because the
  retry policy in App.tsx is built on it. Firestore itself is not under test;
  `npm run check-rules` proves the write against the live rules.
*/
const setDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  serverTimestamp: () => 'SERVER_TIME',
  setDoc: (...args: unknown[]) => setDoc(...args),
}));

const { keepGameRecord } = await import('./gameRecords');

const DB = {} as Firestore;

const RECORD: GameRecord = {
  roomCode: 'ABCD',
  packId: 'science',
  packTitle: 'Science',
  durationSecs: 15,
  wagerEnabled: false,
  stealEnabled: false,
  jigsawEnabled: false,
  players: { greg: { name: 'Greg' } },
  scores: { greg: 1_000 },
  questions: [],
  writtenBy: 'greg',
};

beforeEach(() => {
  setDoc.mockReset();
});

describe('keepGameRecord', () => {
  test('writes the fold plus a server stamp to games/{gameId}', async () => {
    // #given
    setDoc.mockResolvedValue(undefined);

    // #when
    await keepGameRecord(DB, 'game-1', RECORD);

    // #then
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'games/game-1' },
      { ...RECORD, finishedAt: 'SERVER_TIME' },
    );
  });

  test('reports a landed write as kept', async () => {
    // #given
    setDoc.mockResolvedValue(undefined);

    // #when
    const outcome = await keepGameRecord(DB, 'game-1', RECORD);

    // #then
    expect(outcome).toBe('kept');
  });

  test('reports a refusal as refused, so the caller stops', async () => {
    // #given — the ruleset has not been pasted, or the record already exists
    setDoc.mockRejectedValue({ code: 'permission-denied', message: 'Missing or insufficient permissions.' });

    // #when
    const outcome = await keepGameRecord(DB, 'game-1', RECORD);

    // #then
    expect(outcome).toBe('refused');
  });

  test('reports anything else as failed, so the caller tries again', async () => {
    // #given — offline on the final screen
    setDoc.mockRejectedValue({ code: 'unavailable', message: 'The client is offline.' });

    // #when
    const outcome = await keepGameRecord(DB, 'game-1', RECORD);

    // #then
    expect(outcome).toBe('failed');
  });

  test('a rejection that is not an error object is still a failure, not a throw', async () => {
    // #given
    setDoc.mockRejectedValue('something odd');

    // #when
    const outcome = await keepGameRecord(DB, 'game-1', RECORD);

    // #then
    expect(outcome).toBe('failed');
  });
});
