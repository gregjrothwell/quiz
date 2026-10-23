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

/** Whether `id` still carries the sticker on `today`. */
export function isNewRound(
  id: PackId | null,
  today: string,
  until: Partial<Record<PackId, string>> = NEW_UNTIL,
): boolean {
  if (id === null) return false;
  const end = until[id];
  return end !== undefined && today <= end;
}
