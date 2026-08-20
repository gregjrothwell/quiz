import { describe, expect, test } from 'vitest';
import { reduce, type Action } from './reducer';
import {
  DEFAULT_DURATION_SECS,
  DEFAULT_QUESTION_DURATION_MS,
  createRoom,
  resolveQuizmaster,
  type QuizQuestion,
  type RoomState,
} from './state';

const QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    prompt: 'Which river flows through London?',
    options: ['Severn', 'Thames', 'Mersey', 'Tyne'],
    correctIndex: null,
    category: 'Geography',
    difficulty: 'easy',
  },
  {
    id: 'q2',
    prompt: 'Which element has the symbol Fe?',
    options: ['Iron', 'Lead', 'Tin', 'Zinc'],
    correctIndex: null,
    category: 'Science & Nature',
    difficulty: 'easy',
  },
];

/**
 * What the vault holds for each fixture question. The room never carries this
 * while a question is open, so a test that reveals has to supply it exactly as
 * the real reveal does — see src/lib/vault.ts.
 */
const VAULT: Record<string, number> = { q1: 1, q2: 0 };

/** What the vault would answer for whichever question the room is currently on. */
function vaultIndexOf(state: RoomState): number {
  const question = state.questions[state.index];
  const correctIndex = VAULT[question?.id ?? ''];
  if (correctIndex === undefined) throw new Error('fixture has no vault entry');
  return correctIndex;
}

/** The reveal action for whichever question the room is currently on. */
function revealNow(state: RoomState): Action {
  return {
    type: 'reveal',
    correctIndex: vaultIndexOf(state),
    questionId: state.questions[state.index]?.id ?? '',
  };
}

/**
 * Folds actions over a room. An action may be given as a function of the state
 * so far, which is how a reveal names the answer for whichever question is
 * actually in play at that point in the sequence.
 */
type Step = Action | ((state: RoomState) => Action);

function apply(state: RoomState, ...steps: Step[]): RoomState {
  return steps.reduce(
    (current, step) => reduce(current, typeof step === 'function' ? step(current) : step),
    state,
  );
}

/** A room with two players, a loaded pack, and the first question open. */
function playingRoom(): RoomState {
  return apply(
    createRoom('ABCD'),
    { type: 'join', uid: 'host', name: 'Greg', at: 100 },
    { type: 'join', uid: 'guest', name: 'Sam', at: 200 },
    { type: 'selectPack', packId: 'geography', packTitle: 'Geography', questions: QUESTIONS },
    { type: 'start', at: 1_000, gameId: 'game-1', durationSecs: DEFAULT_DURATION_SECS },
  );
}

describe('join', () => {
  test('makes the first player to join the quizmaster', () => {
    // #given an empty room
    const room = createRoom('ABCD');

    // #when the first player joins
    const result = reduce(room, { type: 'join', uid: 'host', name: 'Greg', at: 100 });

    // #then they hold the quizmaster role
    expect(resolveQuizmaster(result.players)).toBe('host');
  });

  test('leaves the quizmaster unchanged when a second player joins', () => {
    // #given a room that already has a quizmaster
    const room = reduce(createRoom('ABCD'), { type: 'join', uid: 'host', name: 'Greg', at: 100 });

    // #when a second player joins
    const result = reduce(room, { type: 'join', uid: 'guest', name: 'Sam', at: 200 });

    // #then the original quizmaster keeps the role
    expect(resolveQuizmaster(result.players)).toBe('host');
  });

  test('ignores a duplicate join from the same player', () => {
    // #given a player already in the room
    const room = reduce(createRoom('ABCD'), { type: 'join', uid: 'host', name: 'Greg', at: 100 });

    // #when the same uid joins again, as a reconnect would
    const result = reduce(room, { type: 'join', uid: 'host', name: 'Greg', at: 300 });

    // #then they are not duplicated in the player list
    expect(Object.keys(result.players)).toHaveLength(1);
  });

  test('does not reset joinedAt when a player reconnects', () => {
    // #given a quizmaster and a later joiner
    const room = apply(
      createRoom('ABCD'),
      { type: 'join', uid: 'host', name: 'Greg', at: 100 },
      { type: 'join', uid: 'guest', name: 'Sam', at: 200 },
    );

    // #when the quizmaster rejoins after a blip, later than the guest
    const result = reduce(room, { type: 'join', uid: 'host', name: 'Greg', at: 900 });

    // #then they keep the role rather than losing it to whoever stayed put
    expect(resolveQuizmaster(result.players)).toBe('host');
  });
});

