import type { QuestionRecord } from '../engine/awards';
import { foldGameRecord, type GameRecord, type RevealTiming } from '../engine/gameRecord';
import { BEAT_EVERY_MS } from '../engine/host';
import { reapAbsent } from '../engine/presence';
import type { Action } from '../engine/reducer';
import { REVEAL_GATE_SLACK_MS, msUntilRevealGate, revealBackoffMs } from '../engine/revealGate';
import { PICK_GRACE_MS, PICK_MS, REVEAL_GRACE_MS, TALK_MS, type StandoffPick } from '../engine/standoff';
import { currentQuestion, type Player, type RoomState } from '../engine/state';

/**
 * What the host owes the room right now, decided without doing any of it
 * (host-loop.md, A3).
 *
 * Every duty the host's device carries — reveal on the clock, beat, the final's
 * three moves, keep the round — is a question of the form "given the room, the
 * answers, presence, the beat and the time, is anything due?". This file answers
 * it, and nothing here awaits, writes or reads a clock: `now` is an argument. So
 * each "not yet" is a unit test rather than a round in a browser.
 *
 * The device's own memory — which question it is already revealing, when it last
 * beat, which stage of the final it has moved on — is {@link HostMemory}, a plain
 * value threaded through. A move is reported {@link began}, then {@link failed} or
 * {@link finished}; each returns the next memory.
 *
 * The rules are the ones the app runs today, moved here from `App.tsx`,
 * `useRoom.ts` and `useStandoff.ts`; the comments where they lived say why each
 * one is what it is, and those comments travel with the code in step 2.
 */

/**
 * Timed retries of a refused reveal before only the Reveal button is left. Every
 * attempt is a vault write against a read budget the game has run out of once.
 */
export const MAX_REVEAL_RETRIES = 8;

/**
 * How often an unmoved stage of the final is looked at again. `useStandoff`
 * re-ran its effects on every second of the stage clock, which is also what
 * retried a move whose write failed.
 */
export const STAGE_RECHECK_MS = 1_000;

/**
 * How long the clock reveal waits, after the vault's gate is open, for an
 * answer whose lamp is lit and whose document has not landed.
 *
 * Cass's question-one writes take up to about 5.5s to be acknowledged, and the
 * fold used to happen at the gate (window + 100ms). A tap on the buzzer then
 * missed the tally even though `arrivalOk` would still have accepted the write
 * — the grace is 8s. Six seconds covers that measured write from a last-moment
 * tap and stays inside the grace, so a write that lands during the wait is
 * still a legal answer. A lamp that never resolves costs the room this long
 * and no longer; the Reveal button does not wait.
 *
 * See docs/decisions/cass-q1.md.
 */
export const IN_FLIGHT_HOLD_MS = 6_000;

/**
 * Whether a seated player has lit their lamp and their answer is not in yet.
 *
 * The lamp is the RTDB write sent beside the Firestore one. Presence keeps
 * that connection open, so the lamp can arrive while the answer write is still
 * in flight. Someone who is not seated cannot be scored, and a lamp for an
 * answer that has already landed is not in flight.
 */
export function answerStillInFlight(
  players: RoomState['players'],
  answers: RoomState['answers'],
  lamps: ReadonlySet<string>,
): boolean {
  for (const uid of lamps) {
    if (players[uid] !== undefined && answers[uid] === undefined) return true;
  }
  return false;
}

