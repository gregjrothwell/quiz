import { describe, expect, test } from 'vitest';
import { isHalfTime, morningChampions, morningTotals, seasonWin } from './double';
import { reduce, type Action } from './reducer';
import { createRoom, type Player, type QuizQuestion, type RoomState } from './state';

/**
 * The Double: two rounds in one room add up to one morning with one final.
 * docs/decisions/morning-double.md — the rule and AC numbers below are that
 * file's. Approved by Greg, 24 October 2026: a lobby choice, the final stakes
 * the whole morning, and it is called The Double.
 */

const seat = (name: string, joinedAt: number): Player => ({ name, joinedAt });

const RACH = seat('Rach', 1);
const JOE = seat('Joe', 2);
const CASS = seat('Cass', 3);

const QUESTIONS: QuizQuestion[] = Array.from({ length: 3 }, (_, index) => ({
  id: `double-${String(index)}`,
  prompt: `Question ${String(index + 1)}`,
  options: ['A', 'B', 'C', 'D'],
  correctIndex: null,
  category: 'General Knowledge',
  difficulty: 'easy',
}));

/** What the quizmaster chose in the lobby. */
interface Choice {
  double?: boolean | undefined;
  standoff?: boolean | undefined;
}

function run(state: RoomState, ...actions: Action[]): RoomState {
  return actions.reduce(reduce, state);
}

function pick(options: Choice = {}): Action {
  return {
    type: 'selectPack',
    packId: 'general-knowledge',
    packTitle: 'GK',
    questions: QUESTIONS,
    wagerEnabled: false,
    stealEnabled: false,
    standoffEnabled: options.standoff ?? false,
    doubleEnabled: options.double ?? false,
  };
}

/** A lobby with everyone in it and the round chosen, ready to start. */
function lobby(players: Record<string, Player>, options: Choice = {}): RoomState {
  return run({ ...createRoom('DBLE'), players }, pick(options));
}

/**
 * A round played to its last scoreboard, with `scores` as the table stands.
 * Built rather than answered: the questions are scored by the reducer's own
 * tests, and what is under test here is what happens after the last one.
 */
function lastScoreboard(state: RoomState, gameId: string, scores: Record<string, number>): RoomState {
  const started = reduce(state, { type: 'start', at: 1_000, gameId, durationSecs: 10 });
  return { ...started, phase: 'scoreboard', index: QUESTIONS.length - 1, scores };
}

const next = (): Action => ({ type: 'next', at: 9_000 });

/** Round one of a double, finished: half-time. */
function halfTime(
  players: Record<string, Player>,
  scores: Record<string, number>,
  options: Pick<Choice, 'standoff'> = {},
): RoomState {
  return reduce(lastScoreboard(lobby(players, { double: true, ...options }), 'round-one', scores), next());
}

/** Round two of a double at its last scoreboard. */
function roundTwoEnd(
  first: Record<string, number>,
  second: Record<string, number>,
  options: Pick<Choice, 'standoff'> & { players?: Record<string, Player> } = {},
): RoomState {
  const players = options.players ?? { rach: RACH, joe: JOE, cass: CASS };
  const paused = halfTime(players, first, { standoff: options.standoff });
  const lobbyTwo = run(paused, { type: 'roundTwo' }, pick({ double: true, standoff: options.standoff }));
  return lastScoreboard(lobbyTwo, 'round-two', second);
}

/** The worked example in the decision doc. Cass is third on the morning. */
const FIRST = { rach: 6_000, joe: 3_000, cass: 2_000 };
const SECOND = { rach: 4_000, joe: 5_500, cass: 1_000 };

/** Opens the final, ends the talk and the picking, and pays it out. */
function playFinal(state: RoomState, picks: Record<string, 'share' | 'shaft'>): RoomState {
  const opened = reduce(state, next());
  return run(
    opened,
    { type: 'openPicks' },
    { type: 'closePicks', sealed: Object.keys(picks) },
    { type: 'settle', picks },
  );
}

