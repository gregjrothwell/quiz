import { describe, expect, test } from 'vitest';
import { parseSnapshot } from './useFinalSnapshot';

const FINISHED = {
  gameId: 'game-1',
  players: {
    greg: { name: 'Greg', joinedAt: 1_000 },
    sam: { name: 'Sam', joinedAt: 1_200, playerId: 'claimed-sam' },
  },
  scores: { greg: 4_300, sam: 3_900 },
};

const EMPTY = { gameId: null, players: {}, scores: {} };

describe('parseSnapshot', () => {
  test('reads back a snapshot it wrote', () => {
    // #given a snapshot serialised the way the hook stores it
    const raw = JSON.stringify(FINISHED);

    // #when it is read back
    const snapshot = parseSnapshot(raw);

    // #then the podium survives the round trip intact, claimed playerId and all
    expect(snapshot).toEqual(FINISHED);
  });

  test('treats an absent snapshot as no snapshot', () => {
    // #given nothing in storage
    // #when it is read
    const snapshot = parseSnapshot(null);

    // #then there is no game rather than a crash
    expect(snapshot).toEqual(EMPTY);
  });

  test('treats unparseable storage as no snapshot', () => {
    // #given something that is not JSON at all
    // #when it is read
    const snapshot = parseSnapshot('{ not json');

    // #then the screen falls back to the live room rather than half a podium
    expect(snapshot).toEqual(EMPTY);
  });

  test('drops a snapshot with no game to belong to', () => {
    // #given a payload carrying players but no gameId
    const raw = JSON.stringify({ players: FINISHED.players, scores: FINISHED.scores });

    // #when it is read
    const snapshot = parseSnapshot(raw);

    // #then it is dropped whole: a podium that cannot say which game it is from
    // would be shown against the next round in the same room
    expect(snapshot).toEqual(EMPTY);
  });

  test('drops a player it cannot trust and keeps the rest', () => {
    // #given one entry with no name at all
    const raw = JSON.stringify({
      ...FINISHED,
      players: { ...FINISHED.players, ghost: { joinedAt: 2_000 } },
    });

    // #when it is read
    const snapshot = parseSnapshot(raw);

    // #then the nameless entry is gone and the real players are untouched
    expect(snapshot.players).toEqual(FINISHED.players);
  });

  test('drops a score that is not a number', () => {
    // #given a score somebody edited into a string
    const raw = JSON.stringify({
      ...FINISHED,
      scores: { ...FINISHED.scores, greg: '999999' },
    });

    // #when it is read
    const snapshot = parseSnapshot(raw);

    // #then it is dropped rather than rendered, and Sam still has hers
    expect(snapshot.scores).toEqual({ sam: 3_900 });
  });

  test('survives players and scores being missing entirely', () => {
    // #given a snapshot from a build that stored neither
    const raw = JSON.stringify({ gameId: 'game-1' });

    // #when it is read
    const snapshot = parseSnapshot(raw);

    // #then it reads as a game nobody was in rather than throwing
    expect(snapshot).toEqual({ gameId: 'game-1', players: {}, scores: {} });
  });
});
