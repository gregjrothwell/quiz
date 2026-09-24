import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { reduce, type Action } from './reducer';
import {
  finalistsFor,
  outcomeOf,
  potOf,
  settleStandoff,
  stakesFor,
  type Standoff,
} from './standoff';
import { PHASES, createRoom, type Player, type QuizQuestion, type RoomState } from './state';

const seat = (name: string, joinedAt: number): Player => ({ name, joinedAt });

/** `NA9N` on 24 September 2026, the round the payoff table in the decision doc is drawn from. */
const NA9N_PLAYERS: Record<string, Player> = {
  first: seat('First', 1),
  second: seat('Second', 2),
  third: seat('Third', 3),
  last: seat('Last', 4),
};
const NA9N_SCORES = { first: 26_700, second: 22_600, third: 21_400, last: 5_600 };

function standoffOf(scores: Record<string, number>, finalists: [string, string]): Standoff {
  return { finalists, stakes: stakesFor(scores, finalists), stage: 'pick', sealed: null, picks: null };
}

describe('finalistsFor', () => {
  test('is the top two, leader first', () => {
    expect(finalistsFor(NA9N_PLAYERS, NA9N_SCORES, 'game-1')).toEqual(['first', 'second']);
  });

  test('only counts people still in the room', () => {
    // `scores` outlives membership on purpose, so a player who went home keeps
    // a number on the document and must not be called to a final they left.
    const { first: _gone, ...stayed } = NA9N_PLAYERS;
    expect(finalistsFor(stayed, NA9N_SCORES, 'game-1')).toEqual(['second', 'third']);
  });

  test('needs two people', () => {
    expect(finalistsFor({ solo: seat('Solo', 1) }, { solo: 4_000 }, 'game-1')).toBeNull();
    expect(finalistsFor({}, {}, 'game-1')).toBeNull();
  });

  test('a room of two is both of them, whatever they scored', () => {
    const players = { a: seat('A', 1), b: seat('B', 2) };
    expect(finalistsFor(players, { a: 0, b: 0 }, 'game-1')?.sort()).toEqual(['a', 'b']);
  });

  test('a tie at the cut is settled the same way on every device', () => {
    const players = { lead: seat('Lead', 1), x: seat('X', 2), y: seat('Y', 3) };
    const scores = { lead: 9_000, x: 5_000, y: 5_000 };
    const once = finalistsFor(players, scores, 'game-7');
    expect(finalistsFor({ ...players }, { ...scores }, 'game-7')).toEqual(once);
    expect(once?.[0]).toBe('lead');
  });

  /*
    The reason the board's own order is not used. `standings` breaks a tie on
    uid, which is fixed per device — so one of two colleagues would win every
    tie for a place in the final for the rest of the season.
  */
  test('a tie at the cut does not go to the same person every game', () => {
    const players = { lead: seat('Lead', 1), aaa: seat('A', 2), zzz: seat('Z', 3) };
    const scores = { lead: 9_000, aaa: 5_000, zzz: 5_000 };
    const chosen = new Set(
      Array.from({ length: 40 }, (_, n) => finalistsFor(players, scores, `game-${n}`)?.[1]),
    );
    expect(chosen).toEqual(new Set(['aaa', 'zzz']));
  });

  test('a three-way tie at the top still sends exactly two', () => {
    const players = { a: seat('A', 1), b: seat('B', 2), c: seat('C', 3) };
    const pair = finalistsFor(players, { a: 3_000, b: 3_000, c: 3_000 }, 'game-3');
    expect(pair).toHaveLength(2);
    expect(new Set(pair).size).toBe(2);
  });
});

describe('stakesFor', () => {
  test('each finalist stakes everything they hold', () => {
    expect(stakesFor(NA9N_SCORES, ['first', 'second'])).toEqual({ first: 26_700, second: 22_600 });
  });

  test('a negative score cannot go into the pot', () => {
    // A lost minimum stake can leave a total below zero. Putting a debt in the
    // pot would make stealing it a punishment, so it stays with its owner.
    expect(stakesFor({ a: 1_500, b: -500 }, ['a', 'b'])).toEqual({ a: 1_500, b: 0 });
  });

  test('the pot is the two stakes together', () => {
    expect(potOf(standoffOf(NA9N_SCORES, ['first', 'second']))).toBe(49_300);
  });
});

