import { describe, expect, test } from 'vitest';
import { BEAT_EVERY_MS } from '../engine/host';
import { revealBackoffMs } from '../engine/revealGate';
import { PICK_GRACE_MS, PICK_MS, REVEAL_GRACE_MS, TALK_MS, type Standoff } from '../engine/standoff';
import { createRoom, type QuizQuestion, type RoomState } from '../engine/state';
import {
  CHASER_INTRO_MS,
  FRESH_MEMORY,
  MAX_REVEAL_RETRIES,
  OPEN_AGAIN_MS,
  began,
  IN_FLIGHT_HOLD_MS,
  answerStillInFlight,
  dueNow,
  failed,
  keepDue,
  openQuestionMove,
  reapDue,
  revealCost,
  revealMove,
  stillRevealing,
  type HostMemory,
  type HostMove,
  type HostView,
} from './due';

/*
  The host's "what is due now", one move and one "not yet" at a time
  (host-loop.md, A3). Every case is a plain value in, a plain value out: no
  clock, no Firestore, no React.
*/

const DURATION_MS = 20_000;
const CONFIRMED_AT = 1_000;
/** The first moment the vault will answer: confirmed + window + 100 ms slack (revealGate.ts). */
const GATE_OPEN = CONFIRMED_AT + DURATION_MS + 100;

function question(id: string): QuizQuestion {
  return { id, prompt: id, options: ['a', 'b', 'c', 'd'], correctIndex: null, category: 'general', difficulty: 'easy' };
}

function questionRoom(overrides: Partial<RoomState> = {}): RoomState {
  return {
    ...createRoom('ABCD'),
    phase: 'question',
    gameId: 'g1',
    index: 0,
    questions: [question('q0'), question('q1')],
    players: { host: { name: 'Host', joinedAt: 1 }, ann: { name: 'Ann', joinedAt: 2 } },
    scores: { host: 0, ann: 0 },
    hostUid: 'host',
    packId: 'general-knowledge',
    packTitle: 'General',
    ...overrides,
  };
}

function baseView(overrides: Partial<HostView> = {}): HostView {
  return {
    uid: 'host',
    room: questionRoom(),
    isHost: true,
    answersReady: true,
    clockExpired: true,
    answerInFlight: false,
    confirmedAt: CONFIRMED_AT,
    durationMs: DURATION_MS,
    gameLog: [],
    finalTable: null,
    committed: [],
    opened: null,
    now: GATE_OPEN,
    ...overrides,
  };
}

const view = baseView;

const kinds = (moves: HostMove[]): string[] => moves.map((move) => move.kind);
const reveals = (moves: HostMove[]): HostMove[] => moves.filter((move) => move.kind === 'reveal');
const opens = (moves: HostMove[]): HostMove[] => moves.filter((move) => move.kind === 'openQuestion');

/** The beat is due on every first look; take it so a case can talk about the rest. */
function beaten(at: number): HostMemory {
  return { ...FRESH_MEMORY, beatAt: at };
}

