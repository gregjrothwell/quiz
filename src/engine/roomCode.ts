/**
 * Room codes get read aloud across a Teams call and typed on phones, so the
 * alphabet omits every character pair people confuse: I/1/L, O/0, and Z/2.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXY3456789';
export const ROOM_CODE_LENGTH = 4;

export function randomRoomCode(rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    const index = Math.floor(rng() * ALPHABET.length);
    code += ALPHABET[index] ?? 'A';
  }
  return code;
}

/**
 * Tidies typed input into a candidate code. Characters outside the alphabet are
 * dropped rather than guessed at — a wrong-but-valid code would silently send
 * someone to another room, whereas a short code just fails the length check.
 */
export function normaliseRoomCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => ALPHABET.includes(character))
    .join('');
}

export function isValidRoomCode(input: string): boolean {
  if (input.length !== ROOM_CODE_LENGTH) return false;
  return [...input].every((character) => ALPHABET.includes(character));
}
