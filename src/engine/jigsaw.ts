/** Locked 4 September 2026. Spec was silent; 3×3 matches the 9s clock lead. */
export const JIGSAW_GRID = 3;
export const JIGSAW_TILES = JIGSAW_GRID * JIGSAW_GRID;

type Rng = () => number;

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) continue;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/**
 * A mulberry32-style generator from a pair of strings every client already
 * holds. Same inputs, same scramble — the rank bonus is otherwise unfair.
 */
export function jigsawRng(questionId: string, gameId: string): Rng {
  let seed = 0;
  const key = `${questionId}\0${gameId}`;
  for (let i = 0; i < key.length; i += 1) {
    seed = Math.imul(seed ^ key.charCodeAt(i), 0x5bd1e995);
    seed = (seed << 13) | (seed >>> 19);
  }
  return () => {
    seed = Math.imul(seed + 0x6d2b79f5, 0x6d2b79f5) >>> 0;
    const t = seed ^ (seed >>> 15);
    return (t >>> 0) / 0x1_0000_0000;
  };
}

/** Piece indices 0..8 in scrambled slot order. Identical on every device. */
export function scrambleTiles(questionId: string, gameId: string): number[] {
  const home = Array.from({ length: JIGSAW_TILES }, (_, index) => index);
  return shuffle(home, jigsawRng(questionId, gameId));
}

/**
 * How many tiles have gone home. Linear across the answer window, so answering
 * early is reading a more scrambled picture — which is the rank bonus doing
 * its job. Reduced motion still uses this count; it just skips the CSS slide.
 */
export function settledTileCount(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return JIGSAW_TILES;
  const elapsed = Math.max(0, Math.min(elapsedMs, durationMs));
  return Math.min(JIGSAW_TILES, Math.floor((elapsed / durationMs) * JIGSAW_TILES));
}

/**
 * Slot → piece after `settled` home pieces have swapped into place.
 *
 * Piece `p` going home swaps with whoever currently occupies slot `p`, so the
 * remaining scramble stays a permutation — no two slots show the same crop.
 */
export function placementAfterSettles(initialPerm: number[], settled: number): number[] {
  const perm = [...initialPerm];
  const limit = Math.max(0, Math.min(settled, perm.length));
  for (let piece = 0; piece < limit; piece += 1) {
    const at = perm.indexOf(piece);
    const occupant = perm[piece];
    if (at < 0 || occupant === undefined) continue;
    perm[piece] = piece;
    perm[at] = occupant;
  }
  return perm;
}

export function tileRow(piece: number): number {
  return Math.floor(piece / JIGSAW_GRID);
}

export function tileColumn(piece: number): number {
  return piece % JIGSAW_GRID;
}