describe('the reveal on the clock', () => {
  test('is due once the clock has run out and the gate is open', () => {
    const due = dueNow(view(), beaten(GATE_OPEN));
    expect(reveals(due.moves)).toEqual([{ kind: 'reveal', key: 'g1:0', questionId: 'q0', manual: false }]);
  });

  test('not yet: the local clock is still running', () => {
    const due = dueNow(view({ clockExpired: false, now: CONFIRMED_AT + 5_000 }), beaten(CONFIRMED_AT));
    expect(reveals(due.moves)).toEqual([]);
  });

  test('not yet: the server has not acknowledged the question, and no timer is set for it', () => {
    // #given the host's own clock has run out on its local copy of the question
    // #when the server's acknowledgement has not arrived
    const due = dueNow(view({ confirmedAt: null }), beaten(GATE_OPEN));
    // #then nothing is due, and the wake is the beat's, not a reveal's — the view
    // changes when the acknowledgement lands
    expect(reveals(due.moves)).toEqual([]);
    expect(due.wakeInMs).toBe(BEAT_EVERY_MS);
  });

  test('not yet: the clock has run out but the gate has not, and it wakes exactly when it will', () => {
    const due = dueNow(view({ now: GATE_OPEN - 7 }), beaten(GATE_OPEN - 7));
    expect(reveals(due.moves)).toEqual([]);
    expect(due.wakeInMs).toBe(7);
  });

  test('not yet: the answers have not been heard since taking the chair', () => {
    expect(reveals(dueNow(view({ answersReady: false }), beaten(GATE_OPEN)).moves)).toEqual([]);
  });

  test('never on a device that is not the host', () => {
    expect(reveals(dueNow(view({ isHost: false }), beaten(GATE_OPEN)).moves)).toEqual([]);
  });

  test('a chaser question keeps the full window, and a reveal already in flight is not sent again', () => {
    // The title card is before the question. Three seconds into the question —
    // as long as that card used to cover — the reveal is not due, and it becomes
    // due on the whole window. A second look while the first reveal is in flight
    // still sends nothing.
    const durationMs = 10_000;
    const confirmedAt = 1_000;
    const room = questionRoom({ chaserEnabled: true });
    const early = confirmedAt + 3_000;
    expect(
      reveals(dueNow(view({ room, clockExpired: false, confirmedAt, durationMs, now: early }), beaten(early)).moves),
    ).toEqual([]);

    const open = confirmedAt + durationMs + 100;
    const first = dueNow(view({ room, clockExpired: true, confirmedAt, durationMs, now: open }), beaten(open));
    const move = reveals(first.moves)[0];
    if (!move) throw new Error('expected a reveal on the full window');
    const inFlight = began(first.memory, move, { room, now: open });
    expect(
      reveals(dueNow(view({ room, clockExpired: true, confirmedAt, durationMs, now: open + 50 }), inFlight).moves),
    ).toEqual([]);
  });

  test('the title card is not a question, so nothing is due to reveal during it', () => {
    const room = questionRoom({
      phase: 'lobby',
      chaserEnabled: true,
      chaserIntro: { at: GATE_OPEN, durationSecs: 10 },
      questionOpenedAt: null,
    });
    expect(reveals(dueNow(view({ room, clockExpired: true }), beaten(GATE_OPEN)).moves)).toEqual([]);
  });

  test('not a second time while the first is in flight', () => {
    // #given a reveal under way
    const first = dueNow(view(), beaten(GATE_OPEN));
    const move = reveals(first.moves)[0];
    if (!move) throw new Error('expected a reveal');
    const inFlight = began(first.memory, move, { room: questionRoom(), now: GATE_OPEN });
    // #when the room updates before it lands
    // #then it is not due again
    expect(reveals(dueNow(view({ now: GATE_OPEN + 50 }), inFlight).moves)).toEqual([]);
  });

  test('waits for an answer the lamp says is in flight, then reveals anyway', () => {
    // Greg, 23 Oct: 3s covers the measured 2.4s slow write. The 4.8–5.5s cases are not.
    expect(IN_FLIGHT_HOLD_MS).toBe(3_000);
    // #given the gate is open and somebody's lamp is lit with no answer landed
    const holding = dueNow(view({ answerInFlight: true }), beaten(GATE_OPEN));
    // #then the clock reveal waits, and asks to be woken when the wait is over
    expect(reveals(holding.moves)).toEqual([]);
    expect(holding.wakeInMs).toBe(IN_FLIGHT_HOLD_MS);

    const still = dueNow(
      view({ answerInFlight: true, now: GATE_OPEN + IN_FLIGHT_HOLD_MS - 1 }),
      beaten(GATE_OPEN),
    );
    expect(reveals(still.moves)).toEqual([]);
    expect(still.wakeInMs).toBe(1);

    // #when the wait is up and the answer still has not landed
    const due = dueNow(
      view({ answerInFlight: true, now: GATE_OPEN + IN_FLIGHT_HOLD_MS }),
      beaten(GATE_OPEN),
    );
    // #then the room is scored without it, rather than held open
    expect(reveals(due.moves)).toEqual([{ kind: 'reveal', key: 'g1:0', questionId: 'q0', manual: false }]);
  });

  test('an answer landing during the wait reveals on the next look', () => {
    const due = dueNow(view({ answerInFlight: false, now: GATE_OPEN + 500 }), beaten(GATE_OPEN));
    expect(reveals(due.moves)).toEqual([{ kind: 'reveal', key: 'g1:0', questionId: 'q0', manual: false }]);
  });

  test('the Reveal button does not wait for an in-flight answer', () => {
    expect(revealMove(view({ answerInFlight: true }), FRESH_MEMORY, true)).toEqual({
      kind: 'reveal',
      key: 'g1:0',
      questionId: 'q0',
      manual: true,
    });
  });

  test('the heartbeat still goes out while an answer is in flight', () => {
    const due = dueNow(view({ answerInFlight: true }), FRESH_MEMORY);
    expect(kinds(due.moves)).toEqual(['beat']);
    expect(due.wakeInMs).toBe(IN_FLIGHT_HOLD_MS);
  });

  test('a new question is due afresh, whatever the last one did', () => {
    const first = dueNow(view(), beaten(GATE_OPEN));
    const move = reveals(first.moves)[0];
    if (!move) throw new Error('expected a reveal');
    const done = began(first.memory, move, { room: questionRoom(), now: GATE_OPEN });
    const next = dueNow(view({ room: questionRoom({ index: 1 }) }), done);
    expect(reveals(next.moves)).toEqual([{ kind: 'reveal', key: 'g1:1', questionId: 'q1', manual: false }]);
  });
});

