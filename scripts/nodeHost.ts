/**
 * The host, run from Node: the same `src/host/` the browser runs through
 * `useHost`, for the harnesses and the whole-round e2e (host-loop.md, C1–C2).
 *
 * It listens the way `useRoom` does — the room with metadata, so a question is
 * timed from the server's acknowledgement; the answers; the sealed picks during a
 * final — and writes the way the app does, through `toUpdate` in
 * `src/lib/roomDoc.ts`. So a harness tests the real host: the reveal on the
 * clock, the retries, the beat, the final's three moves, keeping the round.
 *
 * What it does not do is press the quizmaster's buttons. Start and Next are the
 * caller's, through {@link NodeHost.dispatch}, exactly as a person in the chair
 * would press them.
 *
 * Imports nothing that reaches `src/firebase.ts` (`scripts/imports.test.ts`).
 */

import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  updateDoc,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import {
  doc as liteDoc,
  serverTimestamp as liteServerTimestamp,
  setDoc as liteSetDoc,
  type Firestore as LiteFirestore,
} from 'firebase/firestore/lite';
import { onValue, ref as rtdbRef, type Database } from 'firebase/database';
import { liveAnswers, type AnswerDoc } from '../src/engine/answers';
import type { QuestionRecord } from '../src/engine/awards';
import { resolveHost } from '../src/engine/host';
import type { Action } from '../src/engine/reducer';
import { hasCommitted, openedPick, sealedPickDocFrom, type SealedPickDoc } from '../src/engine/sealedPick';
import type { StandoffPick } from '../src/engine/standoff';
import { questionDurationMs, type RoomState } from '../src/engine/state';
import {
  FRESH_MEMORY,
  began,
  dueNow,
  failed,
  questionKey,
  reapDue,
  revealCost,
  type HostMemory,
  type HostMove,
  type HostView,
} from '../src/host/due';
import { logged, type GameLog } from '../src/host/gameLog';
import { foldActions, perform, removePlayers } from '../src/host/moves';
import type { HostPorts } from '../src/host/ports';
import { keepGameRecord } from '../src/lib/gameRecords';
import { answerDocFrom, toRoomState, toUpdate } from '../src/lib/roomDoc';
import { resolveAnswer } from '../src/lib/vault';

export interface NodeHostOptions {
  db: Firestore;
  /**
   * Lite, for the beat and the vault's candidates, as the app sends them. Passed
   * in, never made here: a Lite instance made from `db.app` is not pointed at an
   * emulator `db` was, and its writes go to the live project instead. That
   * happened on 22 October 2026, in the first run of `node-round.spec.ts`.
   */
  lite: LiteFirestore;
  code: string;
  uid: string;
  /** For the lobby reaper. Without it nobody is reaped, which a harness rarely wants anyway. */
  rtdb?: Database;
  /** Only these duties. `['beat']` holds the chair for a script that reveals by hand. */
  only?: readonly HostMove['kind'][];
  /** Where to say what happened. Defaults to silence. */
  log?: (line: string) => void;
}

export interface NodeHost {
  /** The room as the engine sees it, with the answers the app would count. */
  room: () => RoomState | null;
  /** The quizmaster's presses — start, next — folded over the newest room and written as the app writes. */
  dispatch: (action: Action | Action[]) => Promise<RoomState | null>;
  /** What this host saw of each question, as `useGameLog` keeps it. */
  gameLog: () => readonly QuestionRecord[];
  /** Every failure a move reported, oldest first. A harness should print these. */
  failures: () => readonly string[];
  /**
   * Resolves once no move is in flight. Await it before {@link stop}: a script
   * that exits on the podium otherwise cuts off the `games/` write it started.
   */
  idle: () => Promise<void>;
  /** Resolves with the room once `check` passes; rejects after `ms`. */
  until: (check: (room: RoomState) => boolean, ms?: number) => Promise<RoomState>;
  stop: () => void;
}

