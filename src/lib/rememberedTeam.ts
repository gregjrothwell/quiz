import { cleanTeam } from '../engine/team';

/**
 * The team this browser last played for.
 *
 * Stored beside the remembered name and written to exactly the same pattern,
 * because it is the same kind of thing: a label the player supplies once and
 * should not have to supply again. The cleaning lives in the engine, where it is
 * shared with the grouping the season table does.
 *
 * Note this follows the browser while the team itself lives on the season
 * record. The two only disagree if somebody sets a team on one machine and then
 * plays on another that has never had one — in which case the next banked game
 * writes an empty team and clears it. See `recordGame`, which is why an empty
 * team is written as "leave whatever is there" rather than as "no team".
 */

const STORAGE_KEY = 'vibequiz.team';

export function rememberedTeam(): string {
  try {
    return cleanTeam(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Private windows and locked-down profiles throw on access. No team is the
    // state every player starts in, so there is nothing to recover.
    return '';
  }
}

export function rememberTeam(team: string): void {
  const clean = cleanTeam(team);

  try {
    if (clean) window.localStorage.setItem(STORAGE_KEY, clean);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing is lost for this game: the team has already gone into the round
    // being played, and this browser simply asks for it again next time.
  }
}
