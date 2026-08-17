import type { RoomState } from './state';

/**
 * What this device walked in on: the room it is in, and the question that was
 * already open when it got there — null if it arrived at anything else.
 */
export interface Arrival {
  code: string | null;
  question: string | null;
}

export const NO_ARRIVAL: Arrival = { code: null, question: null };

/**
 * Which question a room is showing, as a value that changes when the question
 * does. Null when it is not showing one, so the lobby, a reveal and the
 * standings all read as "no question open".
 *
 * The game id is in it because a second round in the same room starts again at
 * index zero, and "question one" of the new round is not the one anybody walked
 * in on.
 */
export function questionKeyOf(room: RoomState | null): string | null {
  if (!room || room.phase !== 'question') return null;
  return `${room.gameId ?? ''}:${room.index}`;
}

/**
 * The arrival to carry, given the one already held and the room now on screen.
 *
 * Recorded on the first sight of a room and then left alone. The first snapshot
 * after joining is the room's current state, so a question already open in it is
 * one this device did not see open — which is the whole question this answers,
 * and it answers it without consulting a clock.
 *
 * Deliberately not `questionOpenedAt`. That is the writer's wall clock, and
 * comparing against it folds their offset into every player's speed score — the
 * same reason `useQuestionClock` counts locally. See the note there.
 */
export function arrivalFor(held: Arrival, room: RoomState | null): Arrival {
  // **A room that is momentarily not there is not a room this device has
  // left.** `room` is null for any render where the snapshot has not landed,
  // and clients in this game demonstrably fall out of step — a player in room
  // 6JA5 watched his own timer sit at zero while the round carried on without
  // him. Treating a gap as an arrival would re-stamp somebody who has been here
  // since the lobby and quietly take the speed bonus off whatever question
  // happened to be open when their connection hiccuped.
  //
  // The cost of being lenient is the opposite case: leaving a room and
  // rejoining the *same* one mid-question is not counted as walking in on it.
  // That is the right way round. It hands someone a bonus they half-earned,
  // where the other way silently punishes someone who did nothing wrong.
  if (!room) return held;
  if (held.code === room.code) return held;
  return { code: room.code, question: questionKeyOf(room) };
}

/**
 * Whether the question on screen is the one this device walked in on.
 *
 * True for exactly one question, and only for somebody who joined while it was
 * running. Their answer clock started when they sat down rather than when the
 * question opened, so it says nothing about how fast they were — see App.tsx for
 * what is done about that.
 */
export function walkedIn(held: Arrival, room: RoomState | null): boolean {
  const key = questionKeyOf(room);
  return key !== null && held.question === key;
}
