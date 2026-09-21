/**
 * Which album covers print their own title.
 *
 * The problem this exists for, from the round played on 21 September 2026
 * (`53FN`): eleven of its fifteen sleeves had the answer written on the
 * picture. All four *hard* questions whose cover carried its title scored
 * 100%; the one hard question with a wordless cover — Björk, Vespertine —
 * scored 50%. The difficulty rating was decorative, because the cover was the
 * answer key.
 *
 * It is not a curation mistake so much as an edition one. The specs name an
 * album; iTunes GB returns whatever *edition* it has, and a reissue prints the
 * title on artwork the original never had. Pink Floyd's The Wall is a bare
 * brick wall; the mzstatic art for it reads "PINK FLOYD THE WALL".
 *
 * Everything here is pure and works on text somebody else read off the image.
 * Getting that text is `sleeve-audit.ts`'s job — the same split as
 * `title-in-clip.ts` and `tune-title-audit.ts`, and for the same reason: the
 * part worth testing must run offline.
 *
 * **OCR misreads by shape, where a transcriber misheard by sound.** That is why
 * this does not reuse `phonetic()` from `title-in-clip.ts`, which flattens
 * vowels because a singer bends them. Apple's Vision returned "NEVERNINO" for
 * Nevermind, "STADTUM ARCADTUM" for Stadium Arcadium, "EACK TO BLACK" for Back
 * to Black and "RINK FLOYP" for Pink Floyd — every one of those is a letter
 * swapped for another that looks like it, and an edit-distance ratio on the
 * plain letters handles them without a fold that would also start matching
 * things that merely rhyme.
 */

import { foldWord, similarity, words } from './title-in-clip';

/**
 * A title word short enough that finding it on a cover means nothing.
 *
 * "Is", "It", "In", "Kid" turn up on sleeves for a hundred reasons that
 * are not the title. Anything from four letters up is distinctive enough that
 * its appearance is the answer being handed over: seeing DESTRUCTION on a cover
 * settles Appetite for Destruction against Back in Black, Nevermind and Use
 * Your Illusion I without the player knowing one thing about the artwork.
 */
const DISTINCTIVE_LETTERS = 4;

/**
 * How close a single word has to be before OCR noise stops being an excuse.
 *
 * Vision read Illmatic as "ill matic" and Nevermind as "nevernino". Both are
 * the word, badly — "nevernino" scores 0.78 against Nevermind and "ill matic"
 * joins to 1.00. 0.75 takes both and leaves "destruction" clear of anything
 * that is not destruction. Titles of three letters or fewer are not left to
 * this at all; they are the phrase rule's business.
 */
const WORD_MATCH = 0.75;

/**
 * How close the whole title has to be to a run of cover text.
 *
 * Scaled by length, as in `thresholdFor`, and for one extra reason particular
 * to covers: a one-word title against a cover crowded with label text is a
 * lottery. "21" would match any cover with a two-digit number anywhere on it,
 * which is why a short title leans on this and a long one does not need to.
 */
export function coverThresholdFor(titleWords: number): number {
  if (titleWords <= 1) return 0.86;
  if (titleWords === 2) return 0.74;
  return 0.7;
}

export interface CoverVerdict {
  /** True when a player reading the picture can see the answer. */
  givesItAway: boolean;
  /** 0 to 1 — how much of the title, by weight of letters, is on the cover. */
  score: number;
  /** What was found, so a human can check the machine's homework. */
  matched: string;
  /** Which rule fired. `phrase` is the whole title; `word` is part of it. */
  rule: 'none' | 'word' | 'phrase';
}

const NOTHING: CoverVerdict = { givesItAway: false, score: 0, matched: '', rule: 'none' };

/** Every cover word, plus each adjacent pair joined, for tokens OCR split. */
function coverTokens(coverText: string): string[] {
  const list = words(coverText);
  const joined = list.slice(0, -1).map((word, i) => word + list[i + 1]);
  return [...list, ...joined];
}