describe('a refused reveal', () => {
  function failOnce(memory: HostMemory, now: number): HostMemory {
    const due = dueNow(view({ now }), memory);
    const move = reveals(due.moves)[0];
    if (!move) throw new Error(`expected a reveal at ${String(now)}`);
    return failed(began(due.memory, move, { room: questionRoom(), now }), move, now);
  }

  test('is retried after the backoff, not before', () => {
    // #given the vault turned the first attempt down
    const after = failOnce(beaten(GATE_OPEN), GATE_OPEN);
    const backoff = revealBackoffMs(0);
    // #then a look just before the backoff is up finds nothing due, and asks to wake on time
    const early = dueNow(view({ now: GATE_OPEN + backoff - 1 }), after);
    expect(reveals(early.moves)).toEqual([]);
    expect(early.wakeInMs).toBe(1);
    // #and one on time finds it due again
    expect(reveals(dueNow(view({ now: GATE_OPEN + backoff }), after).moves)).toHaveLength(1);
  });

  test('a reveal already refused is not held again for an in-flight answer', () => {
    const after = failOnce(beaten(GATE_OPEN), GATE_OPEN);
    const backoff = revealBackoffMs(0);
    const due = dueNow(view({ answerInFlight: true, now: GATE_OPEN + backoff }), after);
    expect(reveals(due.moves)).toHaveLength(1);
  });

  test(`stops after ${String(MAX_REVEAL_RETRIES)} timed retries, and says so`, () => {
    // #given the vault refuses every time
    let memory = beaten(GATE_OPEN);
    let now = GATE_OPEN;
    for (let attempt = 0; attempt <= MAX_REVEAL_RETRIES; attempt += 1) {
      memory = failOnce(memory, now);
      now += 60_000;
      memory = { ...memory, beatAt: now };
    }
    // #then nothing more is due on the clock — the Reveal button is what is left
    expect(reveals(dueNow(view({ now }), memory).moves)).toEqual([]);
    expect(stillRevealing(view({ now }), memory)).toBe(false);
    // #and the button still works
    expect(revealMove(view({ now }), memory, true)).toEqual({
      kind: 'reveal',
      key: 'g1:0',
      questionId: 'q0',
      manual: true,
    });
  });

  test('a failed press of the button schedules no timed retry of its own', () => {
    const move = revealMove(view({ clockExpired: false, now: 5_000 }), FRESH_MEMORY, true);
    if (!move) throw new Error('expected the button to reveal');
    const after = failed(began(FRESH_MEMORY, move, { room: questionRoom(), now: 5_000 }), move, 5_000);
    expect(after.revealing).toBeNull();
    expect(after.retry.notBefore).toBeNull();
  });
});