describe('leave', () => {
  test('hands the quizmaster role to the longest-present player', () => {
    // #given a quizmaster and two later joiners
    const room = apply(
      createRoom('ABCD'),
      { type: 'join', uid: 'host', name: 'Greg', at: 100 },
      { type: 'join', uid: 'second', name: 'Sam', at: 200 },
      { type: 'join', uid: 'third', name: 'Alex', at: 300 },
    );

    // #when the quizmaster drops out
    const result = reduce(room, { type: 'leave', uid: 'host' });

    // #then the earliest remaining player takes over
    expect(resolveQuizmaster(result.players)).toBe('second');
  });

  test('clears the quizmaster when the last player leaves', () => {
    // #given a room with one player
    const room = reduce(createRoom('ABCD'), { type: 'join', uid: 'host', name: 'Greg', at: 100 });

    // #when they leave
    const result = reduce(room, { type: 'leave', uid: 'host' });

    // #then no one holds the role
    expect(resolveQuizmaster(result.players)).toBeNull();
  });

  test('keeps the quizmaster when a different player leaves', () => {
    // #given a quizmaster and a guest
    const room = apply(
      createRoom('ABCD'),
      { type: 'join', uid: 'host', name: 'Greg', at: 100 },
      { type: 'join', uid: 'guest', name: 'Sam', at: 200 },
    );

    // #when the guest leaves
    const result = reduce(room, { type: 'leave', uid: 'guest' });

    // #then the quizmaster is untouched
    expect(resolveQuizmaster(result.players)).toBe('host');
  });

  test('ignores a leave from someone who was never in the room', () => {
    // #given a room with one player
    const room = reduce(createRoom('ABCD'), { type: 'join', uid: 'host', name: 'Greg', at: 100 });

    // #when an unknown uid leaves
    const result = reduce(room, { type: 'leave', uid: 'stranger' });

    // #then the state is returned unchanged
    expect(result).toBe(room);
  });
});

describe('start', () => {
  test('refuses to start without a loaded pack', () => {
    // #given a room with players but no questions
    const room = reduce(createRoom('ABCD'), { type: 'join', uid: 'host', name: 'Greg', at: 100 });

    // #when a start is attempted
    const result = reduce(room, {
      type: 'start',
      at: 1_000,
      gameId: 'game-1',
      durationSecs: DEFAULT_DURATION_SECS,
    });

    // #then the room stays in the lobby
    expect(result.phase).toBe('lobby');
  });

  test('opens the first question when a pack is loaded', () => {
    // #given a room with a loaded pack
    const room = playingRoom();

    // #then the first question is open and timed
    expect({ phase: room.phase, index: room.index, openedAt: room.questionOpenedAt }).toEqual({
      phase: 'question',
      index: 0,
      openedAt: 1_000,
    });
  });

  test('stamps the round with the game id it was started with', () => {
    // #given a started round
    const room = playingRoom();

    // #then the id the season table banks against is recorded
    expect(room.gameId).toBe('game-1');
  });

  test('a second round carries its own game id', () => {
    // #given a room that has played a round and been reset
    const replayed = apply(
      playingRoom(),
      { type: 'reset' },
      { type: 'selectPack', packId: 'geography', packTitle: 'Geography', questions: QUESTIONS },
      { type: 'start', at: 5_000, gameId: 'game-2', durationSecs: DEFAULT_DURATION_SECS },
    );

    // #then the new round is distinguishable from the first, so both can count
    expect(replayed.gameId).toBe('game-2');
  });
});

