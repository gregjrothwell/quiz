/**
 * Picture-round types. Specs and answers live in
 * `scripts/hand-picture-data.ts` so the app bundle cannot import them.
 *
 * Source URLs are fetched once at pack-build. The published pack carries only
 * a content-hashed filename under `public/packs/images/`.
 */

export interface StillSpec {
  slug: string;
  prompt: string;
  correct: string;
  incorrect: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  /** Commons filename, Met object id, or a direct NASA/Commons URL. */
  source: StillSource;
  /**
   * On-screen credit when the licence requires it. Absent for PD-Art / CC0 /
   * NASA PD-USGov — those live in ATTRIBUTION.md only.
   */
  credit?: string;
  attribution: string;
  /** Survives a 3×3 scramble. Salisbury is the one still that does not. */
  jigsaw?: boolean;
}

export type StillSource =
  | { kind: 'commons'; file: string }
  | { kind: 'met'; objectId: number }
  | { kind: 'url'; href: string };
