import type { Answer, QuizQuestion } from './state';

/**
 * Beat the Chaser: the room against Mr Fries (docs/decisions/beat-the-chaser.md).
 *
 * Mr Fries is right about as often as this office is on a question like this
 * one — its pack and difficulty — read from `public/packs/rates.json`, which
 * `npm run fold-rates` folds out of `games/`. Per question is impossible: no
 * question is asked twice, so nothing served next has a history of its own.
 *
 * Everything here is pure. His pick is a hash of the game and the question, so
 * every device's reducer reaches the same pick at the reveal and nobody can
 * steer it.
 */

/** A tally: questions' answers that were right, out of all given. */
export interface Tally {
  hits: number;
  tries: number;
}

/**
 * The office's hit rates. `hits`/`tries` rather than right/answered: the seal
 * test reads any key containing "answer" as an answer, and this file ships in
 * `public/packs/`.
 */
export interface Rates {
  overall: Tally;
  byDifficulty: Record<string, Tally>;
  /** Pack, then difficulty. */
  byPack: Record<string, Record<string, Tally>>;
}

/** Below this many answers a group's rate is noise; fall back a level. */
export const RATE_MIN_TRIES = 30;

/** When there is no file at all: the office's overall rate on 22 October 2026. */
export const FALLBACK_RATE = 0.62;

function rateOf(tally: Tally | undefined): number | null {
  if (!tally || tally.tries < RATE_MIN_TRIES) return null;
  return tally.hits / tally.tries;
}

/** Pack × difficulty, then difficulty, then overall, then the fallback. */
export function rateFor(rates: Rates | null, packId: string, difficulty: string): number {
  if (!rates) return FALLBACK_RATE;
  return (
    rateOf(rates.byPack[packId]?.[difficulty])
    ?? rateOf(rates.byDifficulty[difficulty])
    ?? rateOf(rates.overall)
    ?? FALLBACK_RATE
  );
}

/** FNV-1a, as `coin` in standoff.ts: fair and identical everywhere, not secret. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (const char of text) {
    value ^= char.codePointAt(0) ?? 0;
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

/**
 * Mr Fries's lectern. Right with probability `rate`; when wrong, one of the
 * other options, spread evenly. Two independent draws from one game and
 * question, so his rightness and which wrong answer he gives are unrelated.
 */
export function friesPick(gameId: string, questionId: string, rate: number, correctIndex: number, options: number): number {
  const draw = hash(`${gameId}\0${questionId}\0right`) / 0x1_0000_0000;
  if (draw < rate || options < 2) return correctIndex;
  const wrong = hash(`${gameId}\0${questionId}\0which`) % (options - 1);
  return wrong >= correctIndex ? wrong + 1 : wrong;
}

/**
 * The room takes a question when more than half of those who answered got it
 * right. Nobody answering is nobody's question.
 */
export function roomTakes(answers: Readonly<Record<string, Answer>>, correctIndex: number): boolean {
  const given = Object.values(answers);
  if (given.length === 0) return false;
  const right = given.filter((answer) => answer.optionIndex === correctIndex).length;
  return right * 2 > given.length;
}

export interface ChaserScore {
  room: number;
  fries: number;
}

/** The running score, from the questions the reveal has stamped. */
export function chaserScore(questions: readonly QuizQuestion[]): ChaserScore {
  let room = 0;
  let fries = 0;
  for (const question of questions) {
    if (!question.chaser || question.correctIndex === null) continue;
    if (question.chaser.roomTook) room += 1;
    if (question.chaser.pick === question.correctIndex) fries += 1;
  }
  return { room, fries };
}

/** Reads a rates file, or null when it is not one. */
export function ratesFrom(value: unknown): Rates | null {
  if (typeof value !== 'object' || value === null) return null;
  const { overall, byDifficulty, byPack } = value as Record<string, unknown>;
  const isTally = (tally: unknown): tally is Tally =>
    typeof tally === 'object'
    && tally !== null
    && typeof (tally as Tally).hits === 'number'
    && typeof (tally as Tally).tries === 'number';
  if (!isTally(overall) || typeof byDifficulty !== 'object' || byDifficulty === null || typeof byPack !== 'object' || byPack === null) {
    return null;
  }
  return { overall, byDifficulty: byDifficulty as Rates['byDifficulty'], byPack: byPack as Rates['byPack'] };
}

/** The running score as the room reads it: "The office 3 – 2 Mr Fries". */
export function chaserTally(score: ChaserScore): string {
  return `The office ${String(score.room)} – ${String(score.fries)} Mr Fries`;
}

/** The result at the end of the round. */
export function chaserResult(score: ChaserScore): string {
  if (score.room > score.fries) return `The office beat Mr Fries ${String(score.room)} – ${String(score.fries)}`;
  if (score.fries > score.room) return `Mr Fries wins ${String(score.fries)} – ${String(score.room)}`;
  return `Level with Mr Fries, ${String(score.room)} – ${String(score.fries)}`;
}