describe('the answer window', () => {
  /** A room playing a round on a window other than the default. */
  function briskRoom(durationSecs = 10): RoomState {
    return apply(
      createRoom('ABCD'),
      { type: 'join', uid: 'host', name: 'Greg', at: 100 },
      { type: 'join', uid: 'guest', name: 'Sam', at: 200 },
      { type: 'selectPack', packId: 'geography', packTitle: 'Geography', questions: QUESTIONS },
      { type: 'start', at: 1_000, gameId: 'game-1', durationSecs },
    );
  }

  test('a new room starts on the default window', () => {
    // #given a freshly created room
    const room = createRoom('ABCD');

    // #then it carries the same default the security rules fall back to
    expect(room.durationSecs).toBe(DEFAULT_DURATION_SECS);
  });

  test('starting a round fixes the window the quizmaster chose', () => {
    // #given a round started on ten seconds
    const room = briskRoom(10);

    // #then the room carries it, which is what every client and the rules read
    expect(room.durationSecs).toBe(10);
  });

  test('refuses a window the security rules would reject', () => {
    // #given a lobby with a loaded pack
    const room = apply(
      createRoom('ABCD'),
      { type: 'join', uid: 'host', name: 'Greg', at: 100 },
      { type: 'selectPack', packId: 'geography', packTitle: 'Geography', questions: QUESTIONS },
    );

    // #when a round is started below the floor the rules enforce
    const result = reduce(room, {
      type: 'start',
      at: 1_000,
      gameId: 'game-1',
      durationSecs: 1,
    });

    // #then it stays in the lobby rather than starting a round the vault would
    // refuse to open at its first reveal
    expect(result.phase).toBe('lobby');
  });

  test('moving to the next question leaves the window alone', () => {
    // #given a ten-second round past its first question
    const room = apply(
      briskRoom(10),
      revealNow,
      { type: 'next', at: 2_000 },
      { type: 'next', at: 3_000 },
    );

    // #then the second question runs on the same window as the first — the
    // rules only allow it to move on a write that opens a question, and this
    // one must not take that liberty
    expect({ phase: room.phase, index: room.index, durationSecs: room.durationSecs }).toEqual({
      phase: 'question',
      index: 1,
      durationSecs: 10,
    });
  });

  test('accepts an answer that would have been late on the default window', () => {
    // #given a thirty-second round — longer than anything the lobby offers, but
    // well inside what the rules accept, which is the point: the engine reads
    // the window off the room rather than off the picker
    const room = briskRoom(30);

    // #when an answer arrives after twenty seconds but inside thirty
    const result = reduce(room, {
      type: 'answer',
      uid: 'guest',
      optionIndex: 1,
      elapsedMs: 25_000,
    });

    // #then it counts, because the window is the room's and not the constant
    expect(result.answers['guest']?.elapsedMs).toBe(25_000);
  });

  test('rejects an answer past a shortened window', () => {
    // #given a ten-second round
    const room = briskRoom(10);

    // #when an answer arrives at fifteen seconds, which the old fixed window
    // would have accepted
    const result = reduce(room, {
      type: 'answer',
      uid: 'guest',
      optionIndex: 1,
      elapsedMs: 15_000,
    });

    // #then it is not recorded
    expect(result.answers['guest']).toBeUndefined();
  });

  test('scores speed against the room’s window rather than the default', () => {
    // #given two identical rounds differing only in their window, each answered
    // at the halfway point of the shorter one
    const answered = (durationSecs: number, elapsedMs: number): number =>
      apply(
        briskRoom(durationSecs),
        (state) => ({
          type: 'answer',
          uid: 'guest',
          optionIndex: vaultIndexOf(state),
          elapsedMs,
        }),
        revealNow,
      ).scores['guest'] ?? 0;

    // #when one is answered five seconds into a ten-second window, and the
    // other five seconds into the default twenty
    // #then the first scores the full half of the speed bonus and the second
    // scores three-quarters — the curve is stretched across the real window
    expect({ brisk: answered(10, 5_000), standard: answered(20, 5_000) }).toEqual({
      brisk: 750,
      standard: 875,
    });
  });
});

