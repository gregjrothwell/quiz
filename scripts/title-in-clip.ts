/**
 * Where a song says its own name.
 *
 * The problem this exists for, from the round played on 10 September 2026:
 * "A few of the clips also had the title of the song in them very obviously."
 * Apple picks a track's 30-second preview to be its most recognisable stretch,
 * which for a lot of pop is the chorus, which is exactly where the title gets
 * sung — so the clip that is easiest to place is often the one that answers
 * itself.
 *
 * Everything here is pure and works on a transcript. Getting the transcript is
 * `tune-title-audit.ts`'s job.
 *
 * **A transcript of singing is not a transcript of speech.** Whisper mishears
 * the proper nouns hardest, and the proper noun is usually the title — small.en
 * heard "Sweet Caroline, good times" as "The sweet, terrible life", which is
 * why the match below is phonetic and fuzzy rather than a string compare, and
 * why the audit runs a model big enough to get most of them right in the first
 * place.
 */

/** Words too common to carry any of a title's identity. */
const STOP = new Set(['the', 'a', 'an']);

export function foldWord(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .trim();
}

export function words(value: string): string[] {
  return foldWord(value)
    .split(/\s+/)
    .filter((word) => word.length > 0 && !STOP.has(word));
}

/**
 * A coarse phonetic fold — the distinctions a singer blurs and a transcriber
 * then guesses at.
 *
 * Consonants that share a sound are collapsed, and every vowel becomes the
 * same vowel: a sung vowel is stretched and bent until the transcriber is
 * guessing at it, and "Come on Eileen" coming back as "come on and" is that
 * guess. **The vowels are flattened, not dropped.** Dropping them was the
 * first attempt and it destroys short words — "hey" and "hate" both become
 * "h", and then everything that starts with an h matches everything else that
 * does.
 */
export function phonetic(value: string): string {
  const letters = value.replace(/[^a-z]/g, '');
  if (letters.length === 0) return '';
  return letters
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/gh/g, '')
    .replace(/wh/g, 'w')
    .replace(/c/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/z/g, 's')
    .replace(/[aeiouy]/g, 'a')
    .replace(/(.)\1+/g, '$1');
}

export function phoneticKey(list: string[]): string {
  return list.map(phonetic).join('');
}

/** Levenshtein distance, iterative with a single row. */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitute = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1);
      row[j] = Math.min(row[j - 1]! + 1, previous[j]! + 1, substitute);
    }
    previous = row;
  }
  return previous[b.length]!;
}

export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - distance(a, b) / longest;
}

/**
 * How close a run of transcript has to be before it counts as the title.
 *
 * Scaled by length because a one-word title is a coin toss otherwise: "Torn"
 * against a mumbled "born", "Creep" against "keep". A four-word title cannot
 * turn up by accident, so it can afford to be heard badly.
 */
export function thresholdFor(titleWords: number): number {
  if (titleWords <= 1) return 0.92;
  if (titleWords === 2) return 0.74;
  return 0.66;
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface TitleHit {
  start: number;
  end: number;
  score: number;
  /** What the transcriber actually heard there, for a human to sanity-check. */
  heard: string;
}

/** Every moment in the clip where the title is (probably) sung. */
export function titleHits(title: string, transcript: TranscriptWord[]): TitleHit[] {
  const target = words(title);
  if (target.length === 0) return [];
  const key = phoneticKey(target);
  const threshold = thresholdFor(target.length);

  // Articles come out of the transcript as well as out of the title, or the
  // two sides stop lining up: "The Whole of the Moon" is three words once its
  // articles are gone, and a three-word window over a stream that still has
  // them is "whole of the".
  const stream = transcript
    .map((entry) => ({ ...entry, folded: foldWord(entry.word).replace(/\s+/g, '') }))
    .filter((entry) => entry.folded.length > 0 && !STOP.has(entry.folded));

  const found: TitleHit[] = [];
  for (let i = 0; i + target.length <= stream.length; i += 1) {
    const window = stream.slice(i, i + target.length);
    const score = similarity(key, phoneticKey(window.map((entry) => entry.folded)));
    if (score < threshold) continue;
    found.push({
      start: window[0]!.start,
      end: window[window.length - 1]!.end,
      score: Math.round(score * 100) / 100,
      heard: window.map((entry) => entry.folded).join(' '),
    });
  }

  // Overlapping windows around one sung line are one hit, not four.
  const merged: TitleHit[] = [];
  for (const hit of found.sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && hit.start <= last.end + 0.25) {
      last.end = Math.max(last.end, hit.end);
      if (hit.score > last.score) {
        last.score = hit.score;
        last.heard = hit.heard;
      }
      continue;
    }
    merged.push({ ...hit });
  }
  return merged;
}

