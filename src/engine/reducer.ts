import type { PackId } from '../questions/types';
import { tallyQuestion } from './scoring';
import {
  QUESTION_DURATION_MS,
  currentQuestion,
  type Player,
  type QuizQuestion,
  type RoomState,
} from './state';

export type Action =
  | { type: 'join'; uid: string; name: string; at: number }
  | { type: 'leave'; uid: string }
  | { type: 'selectPack'; packId: PackId; packTitle: string; questions: QuizQuestion[] }
  | { type: 'start'; at: number; gameId: string }
  | { type: 'answer'; uid: string; optionIndex: number; elapsedMs: number }
  /**
   * `correctIndex` arrives from the vault, not from the room. Only the client
   * that ran the reveal knows it, and writing it into the question is how
   * everybody else finds out.
   */
  | { type: 'reveal'; correctIndex: number }
  | { type: 'skip' }
  | { type: 'next'; at: number }
  | { type: 'reset' };

/**
 * The whole game as a pure function, so the rules can be tested without
 * Firestore, React, or a clock. Every transition returns a new state; unknown or
 * out-of-phase actions return the state unchanged rather than throwing, because
 * a late network echo must not be able to crash a room.
 */
export function reduce(state: RoomState, action: Action): RoomState {
  switch (action.type) {
    case 'join':
      return join(state, action.uid, action.name, action.at);
    case 'leave':
      return leave(state, action.uid);
    case 'selectPack':
      return selectPack(state, action.packId, action.packTitle, action.questions);
    case 'start':
      return start(state, action.at, action.gameId);
    case 'answer':
      return answer(state, action.uid, action.optionIndex, action.elapsedMs);
    case 'reveal':
      return reveal(state, action.correctIndex);
    case 'skip':
      return skip(state);
    case 'next':
      return next(state, action.at);
    case 'reset':
      return reset(state);
  }
}

function join(state: RoomState, uid: string, name: string, at: number): RoomState {
  // A rejoin must not reset joinedAt, or a reconnecting quizmaster would lose
  // the role to whoever stayed put.
  if (state.players[uid]) return state;

  const player: Player = { name, joinedAt: at };
  return {
    ...state,
    players: { ...state.players, [uid]: player },
    scores: { ...state.scores, [uid]: state.scores[uid] ?? 0 },
  };
}

function leave(state: RoomState, uid: string): RoomState {
  if (!state.players[uid]) return state;

  const players = { ...state.players };
  delete players[uid];

  const answers = { ...state.answers };
  delete answers[uid];

  // The quizmaster role needs no handover: it is derived from who remains.
  return { ...state, players, answers };
}

function selectPack(
  state: RoomState,
  packId: PackId,
  packTitle: string,
  questions: QuizQuestion[],
): RoomState {
  if (state.phase !== 'lobby') return state;
  return { ...state, packId, packTitle, questions };
}

function start(state: RoomState, at: number, gameId: string): RoomState {
  if (state.phase !== 'lobby') return state;
  if (state.questions.length === 0) return state;

  return {
    ...state,
    phase: 'question',
    index: 0,
    questionOpenedAt: at,
    gameId,
    answers: {},
    lastDeltas: {},
    // Everyone starts on zero, including anyone who joined after a previous game.
    scores: Object.fromEntries(Object.keys(state.players).map((uid) => [uid, 0])),
  };
}

function answer(state: RoomState, uid: string, optionIndex: number, elapsedMs: number): RoomState {
  if (state.phase !== 'question') return state;
  if (!state.players[uid]) return state;
  // First answer stands — no changing your mind once committed.
  if (state.answers[uid]) return state;

  const question = currentQuestion(state);
  if (!question) return state;
  if (optionIndex < 0 || optionIndex >= question.options.length) return state;

  // Answers arriving after the window closed are ignored rather than scored at
  // zero, so a laggy client is not punished differently from a silent one.
  if (elapsedMs > QUESTION_DURATION_MS) return state;

  return { ...state, answers: { ...state.answers, [uid]: { optionIndex, elapsedMs } } };
}

