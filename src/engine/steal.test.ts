import { describe, expect, test } from 'vitest';
import { stealFor, STEAL_SHARE, tallyQuestion, verdictFor } from './scoring';
import { createRoom, type Answer, type QuizQuestion, type RoomState } from './state';
import { reduce, type Action } from './reducer';

/** An answer at a given time, optionally carrying a stake. */
function at(elapsedMs: number, optionIndex: number, wager?: number): Answer {
  return { optionIndex, elapsedMs, ...(wager === undefined ? {} : { wager }) };
}

/*
  One shape reused throughout: a runaway leader, a chaser, and somebody who has
  barely scored. It is XS4A's shape — 22,800 against a table that mostly did not
  get going — which is the round this mechanic exists to answer.
*/
const SCORES = { leader: 10_000, chaser: 2_000, quiet: 500 };

describe('stealFor', () => {
  test('the fastest correct answer takes a share of the leader’s points', () => {
    // #given the chaser gets it right first
    const answers = { chaser: at(900, 1), quiet: at(2_000, 1) };

    // #when the steal is worked out
    const steal = stealFor({ correctIndex: 1, answers, scores: SCORES });

    // #then it moves STEAL_SHARE% of what the leader held, from them to the chaser
    expect(steal).toEqual({
      from: 'leader',
      to: 'chaser',
      points: Math.round((10_000 * STEAL_SHARE) / 100),
    });
  });

  test('nobody steals from themselves', () => {
    /*
      #given the leader is also the fastest correct answer

      #then there is no steal. This is the whole self-limiting property of the
      mechanic: it fires only when somebody other than the leader is quickest,
      so a leader who keeps winning questions is never pegged back for it.
    */
    const answers = { leader: at(900, 1), chaser: at(2_000, 1) };
    expect(stealFor({ correctIndex: 1, answers, scores: SCORES })).toBeNull();
  });

  test('a question nobody got right steals nothing', () => {
    const answers = { chaser: at(900, 3), quiet: at(2_000, 0) };
    expect(stealFor({ correctIndex: 1, answers, scores: SCORES })).toBeNull();
  });

  test('a leader holding nothing loses nothing', () => {
    // #given a table where the front-runner is still on zero
    const answers = { chaser: at(900, 1) };
    expect(stealFor({ correctIndex: 1, answers, scores: { chaser: 0, leader: 0 } })).toBeNull();
  });

  test('the victim is decided by uid when the lead is tied, so every device agrees', () => {
    /*
      #given two players level at the top

      #then the same one loses the points on every device. `standings` breaks a
      tie on uid for exactly this reason, and a steal that picked differently
      per client would put the room's scoreboards permanently out of step.
    */
    const answers = { chaser: at(900, 1) };
    const steal = stealFor({
      correctIndex: 1,
      answers,
      scores: { zeta: 9_000, alpha: 9_000, chaser: 100 },
    });
    expect(steal?.from).toBe('alpha');
  });
});

describe('tallyQuestion with a steal', () => {
  const answers = { chaser: at(900, 1), quiet: at(2_000, 1) };
  const steal = { from: 'leader', to: 'chaser', points: 500 };

  test('the thief is paid on top of the base and the rank bonus', () => {
    const deltas = tallyQuestion({ correctIndex: 1, answers, steal });
    // 500 base + 500 for landing first + 500 taken off the leader
    expect(deltas['chaser']).toBe(1_500);
  });

  test('the victim loses exactly that, even having never answered', () => {
    const deltas = tallyQuestion({ correctIndex: 1, answers, steal });
    expect(deltas['leader']).toBe(-500);
  });

  test('a steal moves points rather than making them', () => {
    /*
      #then the round's total is untouched. Worth asserting rather than assuming:
      the wager creates and destroys points, and this deliberately does not — the
      scoreboard adds up to the same number before and after.
    */
    const without = tallyQuestion({ correctIndex: 1, answers });
    const with_ = tallyQuestion({ correctIndex: 1, answers, steal });
    const sum = (d: Record<string, number>) => Object.values(d).reduce((a, b) => a + b, 0);
    expect(sum(with_)).toBe(sum(without));
  });

  test('a victim who was robbed but never answered still reads as silent', () => {
    /*
      #then `verdictFor` is unchanged for them. It tells `lost` from `wrong` by
      whether a uid is in the deltas at all, so paying a non-answerer into that
      map is the one thing here that could have broken a shipped behaviour.
    */
    const deltas = tallyQuestion({ correctIndex: 1, answers, steal });
    expect(verdictFor({ answer: undefined, correctIndex: 1, deltas, uid: 'leader' }))
      .toBe('silent');
  });

  test('a victim who answered wrongly nets the steal against their zero', () => {
    const wrong = { chaser: at(900, 1), leader: at(1_500, 3) };
    const deltas = tallyQuestion({ correctIndex: 1, answers: wrong, steal });
    expect(deltas['leader']).toBe(-500);
    expect(verdictFor({ answer: wrong['leader'], correctIndex: 1, deltas, uid: 'leader' }))
      .toBe('wrong');
  });

  test('a victim who answered correctly keeps the question and still pays', () => {
    // #given the leader was right, but second
    const both = { chaser: at(900, 1), leader: at(1_500, 1) };
    const deltas = tallyQuestion({ correctIndex: 1, answers: both, steal });
    // 500 base + 400 for landing second, less the 500 taken
    expect(deltas['leader']).toBe(400);
  });

  test('no steal leaves every existing score exactly as it was', () => {
    const deltas = tallyQuestion({ correctIndex: 1, answers, steal: null });
    expect(deltas).toEqual({ chaser: 1_000, quiet: 900 });
  });

  test('a steal and a stake compose on the same question', () => {
    /*
      #given the last question of a round played for both

      #then the stake is settled against what the player held and the steal is
      added on top. They are independent: one doubles your own points, the other
      moves somebody else's.
    */
    const staked = { chaser: at(900, 1, 50), leader: at(1_500, 3, 100) };
    const deltas = tallyQuestion({
      correctIndex: 1,
      answers: staked,
      scores: SCORES,
      steal: { from: 'leader', to: 'chaser', points: 500 },
    });
    // chaser: 500 base + 500 first + 1,000 (half of 2,000) + 500 stolen
    expect(deltas['chaser']).toBe(2_500);
    // leader: lost a 100% stake of 10,000, and 500 taken on top
    expect(deltas['leader']).toBe(-10_500);
  });
});

