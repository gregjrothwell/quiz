/**
 * A tab opened before a deploy, asking for a chunk the deploy deleted.
 *
 * Every deploy replaces `gh-pages` wholesale, so the hashed chunks the previous
 * bundle lazy-loads — the share card, the season table, What's new — are gone
 * the moment it lands. A tab still running the old bundle asks for them by
 * their old names and gets a 404. Found by the error beacon on 28 October 2026
 * (PROJ-77): room 3KVN finished five minutes after #168 went live, and one
 * player's podium could neither draw its card nor open the season table.
 *
 * The answer is the one Vite documents: on `vite:preloadError`, reload. The new
 * `index.html` names chunks that exist, and `rememberedRoom` puts the player
 * back in their room. Keeping old chunks on `gh-pages` instead would also work,
 * but a deploy would then never remove anything, including files removed on
 * purpose.
 *
 * **Once, not forever.** If the chunk is missing for some other reason — a
 * deploy half-written, the CDN behind — the reloaded page fails the same way,
 * and reloading again would loop. A second failure within {@link RELOAD_GAP_MS}
 * is left to surface as the error it is, which the beacon then reports.
 */

const STORAGE_KEY = 'vibequiz.chunkReloadAt';

/** Long enough to cover a reload and the re-fetch that fails again; short enough that a later deploy reloads too. */
export const RELOAD_GAP_MS = 30_000;

/** The part of `sessionStorage` this needs. */
export interface ReloadStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Reloads unless this tab already did so for a missing chunk in the last
 * {@link RELOAD_GAP_MS}. Returns whether it reloaded.
 *
 * Storage that cannot be read or written means no reload: without the guard a
 * reload could loop, and a page stuck reloading is worse than one missing its
 * share card.
 */
export function reloadForStaleChunk(store: () => ReloadStore, now: number, reload: () => void): boolean {
  let lastAt: number;
  try {
    const session = store();
    lastAt = Number(session.getItem(STORAGE_KEY) ?? Number.NEGATIVE_INFINITY);
    if (now - lastAt < RELOAD_GAP_MS) return false;
    session.setItem(STORAGE_KEY, String(now));
  } catch {
    return false;
  }
  reload();
  return true;
}

/** Called once, from `main.tsx`. */
export function installStaleChunkReload(): void {
  window.addEventListener('vite:preloadError', () => {
    reloadForStaleChunk(() => window.sessionStorage, Date.now(), () => window.location.reload());
  });
}