describe('settleStandoff — the four outcomes, on NA9N', () => {
  const standoff = standoffOf(NA9N_SCORES, ['first', 'second']);

  test('both share: half each, and level', () => {
    const { scores } = settleStandoff(NA9N_SCORES, standoff, { first: 'share', second: 'share' });
    expect(scores['first']).toBe(24_650);
    expect(scores['second']).toBe(24_650);
  });

  test('one shafts: the pot to them, nothing to the other', () => {
    const { scores } = settleStandoff(NA9N_SCORES, standoff, { first: 'share', second: 'shaft' });
    expect(scores['second']).toBe(49_300);
    expect(scores['first']).toBe(0);
  });

  test('both shaft: both on nothing, and third place wins', () => {
    const { scores } = settleStandoff(NA9N_SCORES, standoff, { first: 'shaft', second: 'shaft' });
    expect(scores['first']).toBe(0);
    expect(scores['second']).toBe(0);
    const top = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
    expect(top?.[0]).toBe('third');
  });

  test('nobody else moves, whatever happens', () => {
    for (const picks of [
      { first: 'share', second: 'share' },
      { first: 'shaft', second: 'share' },
      { first: 'shaft', second: 'shaft' },
    ] as const) {
      const { scores } = settleStandoff(NA9N_SCORES, standoff, picks);
      expect(scores['third']).toBe(21_400);
      expect(scores['last']).toBe(5_600);
    }
  });

  test('the deltas are what the screen says happened', () => {
    const { deltas } = settleStandoff(NA9N_SCORES, standoff, { first: 'shaft', second: 'share' });
    expect(deltas).toEqual({ first: 22_600, second: -22_600 });
  });
});

describe('settleStandoff — the edges', () => {
  test('no pick counts as share, and is recorded as no pick', () => {
    const standoff = standoffOf(NA9N_SCORES, ['first', 'second']);
    const settled = settleStandoff(NA9N_SCORES, standoff, { second: 'shaft' });
    expect(settled.scores['second']).toBe(49_300);
    expect(settled.scores['first']).toBe(0);
    expect(settled.picks).toEqual({ first: null, second: 'shaft' });
  });

  /*
    Withholding never pays: a finalist who does not reveal is read as sharing,
    and shafting is never worse than sharing for the one choosing it — so the
    only person holding a reveal back can help is the other finalist.
  */
  test('a withheld reveal is never better for the one withholding it', () => {
    const standoff = standoffOf(NA9N_SCORES, ['first', 'second']);
    for (const other of ['share', 'shaft'] as const) {
      const revealed = settleStandoff(NA9N_SCORES, standoff, { first: 'shaft', second: other });
      const withheld = settleStandoff(NA9N_SCORES, standoff, { first: null, second: other });
      expect(withheld.scores['first']).toBeLessThanOrEqual(revealed.scores['first'] ?? 0);
    }
  });

  test('an odd pot drops its odd point so a share stays level', () => {
    const scores = { a: 1_001, b: 2_000 };
    const { scores: after } = settleStandoff(scores, standoffOf(scores, ['a', 'b']), {
      a: 'share',
      b: 'share',
    });
    expect(after['a']).toBe(1_500);
    expect(after['b']).toBe(1_500);
  });

  test('a negative score stays with its owner through every outcome', () => {
    const scores = { a: 3_000, b: -500 };
    const standoff = standoffOf(scores, ['a', 'b']);
    expect(settleStandoff(scores, standoff, { a: 'share', b: 'share' }).scores).toEqual({ a: 1_500, b: 1_000 });
    expect(settleStandoff(scores, standoff, { a: 'shaft', b: 'shaft' }).scores).toEqual({ a: 0, b: -500 });
    expect(settleStandoff(scores, standoff, { a: 'share', b: 'shaft' }).scores).toEqual({ a: 0, b: 2_500 });
  });

  test('a pick from somebody who is not a finalist is ignored', () => {
    const standoff = standoffOf(NA9N_SCORES, ['first', 'second']);
    const settled = settleStandoff(NA9N_SCORES, standoff, {
      first: 'share',
      second: 'share',
      third: 'shaft',
    });
    expect(settled.scores['third']).toBe(21_400);
    expect(Object.keys(settled.picks).sort()).toEqual(['first', 'second']);
  });
});