describe('what each reveal cost', () => {
  test('measures the gate wait from the first look after the clock ran out', () => {
    // #given the clock ran out at 21,000 and the gate opened 100 ms later
    const expired = dueNow(view({ now: GATE_OPEN - 100 }), beaten(GATE_OPEN - 100));
    const due = dueNow(view({ now: GATE_OPEN }), expired.memory);
    const move = reveals(due.moves)[0];
    if (!move) throw new Error('expected a reveal');
    // #when it begins, and lands
    const done = revealCost(began(due.memory, move, { room: questionRoom(), now: GATE_OPEN }), 'q0', {
      resolveMs: 180,
      dispatchMs: 40,
    });
    // #then the record says so
    expect(done.timings.byQuestion.get('q0')).toEqual({
      expiredAt: GATE_OPEN - 100,
      gateMs: 100,
      resolveMs: 180,
      dispatchMs: 40,
      attempts: 1,
    });
  });

  test('a second game in the same tab starts with no timings', () => {
    const due = dueNow(view(), beaten(GATE_OPEN));
    const move = reveals(due.moves)[0];
    if (!move) throw new Error('expected a reveal');
    const first = began(due.memory, move, { room: questionRoom(), now: GATE_OPEN });
    const second = dueNow(view({ room: questionRoom({ gameId: 'g2' }) }), first);
    expect(second.memory.timings.gameId).toBe('g2');
    expect([...second.memory.timings.byQuestion.keys()]).toEqual(['q0']);
    expect(second.memory.timings.byQuestion.get('q0')?.attempts).toBe(0);
  });
});

describe('the beat', () => {
  const lobby = (): RoomState => ({ ...createRoom('ABCD'), hostUid: 'host' });

  test('is due at once on taking the chair, then every 15 s', () => {
    const first = dueNow(view({ room: lobby(), now: 0 }), FRESH_MEMORY);
    expect(kinds(first.moves)).toEqual(['beat']);
    const after = began(first.memory, { kind: 'beat' }, { room: lobby(), now: 0 });
    const early = dueNow(view({ room: lobby(), now: BEAT_EVERY_MS - 1 }), after);
    expect(kinds(early.moves)).toEqual([]);
    expect(early.wakeInMs).toBe(1);
    expect(kinds(dueNow(view({ room: lobby(), now: BEAT_EVERY_MS }), after).moves)).toEqual(['beat']);
  });

  test('a failed beat is not chased: the next is due on the usual cadence', () => {
    const after = failed(began(FRESH_MEMORY, { kind: 'beat' }, { room: lobby(), now: 0 }), { kind: 'beat' }, 0);
    expect(kinds(dueNow(view({ room: lobby(), now: 1_000 }), after).moves)).toEqual([]);
  });

  test('never from a device that does not hold the chair, and starts fresh if it takes it', () => {
    const elsewhere = { ...lobby(), hostUid: 'ann' };
    const due = dueNow(view({ room: elsewhere, now: 5_000 }), beaten(4_000));
    expect(kinds(due.moves)).toEqual([]);
    expect(due.memory.beatAt).toBeNull();
  });

  test('a room from before W3 names no host, and nobody beats', () => {
    expect(kinds(dueNow(view({ room: createRoom('ABCD'), now: 0 }), FRESH_MEMORY).moves)).toEqual([]);
  });
});