/** Everything this device can see that bears on what the host owes. */
export interface HostView {
  uid: string;
  room: RoomState;
  /** This device runs the room: `resolveHost(room) === uid`. */
  isHost: boolean;
  /**
   * The answers listener has delivered once for this room. A host who has only
   * just taken the chair mid-question has not heard it yet, and a reveal then
   * would score an empty room.
   */
  answersReady: boolean;
  /** The question clock, as this device counts it. */
  clockExpired: boolean;
  /**
   * A seated player's lamp is lit and their answer has not landed. The clock
   * reveal waits for it — see {@link IN_FLIGHT_HOLD_MS}. The Reveal button
   * does not.
   */
  answerInFlight: boolean;
  /** When the server acknowledged the open question, on this device's clock. Null until it has. */
  confirmedAt: number | null;
  durationMs: number;
  /** What this device saw of each question, for a Survey Says guess and for `games/`. */
  gameLog: readonly QuestionRecord[];
  /** The table frozen at the whistle, so a winner who presses Leave is still in the record. */
  finalTable: { players: Record<string, Player>; scores: Record<string, number> } | null;
  /** Finalists with a commitment for this game, in finalist order. */
  committed: readonly string[];
  /** Sealed picks opened against their commitments; null while that check is still running. */
  opened: Readonly<Record<string, StandoffPick | null>> | null;
  now: number;
}

export type Timing = RevealTiming & { expiredAt: number };

export interface HostMemory {
  /** The question being revealed (`gameId:index`). Cleared on failure, kept on success. */
  revealing: string | null;
  /** The timed retries of the current question's reveal. */
  retry: { key: string; n: number; notBefore: number | null; exhausted: boolean };
  /** What each reveal cost, for `games/`. Emptied when the game changes. */
  timings: { gameId: string; byQuestion: ReadonlyMap<string, Timing> };
  /** When the last beat was sent; null while this device does not hold the chair. */
  beatAt: number | null;
  /** The stage of the final on screen, and when this device first saw it. */
  stage: { key: string; seenAt: number } | null;
  /** The stage of the final already moved on (`gameId:stage`). Cleared on failure. */
  moved: string | null;
  /** The game already kept in `games/`. Cleared when the write failed. */
  kept: string | null;
  /** When each absent player was first missed, for the lobby reaper. */
  absentSince: Readonly<Record<string, number>>;
}

export const FRESH_MEMORY: HostMemory = {
  revealing: null,
  retry: { key: '', n: 0, notBefore: null, exhausted: false },
  timings: { gameId: '', byQuestion: new Map() },
  beatAt: null,
  stage: null,
  moved: null,
  kept: null,
  absentSince: {},
};

export type HostMove =
  /** `manual` is the Reveal button: no clock, no gate, and no timed retry if it fails. */
  | { kind: 'reveal'; key: string; questionId: string; manual: boolean }
  | { kind: 'beat' }
  | { kind: 'standoff'; key: string; action: Action }
  | { kind: 'keepGame'; gameId: string; record: GameRecord };

export interface Due {
  moves: HostMove[];
  memory: HostMemory;
  /** Look again after this long even if nothing changes. Null: only when something does. */
  wakeInMs: number | null;
}

/** `gameId:index` — one per question per game, so a second round never inherits the first's state. */
export function questionKey(room: RoomState): string {
  return `${room.gameId ?? ''}:${String(room.index)}`;
}

function soonest(...waits: (number | null)[]): number | null {
  const real = waits.filter((wait): wait is number => wait !== null);
  return real.length === 0 ? null : Math.min(...real);
}

function timingsFor(memory: HostMemory, gameId: string): HostMemory['timings'] {
  return memory.timings.gameId === gameId ? memory.timings : { gameId, byQuestion: new Map() };
}

/**
 * Every move due now, the memory to carry, and when to look again.
 *
 * Call it whenever the view changes and when a wake it asked for comes round.
 * A failed `games/` write asks for no wake: like the season write, it is tried
 * again on the next change to the room, never on a timer, so a refusal cannot spin.
 */
export function dueNow(view: HostView, memory: HostMemory): Due {
  let next = memory;
  const moves: HostMove[] = [];
  const waits: (number | null)[] = [];

  const reveal = revealDue(view, next);
  next = reveal.memory;
  if (reveal.move) moves.push(reveal.move);
  waits.push(reveal.wakeInMs);

  const beat = beatDue(view, next);
  next = beat.memory;
  if (beat.move) moves.push(beat.move);
  waits.push(beat.wakeInMs);

  const final = standoffDue(view, next);
  next = final.memory;
  if (final.move) moves.push(final.move);
  waits.push(final.wakeInMs);

  const keep = keepDue(view, next);
  if (keep) moves.push(keep);

  return { moves, memory: next, wakeInMs: soonest(...waits) };
}

