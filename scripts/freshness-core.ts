/**
 * How much of each pack the office has not been asked yet — the pure half of
 * `npm run freshness`, so it is tested offline.
 *
 * Greg, 5 October 2026: "we need a regular check for if question packs are
 * exhausted to keep them fresh." That day Catchphrase (30 of 30) and Sleeves
 * (105 of 104) were both spent, and nothing had said so — Sleeves had simply
 * stopped being picked. docs/decisions/pack-freshness.md.
 */

import { RANDOM_SOURCES, quotasFor } from '../src/engine/randomRound';

/** A published pack: its id, its title, and the ids of every question in it. */
export interface PackIds {
  id: string;
  title: string;
  ids: string[];
}

/**
 * One kept round, as `games/` holds it. A Random Round is `packId: random`
 * with no source on its questions, so what it took from each pack is worked
 * out from its length ({@link takenBy}).
 */
export interface PlayedRound {
  packId: string;
  finishedAt: number;
  questions: number;
}

export interface FreshnessRow {
  pack: string;
  title: string;
  size: number;
  /** Asked this season *and still in the pack*. */
  asked: number;
  unseen: number;
  /**
   * The median of this pack's own recent rounds, or {@link DEFAULT_ROUND}. A
   * Random Round's share is not a round of this pack, so it is left out.
   */
  roundLength: number;
  /** Unseen over round length, to one decimal place. */
  freshRounds: number;
  /** Rounds in the window that took from this pack: its own, and Random Rounds that dealt from it. */
  played: number;
  /** Of {@link played}, the Random Rounds. */
  playedRandom: number;
  /** Questions taken a week over the window, own rounds and Random shares together. One decimal place. */
  perWeek: number;
  /** Unseen over {@link perWeek}, to one decimal place; null when nothing takes from it. */
  weeksLeft: number | null;
  low: boolean;
}

export const DEFAULT_ROUND = 15;
export const WINDOW_DAYS = 14;
/** Fewer fresh rounds than this, on a pack that is played, is low. */
export const LOW_BELOW = 2;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid];
  const lower = sorted[mid - 1];
  if (upper === undefined) return null;
  return sorted.length % 2 === 1 || lower === undefined ? upper : Math.round((lower + upper) / 2);
}

/** What one round took, pack by pack. */
export interface Taken {
  pack: string;
  questions: number;
  /** Dealt as a Random Round's share, not as a round of this pack. */
  random: boolean;
}

const floorTenth = (value: number) => Math.floor(value * 10) / 10;

/**
 * What one round took from each pack: all of it from its own pack, or, for a
 * Random Round, each source's share.
 *
 * **The share is the engine's own {@link quotasFor} over {@link RANDOM_SOURCES}**,
 * so a change to the deal changes this too: 15 is 3,3,3,2,2,2 and 10 is
 * 2,2,2,2,1,1. It is what the deal asks of each source; one that ran short
 * would have supplied less, which the record cannot show.
 */
export function takenBy(round: PlayedRound): Taken[] {
  if (round.packId !== 'random') return [{ pack: round.packId, questions: round.questions, random: false }];
  const quotas = quotasFor(round.questions, RANDOM_SOURCES.length);
  return RANDOM_SOURCES.flatMap((source, index) => {
    const share = quotas[index] ?? 0;
    return share > 0 ? [{ pack: source, questions: share, random: true }] : [];
  });
}

/**
 * One row per pack, lowest first.
 *
 * **Unseen is the pack's ids minus the asked ones, not one count minus the
 * other.** An asked id can belong to a question that has since left the pack —
 * Sleeves had 105 asked against 104 published — and subtracting counts would
 * call that pack overdrawn rather than empty.
 *
 * **Only a pack played in the window can be low.** The growth rule goes by
 * what the office plays; a pack nobody picks running dry is not news. Played
 * includes Random Rounds that dealt from it (PROJ-204): Sleeves read "played
 * 0" for a fortnight while Random Round took about seven a week from it.
 *
 * **Fresh rounds stay in this pack's own rounds; per week is what counts the
 * share.** A Random Round takes two or three from a source, and a median over
 * those and the pack's own rounds of 15 would call a round two questions long,
 * multiplying a pack's fresh rounds five times or more and silencing its alarm.
 */
