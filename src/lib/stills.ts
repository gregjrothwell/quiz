import { useEffect, useMemo, useState } from 'react';
import { isItunesArtworkUrl } from './apple-media';
import { packImageUrl } from './usePacks';

/**
 * Where a picture question's image lives, and when it has actually arrived.
 *
 * Written on 21 September 2026 after Bret's round: the pictures did not show
 * up, and there were two separate reasons neither of which was the files. They
 * are fine — 29–134KB, 200 from Pages, and in the round he played the file size
 * predicted neither the hit rate nor the answer speed. What was wrong was that
 * **nothing asked for an image until the question was already on screen**, so
 * the download and the countdown started in the same frame. See
 * `docs/decisions/picture-loading.md`.
 */

export interface StillSource {
  image?: string | undefined;
  artworkUrl?: string | undefined;
}

/**
 * The one place that turns a question into an image URL.
 *
 * Shared rather than duplicated on purpose: the preloader and the `<img>` have
 * to agree to the character, or the preloader warms a cache entry the render
 * never asks for and the whole thing is decoration that looks like it works.
 */
export function stillSrc(image?: string, artworkUrl?: string): string | null {
  if (artworkUrl && isItunesArtworkUrl(artworkUrl)) return artworkUrl;
  if (image) return packImageUrl(image);
  return null;
}

/**
 * How many stills to pull at once.
 *
 * Not all fifteen. A round's images are wanted *in order*, and a slow link is
 * exactly the case this exists for — firing the lot at once would put question
 * fifteen's still in contention with question one's on the connection least
 * able to afford it. Three keeps the pipe busy without losing the ordering.
 */
const PRELOAD_CONCURRENCY = 3;

/**
 * Pulls a round's stills into the browser cache while the lobby is open.
 *
 * The client holds every question from the moment the round is built, so all
 * fifteen filenames are known long before the first one is shown — and the
 * lobby then sits there while people join. That window is free, and using it
 * is the whole fix: by the time a question appears its picture is a cache hit
 * on any connection that managed the lobby at all.
 *
 * Nothing is aborted on cleanup. Clearing `src` to cancel would throw away a
 * partly-downloaded image that the next question is about to want, which is
 * the opposite of the point; the elements are small and the bytes belong to
 * the HTTP cache, not to us.
 */
export function useStillPreload(questions: readonly StillSource[] | undefined): void {
  const urls = useMemo(() => {
    const found = (questions ?? [])
      .map((question) => stillSrc(question.image, question.artworkUrl))
      .filter((url): url is string => url !== null);
    return [...new Set(found)];
  }, [questions]);

  // The urls array is rebuilt on every snapshot, so the effect keys off what is
  // in it rather than its identity. Without this the preload restarts on every
  // presence write — which on a busy lobby is several times a second.
  const key = urls.join('\n');

  useEffect(() => {
    if (urls.length === 0) return;
    let cancelled = false;
    let next = 0;

    const pull = (): void => {
      if (cancelled || next >= urls.length) return;
      const url = urls[next];
      next += 1;
      if (url === undefined) return;
      const img = new Image();
      // Whether it worked or not, move on: one 404 must not stall the queue
      // behind it, because the question that 404s is not the question the
      // player is about to be shown.
      img.onload = pull;
      img.onerror = pull;
      img.src = url;
    };

    for (let i = 0; i < Math.min(PRELOAD_CONCURRENCY, urls.length); i += 1) pull();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * `waiting` is "not here yet, and it is too soon to say so".
 *
 * On a warm cache a still is there in one frame, and a placeholder that appears
 * and vanishes inside 16ms reads as a rendering fault — the same reasoning as
 * the chunk loader in `App.tsx`. `slow` is the same absence once it has lasted
 * long enough to be worth admitting.
 */
export type StillStatus = 'waiting' | 'slow' | 'ready' | 'failed';

/**
 * How long a still may be missing before the screen says so.
 *
 * Long enough to skip the common case, short enough that somebody on a bad
 * connection is told something is happening well inside a ten-second window.
 */
export const SAY_SOMETHING_AFTER_MS = 180;

/**
 * Whether `src` has arrived, with one silent retry before it gives up.
 *
 * A probe rather than the `<img>`'s own `onLoad`, because the jigsaw draws its
 * tiles with `background-image` and has no element to listen to. One hook for
 * both keeps them from drifting; the probe costs no second download, since it
 * asks for the same URL and lands on the same cache entry.
 *
 * The silent retry is there because the failure this is for is a blip on a bad
 * connection, and a ten-second answer window has no room for a player to read
 * a message, decide, and press a button. They get the button only once the
 * automatic attempt has also failed.
 */
export function useStillStatus(src: string | null): {
  status: StillStatus;
  /**
   * Bump this into the `<img>`'s `key`. A browser will not re-request a `src`
   * that already errored on an element it is still holding, so a retry that
   * only re-runs the probe fixes the message and leaves the picture missing.
   */
  attempt: number;
  retry: () => void;
} {
  const opening = (from: string | null): StillStatus => (from === null ? 'ready' : 'waiting');
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<StillStatus>(() => opening(src));
  const [tracked, setTracked] = useState(src);

  // Reset during render rather than in an effect. A new question is a new
  // picture, and an effect that corrects the state afterwards shows the
  // previous question's still for a frame — on a round where every question is
  // a picture, that frame is the last answer sitting under the new prompt.
  if (tracked !== src) {
    setTracked(src);
    setAttempt(0);
    setStatus(opening(src));
  }

  useEffect(() => {
    if (src === null) return;
    let live = true;
    let retried = false;

    const timer = window.setTimeout(() => {
      if (live) setStatus((was) => (was === 'waiting' ? 'slow' : was));
    }, SAY_SOMETHING_AFTER_MS);

    const probe = (): void => {
      const img = new Image();
      img.onload = () => {
        if (live) setStatus('ready');
      };
      img.onerror = () => {
        if (!live) return;
        if (retried) {
          setStatus('failed');
          return;
        }
        retried = true;
        probe();
      };
      img.src = src;
    };
    probe();

    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [src, attempt]);

  return {
    status,
    attempt,
    retry: () => {
      setAttempt((n) => n + 1);
      setStatus('waiting');
    },
  };
}
