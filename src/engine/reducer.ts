import type { PackId } from '../questions/types';
import type { FormFact } from './form';
import { carryFirstMs, firstTouchOf } from './answers';
import { BONUS_MULTIPLIER, isBonusCatchphrase } from './catchphraseBonus';
import { questionPack } from './randomRound';
import { stealFor, tallyQuestion } from './scoring';
import { friesPick, roomTakes } from './chaser';
import { isHalfTime, morningTotals } from './double';
import { finalistsFor, settleStandoff, stakesFor, type StandoffPick } from './standoff';
import { isTell } from './survey';
import {
  currentQuestion,
  isDurationAllowed,
  type Answer,
  isStealQuestion,
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
  /**
   * Mr Fries's title card, still in the lobby, before question one.
   *
   * `at` is when it went up. The host opens the question three seconds later
   * (`src/host/due.ts`); the quizmaster's tap is the same `start`, only sooner.
   * Nothing here is on a timer. A second `start` finds the question already
   * open and changes nothing. A card laid over question one would come straight
   * out of the answering window.
   */
  | { type: 'chaserIntro'; at: number; durationSecs: number }
  | { type: 'leave'; uid: string }
  | {
      type: 'selectPack';
      packId: PackId;
      packTitle: string;
      questions: QuizQuestion[];
      wagerEnabled: boolean;
      stealEnabled: boolean;
      jigsawEnabled?: boolean;
      /** Optional for the reason `jigsawEnabled` is: every caller before it omits it. */
      standoffEnabled?: boolean;
      chaserEnabled?: boolean;
      /** What the season says about each player, for the Commentator. */
      history?: RoomState['history'];
      /**
       * Set when The Ladder filled a difficulty from another. Omitted by every
       * caller that is not dealing a ramp, and stored as nothing in that case.
       */
      ladderNotices?: readonly string[];
      /** Optional for the reason `jigsawEnabled` is. Ignored in round two, which is always a double. */
      doubleEnabled?: boolean;
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
  /**
   * `top` only on a Survey Says guess: every option tied for the room's most
   * popular, all of them right. `correctIndex` is then the lowest of them.
   */
  | { type: 'reveal'; correctIndex: number; questionId: string; top?: number[]; counts?: number[] }
  | { type: 'skip' }
  | { type: 'next'; at: number }
  /** The quizmaster ends the talking, by button or when the talk clock runs out. */
  | { type: 'openPicks' }
  /**
   * The whistle on the picking: when both finalists have committed, or when the
   * pick clock runs out. `sealed` is who had committed by then, as the
   * quizmaster's device saw it — only their picks can count.
   */
  | { type: 'closePicks'; sealed: string[] }
  /**
   * The final is paid out. `picks` are the ones the quizmaster's device verified
   * against each finalist's commitment — see `sealedPick.ts`. A finalist with no
   * verified pick is simply absent, and counts as share.
   */
  | { type: 'settle'; picks: Record<string, StandoffPick | null> }
  /** The quizmaster's Round two, at half-time of The Double. */
  | { type: 'roundTwo' }
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
    case 'chaserIntro':
      return showChaserIntro(state, action.at, action.durationSecs);
    case 'leave':
      return leave(state, action.uid);
    case 'selectPack':
      return selectPack(
        state,
        action.packId,
        action.packTitle,
        action.questions,
        action.wagerEnabled,
        action.stealEnabled,
        action.jigsawEnabled ?? false,
        action.standoffEnabled ?? false,
        action.chaserEnabled ?? false,
        action.history ?? {},
        action.ladderNotices ?? [],
        action.doubleEnabled ?? false,
      );
    case 'start':
      return start(state, action.at, action.gameId, action.durationSecs);
    case 'answer':
      return answer(state, action.uid, action.optionIndex, action.elapsedMs, action.wager);
    case 'reveal':
      return reveal(state, action.correctIndex, action.questionId, action.top, action.counts);
    case 'skip':
      return skip(state);
    case 'next':
      return next(state, action.at);
    case 'openPicks':
      return openPicks(state);
    case 'closePicks':
      return closePicks(state, action.sealed);
    case 'settle':
      return settle(state, action.picks);
    case 'roundTwo':
      return roundTwo(state);
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

  // In a room made before W3 the role is derived from who remains. In one made
  // since, the handover is `hostUid`, written by `leave` in useRoom beside the
  // seat it removes — this action is the engine's own and never persisted.
  return { ...state, players, answers };
}

function selectPack(
  state: RoomState,
  packId: PackId,
  packTitle: string,
  questions: QuizQuestion[],
  wagerEnabled: boolean,
  stealEnabled: boolean,
  jigsawEnabled: boolean,
  standoffEnabled: boolean,
  chaserEnabled: boolean,
  history: RoomState['history'],
  ladderNotices: readonly string[],
  doubleEnabled: boolean,
): RoomState {
  if (state.phase !== 'lobby') return state;
  return {
    ...state,
    packId,
    packTitle,
    questions,
    wagerEnabled,
    stealEnabled,
    jigsawEnabled,
    standoffEnabled,
    chaserEnabled,
    history,
    ladderNotices,
    // Round two of a double is a double whatever the quizmaster's device sends:
    // turning it off here would strand round one's scores on the room.
    doubleEnabled: state.double !== null || doubleEnabled,
  };
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

/**
 * Puts Mr Fries's card up, in the lobby, before question one.
 *
 * Refused outside the lobby and on a round that is not against him: mid-round
 * it would sit on a clock that is already running. The window is parked on the
 * card, as it is on the opening titles, because the rules will not take a new
 * `durationSecs` until a question opens.
 *
 * A card that is already up is left as it is, including its `at`. Putting it
 * up again must not restart the three seconds the host is counting.
 */
function showChaserIntro(state: RoomState, at: number, durationSecs: number): RoomState {
  if (state.phase !== 'lobby') return state;
  if (!state.chaserEnabled || state.questions.length === 0) return state;
  if (!isDurationAllowed(durationSecs) || !Number.isFinite(at)) return state;
  if (state.form === null && state.chaserIntro?.durationSecs === durationSecs) return state;

  return { ...state, form: null, chaserIntro: { at, durationSecs } };
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
    lastSteal: null,
    lastPicks: {},
    // The titles have done their job the moment the first question is up, and
    // leaving them on the document would put them back on screen at the end of
    // the round, when `reset` returns the room to the lobby. The chaser card
    // with them: it is the beat before this question, and the clock starts now.
    form: null,
    chaserIntro: null,
    // The last round's final, if it had one, is over.
    standoff: null,
    // The vote has done its job once the round is chosen.
    packVotes: {},
    voteTaps: {},
    browsing: null,
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

  // Carried from whatever pick this replaces, so changing your mind leaves the
  // moment you first committed on the document. It is shown at the reveal and
  // scored nowhere — see docs/decisions/answer-spam.md.
  // No staleness to reconcile here the way `useRoom` has to: the reducer's
  // state is its own and is always current.
  const holdingAnswer = state.answers[uid];
  const first = carryFirstMs(holdingAnswer && firstTouchOf(holdingAnswer), elapsedMs);

  return {
    ...state,
    answers: { ...state.answers, [uid]: { optionIndex, elapsedMs, ...first, ...staked } },
  };
}

function reveal(
  state: RoomState,
  correctIndex: number,
  questionId: string,
  top?: number[],
  counts?: number[],
): RoomState {
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
  if (top && !(top.includes(correctIndex) && top.every((option) => option >= 0 && option < question.options.length))) {
    return state;
  }
  if (counts && !(counts.length === question.options.length && counts.every((count) => Number.isInteger(count) && count >= 0))) {
    return state;
  }

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
  /*
    The steal, resolved here rather than inside `tallyQuestion` so that `scores`
    keeps its one job there — its presence is what turns a stake into points, and
    a steal is nothing to do with stakes.

    `stealFor` reads the same `{correctIndex, answers, scores}` every client
    holds at this moment, so the reveal stays a pure function of the room and the
    screen can call it again to say who lost what without any of it being
    written down. Null on every question of a round nobody opted into.
  */
  // A Survey Says tell has no right answer: nobody scores, and nobody's pick is
  // published, because the room's split is what part two asks about (T2, T3).
  const telling = isTell(question);

  // Scores filtered to the room the same way `eligible` is: `leave` drops a seat
  // and keeps the score, so the raw map can name a leader who has gone home.
  const steal = !telling && isStealQuestion(state)
    ? stealFor({
        correctIndex,
        answers: eligible,
        scores: Object.fromEntries(Object.entries(state.scores).filter(([uid]) => state.players[uid])),
      })
    : null;

  const deltas = telling ? {} : tallyQuestion({
    correctIndex,
    ...(top ? { top } : {}),
    answers: eligible,
    ...(isWagerQuestion(state) ? { scores: state.scores } : {}),
    steal,
    // The question's source pack when the round is a mix, otherwise the room's
    // pack. Every device reads the same question, so the bonus still agrees
    // without a second write.
    ...(isBonusCatchphrase(questionPack(state.packId, question), state.index)
      ? { multiplier: BONUS_MULTIPLIER }
      : {}),
  });

  const scores = { ...state.scores };
  for (const [uid, delta] of Object.entries(deltas)) {
    scores[uid] = (scores[uid] ?? 0) + delta;
  }

  // Written back into the question so every other client learns the answer from
  // the room update they are already listening to, rather than each paying for
  // its own read of the vault's reveal document.
  // Beat the Chaser: Mr Fries's lectern and whether the room took it, decided
  // here so every device's reducer reaches the same verdict (`chaser.ts`).
  const chaser =
    state.chaserEnabled && !entryIsSurvey(question) && question.chaserRate !== undefined
      ? {
          pick: friesPick(state.gameId ?? '', question.id, question.chaserRate, correctIndex, question.options.length),
          roomTook: roomTakes(eligible, correctIndex),
        }
      : null;

  const questions = state.questions.map((entry, index) =>
    index === state.index
      ? {
          ...entry,
          correctIndex,
          ...(top && entry.survey
            ? { survey: { ...entry.survey, top, ...(counts ? { counts } : {}) } }
            : {}),
          ...(chaser ? { chaser } : {}),
        }
      : entry,
  );

  return {
    ...state,
    phase: 'reveal',
    questions,
    questionOpenedAt: null,
    lastDeltas: deltas,
    lastSteal: steal,
    // Every counted pick, on the room. Since W3 only the host reads the answers
    // subcollection, so this is how every other device gets the reveal chips,
    // the replay and its game log — from the update it is already receiving.
    lastPicks: telling ? {} : publishedPicks(eligible),
    scores,
  };
}

/**
 * The picks as they go on the room: the fields an answer carries and nothing
 * else, and no key whose value is undefined, which Firestore refuses outright.
 * An answer document also carries `questionIndex`, which the room does not need.
 */
function entryIsSurvey(question: QuizQuestion): boolean {
  return question.survey !== undefined;
}

function publishedPicks(answers: Record<string, Answer>): Record<string, Answer> {
  return Object.fromEntries(
    Object.entries(answers).map(([uid, { optionIndex, elapsedMs, firstMs, wager, at }]) => [
      uid,
      {
        optionIndex,
        elapsedMs,
        ...(firstMs === undefined ? {} : { firstMs }),
        ...(wager === undefined ? {} : { wager }),
        ...(at === undefined ? {} : { at }),
      },
    ]),
  );
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
    lastSteal: null,
    lastPicks: {},
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
      // Round one of a double ends at half-time: its final, if the room chose
      // one, is played on the whole morning at the end of round two.
      const halfTime = state.doubleEnabled && state.double === null;
      // After the wager has been paid on the last question, so a stake that
      // came off is what decides who reaches the final. On the morning in
      // round two of a double, which outside one is just the round.
      const morning = morningTotals(state);
      const finalists = state.standoffEnabled && !halfTime
        ? finalistsFor(state.players, morning, state.gameId ?? '')
        : null;
      if (finalists) {
        return {
          ...state,
          phase: 'standoff',
          answers: {},
          lastDeltas: {},
          lastSteal: null,
          lastPicks: {},
          standoff: {
            finalists,
            stakes: stakesFor(morning, finalists),
            stage: 'talk',
            sealed: null,
            picks: null,
          },
        };
      }
      return { ...state, phase: 'finished', answers: {}, lastDeltas: {}, lastSteal: null, lastPicks: {} };
    }
    return {
      ...state,
      phase: 'question',
      index: nextIndex,
      questionOpenedAt: at,
      answers: {},
      lastDeltas: {},
      lastSteal: null,
      lastPicks: {},
    };
  }

  // Only once both picks are showing. Moving on from the talk or the pick would
  // take the room to the results before anything had been decided.
  if (state.phase === 'standoff') {
    if (state.standoff?.stage !== 'revealed') return state;
    return { ...state, phase: 'finished', answers: {}, lastDeltas: {}, lastSteal: null, lastPicks: {} };
  }

  return state;
}