/* ── Through the reducer ─────────────────────────────────────────────────── */

const QUESTIONS: QuizQuestion[] = [0, 1, 2].map((i) => ({
  id: `q${i}`,
  prompt: `Question ${i}`,
  options: ['A', 'B', 'C', 'D'],
  correctIndex: null,
  category: 'General Knowledge',
  difficulty: 'medium',
}));

function apply(state: RoomState, ...actions: Action[]): RoomState {
  return actions.reduce(reduce, state);
}

/** A round of three, with Ann out in front after the first question. */
function roundWithSteal(stealEnabled: boolean): RoomState {
  const opened = apply(
    createRoom('STL1'),
    { type: 'join', uid: 'ann', name: 'Ann', at: 100 },
    { type: 'join', uid: 'bo', name: 'Bo', at: 200 },
    {
      type: 'selectPack',
      packId: 'general-knowledge',
      packTitle: 'General Knowledge',
      questions: QUESTIONS,
      wagerEnabled: false,
      stealEnabled,
    },
    { type: 'start', at: 1_000, gameId: 'game-1', durationSecs: 20 },
  );

  // Ann alone gets question one, so she leads on 1,000 and Bo is on 0.
  return apply(
    opened,
    { type: 'answer', uid: 'ann', optionIndex: 0, elapsedMs: 1_000 },
    { type: 'reveal', correctIndex: 0, questionId: 'q0' },
    // Twice: `next` is reveal -> scoreboard -> question, one phase at a time.
    { type: 'next', at: 2_000 },
    { type: 'next', at: 2_500 },
  );
}

describe('the steal through the reducer', () => {
  test('a round nobody opted into carries no steal at all', () => {
    const state = apply(
      roundWithSteal(false),
      { type: 'answer', uid: 'bo', optionIndex: 0, elapsedMs: 900 },
      { type: 'reveal', correctIndex: 0, questionId: 'q1' },
    );
    expect(state.lastSteal).toBeNull();
    expect(state.scores).toEqual({ ann: 1_000, bo: 1_000 });
  });

  test('the chaser takes a share off the leader, and the total is unchanged', () => {
    const before = roundWithSteal(true);
    const state = apply(
      before,
      { type: 'answer', uid: 'bo', optionIndex: 0, elapsedMs: 900 },
      { type: 'reveal', correctIndex: 0, questionId: 'q1' },
    );

    // 5% of Ann's 1,000. Bo takes 500 base + 500 for being first, plus the 50.
    expect(state.lastSteal).toEqual({ from: 'ann', to: 'bo', points: 50 });
    expect(state.scores).toEqual({ ann: 950, bo: 1_050 });

    const total = (s: RoomState) => Object.values(s.scores).reduce((a, b) => a + b, 0);
    expect(total(state) - total(before)).toBe(1_000);
  });

  test('the leader answering first takes nothing off themselves', () => {
    const state = apply(
      roundWithSteal(true),
      { type: 'answer', uid: 'ann', optionIndex: 0, elapsedMs: 900 },
      { type: 'answer', uid: 'bo', optionIndex: 0, elapsedMs: 2_000 },
      { type: 'reveal', correctIndex: 0, questionId: 'q1' },
    );
    expect(state.lastSteal).toBeNull();
    expect(state.scores).toEqual({ ann: 2_000, bo: 900 });
  });

  test('skipping a revealed question puts the stolen points back', () => {
    /*
      #then the board is exactly what it was. `skip` reverses `lastDeltas`, and
      the steal is inside those deltas rather than beside them — which is the
      reason it was applied there rather than to `scores` directly.
    */
    const before = roundWithSteal(true);
    const state = apply(
      before,
      { type: 'answer', uid: 'bo', optionIndex: 0, elapsedMs: 900 },
      { type: 'reveal', correctIndex: 0, questionId: 'q1' },
      { type: 'skip' },
    );
    expect(state.scores).toEqual(before.scores);
  });

  test('the steal is cleared when the next question opens', () => {
    // Otherwise the reveal screen would explain the previous question's transfer
    // over the top of a question still being answered.
    const state = apply(
      roundWithSteal(true),
      { type: 'answer', uid: 'bo', optionIndex: 0, elapsedMs: 900 },
      { type: 'reveal', correctIndex: 0, questionId: 'q1' },
      { type: 'next', at: 5_000 },
      { type: 'next', at: 5_500 },
    );
    expect(state.lastSteal).toBeNull();
  });
});
