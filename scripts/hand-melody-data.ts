/**
 * Melody pack source for the melody-only writer.
 *
 * Voice sequences and the 1956 rights live with the specs in
 * `src/questions/melody-voices.ts` so `write-hand-packs` still emits the full
 * pack if someone runs it for pictures. This file is the melody entry point.
 */

export {
  MELODY_SPECS,
  type MelodySpec,
} from '../src/questions/melody-voices';

export const MELODY_PACK_TITLE = 'Name that Tune';
export const MELODY_PACK_BLURB = 'Public-domain melodies, played by the house synth.';

/** Lobby default in `ROUND_LENGTHS`. Three nights without a repeat need 3× this. */
export const MELODY_ROUND_LENGTH = 15;
export const MELODY_MIN_PACK = MELODY_ROUND_LENGTH * 3;
