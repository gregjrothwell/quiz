/**
 * How much of each pack the office has not been asked yet — the pure half of
 * `npm run freshness`, so it is tested offline.
 *
 * Greg, 5 October 2026: "we need a regular check for if question packs are
 * exhausted to keep them fresh." That day Catchphrase (30 of 30) and Sleeves
 * (105 of 104) were both spent, and nothing had said so — Sleeves had simply
 * stopped being picked. docs/decisions/pack-freshness.md.
 */

/** A published pack: its id, its title, and the ids of every question in it. */
export interface PackIds {
  id: string;
  title: string;
  ids: string[];
}

/** One kept round, as `games/` holds it. */
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
  /** The median of this pack's recent rounds, or {@link DEFAULT_ROUND}. */
  roundLength: number;
  /** Unseen over round length, to one decimal place. */
  freshRounds: number;
  /** Rounds of this pack in the window. */
  played: number;
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

/**
 * One row per pack, lowest first.
 *
 * **Unseen is the pack's ids minus the asked ones, not one count minus the
 * other.** An asked id can belong to a question that has since left the pack —
 * Sleeves had 105 asked against 104 published — and subtracting counts would
 * call that pack overdrawn rather than empty.
 *
 * **Only a pack played in the window can be low.** The growth rule goes by
 * what the office plays; a pack nobody picks running dry is not news.
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
  const recent = rounds.filter((round) => round.finishedAt >= since);

  return packs
    .map((pack): FreshnessRow => {
      const seen = new Set(asked[pack.id] ?? []);
      const askedHere = pack.ids.filter((id) => seen.has(id)).length;
      const unseen = pack.ids.length - askedHere;
      const mine = recent.filter((round) => round.packId === pack.id);
      const roundLength = median(mine.map((round) => round.questions)) ?? DEFAULT_ROUND;
      const freshRounds = Math.floor((unseen / roundLength) * 10) / 10;
      return {
        pack: pack.id,
        title: pack.title,
        size: pack.ids.length,
        asked: askedHere,
        unseen,
        roundLength,
        freshRounds,
        played: mine.length,
        low: mine.length > 0 && unseen / roundLength < lowBelow,
      };
    })
    .sort((a, b) => a.freshRounds - b.freshRounds || a.pack.localeCompare(b.pack));
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