describe('answer', () => {
  test('records a player answer during the question phase', () => {
    // #given an open question
    const room = playingRoom();

    // #when a player answers
    const result = reduce(room, { type: 'answer', uid: 'guest', optionIndex: 1, elapsedMs: 2000 });

    // #then the answer is stored with the elapsed time it was given in
    expect(result.answers['guest']).toEqual({ optionIndex: 1, elapsedMs: 2_000 });
  });

  test('replaces the answer when a player changes their mind', () => {
    // #given a player who has already answered
    const room = reduce(playingRoom(), {
      type: 'answer',
      uid: 'guest',
      optionIndex: 1,
      elapsedMs: 2000,
    });

    // #when they pick something else
    const result = reduce(room, { type: 'answer', uid: 'guest', optionIndex: 2, elapsedMs: 3000 });

    // #then the new pick stands
    expect(result.answers['guest']?.optionIndex).toBe(2);
  });

  test('charges the later time when a player changes their mind', () => {
    // #given a player who answered almost instantly
    const room = reduce(playingRoom(), {
      type: 'answer',
      uid: 'guest',
      optionIndex: 1,
      elapsedMs: 500,
    });

    // #when they change it much later in the window
    const result = reduce(room, { type: 'answer', uid: 'guest', optionIndex: 2, elapsedMs: 9000 });

    // #then the speed bonus is measured from the change, not the first guess —
    // #otherwise a quick guess banks the points and the revision is free
    expect(result.answers['guest']?.elapsedMs).toBe(9000);
  });

  test('keeps the existing answer when a change arrives after the window', () => {
    // #given a player who answered inside the window
    const room = reduce(playingRoom(), {
      type: 'answer',
      uid: 'guest',
      optionIndex: 1,
      elapsedMs: 2000,
    });

    // #when a change arrives after the clock ran out
    const result = reduce(room, {
      type: 'answer',
      uid: 'guest',
      optionIndex: 3,
      elapsedMs: 99_000,
    });

    // #then it is ignored and the answer they gave in time stands
    expect(result.answers['guest']).toEqual({ optionIndex: 1, elapsedMs: 2000 });
  });

  test('ignores an answer arriving after the window closed', () => {
    // #given an open question
    const room = playingRoom();

    // #when an answer arrives past the duration
    const result = reduce(room, {
      type: 'answer',
      uid: 'guest',
      optionIndex: 1,
      elapsedMs: DEFAULT_QUESTION_DURATION_MS + 1,
    });

    // #then it is not recorded
    expect(result.answers['guest']).toBeUndefined();
  });

  test('ignores an option index outside the available options', () => {
    // #given an open question with four options
    const room = playingRoom();

    // #when an out-of-range index is submitted
    const result = reduce(room, { type: 'answer', uid: 'guest', optionIndex: 9, elapsedMs: 2000 });

    // #then it is rejected
    expect(result.answers['guest']).toBeUndefined();
  });

  test('ignores an answer from someone not in the room', () => {
    // #given an open question
    const room = playingRoom();

    // #when a non-member answers
    const result = reduce(room, { type: 'answer', uid: 'stranger', optionIndex: 1, elapsedMs: 2000 });

    // #then it is rejected
    expect(result.answers['stranger']).toBeUndefined();
  });

  test('ignores an answer outside the question phase', () => {
    // #given a room still in the lobby
    const room = apply(
      createRoom('ABCD'),
      { type: 'join', uid: 'host', name: 'Greg', at: 100 },
    );

    // #when an answer arrives
    const result = reduce(room, { type: 'answer', uid: 'host', optionIndex: 1, elapsedMs: 2000 });

    // #then nothing is recorded
    expect(result.answers).toEqual({});
  });
});