describe('the final', () => {
  function standoffRoom(stage: Standoff['stage'], sealed: string[] | null = null): RoomState {
    return questionRoom({
      phase: 'standoff',
      standoffEnabled: true,
      standoff: { finalists: ['host', 'ann'], stakes: { host: 100, ann: 100 }, stage, sealed, picks: null },
    });
  }
  const standoffs = (moves: HostMove[]): HostMove[] => moves.filter((move) => move.kind === 'standoff');

  /** First sight of a stage at t = 0, then a look at `at`. */
  function lookAt(room: RoomState, at: number, extra: Partial<HostView> = {}): ReturnType<typeof dueNow> {
    const seen = dueNow(view({ room, now: 0, ...extra }), beaten(0));
    return dueNow(view({ room, now: at, ...extra }), { ...seen.memory, beatAt: at });
  }

  test('the talk ends when its minute is up, not before', () => {
    expect(standoffs(lookAt(standoffRoom('talk'), TALK_MS - 1).moves)).toEqual([]);
    expect(standoffs(lookAt(standoffRoom('talk'), TALK_MS).moves)).toEqual([
      { kind: 'standoff', key: 'g1:talk', action: { type: 'openPicks' } },
    ]);
  });

  test('the whistle goes as soon as both have committed', () => {
    const due = lookAt(standoffRoom('pick'), 2_000, { committed: ['host', 'ann'] });
    expect(standoffs(due.moves)).toEqual([
      { kind: 'standoff', key: 'g1:pick', action: { type: 'closePicks', sealed: ['host', 'ann'] } },
    ]);
  });

  test('or once the pick and its grace are over, sealing only who committed', () => {
    const room = standoffRoom('pick');
    expect(standoffs(lookAt(room, PICK_MS + PICK_GRACE_MS - 1, { committed: ['ann'] }).moves)).toEqual([]);
    expect(standoffs(lookAt(room, PICK_MS + PICK_GRACE_MS, { committed: ['ann'] }).moves)).toEqual([
      { kind: 'standoff', key: 'g1:pick', action: { type: 'closePicks', sealed: ['ann'] } },
    ]);
  });

  test('not yet: no settle before the sealed picks have been checked', () => {
    expect(standoffs(lookAt(standoffRoom('closed', ['host', 'ann']), 60_000, { opened: null }).moves)).toEqual([]);
  });

  test('not yet: no settle before every pick opens, until the grace runs out', () => {
    const room = standoffRoom('closed', ['host', 'ann']);
    const opened = { host: 'share' as const, ann: null };
    expect(standoffs(lookAt(room, REVEAL_GRACE_MS - 1, { opened }).moves)).toEqual([]);
    expect(standoffs(lookAt(room, REVEAL_GRACE_MS, { opened }).moves)).toEqual([
      { kind: 'standoff', key: 'g1:closed', action: { type: 'settle', picks: opened } },
    ]);
  });

  test('settles at once when every pick has opened', () => {
    const opened = { host: 'share' as const, ann: 'shaft' as const };
    expect(standoffs(lookAt(standoffRoom('closed', ['host', 'ann']), 300, { opened }).moves)).toHaveLength(1);
  });

  test('each stage is moved on once; a failed write makes it due again', () => {
    const room = standoffRoom('talk');
    const due = lookAt(room, TALK_MS);
    const move = standoffs(due.moves)[0];
    if (!move) throw new Error('expected the talk to end');
    const moving = began(due.memory, move, { room, now: TALK_MS });
    expect(standoffs(dueNow(view({ room, now: TALK_MS + 1 }), moving).moves)).toEqual([]);
    const refused = failed(moving, move, TALK_MS + 1);
    expect(standoffs(dueNow(view({ room, now: TALK_MS + 2 }), refused).moves)).toHaveLength(1);
  });

  test('a stage counts from when this device first saw it, so a new stage starts its own clock', () => {
    const talk = lookAt(standoffRoom('talk'), TALK_MS);
    const pick = dueNow(view({ room: standoffRoom('pick'), now: TALK_MS + 10 }), talk.memory);
    expect(pick.memory.stage).toEqual({ key: 'g1:pick', seenAt: TALK_MS + 10 });
    expect(standoffs(pick.moves)).toEqual([]);
  });

  test('never moved by a device that is not the host', () => {
    expect(standoffs(lookAt(standoffRoom('talk'), TALK_MS, { isHost: false }).moves)).toEqual([]);
  });
});

