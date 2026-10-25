import type { PackId } from './types';

/**
 * Last day (inclusive) a round type wears a New sticker.
 *
 * Fourteen days after the day it went live — long enough that a Friday office
 * game meets it, short enough that last month's round is not still shouting.
 * Compared as `YYYY-MM-DD` strings, on the office clock (`Europe/London`).
 *
 * A round with no date here was never stickered. Pull a date forward to retire
 * one early; there is no other switch.
 */
export const NEW_UNTIL: Partial<Record<PackId, string>> = {
  // Random Round and Name the Artist, 12 Oct 2026 (#72).
  random: '2026-10-26',
  artists: '2026-10-26',
  // The Price is Right, 21 Oct 2026 (#96).
  tags: '2026-11-04',
  // Survey Says, 22 Oct 2026 (#131).
  survey: '2026-11-05',
  // Theme Tunes and Higher or Lower, 25 Oct 2026 (release-25-oct).
  themes: '2026-11-08',
  higher: '2026-11-08',
};

/**
 * A lobby way of playing, as distinct from a pack.
 *
 * House defaults (As it comes, Played straight, Just us, On the last answer,
 * As stills) are the absence of a mode and are not in this list.
 */
export type LobbyMode =
  | 'ladder'
  | 'stakes'
  | 'steal'
  | 'chaser'
  | 'standoff'
  | 'jigsaw'
  | 'double';

/**
 * Last day (inclusive) a lobby mode wears a New sticker. Same window as
 * {@link NEW_UNTIL}. A mode with no date here was never stickered.
 */
export const MODE_NEW_UNTIL: Partial<Record<LobbyMode, string>> = {
  // The Ladder, named in the lobby 1 Aug 2026 (4b5a9c9). No separate deploy
  // line; the office season started 3 Aug, and the name was already taken on
  // screen by 20 Aug. Either reading, this window is closed.
  ladder: '2026-08-15',
  // Played for stakes, live 2 Sep 2026 (#19).
  stakes: '2026-09-16',
  // First right answer steals, live 4 Sep 2026 (index-BOq4sYDx).
  steal: '2026-09-18',
  // The 3×3 jigsaw, live with the picture pack the same day (index-CIOq186A).
  jigsaw: '2026-09-18',
  // Share or Shaft, live 24 Sep 2026 (#60).
  standoff: '2026-10-08',
  // Beat the Chaser, live 22 Oct 2026 (#136).
  chaser: '2026-11-05',
  // The Double, live 25 Oct 2026 (#147).
  double: '2026-11-08',
};

/** Calendar day in the office's zone, `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Whether a sticker whose last day is `end` is still on for `today`. */
function stillNew(end: string | undefined, today: string): boolean {
  return end !== undefined && today <= end;
}

/** Whether `id` still carries the sticker on `today`. */
export function isNewRound(
  id: PackId | null,
  today: string,
  until: Partial<Record<PackId, string>> = NEW_UNTIL,
): boolean {
  if (id === null) return false;
  return stillNew(until[id], today);
}

/** Whether lobby mode `id` still carries the sticker on `today`. */
export function isNewMode(
  id: LobbyMode,
  today: string,
  until: Partial<Record<LobbyMode, string>> = MODE_NEW_UNTIL,
): boolean {
  return stillNew(until[id], today);
}
