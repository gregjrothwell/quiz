import { describe, expect, test } from 'vitest';
import { createRoom } from '../engine/state';
import { finalistReadFor, finalistReadFromKey, finalistReadKey } from './finalistRead';

function finalRoom() {
  return {
    ...createRoom('HKQ7'),
    phase: 'standoff' as const,
    gameId: 'tonight',
    players: {
      sam: { name: 'Sam', joinedAt: 1, playerId: 'claimed-sam' },
      greg: { name: 'Greg', joinedAt: 2 },
    },
    standoff: {
      finalists: ['sam', 'greg'] as [string, string],
      stakes: { sam: 100, greg: 50 },
      stage: 'talk' as const,
      sealed: null,
      picks: null,
    },
  };
}

describe('finalistReadFor', () => {
  test('reads the two finalists, and a claimed player id rather than the uid', () => {
    const read = finalistReadFor(finalRoom());
    expect(read).toEqual({
      gameId: 'tonight',
      finalists: [
        { uid: 'sam', playerId: 'claimed-sam' },
        { uid: 'greg', playerId: 'greg' },
      ],
    });
  });

  test('reads nothing before the final, and the same key across the stages', () => {
    const room = finalRoom();
    expect(finalistReadFor({ ...room, phase: 'scoreboard' })).toBeNull();
    expect(finalistReadFor(null)).toBeNull();

    const talking = finalistReadFor(room);
    const picking = finalistReadFor({
      ...room,
      standoff: room.standoff ? { ...room.standoff, stage: 'pick' } : null,
    });
    const key = talking && finalistReadKey(talking);
    expect(key).toBe(picking && finalistReadKey(picking));
    expect(key ? finalistReadFromKey(key) : null).toEqual(talking);
  });
});