describe('reveal', () => {
  test('adds speed-weighted points for a correct answer', () => {
    // #given a correct answer given instantly
    const room = reduce(playingRoom(), {
      type: 'answer',
      uid: 'guest',
      optionIndex: 1,
      elapsedMs: 0,
    });

    // #when the question is revealed
    const result = reduce(room, revealNow(room));

    // #then the player banks the maximum score
    expect(result.scores['guest']).toBe(1000);
  });

  test('leaves a wrong answer on zero', () => {
    // #given an incorrect answer
    const room = reduce(playingRoom(), {
      type: 'answer',
      uid: 'guest',
      optionIndex: 0,
      elapsedMs: 0,
    });

    // #when the question is revealed
    const result = reduce(room, revealNow(room));

    // #then no points are awarded
    expect(result.scores['guest']).toBe(0);
  });

  test('moves the room into the reveal phase', () => {
    // #given an open question
    const room = playingRoom();

    // #when it is revealed
    const result = reduce(room, revealNow(room));

    // #then the phase advances and the timer is cleared
    expect({ phase: result.phase, openedAt: result.questionOpenedAt }).toEqual({
      phase: 'reveal',
      openedAt: null,
    });
  });

  test('scores an answer that lands while the vault is being asked', () => {
    // #given a question revealed against a room that gained an answer after the
    // vault was asked — the buzzer-beater the round used to throw away
    const asked = playingRoom();
    const action = revealNow(asked);
    const landed = reduce(asked, {
      type: 'answer',
      uid: 'guest',
      optionIndex: 1,
      elapsedMs: 9_900,
    });

    // #when the answer comes back and is applied to the room as it is now
    const result = reduce(landed, action);

    // #then the late answer counts
    expect(result.scores['guest']).toBe(505);
  });

  test('refuses an answer that belongs to a different question', () => {
    // #given a reveal for the question that was open when the vault was asked
    const asked = playingRoom();
    const action = revealNow(asked);

    // #when the room has since moved on to the question after it
    const movedOn = apply(
      asked,
      action,
      { type: 'next', at: 0 },
      { type: 'next', at: 1 },
    );

    // #then applying that answer again does nothing at all, rather than marking
    // the whole room wrong on a question it was never the answer to
    expect(reduce(movedOn, action)).toBe(movedOn);
    expect(movedOn.index).toBe(1);
  });
});

describe('skip', () => {
  test('records the question as skipped', () => {
    // #given an open question
    const room = playingRoom();

    // #when the quizmaster throws it out
    const result = reduce(room, { type: 'skip' });

    // #then its id is recorded so it never scores
    expect(result.skipped).toEqual(['q1']);
  });

  test('takes back points already awarded when skipping after the reveal', () => {
    // #given a revealed question that scored a player
    const room = apply(
      playingRoom(),
      { type: 'answer', uid: 'guest', optionIndex: 1, elapsedMs: 0 },
      revealNow,
    );

    // #when the quizmaster skips it retrospectively
    const result = reduce(room, { type: 'skip' });

    // #then the awarded points are removed again
    expect(result.scores['guest']).toBe(0);
  });

  test('clears answers so the skipped question leaves no trace', () => {
    // #given a question with an answer recorded
    const room = reduce(playingRoom(), {
      type: 'answer',
      uid: 'guest',
      optionIndex: 1,
      elapsedMs: 1000,
    });

    // #when it is skipped
    const result = reduce(room, { type: 'skip' });

    // #then the answers are cleared
    expect(result.answers).toEqual({});
  });
});

describe('next', () => {
  test('moves from reveal to the scoreboard', () => {
    // #given a revealed question
    const room = reduce(playingRoom(), revealNow(playingRoom()));

    // #when the quizmaster advances
    const result = reduce(room, { type: 'next', at: 6_000 });

    // #then the standings are shown
    expect(result.phase).toBe('scoreboard');
  });

  test('opens the next question from the scoreboard', () => {
    // #given the scoreboard after the first question
    const room = apply(
      playingRoom(),
      revealNow,
      { type: 'next', at: 6_000 },
    );

    // #when the quizmaster advances again
    const result = reduce(room, { type: 'next', at: 7_000 });

    // #then the second question opens
    expect({ phase: result.phase, index: result.index }).toEqual({ phase: 'question', index: 1 });
  });

  test('finishes the game after the last question', () => {
    // #given the scoreboard following the final question
    const room = apply(
      playingRoom(),
      revealNow,
      { type: 'next', at: 6_000 },
      { type: 'next', at: 7_000 },
      revealNow,
      { type: 'next', at: 9_000 },
    );

    // #when the quizmaster advances past the end
    const result = reduce(room, { type: 'next', at: 10_000 });

    // #then the game is over
    expect(result.phase).toBe('finished');
  });

  test('clears the previous answers when a new question opens', () => {
    // #given an answered and revealed first question
    const room = apply(
      playingRoom(),
      { type: 'answer', uid: 'guest', optionIndex: 1, elapsedMs: 1000 },
      revealNow,
      { type: 'next', at: 6_000 },
    );

    // #when the next question opens
    const result = reduce(room, { type: 'next', at: 7_000 });

    // #then no stale answers carry over
    expect(result.answers).toEqual({});
  });
});