describe('outcomeOf', () => {
  const base = standoffOf(NA9N_SCORES, ['first', 'second']);

  test('is nothing until it is settled', () => {
    expect(outcomeOf(base)).toBeNull();
  });

  test('says who shafted whom, and for how much', () => {
    expect(outcomeOf({ ...base, picks: { first: 'share', second: 'shaft' } })).toEqual({
      kind: 'shafted',
      by: 'second',
      from: 'first',
      pot: 49_300,
    });
  });

  test('a share says what each took home', () => {
    expect(outcomeOf({ ...base, picks: { first: 'share', second: null } })).toEqual({
      kind: 'shared',
      each: 24_650,
    });
  });

  test('both shafting loses the lot', () => {
    expect(outcomeOf({ ...base, picks: { first: 'shaft', second: 'shaft' } })).toEqual({
      kind: 'bothShafted',
      pot: 49_300,
    });
  });
});

/** A round of two questions, on its last scoreboard, with the final switched on. */
function lastScoreboard(overrides: Partial<RoomState> = {}): RoomState {
  const question = (id: string): QuizQuestion => ({
    id,
    prompt: `Question ${id}?`,
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    category: 'General Knowledge',
    difficulty: 'easy',
  });
  return {
    ...createRoom('TEST'),
    phase: 'scoreboard',
    players: NA9N_PLAYERS,
    scores: NA9N_SCORES,
    questions: [question('q1'), question('q2')],
    index: 1,
    gameId: 'game-1',
    standoffEnabled: true,
    ...overrides,
  };
}

const run = (state: RoomState, ...actions: Action[]): RoomState => actions.reduce(reduce, state);