interface OneDue {
  move: HostMove | null;
  memory: HostMemory;
  wakeInMs: number | null;
}

/** The retry state belongs to one question; a new one starts with its full allowance. */
function retryFor(memory: HostMemory, key: string): HostMemory['retry'] {
  return memory.retry.key === key ? memory.retry : { key, n: 0, notBefore: null, exhausted: false };
}

/**
 * The reveal on the clock. Due once the local clock has run out **and** the
 * gate is provably open (`revealGate.ts`): the host's own clock expires a
 * whisker before the vault will answer, because it wrote the question open.
 */
export function revealDue(view: HostView, memory: HostMemory): OneDue {
  const { room, now } = view;
  if (!view.isHost || room.phase !== 'question' || !view.clockExpired) {
    return { move: null, memory, wakeInMs: null };
  }

  const key = questionKey(room);
  const retry = retryFor(memory, key);
  let next: HostMemory = retry === memory.retry ? memory : { ...memory, retry };

  // The moment the gate wait is measured from: the first look after the local
  // clock ran out, once per question.
  const question = currentQuestion(room);
  const timings = timingsFor(next, room.gameId ?? '');
  if (question && !timings.byQuestion.has(question.id)) {
    const byQuestion = new Map(timings.byQuestion);
    byQuestion.set(question.id, { expiredAt: now, gateMs: 0, resolveMs: 0, dispatchMs: 0, attempts: 0 });
    next = { ...next, timings: { gameId: timings.gameId, byQuestion } };
  } else if (timings !== next.timings) {
    next = { ...next, timings };
  }

  const wait = msUntilRevealGate({ confirmedAt: view.confirmedAt, durationMs: view.durationMs, now });
  // The server has not acknowledged the question yet; the view changes when it does.
  if (wait === null) return { move: null, memory: next, wakeInMs: null };
  if (wait > 0) return { move: null, memory: next, wakeInMs: wait };

  if (retry.exhausted) return { move: null, memory: next, wakeInMs: null };
  if (retry.notBefore !== null && now < retry.notBefore) {
    return { move: null, memory: next, wakeInMs: retry.notBefore - now };
  }

  // Only the first attempt waits. A retry is a vault that already refused, and
  // holding it again would pile this wait onto the backoff.
  const notStarted = retry.n === 0 && retry.notBefore === null;
  if (notStarted && view.answerInFlight && view.confirmedAt !== null) {
    const holdEnds = view.confirmedAt + view.durationMs + REVEAL_GATE_SLACK_MS + IN_FLIGHT_HOLD_MS;
    if (now < holdEnds) return { move: null, memory: next, wakeInMs: holdEnds - now };
  }

  const move = revealMove(view, next, false);
  return { move, memory: next, wakeInMs: null };
}

/**
 * The reveal the host may make now, clock or no clock — the Reveal button's
 * question. Null when there is nothing to reveal, the answers have not been
 * heard yet, or this question is already being revealed.
 */
export function revealMove(view: HostView, memory: HostMemory, manual: boolean): HostMove | null {
  const { room } = view;
  if (room.phase !== 'question' || !view.answersReady) return null;
  const question = currentQuestion(room);
  if (!question) return null;
  const key = questionKey(room);
  if (memory.revealing === key) return null;
  return { kind: 'reveal', key, questionId: question.id, manual };
}

/** Whether the room should be told the host is still trying to reveal. */
export function stillRevealing(view: HostView, memory: HostMemory): boolean {
  if (!view.clockExpired) return false;
  const retry = retryFor(memory, questionKey(view.room));
  return retry.n < MAX_REVEAL_RETRIES;
}