/**
 * The whole title, matched against a run of cover text of about its length.
 *
 * Slid rather than compared end to end, because the title is almost never all
 * a cover says. "DAVID BOWIE ALADDİN SANE" is the artist and then the title;
 * "25th ANNIVERSARY LEGACY EDITION The Clash CALLING" is a sticker, the band,
 * and half the title in a different corner. Comparing the two strings whole
 * scores both low and calls a cover clean that is telling the player the answer
 * in capitals.
 */
function phraseHit(target: string[], stream: string[]): CoverVerdict {
  const key = target.join('');
  const threshold = coverThresholdFor(target.length);
  const sizes = [...new Set([Math.max(1, target.length - 1), target.length, target.length + 1])];

  let best = NOTHING;
  for (const size of sizes) {
    for (let i = 0; i + size <= stream.length; i += 1) {
      const window = stream.slice(i, i + size);
      const score = similarity(key, window.join(''));
      if (score > best.score) {
        best = {
          givesItAway: score >= threshold,
          score: Math.round(score * 100) / 100,
          matched: window.join(' '),
          rule: score >= threshold ? 'phrase' : 'none',
        };
      }
    }
  }
  return best;
}

/**
 * Any distinctive word of the title, found anywhere on the cover.
 *
 * The rule the phrase match could not express, and the one that catches most of
 * what a person would call a giveaway. A cover rarely prints the title neatly
 * in one run: Sgt. Pepper's is on a drum skin that Vision read as "LONELY
 * HEARTS", London Calling came back as a sticker and the word "CALLING",
 * Ziggy Stardust lost "fall of" in the middle. None of those is close to the
 * whole title and every one of them hands the answer over.
 *
 * Deliberately biased towards rejecting. A cover wrongly refused costs one
 * album out of a list that can be lengthened; a cover wrongly kept costs a
 * question, and fifteen of those cost the round that was already played.
 */
function wordHit(target: string[], tokens: string[]): CoverVerdict {
  const letters = target.join('').length;
  const found: string[] = [];
  let weight = 0;

  for (const word of target) {
    if (word.length < DISTINCTIVE_LETTERS) continue;
    const hit = tokens.find((token) => similarity(word, token) >= WORD_MATCH);
    if (hit === undefined) continue;
    found.push(hit);
    weight += word.length;
  }
  if (found.length === 0) return NOTHING;
  return {
    givesItAway: true,
    score: letters === 0 ? 0 : Math.round((weight / letters) * 100) / 100,
    matched: found.join(' '),
    rule: 'word',
  };
}

/** Whether `coverText` — everything read off the artwork — names `title`. */
export function titleOnCover(title: string, coverText: string): CoverVerdict {
  const target = words(title);
  if (target.length === 0 || coverText.trim().length === 0) return NOTHING;

  const tokens = coverTokens(coverText);
  if (tokens.length === 0) return NOTHING;

  const byWord = wordHit(target, tokens);
  if (byWord.givesItAway) return byWord;

  const byPhrase = phraseHit(target, words(coverText));
  return byPhrase.givesItAway ? byPhrase : { ...byPhrase, givesItAway: false, rule: 'none' };
}

/**
 * Whether the cover names the artist.
 *
 * Reported, never gated on by itself. In most of this pack the four options are
 * albums by one artist, so the name on the cover tells a player nothing — but
 * not all of them are: the Back in Black question offers Appetite for
 * Destruction and Nevermind alongside it, and there the band's name narrows
 * four to one. That is a judgement about the *options*, which is a person's job
 * and not a matcher's, so the audit prints it and leaves it.
 */
export function artistOnCover(artist: string, coverText: string): boolean {
  return titleOnCover(artist, coverText).givesItAway;
}

