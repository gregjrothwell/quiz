import { useCallback, useEffect, useRef, useState } from 'react';
import { onValue, ref as rtdbRef } from 'firebase/database';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
// The beat goes over Lite, as the vault's candidates do: a write the rules
// refuse is a 403 on its own request there, and does not close the main SDK's
// write stream under the answers. See `resolveAnswer` in vault.ts.
import { doc as liteDoc, serverTimestamp as liteServerTimestamp, setDoc as liteSetDoc } from 'firebase/firestore/lite';
import { firestore, realtimeDb, vaultFirestore } from '../firebase';
import type { QuestionRecord } from '../engine/awards';
import type { Action } from '../engine/reducer';
import type { StandoffPick } from '../engine/standoff';
import type { Player, RoomState } from '../engine/state';
import {
  FRESH_MEMORY,
  began,
  dueNow,
  failed,
  openQuestionMove,
  questionKey,
  reapDue,
  revealCost,
  revealMove,
  type HostMemory,
  type HostMove,
  type HostView,
} from '../host/due';
import { perform, removePlayers } from '../host/moves';
import type { HostPorts } from '../host/ports';
import { keepGameRecord } from './gameRecords';
import { resolveAnswer } from './vault';

/**
 * The host's duties, run in the browser: everything `src/host/` decides, done
 * against this device's Firestore, RTDB and vault (host-loop.md, B1).
 * Opening question one off Mr Fries's card is one of them: one device, and
 * the tap goes through the same in-flight lock as the timer.
 *
 * The rules live in `src/host/due.ts` and are tested there; this hook is only
 * the clock and the plumbing. It asks `dueNow` whenever something it reads
 * changes and whenever a wake it asked for comes round, performs what is due,
 * and tells `due.ts` how each move went.
 *
 * The memory is a ref, not state: nothing renders it, and a re-render per move
 * would re-run this effect at the worst moment. The one thing that does render —
 * whether the timed retries have given up — is state, set from the failure.
 */

export interface HostInputs {
  code: string | null;
  uid: string | null;
  room: RoomState | null;
  isHost: boolean;
  answersReady: boolean;
  clockExpired: boolean;
  confirmedAt: number | null;
  durationMs: number;
  gameLog: readonly QuestionRecord[];
  finalTable: { players: Record<string, Player>; scores: Record<string, number> } | null;
  /** Finalists with a commitment for this game, in finalist order. From `useStandoff`. */
  committed: readonly string[];
  /** Sealed picks opened against their commitments; null while checking. From `useStandoff`. */
  opened: Readonly<Record<string, StandoffPick | null>> | null;
  dispatch: (action: Action | Action[]) => Promise<void>;
  report: (cause: unknown) => void;
}

export interface Host {
  /** The Reveal button: no clock, no gate. Rejects when the reveal fails. */
  reveal: () => Promise<void>;
  /** The clock has run out and the timed retries have not given up. */
  revealing: boolean;
  /**
   * Skip Mr Fries's card. The same open the timer sends, so a tap on the same
   * tick does not start the question twice. Resolves without writing when an
   * open is already in flight or the card is gone.
   */
  openQuestion: () => Promise<void>;
}

function portsFor(code: string, dispatch: HostInputs['dispatch']): HostPorts {
  return {
    dispatch,
    beat: () => liteSetDoc(liteDoc(vaultFirestore(), 'rooms', code, 'host', 'beat'), { at: liteServerTimestamp() }),
    removePlayer: (uid) => updateDoc(doc(firestore(), 'rooms', code), { [`players.${uid}`]: deleteField() }),
    resolveAnswer: (question) => resolveAnswer(vaultFirestore(), code, question),
    keepGame: (gameId, record) => keepGameRecord(firestore(), gameId, record),
    now: () => Date.now(),
  };
}

function viewOf(inputs: HostInputs, now: number): HostView | null {
  if (!inputs.uid || !inputs.room || inputs.room.code !== inputs.code) return null;
  return {
    uid: inputs.uid,
    room: inputs.room,
    isHost: inputs.isHost,
    answersReady: inputs.answersReady,
    clockExpired: inputs.clockExpired,
    confirmedAt: inputs.confirmedAt,
    durationMs: inputs.durationMs,
    gameLog: inputs.gameLog,
    finalTable: inputs.finalTable,
    committed: inputs.committed,
    opened: inputs.opened,
    now,
  };
}