/**
 * The heartbeat (W3): every {@link BEAT_EVERY_MS} while this device holds the
 * chair of a room that names one. Nobody listens; the claim rule reads it.
 */
export function beatDue(view: HostView, memory: HostMemory): OneDue {
  const beating = view.room.hostUid === view.uid;
  if (!beating) {
    return { move: null, memory: memory.beatAt === null ? memory : { ...memory, beatAt: null }, wakeInMs: null };
  }
  const since = memory.beatAt === null ? null : view.now - memory.beatAt;
  if (since !== null && since < BEAT_EVERY_MS) {
    return { move: null, memory, wakeInMs: BEAT_EVERY_MS - since };
  }
  return { move: { kind: 'beat' }, memory, wakeInMs: BEAT_EVERY_MS };
}

/**
 * Share or Shaft's three moves: end the talk, blow the whistle, settle. Each
 * stage counts from when this device first saw it open — the fallback the
 * question clock uses where it cannot measure against the server. Nothing is
 * scored on these clocks; they pace the room.
 */
export function standoffDue(view: HostView, memory: HostMemory): OneDue {
  const { room, now } = view;
  const standoff = room.phase === 'standoff' ? room.standoff : null;
  const stage = standoff?.stage ?? null;
  const gameId = room.gameId ?? '';

  if (!standoff || stage === null || stage === 'revealed') {
    return { move: null, memory: memory.stage === null ? memory : { ...memory, stage: null }, wakeInMs: null };
  }

  const key = `${gameId}:${stage}`;
  const next: HostMemory = memory.stage?.key === key ? memory : { ...memory, stage: { key, seenAt: now } };
  const elapsed = now - (next.stage?.seenAt ?? now);

  if (!view.isHost || next.moved === key) return { move: null, memory: next, wakeInMs: null };

  const recheck = (limitMs: number): number => Math.min(STAGE_RECHECK_MS, Math.max(0, limitMs - elapsed));

  if (stage === 'talk') {
    if (elapsed < TALK_MS) return { move: null, memory: next, wakeInMs: recheck(TALK_MS) };
    return { move: { kind: 'standoff', key, action: { type: 'openPicks' } }, memory: next, wakeInMs: STAGE_RECHECK_MS };
  }

  if (stage === 'pick') {
    const { finalists } = standoff;
    const everyoneIn = finalists.length > 0 && view.committed.length === finalists.length;
    const pickOver = elapsed >= PICK_MS + PICK_GRACE_MS;
    if (!everyoneIn && !pickOver) return { move: null, memory: next, wakeInMs: recheck(PICK_MS + PICK_GRACE_MS) };
    return {
      move: { kind: 'standoff', key, action: { type: 'closePicks', sealed: [...view.committed] } },
      memory: next,
      wakeInMs: STAGE_RECHECK_MS,
    };
  }

  // Closed: settle once every sealed pick opens, or once the grace runs out —
  // a pick that never opens counts as share. Never before the check has run.
  const sealed = standoff.sealed ?? [];
  const verified = view.opened;
  if (verified === null) return { move: null, memory: next, wakeInMs: STAGE_RECHECK_MS };
  const allOpened = sealed.every((finalist) => verified[finalist] != null);
  if (!allOpened && elapsed < REVEAL_GRACE_MS) {
    return { move: null, memory: next, wakeInMs: recheck(REVEAL_GRACE_MS) };
  }
  return {
    move: { kind: 'standoff', key, action: { type: 'settle', picks: { ...verified } } },
    memory: next,
    wakeInMs: STAGE_RECHECK_MS,
  };
}

/**
 * The round kept at `games/{gameId}`, by the host and nobody else: the rules
 * allow `create` and refuse `update`, so a second writer is a refused write per
 * game for nothing.
 */
