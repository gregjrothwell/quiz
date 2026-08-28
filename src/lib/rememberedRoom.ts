import { isValidRoomCode, normaliseRoomCode } from '../engine/roomCode';

/**
 * The room this tab is in, so a reload does not throw you out of it.
 *
 * `code` is React state in `useRoom` and nothing persisted it, so refreshing
 * mid-round dropped you to the landing screen and you rejoined by hand. Found on
 * 28 August 2026 while testing something else, and it was the only outright
 * defect on the ideas list.
 *
 * **Session storage, not local**, and the distinction is the same one
 * `rememberedPlayingWith` makes: this describes *this tab, tonight*, not this
 * browser. A room code in local storage would try to put somebody back into last
 * week's room, which is worse than the bug it fixes — the room is long gone, the
 * restore fails, and the landing screen is where they end up anyway, just
 * slower.
 *
 * Everything else a reload needs already survives one. The auth uid is durable,
 * the name is in local storage, and the game log is mirrored into session
 * storage precisely so a mid-round reload does not read as never having been
 * here. This was the one piece that was not.
 */

const STORAGE_KEY = 'vibequiz.room';

/**
 * The room to rejoin, or the empty string.
 *
 * Validated on the way out as well as in, on the same reasoning as `cleanName`:
 * what is in storage is whatever an older build wrote there, or whatever
 * somebody with the console open decided to put there instead. An invalid code
 * is treated as no code, which lands on the landing screen — exactly where a
 * browser with nothing stored starts.
 */
export function rememberedRoom(): string {
  try {
    const stored = normaliseRoomCode(window.sessionStorage.getItem(STORAGE_KEY) ?? '');
    return isValidRoomCode(stored) ? stored : '';
  } catch {
    // Private windows and locked-down profiles throw on access. No stored room
    // is the state every tab starts in, so there is nothing to recover.
    return '';
  }
}

export function rememberRoom(code: string): void {
  const clean = normaliseRoomCode(code);
  if (!isValidRoomCode(clean)) return;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, clean);
  } catch {
    // Nothing is lost for this round: the tab is already in the room, and only a
    // reload would have needed this.
  }
}

/**
 * **Leaving must call this**, and it is the whole risk in the feature. Without
 * it, Leave becomes a button that drops you out of the room and then puts you
 * straight back on the next render — the room code is still in storage and
 * nothing else would ever remove it.
 */
export function forgetRoom(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Already unreachable; a tab that cannot write storage cannot have stored a
    // room to begin with.
  }
}