describe('reset', () => {
  test('returns to the lobby with scores cleared but players kept', () => {
    // #given a finished game with points on the board
    const room = apply(
      playingRoom(),
      { type: 'answer', uid: 'guest', optionIndex: 1, elapsedMs: 0 },
      revealNow,
    );

    // #when the room is reset for another round
    const result = reduce(room, { type: 'reset' });

    // #then players remain but the board is wiped
    expect({
      phase: result.phase,
      players: Object.keys(result.players).length,
      scores: result.scores,
    }).toEqual({ phase: 'lobby', players: 2, scores: { host: 0, guest: 0 } });
  });
});

describe('reveal only scores people in the room', () => {
  test('ignores an answer from a uid the room does not list', () => {
    // #given an open question answered correctly by a member and by somebody
    // who is not in the room — which the answers subcollection permits, since
    // nothing checks membership on the way in
    const room = playingRoom();
    const withStranger: RoomState = {
      ...room,
      answers: {
        guest: { optionIndex: 1, elapsedMs: 0 },
        stranger: { optionIndex: 1, elapsedMs: 0 },
      },
    };

    // #when the question is revealed
    const result = reduce(withStranger, revealNow(withStranger));

    // #then only the member is scored, so no score can exist for somebody the
    // standings would never show — the shape of the room 6SVG bug
    expect(result.lastDeltas).toEqual({ guest: 1000 });
    expect(result.scores['stranger']).toBeUndefined();
  });

  test('still scores a member normally', () => {
    // #given only members answering
    const room = playingRoom();
    const answered = reduce(room, {
      type: 'answer',
      uid: 'guest',
      optionIndex: 1,
      elapsedMs: 0,
    });

    // #when revealed
    const result = reduce(answered, revealNow(answered));

    // #then nothing about the ordinary path changed
    expect(result.scores['guest']).toBe(1000);
  });
});

describe('the opening titles', () => {
  const FACTS = [{ id: 'champion' as const, uids: ['host'], wins: 3 }];

  function lobbyWithPack(): RoomState {
    return apply(
      createRoom('ABCD'),
      { type: 'join', uid: 'host', name: 'Greg', at: 100 },
      { type: 'join', uid: 'guest', name: 'Sam', at: 200 },
      { type: 'selectPack', packId: 'geography', packTitle: 'Geography', questions: QUESTIONS },
    );
  }

  test('go up in the lobby, before a round starts', () => {
    // #given a lobby with a pack chosen
    const state = lobbyWithPack();

    // #when the titles are put up
    const next = reduce(state, { type: 'titles', at: 5_000, facts: FACTS, durationSecs: DEFAULT_DURATION_SECS });

    // #then the room carries them, still in the lobby
    expect(next.phase).toBe('lobby');
    expect(next.form).toEqual({
      at: 5_000,
      facts: FACTS,
      durationSecs: DEFAULT_DURATION_SECS,
    });
  });

  test('are refused once a question is open', () => {
    // #given a round already under way
    const state = playingRoom();

    // #when the titles are put up
    const next = reduce(state, { type: 'titles', at: 5_000, facts: FACTS, durationSecs: DEFAULT_DURATION_SECS });

    // #then nothing changes — a title card over a running clock would take the
    // time out of everybody's answering window, which is the one thing this
    // feature must never do
    expect(next).toBe(state);
  });

  test('are refused when there is nothing to say', () => {
    // #given a lobby and a room the season knows nothing about
    const state = lobbyWithPack();

    // #when empty titles are put up
    const next = reduce(state, { type: 'titles', at: 5_000, facts: [], durationSecs: DEFAULT_DURATION_SECS });

    // #then the round is not held up by a card with nothing on it
    expect(next).toBe(state);
  });

  test('come down when the round starts', () => {
    // #given a lobby showing the titles
    const state = reduce(lobbyWithPack(), { type: 'titles', at: 5_000, facts: FACTS, durationSecs: DEFAULT_DURATION_SECS });

    // #when the round starts
    const next = reduce(state, {
      type: 'start',
      at: 11_000,
      gameId: 'game-1',
      durationSecs: DEFAULT_DURATION_SECS,
    });

    // #then they are cleared, or they would be back on screen at the end of the
    // round when `reset` returns the room to the lobby
    expect(next.form).toBeNull();
    expect(next.phase).toBe('question');
  });

  test('are cleared by a reset', () => {
    // #given a room that somehow reached the end still carrying titles
    const state = { ...playingRoom(), form: { at: 5_000, facts: FACTS, durationSecs: DEFAULT_DURATION_SECS } };

    // #when the room is reset
    const next = reduce(state, { type: 'reset' });

    // #then the lobby is a lobby again, not a title card
    expect(next.form).toBeNull();
  });
});

