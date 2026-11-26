/**
 * A lead-in before each question: the question arrives, and its answers land a
 * beat later (PROJ-179, docs/decisions/question-lead-in.md).
 *
 * **A hold on the room's shared clock, not a phase.** The question opens as it
 * always has and every screen keeps the answers back for the same two seconds,
 * the way an ordinary Catchphrase keeps its options back for half the clock. So
 * there is no second write, no timer on the host's device, and nothing for a
 * seat that hears late to miss: it sees a shorter lead-in and the same answers.
 *
 * **Added to the window, never taken out of it** (Greg, 11 November 2026).
 * `durationSecs` is what the rules and the vault's gate read, so a ten-second
 * question is written as twelve, and everything that means "how long to answer"
 * asks {@link answeringMs} instead of `questionDurationMs`.
 *
 * **Answers stay stamped from the open.** That is what `arrivalOk` in the rules
 * checks, and holding everybody back by the same amount moves every stamp by the
 * same amount and no rank. The lead-in comes off only where a time is kept or
 * shown to somebody: {@link answeringTimes}.
 */

import type { PackId } from '../questions/types';
import type { Action } from './reducer';
import type { RoomState } from './state';

/** Greg was shown two seconds and did not change it. */
export const LEAD_IN_SECS = 2;

/**
 * The lead-in a round on this pack opens with.
 *
 * Catchphrase has none: its picture already plays alone for half the clock, and
 * a Bonus Catchphrase's squares lift from the first frame. One figure for the
 * whole round, because the rules pin the window once a question opens, so a
 * Catchphrase dealt into a Random Round gets that round's.
 */
export function leadInSecsFor(packId: PackId | null): number {
  return packId === 'catchphrase' ? 0 : LEAD_IN_SECS;
}

type Window = Pick<RoomState, 'durationSecs' | 'leadInSecs'>;

/**
 * This room's lead-in in milliseconds. Zero for a round an old bundle opened,
 * which carries none, and for a figure that would leave no time to answer in.
 */
export function leadInMs({ durationSecs, leadInSecs }: Window): number {
  if (!Number.isFinite(leadInSecs) || leadInSecs <= 0 || leadInSecs >= durationSecs) return 0;
  return leadInSecs * 1000;
}

/** How long there is to answer, which is the window the quizmaster chose. */
export function answeringMs(room: Window): number {
  return room.durationSecs * 1000 - leadInMs(room);
}

export function answeringSecs(room: Window): number {
  return answeringMs(room) / 1000;
}

export function leadInOver(elapsedMs: number, leadMs: number): boolean {
  return elapsedMs >= leadMs;
}

/** Time since the answers landed, from time since the question opened. */
export function sinceAnswersLanded(elapsedMs: number, leadMs: number): number {
  return Math.max(0, elapsedMs - leadMs);
}

/**
 * The same answers with the lead-in off their times, for anything that keeps or
 * shows one. A stamp from before the answers landed can only be an old tab's or
 * a crafted client's, and reads as zero.
 */
export function answeringTimes<T extends { elapsedMs: number; firstMs?: number }>(
  answers: Record<string, T>,
  leadMs: number,
): Record<string, T> {
  if (leadMs === 0) return answers;
  return Object.fromEntries(
    Object.entries(answers).map(([uid, answer]) => [
      uid,
      {
        ...answer,
        elapsedMs: sinceAnswersLanded(answer.elapsedMs, leadMs),
        ...(answer.firstMs === undefined ? {} : { firstMs: sinceAnswersLanded(answer.firstMs, leadMs) }),
      },
    ]),
  );
}

/**
 * The action that opens a round, with its lead-in on it. Everything in the app
 * opens one through here (`openRound.test.ts` reads the source to check);
 * a harness that wants an exact window builds its own `start` and has none.
 */
export function openRound(round: {
  packId: PackId | null;
  at: number;
  gameId: string;
  /** The answering time, as chosen in the lobby. */
  durationSecs: number;
}): Extract<Action, { type: 'start' }> {
  const { packId, at, gameId, durationSecs } = round;
  return { type: 'start', at, gameId, durationSecs, leadInSecs: leadInSecsFor(packId) };
}