describe('the lobby choice (AC1, AC2)', () => {
  test('a fresh room is not a double, and has no first half', () => {
    const room = createRoom('DBLE');
    expect(room.doubleEnabled).toBe(false);
    expect(room.double).toBeNull();
  });

  test('choosing the round can make it a double', () => {
    expect(lobby({ rach: RACH }, { double: true }).doubleEnabled).toBe(true);
    expect(lobby({ rach: RACH }).doubleEnabled).toBe(false);
  });

  test('a caller that predates the Double leaves it off', () => {
    const older: Action = {
      type: 'selectPack',
      packId: 'general-knowledge',
      packTitle: 'GK',
      questions: QUESTIONS,
      wagerEnabled: false,
      stealEnabled: false,
    };
    expect(run({ ...createRoom('DBLE'), players: { rach: RACH } }, older).doubleEnabled).toBe(false);
  });

  test("round two's lobby keeps it on, whatever the quizmaster's device sends", () => {
    const lobbyTwo = run(halfTime({ rach: RACH, joe: JOE }, { rach: 1, joe: 2 }), { type: 'roundTwo' });
    expect(reduce(lobbyTwo, pick({ double: false })).doubleEnabled).toBe(true);
  });
});

describe('half-time (rules 2–3, AC3, AC5)', () => {
  test('round one of a double ends at half-time, with no final, even with Share or Shaft on', () => {
    const paused = halfTime({ rach: RACH, joe: JOE, cass: CASS }, FIRST, { standoff: true });
    expect(paused.phase).toBe('finished');
    expect(paused.standoff).toBeNull();
    expect(isHalfTime(paused)).toBe(true);
  });

  test('round one keeps its own scores at half-time, so it banks as an ordinary round', () => {
    const paused = halfTime({ rach: RACH, joe: JOE, cass: CASS }, FIRST, { standoff: true });
    expect(paused.scores).toEqual(FIRST);
    expect(paused.gameId).toBe('round-one');
  });

  test('a round that is not a double still opens its final', () => {
    const ended = reduce(lastScoreboard(lobby({ rach: RACH, joe: JOE }, { standoff: true }), 'g', FIRST), next());
    expect(ended.phase).toBe('standoff');
    expect(isHalfTime(ended)).toBe(false);
  });

  test('an ordinary finished round is not half-time', () => {
    const ended = reduce(lastScoreboard(lobby({ rach: RACH, joe: JOE }), 'g', FIRST), next());
    expect(ended.phase).toBe('finished');
    expect(isHalfTime(ended)).toBe(false);
  });

  test('mid-round is not half-time', () => {
    const playing = lastScoreboard(lobby({ rach: RACH }, { double: true }), 'round-one', { rach: 1 });
    expect(isHalfTime(playing)).toBe(false);
  });
});