describe('join and the claimed identity', () => {
  test('records a playerId that differs from the uid', () => {
    // #given somebody joining on a browser that has claimed a season record
    const state = reduce(createRoom('ABCD'), {
      type: 'join',
      uid: 'work-browser',
      name: 'Greg',
      at: 100,
      playerId: 'greg-at-home',
    });

    // #then the room carries it, so the opening titles can find their season row
    // without a claims lookup per player
    expect(state.players['work-browser']?.playerId).toBe('greg-at-home');
  });

  test('leaves the entry exactly as it was when the two match', () => {
    // #given an ordinary player, who has claimed nothing
    const state = reduce(createRoom('ABCD'), {
      type: 'join',
      uid: 'greg',
      name: 'Greg',
      at: 100,
      playerId: 'greg',
    });

    // #then no redundant copy of the uid goes into the document — the entry is
    // byte-for-byte the two fields it has always been
    expect(state.players.greg).toEqual({ name: 'Greg', joinedAt: 100 });
  });
});

describe('the quizmaster keeps the start of the round', () => {
  const FACTS = [{ id: 'champion' as const, uids: ['host'], wins: 3 }];

  function titledLobby(durationSecs = 15): RoomState {
    return apply(
      createRoom('ABCD'),
      { type: 'join', uid: 'host', name: 'Greg', at: 100 },
      { type: 'selectPack', packId: 'geography', packTitle: 'Geography', questions: QUESTIONS },
      { type: 'titles', at: 5_000, facts: FACTS, durationSecs },
    );
  }

  test('holds the round in the lobby until it is started', () => {
    // #given titles that went up a long time ago
    const state = titledLobby();

    // #then the room has not moved on by itself — nothing here runs on a timer,
    // because a round that begins on its own takes the start of the quiz away
    // from the person running it
    expect(state.phase).toBe('lobby');
    expect(state.form).not.toBeNull();
  });

  test('opens on the window that was chosen, not the room default', () => {
    // #given titles carrying a fifteen-second window
    const state = titledLobby(15);

    // #when the quizmaster starts the round with what the digest carried
    const next = reduce(state, {
      type: 'start',
      at: 9_000,
      gameId: 'game-1',
      durationSecs: state.form?.durationSecs ?? 0,
    });

    // #then the round opens on fifteen. The window cannot be parked on the
    // room's own durationSecs, which the rules pin until a question opens, so it
    // rides inside the digest instead
    expect(next.durationSecs).toBe(15);
    expect(next.phase).toBe('question');
  });

  test('refuses titles carrying a window the rules would reject', () => {
    // #given a lobby and a one-second window
    const state = apply(
      createRoom('ABCD'),
      { type: 'join', uid: 'host', name: 'Greg', at: 100 },
      { type: 'selectPack', packId: 'geography', packTitle: 'Geography', questions: QUESTIONS },
    );

    // #when the titles are put up with it
    const next = reduce(state, { type: 'titles', at: 5_000, facts: FACTS, durationSecs: 1 });

    // #then it is refused here, where it costs a Start button that does nothing
    // rather than a round that stops dead at its first reveal
    expect(next).toBe(state);
  });

  test('goes back to the lobby controls when the titles are cleared', () => {
    // #given a quizmaster who has changed their mind about the round
    const state = titledLobby();

    // #when the titles are cleared
    const next = reduce(state, { type: 'clearTitles' });

    // #then the lobby is a lobby again, with the pack still chosen
    expect(next.form).toBeNull();
    expect(next.questions).toHaveLength(QUESTIONS.length);
  });

  test('clearing titles that are not up changes nothing', () => {
    // #given an ordinary lobby
    const state = reduce(createRoom('ABCD'), { type: 'join', uid: 'host', name: 'Greg', at: 100 });

    // #when the titles are cleared
    // #then the same object comes back, so no write is made for a no-op
    expect(reduce(state, { type: 'clearTitles' })).toBe(state);
  });
});