export function useHost(inputs: HostInputs): Host {
  const { code, uid, room, isHost, answersReady, clockExpired, confirmedAt, durationMs } = inputs;
  const { gameLog, finalTable, committed, opened, report } = inputs;

  const memoryRef = useRef<HostMemory>(FRESH_MEMORY);
  const inputsRef = useRef(inputs);
  useEffect(() => {
    inputsRef.current = inputs;
  });

  // Bumped by a wake or a failed reveal, to look again with nothing else changed.
  const [tick, setTick] = useState(0);
  const wake = useCallback(() => setTick((n) => n + 1), []);
  // The question whose timed retries have given up, so the room stops saying "Revealing…".
  const [gaveUp, setGaveUp] = useState<string | null>(null);

  // Built inside each effect and handler rather than memoised: `dispatch` is a
  // new function on every room update, and a new set of ports in the reaper's
  // dependencies would tear its presence listener down with it. Read through the
  // ref, the ports only depend on the room code.
  const portsNow = useCallback(
    (forCode: string): HostPorts => portsFor(forCode, (action) => inputsRef.current.dispatch(action)),
    [],
  );

  const run = useCallback(
    (move: HostMove, view: HostView, live: HostPorts): Promise<void> => {
      memoryRef.current = began(memoryRef.current, move, { room: view.room, now: Date.now() });
      return perform(move, { room: view.room, gameLog: view.gameLog }, live).then(
        (result) => {
          if (result.kind === 'reveal' && move.kind === 'reveal') {
            memoryRef.current = revealCost(memoryRef.current, move.questionId, result.cost);
          }
          // A refusal is final until the rules change, so only 'failed' is tried again —
          // on the next change to the room, never on a timer.
          if (result.kind === 'keepGame' && result.outcome === 'failed') {
            memoryRef.current = failed(memoryRef.current, move, Date.now());
          }
        },
        (cause: unknown) => {
          memoryRef.current = failed(memoryRef.current, move, Date.now());
          // A missed beat is not worth a notice: the next is fifteen seconds away.
          if (move.kind === 'beat') return;
          if (move.kind === 'reveal' && !move.manual) {
            if (memoryRef.current.retry.exhausted) setGaveUp(move.key);
            // Look again so the backoff's wake is scheduled.
            wake();
          }
          if (move.kind === 'openQuestion') {
            const current = inputsRef.current.room;
            const waiting = current?.phase === 'lobby' && current.chaserIntro !== null;
            // The question already opened: this write lost to the one in flight.
            // A room that is still on the card is a real failure, tried again
            // once `openNotBefore` says so.
            if (!waiting) return;
            wake();
          }
          // A stage of the final is looked at again on the second, as before.
          throw cause;
        },
      );
    },
    [wake],
  );

  useEffect(() => {
    if (!code) return;
    const view = viewOf(inputsRef.current, Date.now());
    if (!view) return;
    const ports = portsNow(code);

    const due = dueNow(view, memoryRef.current);
    memoryRef.current = due.memory;
    for (const move of due.moves) {
      run(move, view, ports).catch((cause: unknown) => {
        if (move.kind === 'reveal' || move.kind === 'standoff' || move.kind === 'openQuestion') report(cause);
      });
    }

    if (due.wakeInMs === null) return;
    const timer = window.setTimeout(wake, due.wakeInMs);
    return () => window.clearTimeout(timer);
  }, [
    code,
    portsNow,
    uid,
    room,
    isHost,
    answersReady,
    clockExpired,
    confirmedAt,
    durationMs,
    gameLog,
    finalTable,
    committed,
    opened,
    report,
    run,
    wake,
    tick,
  ]);

  // The lobby reaper, on each presence reading — see `reapDue`. Only the host
  // listens, and the room is read from the ref so a new snapshot does not tear
  // the listener down.
  useEffect(() => {
    if (!code || !isHost) return;
    const ports = portsNow(code);
    return onValue(rtdbRef(realtimeDb(), `presence/${code}`), (snapshot) => {
      const current = inputsRef.current.room;
      if (!current || current.code !== code) return;
      const present = new Set(Object.keys((snapshot.val() as Record<string, unknown> | null) ?? {}));
      const { remove, memory } = reapDue({ isHost: true, room: current, now: Date.now() }, memoryRef.current, present);
      memoryRef.current = memory;
      // Unreported, as before: the next presence reading tries again.
      if (remove.length > 0) removePlayers(remove, ports).catch(() => undefined);
    });
  }, [code, isHost, portsNow]);

  const reveal = useCallback(async (): Promise<void> => {
    if (!code) return;
    const view = viewOf(inputsRef.current, Date.now());
    if (!view) return;
    const move = revealMove(view, memoryRef.current, true);
    if (!move) return;
    await run(move, view, portsNow(code));
  }, [code, portsNow, run]);

  const openQuestion = useCallback(async (): Promise<void> => {
    if (!code) return;
    const view = viewOf(inputsRef.current, Date.now());
    if (!view) return;
    const move = openQuestionMove(view, memoryRef.current, true);
    if (!move) return;
    await run(move, view, portsNow(code));
  }, [code, portsNow, run]);

  const revealing = clockExpired && room !== null && gaveUp !== questionKey(room);
  return { reveal, revealing, openQuestion };
}
