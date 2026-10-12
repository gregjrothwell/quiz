/**
 * The pure half of the Blankety Blank pack: where the blank goes, what the
 * room sees, and the text folding the source check and the Catchphrase overlap
 * test both search with. No network, no files — `blanks-check.ts` and
 * `write-blanks-pack.ts` do that. See docs/decisions/blankety-blank.md.
 */

export type BlankKind = 'saying' | 'slogan' | 'catchphrase';

/** What the room sees in place of the missing word. */
export const BLANK = '_____';

/** A letter or digit, in any script. */
function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char);
}

/**
 * Where `word` stands alone in `text`, case-insensitively.
 *
 * Not a `\b` regex: an answer like a dropped-g word ends in an apostrophe, and
 * `\b` sees no boundary between an apostrophe and a space. The test is only
 * that the characters either side are not letters or digits.
 */
export function wholeWordIndices(text: string, word: string): number[] {
  const haystack = text.toLowerCase();
  const needle = word.toLowerCase();
  const found: number[] = [];
  if (needle.length === 0) return found;

  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + 1)) {
    const before = haystack[at - 1];
    const after = haystack[at + needle.length];
    if (isWordChar(needle[0]) && isWordChar(before)) continue;
    if (isWordChar(needle[needle.length - 1]) && isWordChar(after)) continue;
    found.push(at);
  }
  return found;
}

function onlyIndex(phrase: string, answer: string): number {
  const indices = wholeWordIndices(phrase, answer);
  if (indices.length !== 1) {
    throw new Error(`The answer must stand in the phrase exactly once, found ${indices.length}`);
  }
  return indices[0] as number;
}

/** The phrase with `option` where the answer was. Everything else is untouched. */
export function substitute(phrase: string, answer: string, option: string): string {
  const at = onlyIndex(phrase, answer);
  return `${phrase.slice(0, at)}${option}${phrase.slice(at + answer.length)}`;
}

/**
 * The question as the room sees it.
 *
 * A saying is the phrase itself with its first letter raised — Wiktionary
 * titles are lower case. A slogan or catchphrase is quoted, with its clue (the
 * brand, the character, the show) in front when the phrase does not already
 * name it.
 */
export function blankedQuestion(spec: {
  phrase: string;
  answer: string;
  clue?: string;
  kind?: BlankKind;
}): string {
  const blanked = substitute(spec.phrase, spec.answer, BLANK);
  if (spec.kind === undefined || spec.kind === 'saying') {
    return `${blanked.charAt(0).toUpperCase()}${blanked.slice(1)}`;
  }
  const quoted = `“${blanked}”`;
  return spec.clue ? `${spec.clue}: ${quoted}` : quoted;
}

/**
 * Text folded for searching: lower case, curly apostrophes straightened, every
 * run of other punctuation and space collapsed to one space. Apostrophes
 * survive, so a dropped-g word still matches itself; a source that quotes a
 * phrase in single quotes still matches, because `wholeWordIndices` does not
 * count an apostrophe as part of a word.
 */
export function normalisePhrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .trim();
}

/**
 * Whether either phrase contains the other as whole words, ignoring case and
 * punctuation. A single shared word does not count — "the" would clash with
 * everything — so the shorter side must be two words or more.
 */
export function overlapsWith(a: string, b: string): boolean {
  const left = normalisePhrase(a);
  const right = normalisePhrase(b);
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (shorter.split(' ').length < 2) return false;
  return wholeWordIndices(longer, shorter).length > 0;
}
