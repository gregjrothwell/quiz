import type { QuestionRecord } from '../engine/awards';
import { REVEAL_TIMEOUT_MS } from '../engine/revealGate';
import { reduce, type Action } from '../engine/reducer';
import { currentQuestion, type RoomState } from '../engine/state';
import { guessReveal } from '../engine/survey';
import { withTimeout } from '../lib/withTimeout';
import type { HostMove } from './due';
import type { HostPorts } from './ports';

/**
 * Doing what `due.ts` decided, through the ports (host-loop.md, A4). Every
 * failure comes back to the caller as a rejection; nothing here swallows one.
 * What to do about it — report it, retry it, ignore a missed beat — is the
 * caller's, and `failed()` in `due.ts` says when the move comes due again.
 */

/**
 * Folds actions over a room. Null when nothing changed, so the caller writes
 * nothing. Actions are folded together and written once: dispatching twice in a
 * row would run the second against a stale room, so `start` would not see the
 * questions `selectPack` had just added.
 */
export function foldActions(current: RoomState, action: Action | Action[]): RoomState | null {
  const actions = Array.isArray(action) ? action : [action];
  const next = actions.reduce(reduce, current);
  return next === current ? null : next;
}

export interface RevealCost {
  resolveMs: number;
  dispatchMs: number;
}

/**
 * Reveals the open question of `room`: the vault's answer, or for Survey Says
 * the room's own. Bounded by {@link REVEAL_TIMEOUT_MS}, because a Firestore
 * write does not reject when the line stalls — it stays pending, and a pending
 * reveal held the whole room on "Revealing…" (`withTimeout`).
 *
 * The question is named in the action, so a reveal landing after the room has
 * moved on scores nothing against the wrong question.
 */
export async function revealQuestion(
  room: RoomState,
  gameLog: readonly QuestionRecord[],
  ports: Pick<HostPorts, 'dispatch' | 'resolveAnswer' | 'now'>,
  timeoutMs: number = REVEAL_TIMEOUT_MS,
): Promise<RevealCost> {
  const question = currentQuestion(room);
  if (room.phase !== 'question' || !question) return { resolveMs: 0, dispatchMs: 0 };

  return withTimeout(
    (async (): Promise<RevealCost> => {
      // Survey Says has no vault: the room is the answer. A tell has none, so it
      // reveals on option 0 and the reducer scores nobody. A guess reads the
      // room's top answer off this host's record of the telling, and is skipped
      // when there is none — the chair changed hands, or too few answered.
      if (question.survey) {
        const started = ports.now();
        if (question.survey.part === 'tell') {
          await ports.dispatch({ type: 'reveal', correctIndex: 0, questionId: question.id });
        } else {
          const guessed = guessReveal(room.questions, room.index, gameLog);
          await ports.dispatch(
            guessed
              ? {
                  type: 'reveal',
                  correctIndex: guessed.correctIndex,
                  top: guessed.top,
                  counts: guessed.counts,
                  questionId: question.id,
                }
              : { type: 'skip' },
          );
        }
        return { resolveMs: 0, dispatchMs: ports.now() - started };
      }

      const startedResolve = ports.now();
      const correctIndex = await ports.resolveAnswer(question);
      const resolveMs = ports.now() - startedResolve;
      const startedDispatch = ports.now();
      await ports.dispatch({ type: 'reveal', correctIndex, questionId: question.id });
      return { resolveMs, dispatchMs: ports.now() - startedDispatch };
    })(),
    timeoutMs,
    'The reveal',
  );
}

/** What a move came to. Only a reveal and a keep have anything to say. */
export type Performed =
  | { kind: 'reveal'; cost: RevealCost }
  | { kind: 'keepGame'; outcome: 'kept' | 'refused' | 'failed' }
  | { kind: 'beat' | 'standoff' };

/** Performs one move. Rejects when it fails; see `failed()` for what happens next. */
export async function perform(
  move: HostMove,
  context: { room: RoomState; gameLog: readonly QuestionRecord[] },
  ports: HostPorts,
): Promise<Performed> {
  switch (move.kind) {
    case 'reveal':
      return { kind: 'reveal', cost: await revealQuestion(context.room, context.gameLog, ports) };
    case 'beat':
      await ports.beat();
      return { kind: 'beat' };
    case 'standoff':
      await ports.dispatch(move.action);
      return { kind: 'standoff' };
    case 'keepGame':
      return { kind: 'keepGame', outcome: await ports.keepGame(move.gameId, move.record) };
  }
}

/** The lobby reaper's removals, one write each, all attempted. Rejects if any failed. */
export async function removePlayers(uids: readonly string[], ports: Pick<HostPorts, 'removePlayer'>): Promise<void> {
  const results = await Promise.allSettled(uids.map((uid) => ports.removePlayer(uid)));
  const refused = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (refused) throw refused.reason;
}