describe('keeping the round', () => {
  const finished = (): RoomState => questionRoom({ phase: 'finished' });
  /** A record of both questions: `foldGameRecord` keeps nothing from a log with holes. */
  const gameLog = [0, 1].map((index) => ({ index, correctIndex: 0, answers: {}, deltas: {} }));
  const view = (overrides: Partial<HostView> = {}): HostView => baseView({ gameLog, ...overrides });

  test('is due once the round is finished, from the host', () => {
    const move = keepDue(view({ room: finished() }), FRESH_MEMORY);
    expect(move?.kind).toBe('keepGame');
  });

  test('not from anybody else, and not while the round is on', () => {
    expect(keepDue(view({ room: finished(), isHost: false }), FRESH_MEMORY)).toBeNull();
    expect(keepDue(view(), FRESH_MEMORY)).toBeNull();
  });

  test('once per game, and again only if the write failed', () => {
    const move = keepDue(view({ room: finished() }), FRESH_MEMORY);
    if (!move) throw new Error('expected a keep');
    const keeping = began(FRESH_MEMORY, move, { room: finished(), now: 0 });
    expect(keepDue(view({ room: finished() }), keeping)).toBeNull();
    expect(keepDue(view({ room: finished() }), failed(keeping, move, 0))).not.toBeNull();
  });

  test('asks for no wake: a failed keep is tried on the next change to the room, never on a timer', () => {
    const due = dueNow(view({ room: { ...finished(), hostUid: null } }), FRESH_MEMORY);
    expect(kinds(due.moves)).toEqual(['keepGame']);
    expect(due.wakeInMs).toBeNull();
  });

  test('is written from the table frozen at the whistle, so a winner who left is still in it', () => {
    const room = { ...finished(), players: { ann: { name: 'Ann', joinedAt: 2 } } };
    const finalTable = { players: questionRoom().players, scores: { host: 900, ann: 100 } };
    const move = keepDue(view({ room, finalTable }), FRESH_MEMORY);
    expect(move?.kind === 'keepGame' && Object.keys(move.record.players).sort()).toEqual(['ann', 'host']);
  });
});