describe('Round two (rule 4, AC6–AC8)', () => {
  test('goes back to the lobby holding round one, with the round to choose again', () => {
    const lobbyTwo = run(halfTime({ rach: RACH, joe: JOE, cass: CASS }, FIRST), { type: 'roundTwo' });
    expect(lobbyTwo.phase).toBe('lobby');
    expect(lobbyTwo.double).toEqual({ gameId: 'round-one', scores: FIRST });
    expect(lobbyTwo.doubleEnabled).toBe(true);
    expect(lobbyTwo.gameId).toBeNull();
    expect(lobbyTwo.packId).toBeNull();
    expect(lobbyTwo.questions).toEqual([]);
  });

  test('is refused anywhere but half-time', () => {
    const ordinary = reduce(lastScoreboard(lobby({ rach: RACH, joe: JOE }), 'g', FIRST), next());
    expect(reduce(ordinary, { type: 'roundTwo' })).toBe(ordinary);

    const playing = lastScoreboard(lobby({ rach: RACH }, { double: true }), 'round-one', { rach: 1 });
    expect(reduce(playing, { type: 'roundTwo' })).toBe(playing);
  });

  test('there is no treble: the end of round two is not half-time, and refuses a third', () => {
    const ended = reduce(roundTwoEnd(FIRST, SECOND), next());
    expect(ended.phase).toBe('finished');
    expect(isHalfTime(ended)).toBe(false);
    expect(reduce(ended, { type: 'roundTwo' })).toBe(ended);
  });

  test('scores from zero for the round, and the morning adds the two', () => {
    const lobbyTwo = run(halfTime({ rach: RACH, joe: JOE, cass: CASS }, FIRST), { type: 'roundTwo' }, pick({ double: true }));
    const started = reduce(lobbyTwo, { type: 'start', at: 1_000, gameId: 'round-two', durationSecs: 10 });
    expect(started.scores).toEqual({ rach: 0, joe: 0, cass: 0 });
    expect(started.double?.scores).toEqual(FIRST);
    expect(morningTotals({ ...started, scores: SECOND })).toEqual({ rach: 10_000, joe: 8_500, cass: 3_000 });
  });

  test('someone who joins at half-time starts the morning on nothing', () => {
    const lobbyTwo = run(
      halfTime({ rach: RACH, joe: JOE }, { rach: 6_000, joe: 3_000 }),
      { type: 'roundTwo' },
      { type: 'join', uid: 'cass', name: 'Cass', at: 5 },
    );
    expect(morningTotals({ ...lobbyTwo, scores: { rach: 0, joe: 0, cass: 2_500 } }).cass).toBe(2_500);
  });

  test('someone who leaves keeps their round-one total on the morning', () => {
    const lobbyTwo = run(halfTime({ rach: RACH, joe: JOE, cass: CASS }, FIRST), { type: 'roundTwo' }, { type: 'leave', uid: 'cass' });
    expect(morningTotals({ ...lobbyTwo, scores: { rach: 0, joe: 0 } }).cass).toBe(2_000);
  });

  test('outside a double the morning is just the round', () => {
    expect(morningTotals({ double: null, scores: SECOND })).toEqual(SECOND);
  });
});

describe('the final, on the whole morning (rules 7–8, AC9–AC11)', () => {
  test('the finalists are the top two on the morning, not on round two', () => {
    // Round two alone would send Cass (3,000) and Joe (2,500). On the morning
    // it is Rach (8,000) and Joe (5,500), with Cass third on 5,000.
    const ended = reduce(
      roundTwoEnd(FIRST, { rach: 2_000, joe: 2_500, cass: 3_000 }, { standoff: true }),
      next(),
    );
    expect(ended.phase).toBe('standoff');
    expect(ended.standoff?.finalists).toEqual(['rach', 'joe']);
  });

  test('the stakes are each finalist’s morning above zero', () => {
    const ended = reduce(roundTwoEnd(FIRST, SECOND, { standoff: true }), next());
    expect(ended.standoff?.stakes).toEqual({ rach: 10_000, joe: 8_500 });
  });

  test('someone who left cannot be a finalist, though their morning still counts on the board', () => {
    const players = { rach: RACH, joe: JOE, cass: CASS };
    const atEnd = roundTwoEnd({ rach: 1_000, joe: 1_000, cass: 9_000 }, { rach: 500, joe: 400, cass: 0 }, { standoff: true, players });
    const left = reduce(atEnd, { type: 'leave', uid: 'cass' });
    const ended = reduce(left, next());
    expect(ended.standoff?.finalists).toEqual(['rach', 'joe']);
    expect(morningTotals(ended).cass).toBe(9_000);
  });

  // The worked example: what round two banks is the settled morning less
  // round one, so the two banked rounds add up to the outcome.
  test.each([
    ['both share', { rach: 'share', joe: 'share' }, { rach: 3_250, joe: 6_250 }],
    ['Rach shafts, Joe shares', { rach: 'shaft', joe: 'share' }, { rach: 12_500, joe: -3_000 }],
    ['both shaft', { rach: 'shaft', joe: 'shaft' }, { rach: -6_000, joe: -3_000 }],
  ] as const)('%s: round two banks the settled morning less round one', (_label, picks, banked) => {
    const settled = playFinal(roundTwoEnd(FIRST, SECOND, { standoff: true }), picks);
    expect(settled.standoff?.stage).toBe('revealed');
    expect(settled.scores.rach).toBe(banked.rach);
    expect(settled.scores.joe).toBe(banked.joe);
    // Nobody else's score moves.
    expect(settled.scores.cass).toBe(SECOND.cass);
    // And the morning is what the final paid out.
    expect(morningTotals(settled).rach).toBe(FIRST.rach + banked.rach);
  });

  test('a final that is not a double still stakes the round alone', () => {
    const ended = reduce(lastScoreboard(lobby({ rach: RACH, joe: JOE }, { standoff: true }), 'g', SECOND), next());
    expect(ended.standoff?.stakes).toEqual({ joe: 5_500, rach: 4_000 });
  });

  test('a double without Share or Shaft ends on the last answer', () => {
    const ended = reduce(roundTwoEnd(FIRST, SECOND), next());
    expect(ended.phase).toBe('finished');
    expect(ended.standoff).toBeNull();
  });
});