describe('the reducer', () => {
  test('the last scoreboard goes to the final when the room chose one', () => {
    const next = run(lastScoreboard(), { type: 'next', at: 1 });
    expect(next.phase).toBe('standoff');
    expect(next.standoff).toEqual({
      finalists: ['first', 'second'],
      stakes: { first: 26_700, second: 22_600 },
      stage: 'talk',
      sealed: null,
      picks: null,
    });
  });

  test('and straight to the results when it did not', () => {
    const next = run(lastScoreboard({ standoffEnabled: false }), { type: 'next', at: 1 });
    expect(next.phase).toBe('finished');
    expect(next.standoff).toBeNull();
  });

  test('a room of one has no final to play', () => {
    const next = run(
      lastScoreboard({ players: { solo: seat('Solo', 1) }, scores: { solo: 4_000 } }),
      { type: 'next', at: 1 },
    );
    expect(next.phase).toBe('finished');
  });

  test('an earlier scoreboard still goes to the next question', () => {
    const next = run(lastScoreboard({ index: 0 }), { type: 'next', at: 1 });
    expect(next.phase).toBe('question');
  });

  test('talk, then pick, then the whistle, then the reveal, then the results', () => {
    const talking = run(lastScoreboard(), { type: 'next', at: 1 });
    const picking = run(talking, { type: 'openPicks' });
    expect(picking.standoff?.stage).toBe('pick');

    const closed = run(picking, { type: 'closePicks', sealed: ['first', 'second'] });
    expect(closed.standoff?.stage).toBe('closed');
    expect(closed.standoff?.sealed).toEqual(['first', 'second']);

    const revealed = run(closed, { type: 'settle', picks: { first: 'share', second: 'shaft' } });
    expect(revealed.standoff?.stage).toBe('revealed');
    expect(revealed.standoff?.picks).toEqual({ first: 'share', second: 'shaft' });
    expect(revealed.scores).toEqual({ ...NA9N_SCORES, first: 0, second: 49_300 });
    expect(revealed.lastDeltas).toEqual({ first: -26_700, second: 26_700 });

    const finished = run(revealed, { type: 'next', at: 2 });
    expect(finished.phase).toBe('finished');
    // Kept, so the round's record and the results can say what happened.
    expect(finished.standoff?.picks).toEqual({ first: 'share', second: 'shaft' });
    expect(finished.scores['second']).toBe(49_300);
  });

  test('nothing skips a stage', () => {
    const talking = run(lastScoreboard(), { type: 'next', at: 1 });
    // No settling while they are still talking, and no leaving before the reveal.
    expect(run(talking, { type: 'settle', picks: { first: 'shaft', second: 'shaft' } })).toBe(talking);
    expect(run(talking, { type: 'closePicks', sealed: ['first'] })).toBe(talking);
    expect(run(talking, { type: 'next', at: 2 })).toBe(talking);

    const picking = run(talking, { type: 'openPicks' });
    expect(run(picking, { type: 'openPicks' })).toBe(picking);
    // Nothing is paid before the whistle.
    expect(run(picking, { type: 'settle', picks: { first: 'shaft', second: 'shaft' } })).toBe(picking);
    expect(run(picking, { type: 'next', at: 2 })).toBe(picking);

    const closed = run(picking, { type: 'closePicks', sealed: ['first', 'second'] });
    expect(run(closed, { type: 'closePicks', sealed: [] })).toBe(closed);
    expect(run(closed, { type: 'next', at: 2 })).toBe(closed);

    const revealed = run(closed, { type: 'settle', picks: { first: 'share', second: 'share' } });
    // A second settle — a late echo — cannot pay out twice.
    expect(run(revealed, { type: 'settle', picks: { first: 'shaft', second: 'shaft' } })).toBe(revealed);
  });

  /*
    The reason the whistle exists. A finalist whose opponent never picked has to
    be able to reveal, and after the close they can safely — but a commitment
    that arrives after it could have been made by reading that reveal.
  */
  test('a pick committed after the whistle does not count', () => {
    const closed = run(
      lastScoreboard(),
      { type: 'next', at: 1 },
      { type: 'openPicks' },
      { type: 'closePicks', sealed: ['first'] },
    );
    const settled = run(closed, { type: 'settle', picks: { first: 'share', second: 'shaft' } });
    expect(settled.standoff?.picks).toEqual({ first: 'share', second: null });
    // Both read as sharing, so the pot splits.
    expect(settled.scores['second']).toBe(24_650);
  });

  test('only a finalist can be sealed', () => {
    const closed = run(
      lastScoreboard(),
      { type: 'next', at: 1 },
      { type: 'openPicks' },
      { type: 'closePicks', sealed: ['first', 'third'] },
    );
    expect(closed.standoff?.sealed).toEqual(['first']);
  });

  test('the stakes are fixed when the final opens', () => {
    // A late answer echo or a stray score write between talk and settle must not
    // change what either finalist is playing for.
    const talking = run(lastScoreboard(), { type: 'next', at: 1 });
    const moved = { ...talking, scores: { ...talking.scores, first: 99_999 } };
    const settled = run(
      moved,
      { type: 'openPicks' },
      { type: 'closePicks', sealed: ['first', 'second'] },
      { type: 'settle', picks: { first: 'shaft', second: 'share' } },
    );
    expect(settled.scores['first']).toBe(99_999 - 26_700 + 49_300);
  });

  test('the wager is settled first, so it decides who reaches the final', () => {
    const lastQuestion = lastScoreboard({
      phase: 'question',
      wagerEnabled: true,
      questions: lastScoreboard().questions.map((entry) => ({ ...entry, correctIndex: null })),
      answers: { third: { optionIndex: 0, elapsedMs: 900, wager: 100 } },
    });
    const revealed = run(lastQuestion, { type: 'reveal', correctIndex: 0, questionId: 'q2' });
    const final = run(revealed, { type: 'next', at: 1 }, { type: 'next', at: 2 });
    expect(final.standoff?.finalists[0]).toBe('third');
  });

  test('a new round and a reset both start with no final', () => {
    const finished = run(
      lastScoreboard(),
      { type: 'next', at: 1 },
      { type: 'openPicks' },
      { type: 'closePicks', sealed: [] },
      { type: 'settle', picks: {} },
      { type: 'next', at: 2 },
    );
    expect(run(finished, { type: 'reset' }).standoff).toBeNull();
  });

  test('the lobby carries the choice into the room', () => {
    const room = { ...createRoom('TEST'), players: NA9N_PLAYERS };
    const picked = run(room, {
      type: 'selectPack',
      packId: 'science',
      packTitle: 'Science',
      questions: lastScoreboard().questions,
      wagerEnabled: false,
      stealEnabled: false,
      standoffEnabled: true,
    });
    expect(picked.standoffEnabled).toBe(true);
    expect(run(picked, { type: 'start', at: 1, gameId: 'g', durationSecs: 10 }).standoff).toBeNull();
  });
});

/*
  The phase list in the rules is an exact allow-list, and `App.tsx` matches
  phases exhaustively. A phase the engine knows and the rules do not is refused
  on the write that enters it — the whole room stops on the last scoreboard with
  nothing on screen to say why. The same guard the game record has.
*/
describe('the phases agree with the security rules', () => {
  const RULES = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const listed = /request\.resource\.data\.phase in\s*\[([^\]]*)\]/.exec(RULES)?.[1] ?? '';
  const names = [...listed.matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();

  test('every phase the engine can write is one the rules accept', () => {
    expect(names).toEqual([...PHASES].sort());
  });
});