/**
 * How badly the artist's name may be read and still be recognised as the
 * artist's name.
 *
 * Loose on purpose. Vision returned "davlorowie" for David Bowie and
 * "wrafhouse" for Winehouse, and a cover whose only text is the band's name
 * badly read is a cover whose only text is the band's name. Striking it out
 * tightly leaves the misreading behind to be counted as something the cover
 * says, which then fails a perfectly good sleeve for the artist being on it.
 */
const ARTIST_FOLD = 0.6;

/**
 * How many letters of unexplained text a cover may carry.
 *
 * Measured on 143 covers, 21 September 2026. After the artist's name is struck
 * out, the distribution is not a gradient — it is two clumps. Thirty-one covers
 * have **nothing** left; a handful carry a short garbled fragment ("meniege",
 * "cluks", "rcad", up to seven letters); and everything above that is a cover
 * with real words on it. Eight sits in the gap.
 *
 * This is the rule that catches what the title matcher cannot. Vision read
 * Kendrick's good kid, m.A.A.d city as "jo00 k d aao city ag orteilte 3y
 * vemorio lartar" and Purple Rain as "pustetain phucstane the fevolation" —
 * both covers print their title, both are mangled past any matcher, and both
 * are plainly *covered in writing*. A round that asks "name the album from the
 * cover" cannot use a cover that is talking, whatever it is saying.
 */
const NOISE_ALLOWANCE = 8;

/** The cover's words, with the artist's name struck out. */
function beyondTheArtist(artist: string, coverText: string): string[] {
  const name = words(artist);
  const joined = name.join('');
  return words(coverText).filter(
    (word) =>
      !name.some((part) => similarity(part, word) >= ARTIST_FOLD)
      && similarity(joined, word) < ARTIST_FOLD,
  );
}

export interface SleeveVerdict {
  publishable: boolean;
  /** Empty when publishable; otherwise why it was refused, for the log. */
  why: string;
}

/**
 * Whether a sleeve can be published — the one call the pack builder makes.
 *
 * Two rules, and the second is not a backstop for the first so much as a
 * different question. The title matcher asks *does the cover say the answer*;
 * the busy rule asks *is the cover saying anything at all*. A quiz that shows a
 * picture and asks what it is has no use for a picture with writing on it, and
 * the writing does not have to be legible to a machine to be legible to Bret.
 */
export function sleeveVerdict(
  title: string,
  artist: string,
  coverText: string,
): SleeveVerdict {
  /*
    A one-character title is refused, because nothing can check it.

    Ed Sheeran's `+`, `x`, `÷` and `=` are the case, and they are not an edge
    one — the glyph *is* the artwork, so those covers show their title at a size
    nothing else on this list manages. `titleOnCover` had no opinion on them:
    `words('÷')` is empty, which read as "clean" when it meant "no idea". Vision
    read that sleeve as "divide" and the gate passed it anyway.

    Two characters rather than one letter, deliberately. On letters alone `x`
    survives and `÷` does not, which is the same question answered two ways on
    the accident of Unicode — and all four are really one kind of question,
    "match the glyph", that this round cannot police. Adele's `21` and `25`
    clear it: they are two characters, and their covers are portraits.
  */
  if (words(title).join('').length < 2) {
    return { publishable: false, why: 'title is a single glyph, so the cover cannot be checked' };
  }
  const named = titleOnCover(title, coverText);
  if (named.givesItAway) {
    return { publishable: false, why: `cover names the album — “${named.matched}”` };
  }
  const rest = beyondTheArtist(artist, coverText);
  const letters = rest.join('').length;
  if (letters > NOISE_ALLOWANCE) {
    return { publishable: false, why: `${letters} letters of text on the cover — “${rest.join(' ')}”` };
  }
  return { publishable: true, why: '' };
}

/** Everything Vision read, as one string, dropping the runs it was unsure of. */
export function joinCoverText(
  lines: readonly { text: string; confidence: number }[],
  floor = 0.3,
): string {
  return lines
    .filter((line) => line.confidence >= floor)
    .map((line) => foldWord(line.text))
    .join(' ')
    .trim();
}
