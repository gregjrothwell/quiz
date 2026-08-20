import { describe, expect, test } from 'vitest';
import { arrivalFor, walkedIn, NO_ARRIVAL, type Arrival } from './arrival';
import { createRoom, type Phase, type RoomState } from './state';

function room(overrides: Partial<RoomState> = {}): RoomState {
  return { ...createRoom('6JA5'), gameId: 'game-1', ...overrides };
}

/**
 * Plays a device through a run of room states, the way `App` does: the arrival
 * is carried from one render to the next, and the flag is read off the current
 * one.
 */
function follow(states: (RoomState | null)[]): boolean[] {
  let held: Arrival = NO_ARRIVAL;
  return states.map((state) => {
    held = arrivalFor(held, state);
    return walkedIn(held, state);
  });
}

const ROUND: { phase: Phase; index: number }[] = [
  { phase: 'question', index: 0 },
  { phase: 'reveal', index: 0 },
  { phase: 'scoreboard', index: 0 },
  { phase: 'question', index: 1 },
  { phase: 'reveal', index: 1 },
];

describe('walkedIn', () => {
  test('is never true for somebody who joined in the lobby', () => {
    // #given a device that was in the room before the round started
    const states = [room({ phase: 'lobby' }), ...ROUND.map((step) => room(step))];

    // #when it follows the whole round
    const flags = follow(states);

    // #then no question is ever treated as one it walked in on
    expect(flags).toEqual(flags.map(() => false));
  });

  test('flags the question that was already running on arrival', () => {
    // #given a device whose first sight of the room is question two, open
    const states = [
      room({ phase: 'question', index: 1 }),
      room({ phase: 'question', index: 1 }),
    ];

    // #when it renders
    const flags = follow(states);

    // #then that question is marked, on every render of it
    expect(flags).toEqual([true, true]);
  });

  test('stops flagging once the round moves on', () => {
    // #given the same late arrival, carried through to the next question
    const states = [
      room({ phase: 'question', index: 1 }),
      room({ phase: 'reveal', index: 1 }),
      room({ phase: 'scoreboard', index: 1 }),
      room({ phase: 'question', index: 2 }),
      room({ phase: 'reveal', index: 2 }),
    ];

    // #when it follows the rest of the round
    const flags = follow(states);

    // #then only the question it walked in on is marked
    expect(flags).toEqual([true, false, false, false, false]);
  });

  test('does not mark the question for somebody who arrived at the standings', () => {
    // #given a device that joined between questions
    const states = [
      room({ phase: 'scoreboard', index: 3 }),
      room({ phase: 'question', index: 4 }),
    ];

    // #when the next question opens
    const flags = follow(states);

    // #then they saw it open, so it counts in full
    expect(flags).toEqual([false, false]);
  });

  test('does not carry an arrival across a second round in the same room', () => {
    // #given a device that walked in on question one of a round
    const states = [
      room({ phase: 'question', index: 0, gameId: 'game-1' }),
      room({ phase: 'lobby', index: 0, gameId: null }),
      // "Another round" mints a fresh game id and starts again at index zero
      room({ phase: 'question', index: 0, gameId: 'game-2' }),
    ];

    // #when the room plays again
    const flags = follow(states);

    // #then question one of the new round is a question they saw open
    expect(flags).toEqual([true, false, false]);
  });

  test('does not re-stamp a player whose snapshot hiccuped mid-question', () => {
    // #given somebody who has been in the room since the lobby, and a render
    // where the room is momentarily not there
    const states = [
      room({ phase: 'lobby' }),
      room({ phase: 'question', index: 3 }),
      null,
      room({ phase: 'question', index: 3 }),
    ];

    // #when they carry on
    const flags = follow(states);

    // #then the gap does not cost them the question they were already playing
    expect(flags).toEqual([false, false, false, false]);
  });

  test('starts fresh after leaving and joining another room', () => {
    // #given a device that leaves mid-question and joins a different room, also
    // mid-question
    const states = [
      room({ phase: 'question', index: 2 }),
      null,
      { ...room({ phase: 'question', index: 5 }), code: 'HJ44' },
    ];

    // #when it follows both
    const flags = follow(states);

    // #then each arrival is judged on its own room
    expect(flags).toEqual([true, false, true]);
  });
});

describe('arrivalFor', () => {
  test('holds the same object while the room is unchanged, so no render loops', () => {
    // #given an arrival already recorded for a room
    const state = room({ phase: 'question', index: 1 });
    const first = arrivalFor(NO_ARRIVAL, state);

    // #when the room updates without changing which room it is
    const second = arrivalFor(first, room({ phase: 'reveal', index: 1 }));

    // #then the very same value comes back
    expect(second).toBe(first);
  });
});
