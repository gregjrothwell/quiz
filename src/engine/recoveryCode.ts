import { ALPHABET } from './roomCode';

/**
 * The code that moves an identity onto another browser.
 *
 * Same alphabet as a room code, and for the same reason: it gets read aloud and
 * typed on a phone, so every pair people confuse — I/1/L, O/0, Z/2 — is already
 * missing from it.
 *
 * Eight characters rather than four. A room code only has to be unique among the
 * rooms alive this afternoon and is worthless an hour later; this one is a
 * standing capability over somebody's season row, so the guess-space matters.
 * Eight over 29 symbols is about 5×10¹¹, against a room code's 707,281.
 */
export const RECOVERY_CODE_LENGTH = 8;

export function randomRecoveryCode(rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i += 1) {
    const index = Math.floor(rng() * ALPHABET.length);
    code += ALPHABET[index] ?? 'A';
  }
  return code;
}

/**
 * Tidies typed input into a candidate code. Characters outside the alphabet are
 * dropped rather than guessed at — including the hyphen the code is *displayed*
 * with, so pasting it back in the form it was read in works.
 */
export function normaliseRecoveryCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => ALPHABET.includes(character))
    .join('');
}

export function isValidRecoveryCode(input: string): boolean {
  if (input.length !== RECOVERY_CODE_LENGTH) return false;
  return [...input].every((character) => ALPHABET.includes(character));
}

/**
 * How the code is shown, never how it is stored. Eight characters in one run is
 * a string people lose their place in halfway through reading it out.
 */
export function formatRecoveryCode(code: string): string {
  const half = RECOVERY_CODE_LENGTH / 2;
  return `${code.slice(0, half)}-${code.slice(half)}`;
}
