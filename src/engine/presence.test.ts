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
      phase: 'lobby' as const,
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
      phase: 'lobby' as const,
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
      phase: 'lobby' as const,
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
      phase: 'lobby' as const,
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
      phase: 'lobby' as const,
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
      phase: 'lobby' as const,
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
      phase: 'lobby' as const,
    });

    // #then presence being available means the absence is believed
    expect(result.remove).toEqual(['sam']);
  });
});

describe('reapAbsent outside the lobby', () => {
  const absentPlayers = {
    greg: { name: 'Greg', joinedAt: 100 },
    tom: { name: 'Tom', joinedAt: 200 },
  };

  test.each(['question', 'reveal', 'scoreboard', 'finished'] as const)(
    'never removes anybody during %s',
    (phase) => {
      // #given a player whose presence has been gone far longer than the grace
      const result = reapAbsent({
        players: absentPlayers,
        present: new Set(['greg']),
        absentSince: { tom: 0 },
        now: STALE_GRACE_MS * 10,
        phase,
      });

      // #then they stay in the room
      expect(result.remove).toEqual([]);
    },
  );

  test('keeps a mid-round player who would have been reaped in the lobby', () => {
    // #given the identical reading, once in the lobby and once mid-round
    const reading = {
      players: absentPlayers,
      present: new Set(['greg']),
      absentSince: { tom: 0 },
      now: STALE_GRACE_MS * 10,
    };

    // #when each is evaluated
    const inLobby = reapAbsent({ ...reading, phase: 'lobby' });
    const midRound = reapAbsent({ ...reading, phase: 'question' });

    // #then only the lobby tidies up — this is the bug from room 6SVG, where a
    // player was removed mid-round and lost their score and their season row
    expect(inLobby.remove).toEqual(['tom']);
    expect(midRound.remove).toEqual([]);
  });

  test('drops the absence clock outside the lobby so a stale reading cannot reap on return', () => {
    // #given somebody noticed absent long ago, while a round was running
    const result = reapAbsent({
      players: absentPlayers,
      present: new Set(['greg']),
      absentSince: { tom: 0 },
      now: STALE_GRACE_MS * 10,
      phase: 'scoreboard',
    });

    // #then the clock is cleared, so the lobby starts them fresh
    expect(result.absentSince).toEqual({});
  });
});
