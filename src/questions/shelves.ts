/**
 * Which shelf of the lobby a pack sits on, and in what order.
 *
 * The lobby listed packs in `index.json` order, which is harvest order: the ten
 * text-trivia packs first and the rounds the office plays last, in one wall of
 * identical cards. Measured 20 October 2026 over the last 60 kept rounds
 * (`read-games -- --last 60`): 45 were a show round — Random Round 9, On the
 * box 8, Name that Tune 8, Catchphrase 8, Sleeves 6, then the rest — and 15
 * were text trivia.
 *
 * So the show rounds come first, most played first, and trivia keeps the
 * index's order underneath. A pack on neither list is trivia: a new harvested
 * pack lands where the others like it are, and a new show round has to be
 * placed here on purpose.
 */

import type { PackId, PackSummary } from './types';

export const SHOW_ROUNDS: readonly PackId[] = [
  'random',
  'survey',
  'screens',
  'tunes',
  'catchphrase',
  'sleeves',
  'artists',
  'blanks',
  'prices',
  'tags',
  // Higher or Lower, 25 October 2026: beside the two price rounds.
  'higher',
  'picture',
  'flags',
  'melody',
];

/** The one card drawn wide, as the lobby's way in. */
export const FEATURED_PACK: PackId = 'random';

export interface Shelf {
  id: 'show' | 'trivia';
  label: string;
  packs: PackSummary[];
}

/** The lobby's shelves, empty ones left out. */
export function shelvePacks(packs: readonly PackSummary[]): Shelf[] {
  const show = SHOW_ROUNDS.flatMap((id) => packs.filter((pack) => pack.id === id));
  const trivia = packs.filter((pack) => !SHOW_ROUNDS.includes(pack.id));
  const shelves: Shelf[] = [
    { id: 'show', label: 'Show rounds', packs: show },
    { id: 'trivia', label: 'Straight trivia', packs: trivia },
  ];
  return shelves.filter((shelf) => shelf.packs.length > 0);
}
