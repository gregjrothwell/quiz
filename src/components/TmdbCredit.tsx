import tmdbLogo from '../assets/tmdb.svg';

/**
 * TMDB's API terms, section 3 (themoviedb.org/api-terms-of-use, fetched
 * 15 October 2026): the licence holds only while the app shows TMDB's logo,
 * less prominent than its own marks, and this notice prominently. Their words,
 * with "website" filled in — not ours to reword.
 *
 * The logo is TMDB's own "alt short" SVG from themoviedb.org/about/logos-attribution,
 * unaltered. See docs/decisions/public-scale.md#the-plan-15-october-2026.
 */
export const TMDB_NOTICE =
  'This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.';

export function TmdbMark() {
  return <img className="tmdb-mark" src={tmdbLogo} alt="TMDB" width={273} height={36} />;
}

/** Under an On the box still: the logo where TMDB's content is on screen. */
export function TmdbStillCredit() {
  return (
    <figcaption className="still__credit still__credit--tmdb">
      Still via <TmdbMark />
    </figcaption>
  );
}

/** The lobby's footer: the full notice, once, where everyone passes it before every round. */
export function TmdbNotice() {
  return (
    <footer className="tmdb-notice">
      <TmdbMark />
      <p>{TMDB_NOTICE}</p>
    </footer>
  );
}