describe('Mr Fries’s card', () => {
  function cardRoom(at: number): RoomState {
    return questionRoom({
      phase: 'lobby',
      gameId: null,
      chaserEnabled: true,
      chaserIntro: { at, durationSecs: 10 },
      questionOpenedAt: null,
    });
  }

  test('opens question one once three seconds have passed, and not a moment sooner', () => {
    const at = 5_000;
    const room = cardRoom(at);
    const early = dueNow(view({ room, now: at + CHASER_INTRO_MS - 1, clockExpired: false }), beaten(at));
    expect(opens(early.moves)).toEqual([]);
    expect(early.wakeInMs).toBe(1);

    const due = dueNow(view({ room, now: at + CHASER_INTRO_MS, clockExpired: false }), beaten(at));
    expect(opens(due.moves)).toEqual([{ kind: 'openQuestion', key: String(at), durationSecs: 10 }]);
  });

  test('a tap at the same moment as the timer is the same open, sent once', () => {
    const at = 5_000;
    const now = at + CHASER_INTRO_MS;
    const room = cardRoom(at);
    const due = dueNow(view({ room, now, clockExpired: false }), beaten(now));
    const move = opens(due.moves)[0];
    if (!move) throw new Error('expected an open');
    const inFlight = began(due.memory, move, { room, now });
    const again = view({ room, now, clockExpired: false });
    expect(opens(dueNow(again, inFlight).moves)).toEqual([]);
    expect(openQuestionMove(again, inFlight, true)).toBeNull();
  });

  test('the quizmaster can open it before the three seconds', () => {
    const at = 1_000;
    const now = at + 200;
    const room = cardRoom(at);
    const waiting = view({ room, now, clockExpired: false });
    expect(opens(dueNow(waiting, beaten(now)).moves)).toEqual([]);
    expect(openQuestionMove(waiting, beaten(now), true)).toEqual({
      kind: 'openQuestion',
      key: String(at),
      durationSecs: 10,
    });
  });

  test('a reload keeps the time already spent, and does not open a question that is already open', () => {
    const at = 1_000;
    const now = at + 1_000;
    const waiting = cardRoom(at);
    const due = dueNow(view({ room: waiting, now, clockExpired: false }), FRESH_MEMORY);
    expect(opens(due.moves)).toEqual([]);
    expect(due.wakeInMs).toBe(CHASER_INTRO_MS - 1_000);

    const opened = questionRoom({ chaserEnabled: true, chaserIntro: null });
    expect(opens(dueNow(view({ room: opened, now: at + 9_000 }), FRESH_MEMORY).moves)).toEqual([]);
  });

  test('only the host opens it', () => {
    const at = 1_000;
    const room = cardRoom(at);
    const due = dueNow(
      view({ room, now: at + CHASER_INTRO_MS, isHost: false, clockExpired: false }),
      FRESH_MEMORY,
    );
    expect(opens(due.moves)).toEqual([]);
  });

  test('a failed open waits, then is due again', () => {
    const at = 1_000;
    const now = at + CHASER_INTRO_MS;
    const room = cardRoom(at);
    const due = dueNow(view({ room, now, clockExpired: false }), beaten(now));
    const move = opens(due.moves)[0];
    if (!move) throw new Error('expected an open');
    const after = failed(began(due.memory, move, { room, now }), move, now);
    const early = dueNow(view({ room, now: now + OPEN_AGAIN_MS - 1, clockExpired: false }), after);
    expect(opens(early.moves)).toEqual([]);
    expect(early.wakeInMs).toBe(1);
    expect(opens(dueNow(view({ room, now: now + OPEN_AGAIN_MS, clockExpired: false }), after).moves)).toHaveLength(1);
  });
});

describe('the lobby reaper', () => {
  const lobby = (): RoomState => ({ ...createRoom('ABCD'), players: questionRoom().players, hostUid: 'host' });

  test('removes somebody gone from presence for the grace window, and only in the lobby', () => {
    const present = new Set(['host']);
    const first = reapDue({ isHost: true, room: lobby(), now: 0 }, FRESH_MEMORY, present);
    expect(first.remove).toEqual([]);
    expect(reapDue({ isHost: true, room: lobby(), now: 30_000 }, first.memory, present).remove).toEqual(['ann']);
    expect(reapDue({ isHost: true, room: questionRoom(), now: 30_000 }, first.memory, present).remove).toEqual([]);
  });

  test('never from a device that is not the host', () => {
    const present = new Set(['host']);
    const first = reapDue({ isHost: false, room: lobby(), now: 0 }, FRESH_MEMORY, present);
    expect(reapDue({ isHost: false, room: lobby(), now: 60_000 }, first.memory, present).remove).toEqual([]);
  });
});

describe('an answer still in flight', () => {
  const players = questionRoom().players;
  const landed = { optionIndex: 0, elapsedMs: 1_000 };

  test('is a seated player whose lamp is lit and whose answer has not landed', () => {
    expect(answerStillInFlight(players, {}, new Set(['ann']))).toBe(true);
  });

  test('is not an answer that has already landed, nor a lamp for nobody seated', () => {
    expect(answerStillInFlight(players, { ann: landed }, new Set(['ann']))).toBe(false);
    expect(answerStillInFlight(players, {}, new Set(['stranger']))).toBe(false);
    expect(answerStillInFlight(players, {}, new Set())).toBe(false);
  });
});