export function freshness(input: {
  packs: PackIds[];
  asked: Record<string, string[]>;
  rounds: PlayedRound[];
  now: number;
  windowDays?: number;
  lowBelow?: number;
}): FreshnessRow[] {
  const { packs, asked, rounds, now, windowDays = WINDOW_DAYS, lowBelow = LOW_BELOW } = input;
  const since = now - windowDays * 86_400_000;
  const taken = rounds.filter((round) => round.finishedAt >= since).flatMap(takenBy);
  const weeks = windowDays / 7;

  return packs
    .map((pack): FreshnessRow => {
      const seen = new Set(asked[pack.id] ?? []);
      const askedHere = pack.ids.filter((id) => seen.has(id)).length;
      const unseen = pack.ids.length - askedHere;
      const mine = taken.filter((entry) => entry.pack === pack.id);
      const own = mine.filter((entry) => !entry.random);
      const roundLength = median(own.map((entry) => entry.questions)) ?? DEFAULT_ROUND;
      const freshRounds = floorTenth(unseen / roundLength);
      const rate = mine.reduce((sum, entry) => sum + entry.questions, 0) / weeks;
      return {
        pack: pack.id,
        title: pack.title,
        size: pack.ids.length,
        asked: askedHere,
        unseen,
        roundLength,
        freshRounds,
        played: mine.length,
        playedRandom: mine.length - own.length,
        perWeek: Math.round(rate * 10) / 10,
        weeksLeft: rate > 0 ? floorTenth(unseen / rate) : null,
        low: mine.length > 0 && unseen / roundLength < lowBelow,
      };
    })
    .sort((a, b) => a.freshRounds - b.freshRounds || a.pack.localeCompare(b.pack));
}

/**
 * The season rounds are writing to: the `season-N` most recently written to.
 *
 * **Only `season-N` counts.** `check-rules` writes an asked row under
 * `rules-check` on every run, and no client may delete it, so its timestamp
 * is newer than the last round whenever the preflight ran since. On 30 October
 * 2026 that made every pack read as unasked. Matching what a real season is
 * called, rather than listing the probes, keeps a new probe from doing the same.
 */
export function liveSeason(seasons: { season: string; latest: number }[]): string | null {
  const real = seasons.filter(({ season, latest }) => /^season-\d+$/.test(season) && latest > 0);
  return real.sort((a, b) => b.latest - a.latest)[0]?.season ?? null;
}

/** What the notification says, or null when there is nothing to say. */
export function notificationFor(rows: FreshnessRow[]): string | null {
  const low = rows.filter((row) => row.low);
  if (low.length === 0) return null;
  return low
    .map((row) => `${row.title}: ${row.unseen === 0 ? 'none fresh' : `${row.freshRounds} of a round`}`)
    .join(' · ');
}

/** `YYYY-MM-DD` in the Mac's own time, which is Greg's. */
export function localDay(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/**
 * Whether the morning check should run now: a weekday, from 08:00, and not
 * already done today.
 *
 * The Claude app runs it at 08:00 (plus its own fixed offset, about twelve
 * minutes), and on next launch when it was closed, which can be any time or
 * day. This is what keeps a weekend launch quiet and a second launch from
 * repeating it. 08:00 rather than 08:30 so the warning lands before the
 * morning round, which has started as early as 08:47.
 */
export function isDue(at: Date, lastRun: string | null): boolean {
  const weekday = at.getDay() >= 1 && at.getDay() <= 5;
  const afterStart = at.getHours() >= 8;
  return weekday && afterStart && lastRun !== localDay(at);
}
