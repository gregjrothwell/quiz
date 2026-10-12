/**
 * Checks every Blankety Blank phrase against its source, in both directions:
 * the phrase must be there, and no distractor put in the blank may be.
 *
 *   npm run blanks-check
 *
 * A saying is a Wiktionary entry title, so the check is whether the page
 * exists; a distractor that makes another existing title is a real variant,
 * which would be a second right answer. A slogan or catchphrase must appear in
 * its Wikipedia article's text; a distractor that also appears there is
 * refused for the same reason.
 *
 * Live, so it stays out of `npm test`. Greg plays this round blind: the report
 * names slugs and option numbers, never a phrase or a word from one.
 *
 * Before believing any verdict it checks itself against two answers it already
 * knows — one entry that exists and one that does not (docs/decisions/
 * blankety-blank.md, probed 6 October 2026). A checker that cannot tell those
 * apart would condemn or pass the whole pack for the wrong reason.
 */

import { normalisePhrase, substitute, wholeWordIndices } from './blanks-core';
import { BLANK_SPECS, type BlankSpec } from './hand-blanks-data';

const USER_AGENT = 'VibeQuiz/0.1 (https://github.com/gregjrothwell/quiz; pack builder)';
const WIKTIONARY = 'https://en.wiktionary.org/w/api.php';
const WIKIPEDIA = 'https://en.wikipedia.org/w/api.php';
/** The MediaWiki API's ceiling on titles per query for an anonymous client. */
const TITLES_PER_QUERY = 50;

/** Known answers, not in the pack, so the canary spoils nothing. */
const CANARY = {
  exists: 'every cloud has a silver lining',
  missing: 'every cloud has a silver spoon',
};

export type Verdict =
  | { slug: string; ok: true }
  | { slug: string; ok: false; reason: string };

interface QueryPage {
  title: string;
  missing?: string;
  invalid?: string;
  extract?: string;
}

interface QueryResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: Record<string, QueryPage>;
  };
}

async function api(base: string, params: Record<string, string>): Promise<QueryResponse> {
  const url = `${base}?${new URLSearchParams({ format: 'json', formatversion: '1', ...params })}`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} from ${base}`);
  return (await response.json()) as QueryResponse;
}

/** Which of `titles` are Wiktionary pages, as asked (before any normalisation). */
async function wiktionaryExists(titles: string[]): Promise<Map<string, boolean>> {
  const found = new Map<string, boolean>();
  for (let start = 0; start < titles.length; start += TITLES_PER_QUERY) {
    const batch = titles.slice(start, start + TITLES_PER_QUERY);
    const body = await api(WIKTIONARY, { action: 'query', titles: batch.join('|') });
    const renamed = new Map((body.query?.normalized ?? []).map((entry) => [entry.from, entry.to]));
    const byTitle = new Map(
      Object.values(body.query?.pages ?? {}).map((page) => [page.title, page] as const),
    );
    for (const title of batch) {
      const page = byTitle.get(renamed.get(title) ?? title);
      if (!page) throw new Error('A title came back with no page at all; the query is not doing what it says');
      found.set(title, page.missing === undefined && page.invalid === undefined);
    }
  }
  return found;
}

/** A Wikipedia article's plain text, following redirects, or null if there is no such page. */
async function wikipediaText(title: string): Promise<string | null> {
  const body = await api(WIKIPEDIA, {
    action: 'query',
    prop: 'extracts',
    explaintext: '1',
    redirects: '1',
    titles: title,
  });
  const page = Object.values(body.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined || page.invalid !== undefined) return null;
  return page.extract ?? '';
}

/** Whether `phrase` is in `text`, both folded the same way. */
export function textSays(text: string, phrase: string): boolean {
  return wholeWordIndices(normalisePhrase(text), normalisePhrase(phrase)).length > 0;
}

/** The verdict on a quoted spec, given its source text. Pure, so it is tested offline. */
export function quotedVerdict(spec: BlankSpec, text: string | null): Verdict {
  if (text === null) return { slug: spec.slug, ok: false, reason: 'source article does not exist' };
  if (!textSays(text, spec.phrase)) return { slug: spec.slug, ok: false, reason: 'phrase not found in source' };
  const variants = spec.incorrect
    .map((option, index) => (textSays(text, substitute(spec.phrase, spec.answer, option)) ? index + 1 : 0))
    .filter((index) => index > 0);
  if (variants.length > 0) {
    return { slug: spec.slug, ok: false, reason: `distractor ${variants.join(', ')} also in source` };
  }
  return { slug: spec.slug, ok: true };
}

/** The verdict on a saying, given which titles exist. Pure, so it is tested offline. */
export function sayingVerdict(spec: BlankSpec, exists: Map<string, boolean>): Verdict {
  if (exists.get(spec.source.title) !== true) {
    return { slug: spec.slug, ok: false, reason: 'not a Wiktionary entry' };
  }
  const variants = spec.incorrect
    .map((option, index) => (exists.get(substitute(spec.phrase, spec.answer, option)) === true ? index + 1 : 0))
    .filter((index) => index > 0);
  if (variants.length > 0) {
    return { slug: spec.slug, ok: false, reason: `distractor ${variants.join(', ')} is also an entry` };
  }
  return { slug: spec.slug, ok: true };
}

async function canary(): Promise<void> {
  const found = await wiktionaryExists([CANARY.exists, CANARY.missing]);
  if (found.get(CANARY.exists) !== true || found.get(CANARY.missing) !== false) {
    throw new Error('Canary failed: the checker cannot tell a known entry from a known non-entry');
  }
}

async function main(): Promise<void> {
  await canary();
  console.log('canary: a known entry exists and a known non-entry does not');

  const sayings = BLANK_SPECS.filter((spec) => spec.kind === 'saying');
  const titles = sayings.flatMap((spec) => [
    spec.source.title,
    ...spec.incorrect.map((option) => substitute(spec.phrase, spec.answer, option)),
  ]);
  const exists = await wiktionaryExists(titles);
  const verdicts: Verdict[] = sayings.map((spec) => sayingVerdict(spec, exists));

  const texts = new Map<string, string | null>();
  for (const spec of BLANK_SPECS.filter((candidate) => candidate.kind !== 'saying')) {
    if (!texts.has(spec.source.title)) texts.set(spec.source.title, await wikipediaText(spec.source.title));
    verdicts.push(quotedVerdict(spec, texts.get(spec.source.title) ?? null));
  }

  const failed = verdicts.filter((verdict): verdict is Extract<Verdict, { ok: false }> => !verdict.ok);
  for (const verdict of failed) console.log(`  ${verdict.slug}: ${verdict.reason}`);
  console.log(
    `${verdicts.length - failed.length}/${verdicts.length} pass ` +
      `(${sayings.length} sayings on Wiktionary, ${verdicts.length - sayings.length} on Wikipedia, ` +
      `${texts.size} articles)`,
  );
  if (failed.length > 0) process.exitCode = 1;
}

const runningDirect = process.argv[1]?.includes('blanks-check') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('blanks-check failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
