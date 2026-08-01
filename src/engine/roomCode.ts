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

/**
 * The code carried by a join link, or null if the hash is not one.
 *
 * Kept deliberately strict: an invalid code returns null rather than
 * half-filling the field, because a partly-populated box someone then types
 * into is how you end up joining a room nobody meant to be in.
 */
export function codeFromHash(hash: string): string | null {
  const match = /^#\/j\/([^/?]+)$/.exec(hash);
  if (!match?.[1]) return null;

  const code = normaliseRoomCode(decodeURIComponent(match[1]));
  return isValidRoomCode(code) ? code : null;
}

/** The link a QR code points at, for a phone joining without typing. */
export function joinLink(origin: string, basePath: string, code: string): string {
  return `${origin}${basePath}#/j/${code}`;
}
