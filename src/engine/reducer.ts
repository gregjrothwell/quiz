import type { PackId } from '../questions/types';
import type { FormFact } from './form';
import { tallyQuestion } from './scoring';
import {
  currentQuestion,
  isDurationAllowed,
  isWagerQuestion,
  questionDurationMs,
  type Player,
  type QuizQuestion,
  type RoomState,
} from './state';

export type Action =
  | { type: 'join'; uid: string; name: string; at: number; playerId?: string; squad?: string }
  /**
   * The opening titles. Written while the room is still in the lobby, because
   * the answering window is stamped by the server the moment a question opens —
   * a beat of theatre laid over question one would come straight out of
   * everybody's thinking time.
   *
   * They stay up until the quizmaster starts the round. Nothing here is on a
   * timer: a round that begins on its own takes the start of the quiz away from
   * the person running it, which is the one moment they most want to hold.
   */
  | { type: 'titles'; at: number; facts: FormFact[]; durationSecs: number }
  /** Back to the lobby controls, for a quizmaster who has changed their mind. */
  | { type: 'clearTitles' }
  | { type: 'leave'; uid: string }
  | {
      type: 'selectPack';
      packId: PackId;
      packTitle: string;
      questions: QuizQuestion[];
      wagerEnabled: boolean;
    }
  /**
   * `durationSecs` is settled here and nowhere else. The security rules pin it
   * for as long as a question is open, so the one write that may change it is
   * the write that opens one — and starting a round is the only such write a
   * quizmaster makes deliberately.
   */
  | { type: 'start'; at: number; gameId: string; durationSecs: number }
  | { type: 'answer'; uid: string; optionIndex: number; elapsedMs: number; wager?: number }
  /**
   * `correctIndex` arrives from the vault, not from the room. Only the client
   * that ran the reveal knows it, and writing it into the question is how
   * everybody else finds out.
   *
   * `questionId` says which question it is the answer *to*. The vault is asked
   * before this is dispatched, so there is a network round trip between reading
   * the question and scoring it, and this is what stops an answer being applied
   * to a question the room has since moved on to — which would mark everybody
   * wrong on a question nobody got a chance to get wrong.
   */
  | { type: 'reveal'; correctIndex: number; questionId: string }
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
      return join(state, action.uid, action.name, action.at, action.playerId, action.squad);
    case 'titles':
      return titles(state, action.at, action.facts, action.durationSecs);
    case 'clearTitles':
      return state.form === null ? state : { ...state, form: null };
    case 'leave':
      return leave(state, action.uid);
    case 'selectPack':
      return selectPack(state, action.packId, action.packTitle, action.questions, action.wagerEnabled);
    case 'start':
      return start(state, action.at, action.gameId, action.durationSecs);
    case 'answer':
      return answer(state, action.uid, action.optionIndex, action.elapsedMs, action.wager);
    case 'reveal':
      return reveal(state, action.correctIndex, action.questionId);
    case 'skip':
      return skip(state);
    case 'next':
      return next(state, action.at);
    case 'reset':
      return reset(state);
  }
}

function join(
  state: RoomState,
  uid: string,
  name: string,
  at: number,
  playerId?: string,
  squad?: string,
): RoomState {
  // A rejoin must not reset joinedAt, or a reconnecting quizmaster would lose
  // the role to whoever stayed put.
  if (state.players[uid]) return state;

  // Both omitted rather than written empty. Unconditionally they would put a
  // redundant copy of the uid, and an empty squad, into every entry in every
  // room — and, worse, change the shape of a document that clients one deploy
  // behind still write, for no information at all.
  //
  // This path is only ever taken by the person **creating** a room, since
  // everybody else joins through `planJoin`. That makes it easy to miss and
  // expensive to get wrong: the quizmaster is the one player guaranteed to be in
  // every room, so a squad omitted here is a squad board with a hole in it on
  // every single round.
  const player: Player = {
    name,
    joinedAt: at,
    ...(playerId && playerId !== uid ? { playerId } : {}),
    ...(squad ? { squad } : {}),
  };
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
  wagerEnabled: boolean,
): RoomState {
  if (state.phase !== 'lobby') return state;
  return { ...state, packId, packTitle, questions, wagerEnabled };
}

/**
 * Puts the opening titles up, in the lobby, before a round starts.
 *
 * Refused outside the lobby: mid-round it would put a title card over a question
 * with the clock running, which is the one thing this feature must never do. A
 * card with nothing on it is refused too — an empty title sequence is a pause
 * the room cannot explain.
 */
