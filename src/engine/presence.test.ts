import { describe, expect, test } from 'vitest';
import { reapAbsent, STALE_GRACE_MS } from './presence';
import type { Player } from './state';

function room(...names: string[]): Record<string, Player> {
  return Object.fromEntries(names.map((name, i) => [name, { name, joinedAt: 100 + i }]));
}

describe('reapAbsent', () => {
  test('leaves everyone alone when presence has nothing to say', () => {
    // #given a full room and a presence tree that is completely empty, which is
    // what a blocked or unpublished Realtime Database ruleset looks like
    const players = room('host', 'sam', 'priya');

    // #when the absence check runs long after the grace period
    const result = reapAbsent({
      players,
      present: new Set(),
      absentSince: { host: 0, sam: 0, priya: 0 },
      now: STALE_GRACE_MS * 10,
    });

    // #then nobody is removed — an empty tree means presence is broken, and
    // emptying the room would leave it with no quizmaster and no way to play
    expect(result.remove).toEqual([]);
  });

  test('removes a player absent for longer than the grace period', () => {
    // #given a room where one player has been missing from presence
    const players = room('host', 'sam');

    // #when the grace period has fully elapsed for them
    const result = reapAbsent({
      players,
      present: new Set(['host']),
      absentSince: { sam: 0 },
      now: STALE_GRACE_MS,
    });

    // #then only that player is reaped
    expect(result.remove).toEqual(['sam']);
  });

  test('keeps a briefly absent player, so a dropped packet does not eject them', () => {
    // #given a player who has only just vanished from presence
    const players = room('host', 'sam');

    // #when the check runs well inside the grace period
    const result = reapAbsent({
      players,
      present: new Set(['host']),
      absentSince: { sam: 0 },
      now: STALE_GRACE_MS - 1,
    });

    // #then they stay in the room
    expect(result.remove).toEqual([]);
  });

  test('starts the clock rather than reaping on the first sighting of an absence', () => {
    // #given a player missing from presence for the first time
    const players = room('host', 'sam');

    // #when the check runs with no prior record of their absence
    const result = reapAbsent({
      players,
      present: new Set(['host']),
      absentSince: {},
      now: 5_000,
    });

    // #then they are given the full grace period, not removed immediately
    expect({ remove: result.remove, absentSince: result.absentSince }).toEqual({
      remove: [],
      absentSince: { sam: 5_000 },
    });
  });

  test('forgets the absence once a player comes back', () => {
    // #given a player who was previously noted as absent
    const players = room('host', 'sam');

    // #when presence reports them present again
    const result = reapAbsent({
      players,
      present: new Set(['host', 'sam']),
      absentSince: { sam: 0 },
      now: STALE_GRACE_MS * 2,
    });

    // #then their absence clock is cleared so a later blip starts afresh
    expect({ remove: result.remove, absentSince: result.absentSince }).toEqual({
      remove: [],
      absentSince: {},
    });
  });

  test('an empty room needs no reaping', () => {
    // #given a room nobody is in
    const result = reapAbsent({
      players: {},
      present: new Set(),
      absentSince: {},
      now: 1_000,
    });

    // #then there is nothing to remove
    expect(result.remove).toEqual([]);
  });

  test('still reaps when someone is present, so real departures are cleaned up', () => {
    // #given presence that is working and listing one of two players
    const players = room('host', 'sam');

    // #when the missing one has been gone past the grace period
    const result = reapAbsent({
      players,
      present: new Set(['host']),
      absentSince: { sam: 0 },
      now: STALE_GRACE_MS + 1,
    });

    // #then presence being available means the absence is believed
    expect(result.remove).toEqual(['sam']);
  });
});