function openPicks(state: RoomState): RoomState {
  if (state.phase !== 'standoff' || state.standoff?.stage !== 'talk') return state;
  return { ...state, standoff: { ...state.standoff, stage: 'pick' } };
}

function closePicks(state: RoomState, sealed: string[]): RoomState {
  const { standoff } = state;
  if (state.phase !== 'standoff' || !standoff || standoff.stage !== 'pick') return state;
  return {
    ...state,
    standoff: {
      ...standoff,
      stage: 'closed',
      sealed: standoff.finalists.filter((uid) => sealed.includes(uid)),
    },
  };
}

/**
 * Pays the final out, once. Refused outside the closed stage, so a late echo of
 * a settle that already landed cannot pay the pot a second time.
 *
 * A pick from a finalist who had not committed by the whistle is dropped here
 * whatever the quizmaster's device passed in — the engine, not the caller, is
 * what keeps a late commitment from counting.
 */
function settle(state: RoomState, picks: Record<string, StandoffPick | null>): RoomState {
  const { standoff } = state;
  if (state.phase !== 'standoff' || !standoff || standoff.stage !== 'closed') return state;

  const sealed = standoff.sealed ?? [];
  const counted = Object.fromEntries(
    standoff.finalists.map((uid) => [uid, sealed.includes(uid) ? (picks[uid] ?? null) : null]),
  );
  const settled = settleStandoff(morningTotals(state), standoff, counted);
  return {
    ...state,
    scores: roundScores(state, settled.scores),
    lastDeltas: settled.deltas,
    standoff: { ...standoff, stage: 'revealed', picks: settled.picks },
  };
}