export function keepDue(view: HostView, memory: HostMemory): HostMove | null {
  const { room } = view;
  if (!view.isHost || room.phase !== 'finished') return null;
  const { gameId } = room;
  if (!gameId || memory.kept === gameId) return null;

  const players = view.finalTable?.players ?? room.players;
  const scores = view.finalTable?.scores ?? room.scores;
  const timings = memory.timings.gameId === gameId ? memory.timings.byQuestion : new Map<string, Timing>();
  const record = foldGameRecord({ ...room, players, scores }, [...view.gameLog], view.uid, timings);
  return record ? { kind: 'keepGame', gameId, record } : null;
}

/**
 * The lobby reaper, run on each presence reading rather than on a timer — the
 * policy (lobby only, an empty presence tree is presence broken) is
 * `reapAbsent`'s. Only the host reaps, so two devices never race one removal.
 */
export function reapDue(
  view: Pick<HostView, 'isHost' | 'room' | 'now'>,
  memory: HostMemory,
  present: ReadonlySet<string>,
): { remove: string[]; memory: HostMemory } {
  if (!view.isHost) return { remove: [], memory };
  const { remove, absentSince } = reapAbsent({
    players: view.room.players,
    present,
    absentSince: memory.absentSince,
    now: view.now,
    phase: view.room.phase,
  });
  return { remove, memory: { ...memory, absentSince } };
}

/** A move is under way. */
export function began(memory: HostMemory, move: HostMove, view: Pick<HostView, 'room' | 'now'>): HostMemory {
  switch (move.kind) {
    case 'reveal': {
      const retry = retryFor(memory, move.key);
      const timings = timingsFor(memory, view.room.gameId ?? '');
      const byQuestion = new Map(timings.byQuestion);
      // A reveal from the button before the clock ran out has nothing to measure
      // the gate against, so it measures zero rather than a negative.
      const prior = byQuestion.get(move.questionId) ?? {
        expiredAt: view.now,
        gateMs: 0,
        resolveMs: 0,
        dispatchMs: 0,
        attempts: 0,
      };
      const attempts = prior.attempts + 1;
      byQuestion.set(move.questionId, {
        ...prior,
        attempts,
        gateMs: attempts === 1 ? Math.max(0, view.now - prior.expiredAt) : prior.gateMs,
      });
      return {
        ...memory,
        revealing: move.key,
        // A timed retry falling due is what spends one of the allowance.
        retry: retry.notBefore !== null && !move.manual ? { ...retry, n: retry.n + 1, notBefore: null } : retry,
        timings: { gameId: timings.gameId, byQuestion },
      };
    }
    case 'beat':
      return { ...memory, beatAt: view.now };
    case 'standoff':
      return { ...memory, moved: move.key };
    case 'keepGame':
      return { ...memory, kept: move.gameId };
  }
}

/** A move failed. The memory is left so the same move comes due again, when it should. */
export function failed(memory: HostMemory, move: HostMove, now: number): HostMemory {
  switch (move.kind) {
    case 'reveal': {
      const cleared = { ...memory, revealing: memory.revealing === move.key ? null : memory.revealing };
      if (move.manual) return cleared;
      const retry = retryFor(memory, move.key);
      return {
        ...cleared,
        retry:
          retry.n >= MAX_REVEAL_RETRIES
            ? { ...retry, exhausted: true, notBefore: null }
            : { ...retry, notBefore: now + revealBackoffMs(retry.n) },
      };
    }
    case 'beat':
      // The next beat is due on the usual cadence; a missed one is not chased.
      return memory;
    case 'standoff':
      return { ...memory, moved: memory.moved === move.key ? null : memory.moved };
    case 'keepGame':
      return { ...memory, kept: memory.kept === move.gameId ? null : memory.kept };
  }
}

/** What a finished reveal cost, for `games/`. */
export function revealCost(
  memory: HostMemory,
  questionId: string,
  cost: { resolveMs: number; dispatchMs: number },
): HostMemory {
  const prior = memory.timings.byQuestion.get(questionId);
  if (!prior) return memory;
  const byQuestion = new Map(memory.timings.byQuestion);
  byQuestion.set(questionId, { ...prior, ...cost });
  return { ...memory, timings: { ...memory.timings, byQuestion } };
}
