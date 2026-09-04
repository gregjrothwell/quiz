/**
 * UK CDPA s.12(2): copyright in a musical work expires at the end of the
 * calendar year 70 years after the author's death. In calendar year T that
 * means authors who died in (T − 71) or earlier. A synth rendition is not a
 * sound recording, so s.13A never applies. Songs: last of the author of the
 * musical work and the lyricist (s.10A, s.12(8)). Traditional / unknown
 * author: s.12(3), s.57.
 *
 * Bump TUNE_RIGHTS_YEAR on 1 January. Do not treat 1956 deaths as PD before
 * 2027. See docs/decisions/round-types.md.
 */

export const TUNE_RIGHTS_YEAR = 2026;

/** Died in this year or earlier → public domain from 1 January of the rights year. */
export function latestPublicDomainDeathYear(year: number = TUNE_RIGHTS_YEAR): number {
  return year - 71;
}

export type TuneRights =
  | { kind: 'traditional' }
  | { kind: 'composed'; authorDied: number; lyricistDied?: number };

/** Last-surviving author died in 1955 or earlier (in 2026), or traditional. */
export function tuneAllowed(rights: TuneRights): boolean {
  if (rights.kind === 'traditional') return true;
  const lastDied = Math.max(rights.authorDied, rights.lyricistDied ?? rights.authorDied);
  return lastDied <= latestPublicDomainDeathYear();
}
