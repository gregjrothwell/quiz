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
    date: '2026-10-24',
    lines: [
      'A new squad to pick: Geekend.',
      'Geekend get their own questions: the quizmaster picks Geekend in the lobby, and the round skips only what Geekend have already had.',
    ],
  },
  {
    date: '2026-10-23',
    lines: [
      'What’s new is in the lobby as well, so joining from a link doesn’t skip it.',
      'A new round or a new way to play it wears a New sticker for two weeks.',
      'Beat the Chaser shows its title card for a few seconds before the first question, then the question opens on the full clock.',
      'The Ladder says when a pack has run out of easy or hard questions, and which level it is using instead.',
    ],
  },
  {
    date: '2026-10-22',
    lines: [
      'The commentator’s lines stay on screen but aren’t read out any more, until it has a better voice.',
      'The drum roll before the winner, and while a final’s picks open, sounds like a drum now rather than a stutter.',
      'Play against Mr Fries: the whole office on one side, against the house, who gets each question right about as often as you do.',
      'The quiz commentates: a line at the reveal, the standings and the podium — a lone right answer, a new leader, a first win — read out from the quizmaster’s screen.',
      'A new show round, Survey Says: tell us what you think, then guess what most of the office said.',
      'Rounds land on the season table again. This morning’s two didn’t, which is what put a permissions warning over the podium.',
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

export interface UpdatesNotice {
  unseen: boolean;
  /** First line of the newest entry, when this browser has not opened it. */
  teaser: string | null;
}

/**
 * What the lobby says before anyone opens the page.
 *
 * The same gate as the dot: "last played" here means "last time this browser
 * opened What's new". There is no record of the last round this device sat in.
 */
export function updatesNotice(updates: readonly Update[], seen: string | null): UpdatesNotice {
  const unseen = hasUnseen(updates, seen);
  const line = updates[0]?.lines[0];
  return { unseen, teaser: unseen && line ? line : null };
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
