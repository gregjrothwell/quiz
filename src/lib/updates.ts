/**
 * What each release changed, in words a player would use.
 *
 * Bundled rather than fetched: it is a few hundred bytes, it can never fail to
 * load, and a static file in `public/` would be one more thing that drifts from
 * the build that shipped it. The release PR adds its own entry, so the page says
 * what went live because it went live with it (`docs/decisions/updates-page.md`).
 *
 * **The repo and the site are public.** Blind packs (Catchphrase, Blankety
 * Blank, both Price packs) get a name and a count, never a sample, and nothing
 * internal goes in here: no player names, no costs, no behind-the-scenes work.
 */
export interface Update {
  /** ISO date, `YYYY-MM-DD`. Newest first in {@link UPDATES}. */
  date: string;
  lines: readonly string[];
}

export const UPDATES: readonly Update[] = [
  {
    date: '2026-10-22',
    lines: [
      'This page. Whenever the quiz changes, it says so here.',
      'Season table and What’s new sit beside Join a room, so a laptop shows them without scrolling.',
      'Press the sound check again to stop it.',
    ],
  },
  {
    date: '2026-10-21',
    lines: [
      'A new picture round, The Price is Right: 81 questions.',
      'The packs in the lobby sit on shelves, with the show rounds first.',
      'A Random Round never ends on an album sleeve or a price.',
      'Share or Shaft is played out at the reveal: a share brings the seats together, a shaft smashes the other one.',
      'The podium holds its winner back for a drum roll, standings show who went up and down, and a run of right answers gets called out.',
      'Each Share or Shaft seat shows that finalist’s record: how many finals, how often they shared, shafted and got shafted.',
      'Call it, on Catchphrase: type your answer before the options appear. A right call beats any tap; a wrong one scores nothing.',
    ],
  },
];

const SEEN_KEY = 'vibequiz.updatesSeen';

/** Whether there is an entry newer than the one this browser last opened. */
export function hasUnseen(updates: readonly Update[], seen: string | null): boolean {
  const latest = updates[0]?.date;
  if (!latest) return false;
  return seen === null || latest > seen;
}

export function updatesSeen(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    // Private windows throw on access. The dot then shows every visit, which
    // is the harmless way round.
    return null;
  }
}

export function markUpdatesSeen(updates: readonly Update[]): void {
  const latest = updates[0]?.date;
  if (!latest) return;
  try {
    window.localStorage.setItem(SEEN_KEY, latest);
  } catch {
    // Nothing to keep: the page has already been read.
  }
}