export function startNodeHost({ db, lite, code, uid, rtdb, only, log = () => undefined }: NodeHostOptions): NodeHost {

  let persisted: DocumentData | null = null;
  let answers: Record<string, AnswerDoc> = {};
  let answersReady = false;
  let picks: Record<string, SealedPickDoc> = {};
  let opened: { from: Record<string, SealedPickDoc>; picks: Record<string, StandoffPick | null> } | null = null;
  let memory: HostMemory = FRESH_MEMORY;
  let gameLog: GameLog = { gameId: null, records: [] };
  // When this process first saw each question, and when the server first confirmed it.
  let seen = { key: '', at: 0 };
  let confirmed = { key: '', at: 0 };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const failures: string[] = [];
  const waiters = new Set<() => void>();
  const inFlight = new Set<Promise<unknown>>();

  const room = (): RoomState | null => {
    if (!persisted) return null;
    const players = (persisted.players ?? {}) as RoomState['players'];
    const index = Number(persisted.index ?? 0);
    return toRoomState(code, persisted, liveAnswers(players, index, answers));
  };

  const ports: HostPorts = {
    dispatch: async (action) => {
      await write(action);
    },
    beat: () => liteSetDoc(liteDoc(lite, 'rooms', code, 'host', 'beat'), { at: liteServerTimestamp() }),
    removePlayer: (player) => updateDoc(doc(db, 'rooms', code), { [`players.${player}`]: deleteField() }),
    resolveAnswer: (question) => resolveAnswer(lite, code, question),
    keepGame: (gameId, record) => keepGameRecord(db, gameId, record),
    now: () => Date.now(),
  };

  async function write(action: Action | Action[]): Promise<RoomState | null> {
    const current = room();
    if (!current) return null;
    const next = foldActions(current, action);
    if (!next) return current;
    await updateDoc(doc(db, 'rooms', code), toUpdate(next, current) as Partial<DocumentData>);
    return next;
  }

  function viewNow(now: number): HostView | null {
    const current = room();
    if (!current) return null;
    const key = questionKey(current);
    const durationMs = questionDurationMs(current);
    const asking = current.phase === 'question';
    const verified = opened && opened.from === picks ? opened.picks : null;
    const finalists = current.standoff?.finalists ?? [];
    return {
      uid,
      room: current,
      isHost: resolveHost(current) === uid,
      answersReady,
      clockExpired: asking && seen.key === key && now >= seen.at + durationMs,
      // This process does not watch lamps, so it cannot see an answer in flight.
      // The browser host does (`answerStillInFlight` in App.tsx) and waits.
      answerInFlight: false,
      confirmedAt: asking && confirmed.key === key ? confirmed.at : null,
      durationMs,
      gameLog: gameLog.gameId === current.gameId ? gameLog.records : [],
      finalTable: null,
      committed: finalists.filter((finalist) => hasCommitted(picks[finalist], current.gameId ?? '')),
      opened: verified,
      now,
    };
  }

  function run(move: HostMove, view: HostView): void {
    memory = began(memory, move, { room: view.room, now: Date.now() });
    log(`host: ${move.kind}${move.kind === 'standoff' ? ` ${move.action.type}` : ''}`);
    const performing = perform(move, { room: view.room, gameLog: view.gameLog }, ports).then(
      (result) => {
        if (result.kind === 'reveal' && move.kind === 'reveal') memory = revealCost(memory, move.questionId, result.cost);
        if (result.kind === 'keepGame') {
          log(`host: games/${move.kind === 'keepGame' ? move.gameId : ''} ${result.outcome}`);
          if (result.outcome === 'failed') memory = failed(memory, move, Date.now());
        }
        evaluate();
      },
      (cause: unknown) => {
        memory = failed(memory, move, Date.now());
        const message = `${move.kind} failed: ${cause instanceof Error ? cause.message : String(cause)}`;
        failures.push(message);
        log(`host: ${message}`);
        evaluate();
      },
    );
    inFlight.add(performing);
    void performing.finally(() => inFlight.delete(performing));
  }

  /** Asks `due.ts` what is owed, does it, and sets the next wake. */
  function evaluate(): void {
    if (stopped) return;
    const now = Date.now();
    const view = viewNow(now);
    if (!view) return;

    const due = dueNow(view, memory);
    memory = due.memory;
    for (const move of due.moves) {
      if (!only || only.includes(move.kind)) run(move, view);
    }

    // The question clock runs out with nothing changing, so it is a wake of its own.
    const current = view.room;
    const clockLeft =
      current.phase === 'question' && seen.key === questionKey(current) && !view.clockExpired
        ? seen.at + view.durationMs - now
        : null;
    const waits = [due.wakeInMs, clockLeft].filter((wait): wait is number => wait !== null);
    if (timer) clearTimeout(timer);
    timer = waits.length > 0 ? setTimeout(evaluate, Math.max(0, Math.min(...waits))) : null;

    // Opening the sealed picks is a hash, so it is checked here and fed back in.
    if (view.isHost && current.phase === 'standoff' && current.standoff?.stage === 'closed') {
      const from = picks;
      if (!opened || opened.from !== from) {
        const sealed = current.standoff.sealed ?? [];
        const gameId = current.gameId ?? '';
        void Promise.all(sealed.map(async (finalist) => [finalist, await openedPick(from[finalist], gameId, finalist)] as const)).then(
          (entries) => {
            if (picks !== from) return;
            opened = { from, picks: Object.fromEntries(entries) };
            evaluate();
          },
        );
      }
    }

    for (const wake of waiters) wake();
  }

  const stops: (() => void)[] = [];

  stops.push(
    onSnapshot(doc(db, 'rooms', code), { includeMetadataChanges: true }, (snapshot) => {
      if (!snapshot.exists()) return;
      persisted = snapshot.data();
      const current = room();
      if (current) {
        gameLog = logged(gameLog, current);
        const key = questionKey(current);
        if (current.phase === 'question') {
          if (seen.key !== key) seen = { key, at: Date.now() };
          if (!snapshot.metadata.hasPendingWrites && confirmed.key !== key) confirmed = { key, at: Date.now() };
        }
      }
      evaluate();
    }),
  );

  stops.push(
    onSnapshot(collection(db, 'rooms', code, 'answers'), { includeMetadataChanges: true }, (snapshot) => {
      const next: Record<string, AnswerDoc> = {};
      for (const document of snapshot.docs) {
        const parsed = answerDocFrom(document.data());
        if (parsed) next[document.id] = parsed;
      }
      answers = next;
      if (!snapshot.metadata.fromCache) answersReady = true;
      evaluate();
    }),
  );

  stops.push(
    onSnapshot(collection(db, 'rooms', code, 'standoff'), (snapshot) => {
      const next: Record<string, SealedPickDoc> = {};
      for (const document of snapshot.docs) {
        const parsed = sealedPickDocFrom(document.data());
        if (parsed) next[document.id] = parsed;
      }
      picks = next;
      evaluate();
    }),
  );

  if (rtdb && (!only || only.includes('beat'))) {
    stops.push(
      onValue(rtdbRef(rtdb, `presence/${code}`), (snapshot) => {
        const current = room();
        if (!current) return;
        const present = new Set(Object.keys((snapshot.val() as Record<string, unknown> | null) ?? {}));
        const reaped = reapDue({ isHost: resolveHost(current) === uid, room: current, now: Date.now() }, memory, present);
        memory = reaped.memory;
        if (reaped.remove.length > 0) {
          removePlayers(reaped.remove, ports).catch((cause: unknown) => failures.push(`reap failed: ${String(cause)}`));
        }
      }),
    );
  }

  return {
    room,
    dispatch: write,
    gameLog: () => gameLog.records,
    failures: () => failures,
    idle: async () => {
      while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
    },
    until: (check, ms = 30_000) =>
      new Promise<RoomState>((resolve, reject) => {
        const look = (): void => {
          const current = room();
          if (current && check(current)) {
            waiters.delete(look);
            clearTimeout(deadline);
            resolve(current);
          }
        };
        const deadline = setTimeout(() => {
          waiters.delete(look);
          reject(new Error(`timed out after ${String(ms)}ms; the room is ${room()?.phase ?? 'unread'}`));
        }, ms);
        waiters.add(look);
        look();
      }),
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      for (const stop of stops) stop();
      waiters.clear();
    },
  };
}