export interface ClipChoice {
  previewStart: number;
  /** Undefined means play out — nothing to cut. */
  previewSeconds?: number;
  verdict: 'clean' | 'trimmed' | 'shifted' | 'unavoidable';
  note: string;
}

/** A hair of air before the word, because `timeupdate` only fires ~4×/second. */
const LEAD = 0.4;

export interface ClipOptions {
  /** The answer window the round is played on. */
  window?: number;
  /** How long the preview runs. Apple's are 30s. */
  clip?: number;
  /**
   * Shorter than this is not a clip worth playing, however clean it is.
   *
   * Eight seconds, and the number comes from the melody round: 3.5 seconds of
   * audio and 11.5 of silence on a fifteen-second question is what emptied the
   * room on 8 September. A trim has to leave over half the question with music
   * in it; anything shorter shifts instead, which fills the whole question at
   * the cost of Apple's chosen opening. That is the trade, and it is only worth
   * making when the trim would be a stub.
   */
  minimum?: number;
}

/**
 * Picks where a clip should start and stop, given where the title is sung.
 *
 * Trimming is preferred over shifting, and deliberately: Apple's opening is the
 * most recognisable part of the track, so cutting the end keeps the half that
 * makes the question answerable and loses the half that was answering it.
 * Shifting is the fallback for a title sung too early to leave a clip worth
 * playing, and it costs recognisability — which is the failure the round
 * already had once, when eight people walked out of a melody round nobody
 * could place.
 */
export function chooseClip(hits: TitleHit[], options: ClipOptions = {}): ClipChoice {
  const window = options.window ?? 15;
  const clip = options.clip ?? 30;
  const minimum = options.minimum ?? 8;

  const inPlay = hits.filter((hit) => hit.start < window).sort((a, b) => a.start - b.start);
  if (inPlay.length === 0) {
    return { previewStart: 0, verdict: 'clean', note: 'title never sung inside the window' };
  }

  const first = inPlay[0]!;
  if (first.start - LEAD >= minimum) {
    const seconds = Math.round((first.start - LEAD) * 10) / 10;
    return {
      previewStart: 0,
      previewSeconds: seconds,
      verdict: 'trimmed',
      note: `title at ${first.start.toFixed(1)}s — stop at ${seconds}s`,
    };
  }

  // Too early to trim around. Start after the last early mention instead, and
  // stop again if the next one lands before the window is up.
  const early = inPlay.filter((hit) => hit.start - LEAD < minimum);
  const start = Math.round((early[early.length - 1]!.end + LEAD) * 10) / 10;
  const next = hits.find((hit) => hit.start > start);
  const room = Math.min(clip, next ? next.start - LEAD : clip) - start;
  if (room < minimum) {
    return {
      previewStart: 0,
      verdict: 'unavoidable',
      note: `title at ${inPlay.map((hit) => `${hit.start.toFixed(1)}s`).join(', ')} — no clip of ${minimum}s avoids it`,
    };
  }
  const seconds = Math.round(Math.min(room, window) * 10) / 10;
  return {
    previewStart: start,
    ...(next ? { previewSeconds: seconds } : {}),
    verdict: 'shifted',
    note: `title at ${first.start.toFixed(1)}s — start at ${start}s`
      + (next ? `, stop after ${seconds}s` : ''),
  };
}