/**
 * The settled morning back into the round's own scores. In round two of a
 * double the final was paid on the morning, and what the round banks is the
 * morning less what round one already banked — so the two banked rounds add
 * up to the outcome. Outside a double the two are the same thing.
 */
function roundScores(state: RoomState, morning: Record<string, number>): Record<string, number> {
  const first = state.double?.scores;
  if (!first) return morning;
  // `morningTotals` covers every key of `scores`, so every uid has a morning.
  return Object.fromEntries(Object.keys(state.scores).map((uid) => [uid, (morning[uid] ?? 0) - (first[uid] ?? 0)]));
}

/**
 * Round two of a double: back to the lobby holding round one, scores to zero
 * for the round. Refused anywhere but half-time, which is also what stops a
 * third — round two's end is not half-time, because round one is held.
 */
function roundTwo(state: RoomState): RoomState {
  if (!isHalfTime(state) || state.gameId === null) return state;
  return {
    ...reset(state),
    doubleEnabled: true,
    double: { gameId: state.gameId, scores: { ...state.scores } },
  };
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
    lastSteal: null,
    lastPicks: {},
    form: null,
    chaserIntro: null,
    scores: Object.fromEntries(Object.keys(state.players).map((uid) => [uid, 0])),
    skipped: [],
    // Cleared so the next round mints its own id and counts separately.
    gameId: null,
    ladderNotices: [],
    standoff: null,
    // Another round after a double is an ordinary round. Round two is
    // `roundTwo`, which puts both back.
    doubleEnabled: false,
    double: null,
    packVotes: {},
    voteTaps: {},
    browsing: null,
  };
}
