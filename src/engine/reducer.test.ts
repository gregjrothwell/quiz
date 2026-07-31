import { describe, expect, test } from 'vitest';
import { reduce, type Action } from './reducer';
import {
  QUESTION_DURATION_MS,
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
    correctIndex: 1,
    category: 'Geography',
    difficulty: 'easy',
  },
  {
    id: 'q2',
    prompt: 'Which element has the symbol Fe?',
    options: ['Iron', 'Lead', 'Tin', 'Zinc'],
    correctIndex: 0,
    category: 'Science & Nature',
    difficulty: 'easy',
  },
];

function apply(state: RoomState, ...actions: Action[]): RoomState {
  return actions.reduce(reduce, state);
}

/** A room with two players, a loaded pack, and the first question open. */
function playingRoom(): RoomState {
  return apply(
    createRoom('ABCD'),
    { type: 'join', uid: 'host', name: 'Greg', at: 100 },
    { type: 'join', uid: 'guest', name: 'Sam', at: 200 },
    { type: 'selectPack', packId: 'geography', packTitle: 'Geography', questions: QUESTIONS },
    { type: 'start', at: 1_000 },
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
    const result = reduce(room, { type: 'start', at: 1_000 });

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

  test('keeps the first answer when a player answers twice', () => {
    // #given a player who has already answered
    const room = reduce(playingRoom(), {
      type: 'answer',
      uid: 'guest',
      optionIndex: 1,
      elapsedMs: 2000,
    });

    // #when they try to change it
    const result = reduce(room, { type: 'answer', uid: 'guest', optionIndex: 2, elapsedMs: 3000 });

    // #then the original answer stands
    expect(result.answers['guest']?.optionIndex).toBe(1);
  });

  test('ignores an answer arriving after the window closed', () => {
    // #given an open question
    const room = playingRoom();

    // #when an answer arrives past the duration
    const result = reduce(room, {
      type: 'answer',
      uid: 'guest',
      optionIndex: 1,
      elapsedMs: QUESTION_DURATION_MS + 1,
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
    const result = reduce(room, { type: 'reveal' });

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
    const result = reduce(room, { type: 'reveal' });

    // #then no points are awarded
    expect(result.scores['guest']).toBe(0);
  });

  test('moves the room into the reveal phase', () => {
    // #given an open question
    const room = playingRoom();

    // #when it is revealed
    const result = reduce(room, { type: 'reveal' });

    // #then the phase advances and the timer is cleared
    expect({ phase: result.phase, openedAt: result.questionOpenedAt }).toEqual({
      phase: 'reveal',
      openedAt: null,
    });
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
      { type: 'reveal' },
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
    const room = reduce(playingRoom(), { type: 'reveal' });

    // #when the quizmaster advances
    const result = reduce(room, { type: 'next', at: 6_000 });

    // #then the standings are shown
    expect(result.phase).toBe('scoreboard');
  });

  test('opens the next question from the scoreboard', () => {
    // #given the scoreboard after the first question
    const room = apply(
      playingRoom(),
      { type: 'reveal' },
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
      { type: 'reveal' },
      { type: 'next', at: 6_000 },
      { type: 'next', at: 7_000 },
      { type: 'reveal' },
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
      { type: 'reveal' },
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
      { type: 'reveal' },
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
