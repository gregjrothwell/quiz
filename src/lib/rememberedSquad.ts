import { isSquad, type Squad } from '../engine/squad';

/**
 * The squad this browser last played for, and who it played with.
 *
 * Stored beside the remembered name and written to exactly the same pattern,
 * because it is the same kind of thing: a label the player supplies once and
 * should not have to supply again.
 *
 * Note this follows the browser while the squad itself lives on the season
 * record. The two only disagree if somebody sets a squad on one machine and
 * then plays on another that has never had one — which is why an empty squad is
 * banked as "leave whatever is there" rather than as "no squad". See
 * `recordGame`.
 */

/**
 * Unchanged from the free-text era on purpose. Moving it would discard what
 * every returning player already has stored for the sake of a tidier string,
 * and {@link rememberedSquad} rejects a value the picker no longer offers
 * anyway — so a legacy name is ignored rather than migrated.
 */
const STORAGE_KEY = 'vibequiz.team';

/**
 * Session storage, not local: this describes tonight, not this browser.
 * A Lurker sitting with Hermes this week is not making a standing arrangement,
 * and carrying it to next month's round would quietly bank their points for a
 * squad they were not with.
 */
const PLAYING_WITH_KEY = 'vibequiz.playingWith';

/**
 * The squad this browser last played for, if it is still one on offer.
 *
 * **Narrowed to the current list, unlike `cleanSquad`.** What is in storage may
 * be a name from the free-text era, and a `<select>` handed a value matching
 * none of its options renders as though nothing were chosen — so the picker
 * would silently disagree with the record. Returning nothing instead makes the
 * player choose, and until they do, the empty-means-keep rule leaves their
 * record exactly as it was.
 */
export function rememberedSquad(): Squad | '' {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isSquad(stored) ? stored : '';
  } catch {
    // Private windows and locked-down profiles throw on access. No squad is the
    // state every player starts in, so there is nothing to recover.
    return '';
  }
}

export function rememberSquad(squad: string): void {
  try {
    if (isSquad(squad)) window.localStorage.setItem(STORAGE_KEY, squad);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing is lost for this game: the squad has already gone into the round
    // being played, and this browser simply asks for it again next time.
  }
}

/**
 * Which side a Lurker is sitting with tonight, or nothing.
 *
 * Only ever set by somebody whose own squad is Lurkers; for anybody else it is
 * meaningless and is not asked for. It changes which squad's weekly board their
 * points land on, and nothing about their season record.
 */
export function rememberedPlayingWith(): Squad | '' {
  try {
    const stored = window.sessionStorage.getItem(PLAYING_WITH_KEY);
    return isSquad(stored) ? stored : '';
  } catch {
    return '';
  }
}

export function rememberPlayingWith(squad: string): void {
  try {
    if (isSquad(squad)) window.sessionStorage.setItem(PLAYING_WITH_KEY, squad);
    else window.sessionStorage.removeItem(PLAYING_WITH_KEY);
  } catch {
    // Same trade as above: this round already has the value, and a reload
    // simply falls back to the player's own squad.
  }
}
