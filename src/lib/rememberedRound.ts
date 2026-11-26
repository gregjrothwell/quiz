import { readRoundSettings, type RoundSettings } from '../engine/houseRound';

/**
 * How this device ran its last round, so tomorrow's room starts there
 * (PROJ-183, docs/decisions/house-round.md).
 *
 * Local storage, where the room code is in session storage: the code describes
 * this tab tonight, and this is a habit — one person hosts most mornings, and
 * made the same two changes on most of them.
 *
 * Only ever written by the device that pressed Start.
 */

const STORAGE_KEY = 'vibequiz.houseRound';

/** Read through {@link readRoundSettings}, so a value the lobby no longer offers is ignored. */
export function rememberedRound(): RoundSettings | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : readRoundSettings(JSON.parse(raw));
  } catch {
    // Private windows throw on access, and a hand-edited value may not parse.
    // Nothing remembered is how every device starts: today's defaults.
    return null;
  }
}

export function rememberRound(settings: RoundSettings): void {
  // Named one by one rather than spread: what is stored is these six, whatever
  // else the object handed in happens to carry.
  const { count, level, durationSecs, ending, steal, chaser } = settings;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ count, level, durationSecs, ending, steal, chaser }));
  } catch {
    // Nothing is lost for this round, and App keeps a copy for the rest of this
    // tab. Only the next visit starts from the defaults.
  }
}