describe('after a double (rule 10, AC13)', () => {
  test('Another round is an ordinary round: scores to zero, the Double off and forgotten', () => {
    const ended = reduce(roundTwoEnd(FIRST, SECOND), next());
    const again = reduce(ended, { type: 'reset' });
    expect(again.phase).toBe('lobby');
    expect(again.doubleEnabled).toBe(false);
    expect(again.double).toBeNull();
    expect(Object.values(again.scores).every((score) => score === 0)).toBe(true);
  });

  test('a reset at half-time drops the double rather than carrying it into a lone round', () => {
    const again = reduce(halfTime({ rach: RACH, joe: JOE }, { rach: 1, joe: 2 }), { type: 'reset' });
    expect(again.doubleEnabled).toBe(false);
    expect(again.double).toBeNull();
  });
});

describe('who wins, for the season (rule 9)', () => {
  const players = { rach: RACH, joe: JOE, cass: CASS };

  test('outside a double, the top of the round, as before', () => {
    expect(seasonWin(players, SECOND, null, 'joe')).toBe(true);
    expect(seasonWin(players, SECOND, null, 'rach')).toBe(false);
  });

  test('a round where nobody scored is not a win for everybody', () => {
    expect(seasonWin(players, { rach: 0, joe: 0, cass: 0 }, null, 'rach')).toBe(false);
  });

  test("round two's win goes to the top of the morning, not of the round", () => {
    const double = { gameId: 'round-one', scores: FIRST };
    expect(seasonWin(players, SECOND, double, 'rach')).toBe(true); // 10,000 on the morning
    expect(seasonWin(players, SECOND, double, 'joe')).toBe(false); // 5,500 topped round two
  });

  test('joint champions after a shared final both win', () => {
    const double = { gameId: 'round-one', scores: FIRST };
    const settled = { rach: 3_250, joe: 6_250, cass: 1_000 }; // 9,250 each on the morning
    expect(morningChampions(players, settled, double).sort()).toEqual(['joe', 'rach']);
    expect(seasonWin(players, settled, double, 'joe')).toBe(true);
    expect(seasonWin(players, settled, double, 'rach')).toBe(true);
  });

  test('the champion is chosen from who was in the room at the whistle', () => {
    const double = { gameId: 'round-one', scores: { rach: 1_000, joe: 1_000, cass: 9_000 } };
    expect(morningChampions({ rach: RACH, joe: JOE }, { rach: 500, joe: 400 }, double)).toEqual(['rach']);
  });
});
