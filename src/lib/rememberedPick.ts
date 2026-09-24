import { isStandoffPick, type StandoffPick } from '../engine/standoff';

/**
 * A finalist's own pick and nonce, between committing and revealing.
 *
 * The commitment on the server is a hash, so the reveal needs the two things
 * that went into it — and only this device has them. Held in session storage
 * rather than memory so a reload during the pick does not cost the finalist
 * their pick: without the nonce the commitment can never be opened, and an
 * unopened pick counts as share.
 *
 * Session storage for the reason `rememberedRoom` gives: this is *this tab,
 * tonight*. Keyed by game, so a pick from an earlier round in the same room is
 * never revealed into this one.
 */

export interface RememberedPick {
  pick: StandoffPick;
  nonce: string;
}

const key = (gameId: string): string => `vibequiz.pick.${gameId}`;

export function rememberedPick(gameId: string): RememberedPick | null {
  try {
    const raw = window.sessionStorage.getItem(key(gameId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { pick, nonce } = parsed as Record<string, unknown>;
    return isStandoffPick(pick) && typeof nonce === 'string' ? { pick, nonce } : null;
  } catch {
    // Private windows throw on access, and a hand-edited value may not parse.
    // Either way there is no pick to reveal, which counts as share — the same
    // outcome as a reload in a browser that keeps nothing.
    return null;
  }
}

export function rememberPick(gameId: string, remembered: RememberedPick): void {
  try {
    window.sessionStorage.setItem(key(gameId), JSON.stringify(remembered));
  } catch {
    // The pick still counts if this tab stays open: the reveal reads the copy
    // held in memory first. Only a reload would have needed this one.
  }
}