function reveal(state: RoomState, correctIndex: number): RoomState {
  if (state.phase !== 'question') return state;

  const question = currentQuestion(state);
  if (!question) return state;
  // A vault answer that does not name one of this question's lecterns means the
  // room and the vault disagree about what is being asked. Scoring anything on
  // that basis would mark the whole room wrong, so the reveal is refused and
  // the question stays open instead.
  if (correctIndex < 0 || correctIndex >= question.options.length) return state;

  // Only people who are actually in the room score.
  //
  // Answers arrive through a subcollection that nothing checks membership on,
  // so a client can write one for a room it is not a member of — which is how a
  // reaped player kept banking points nobody could see: `standings` filters on
  // `players`, so the score existed in the document and appeared on no screen.
  // `answer` in this same reducer has always refused a non-member; this is the
  // reveal agreeing with it, so a score can never exist for somebody the room
  // does not list.
  //
  // Safe for anybody merely passing through that state: a client that finds
  // itself missing puts itself back within a second, and a reveal cannot happen
  // until twenty seconds after the question opened.
  const eligible = Object.fromEntries(
    Object.entries(state.answers).filter(([uid]) => state.players[uid]),
  );

  const deltas = tallyQuestion({ correctIndex, answers: eligible });

  const scores = { ...state.scores };
  for (const [uid, delta] of Object.entries(deltas)) {
    scores[uid] = (scores[uid] ?? 0) + delta;
  }

  // Written back into the question so every other client learns the answer from
  // the room update they are already listening to, rather than each paying for
  // its own read of the vault's reveal document.
  const questions = state.questions.map((entry, index) =>
    index === state.index ? { ...entry, correctIndex } : entry,
  );

  return {
    ...state,
    phase: 'reveal',
    questions,
    questionOpenedAt: null,
    lastDeltas: deltas,
    scores,
  };
}

/**
 * Throws out the current question without scoring it. The rule-based question
 * filter cannot judge whether a question is any good, so the quizmaster is the
 * last line of defence against a bad one.
 */
function skip(state: RoomState): RoomState {
  if (state.phase !== 'question' && state.phase !== 'reveal') return state;

  const question = currentQuestion(state);
  if (!question) return state;

  // Undo any points already awarded for it if we are skipping post-reveal.
  const scores = { ...state.scores };
  if (state.phase === 'reveal') {
    for (const [uid, delta] of Object.entries(state.lastDeltas)) {
      scores[uid] = (scores[uid] ?? 0) - delta;
    }
  }

  return {
    ...state,
    phase: 'scoreboard',
    questionOpenedAt: null,
    answers: {},
    lastDeltas: {},
    scores,
    skipped: [...state.skipped, question.id],
  };
}

function next(state: RoomState, at: number): RoomState {
  if (state.phase === 'reveal') {
    return { ...state, phase: 'scoreboard' };
  }

  if (state.phase === 'scoreboard') {
    const nextIndex = state.index + 1;
    if (nextIndex >= state.questions.length) {
      return { ...state, phase: 'finished', answers: {}, lastDeltas: {} };
    }
    return {
      ...state,
      phase: 'question',
      index: nextIndex,
      questionOpenedAt: at,
      answers: {},
      lastDeltas: {},
    };
  }

  return state;
}

function reset(state: RoomState): RoomState {
  return {
    ...state,
    phase: 'lobby',
    packId: null,
    packTitle: null,
    questions: [],
    index: 0,
    questionOpenedAt: null,
    answers: {},
    lastDeltas: {},
    scores: Object.fromEntries(Object.keys(state.players).map((uid) => [uid, 0])),
    skipped: [],
    // Cleared so the next round mints its own id and counts separately.
    gameId: null,
  };
}