function titles(
  state: RoomState,
  at: number,
  facts: FormFact[],
  durationSecs: number,
): RoomState {
  if (state.phase !== 'lobby') return state;
  if (facts.length === 0) return state;
  // Refused here rather than at the reveal, where it would cost a round that
  // stops at its first question instead of a Start button that does nothing.
  if (!isDurationAllowed(durationSecs)) return state;

  return { ...state, form: { at, facts, durationSecs } };
}

function start(state: RoomState, at: number, gameId: string, durationSecs: number): RoomState {
  if (state.phase !== 'lobby') return state;
  if (state.questions.length === 0) return state;
  // A window the rules would refuse is refused here instead, where it costs a
  // dead Start button rather than a round that stops at its first reveal.
  if (!isDurationAllowed(durationSecs)) return state;

  return {
    ...state,
    phase: 'question',
    index: 0,
    durationSecs,
    questionOpenedAt: at,
    gameId,
    answers: {},
    lastDeltas: {},
    // The titles have done their job the moment the first question is up, and
    // leaving them on the document would put them back on screen at the end of
    // the round, when `reset` returns the room to the lobby.
    form: null,
    // Everyone starts on zero, including anyone who joined after a previous game.
    scores: Object.fromEntries(Object.keys(state.players).map((uid) => [uid, 0])),
  };
}

/**
 * Records a pick, replacing whatever the player chose before.
 *
 * Changing your mind is allowed until the clock runs out, and it costs you the
 * speed bonus: `elapsedMs` is whatever the clock reads at the moment of the new
 * pick, not the moment of the first. Keeping the first would let a player lock
 * in a guess at half a second, bank the speed points for it, and then revise at
 * leisure — which would make the speed score meaningless. Overwriting makes the
 * trade honest and visible: you can change, and it costs you.
 */
function answer(
  state: RoomState,
  uid: string,
  optionIndex: number,
  elapsedMs: number,
  wager?: number,
): RoomState {
  if (state.phase !== 'question') return state;
  if (!state.players[uid]) return state;

  const question = currentQuestion(state);
  if (!question) return state;
  if (optionIndex < 0 || optionIndex >= question.options.length) return state;

  // Answers arriving after the window closed are ignored rather than scored at
  // zero, so a laggy client is not punished differently from a silent one.
  if (elapsedMs > questionDurationMs(state)) return state;

  // The stake is kept only on the question that is actually played for it.
  // Dropping it here as well as ignoring it in `tallyQuestion` means a wager
  // sent on the wrong question never enters room state at all, so no screen can
  // render one that will not be paid.
  const staked = isWagerQuestion(state) && wager !== undefined ? { wager } : {};

  return {
    ...state,
    answers: { ...state.answers, [uid]: { optionIndex, elapsedMs, ...staked } },
  };
}

function reveal(state: RoomState, correctIndex: number, questionId: string): RoomState {
  if (state.phase !== 'question') return state;

  const question = currentQuestion(state);
  if (!question) return state;

  // The answer has to belong to the question in play. The vault is asked over
  // the network before this is dispatched, and the room is folded over as it is
  // when the answer comes back rather than as it was when it was asked for —
  // which is what lets an answer written on the buzzer still count. The same
  // gap means the room could in principle have moved on, and scoring one
  // question's answer against the next would mark the whole room wrong.
  if (question.id !== questionId) return state;
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
  // until the room's answer window has closed — five seconds even at the floor
  // the rules allow.
  const eligible = Object.fromEntries(
    Object.entries(state.answers).filter(([uid]) => state.players[uid]),
  );

  // The window is not passed, and that is the change of 20 August 2026: the
  // rank bonus ranks the correct answers against each other rather than against
  // the clock, so a ten-second round and a twenty-second one pay identically. The
  // window still bounds what may be answered at all — `answer` above refuses
  // anything past it — it just no longer decides what an answer is worth.
  // `scores` is passed only on the question the room agreed to play for
  // stakes, and its presence is what turns a `wager` on an answer document into
  // points. Every client reaches the same decision from the same document, so
  // the reveal stays a pure function of what the room already holds.
  const deltas = tallyQuestion({
    correctIndex,
    answers: eligible,
    ...(isWagerQuestion(state) ? { scores: state.scores } : {}),
  });

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
    form: null,
    scores: Object.fromEntries(Object.keys(state.players).map((uid) => [uid, 0])),
    skipped: [],
    // Cleared so the next round mints its own id and counts separately.
    gameId: null,
  };
}
