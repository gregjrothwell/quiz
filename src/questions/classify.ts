import type { Question, PackId } from './types';

/**
 * The open trivia datasets skew roughly 4:1 towards US-specific content. These
 * three passes are the only quality gate between the raw feed and the game, so
 * they favour precision over recall: a question wrongly kept is a dull moment,
 * a question wrongly dropped costs nothing given the pool size.
 */

const US_ONLY = [
  'nfl',
  'nba',
  'mlb',
  'nhl',
  'nascar',
  'super bowl',
  'world series',
  'stanley cup',
  'baseball',
  'american football',
  'college football',
  'major league',
  'thanksgiving',
  'president of the united states',
  'us president',
  'u.s. president',
  'american president',
  'united states congress',
  'us congress',
  'senator',
  'zip code',
  'social security',
  'ivy league',
  'quarterback',
  'touchdown',
  'home run',
  'nfl team',
];

const UK_MARKERS = [
  'britain',
  'british',
  'england',
  'scotland',
  'scottish',
  'wales',
  'welsh',
  'ireland',
  'irish',
  'london',
  'united kingdom',
  'bbc',
  'itv',
  'premier league',
  'shakespeare',
  'edinburgh',
  'glasgow',
  'manchester',
  'liverpool',
  'yorkshire',
  'cornwall',
  'parliament',
  'prime minister',
  'pound sterling',
  'monarch',
  'queen elizabeth',
  'king charles',
  'thames',
  'eastenders',
  'coronation street',
  'doctor who',
  'monty python',
  'beatles',
  'rolling stones',
  'fa cup',
  'wimbledon',
  'six nations',
  'nhs',
  'royal navy',
  'house of commons',
  'downing street',
  'buckingham',
  'stonehenge',
  'loch ness',
  'oxford',
  'cambridge',

  // Places
  'belfast',
  'cardiff',
  'aberdeen',
  'brighton',
  'bristol',
  'newcastle',
  'nottingham',
  'birmingham',
  'snowdonia',
  'ben nevis',
  "hadrian's wall",
  'big ben',
  'tower of london',
  'trafalgar',
  'piccadilly',
  'wembley',
  'old trafford',

  // Institutions
  'house of lords',
  'westminster',
  'scotland yard',
  'bank of england',
  'royal mail',
  'royal air force',

  // History and politics
  'churchill',
  'thatcher',
  'magna carta',
  'henry viii',
  'cromwell',
  'battle of hastings',
  'gunpowder plot',
  'brexit',

  // Culture
  'dickens',
  'jane austen',
  'orwell',
  'tolkien',
  'rowling',
  'hogwarts',
  'sherlock',
  'james bond',
  'blackadder',
  'fawlty towers',
  'only fools and horses',
  'top gear',
  'blue peter',
  'downton abbey',
  'peaky blinders',

  // Music
  'oasis',
  'pink floyd',
  'led zeppelin',
  'david bowie',
  'elton john',
  'spice girls',
  'radiohead',
  'amy winehouse',

  // Sport
  'cricket',
  'rugby union',
  'snooker',
  'grand national',
  'the ashes',
  'tottenham',
  'arsenal',
];

/** Options that break a game which shuffles answer order. */
const ORDER_DEPENDENT = ['all of the above', 'none of the above', 'both a and b', 'all of these'];

/** Phrases whose answer decays over time. */
const DATE_ROT = ['as of 20', 'this year', 'last year', 'present day', 'reigning'];

/**
 * "current"/"currently" only signals decay when it qualifies a title or record —
 * matching the bare word would strip legitimate questions about electric current.
 */
const CURRENT_TITLE =
  /\bcurrent(?:ly)?\b[^.?!]{0,40}?\b(?:champion|title holder|holder|leader|president|prime minister|monarch|ceo|manager|captain|world record|record holder|number one)\b/i;

function toPattern(terms: string[]): RegExp {
  const escaped = terms.map((term) => {
    const body = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lead = /^\w/.test(term) ? '\\b' : '';
    const tail = /\w$/.test(term) ? '\\b' : '';
    return `${lead}${body}${tail}`;
  });
  return new RegExp(escaped.join('|'), 'i');
}

const US_ONLY_PATTERN = toPattern(US_ONLY);
const UK_PATTERN = new RegExp(toPattern(UK_MARKERS).source, 'gi');
const ORDER_DEPENDENT_PATTERN = toPattern(ORDER_DEPENDENT);
const DATE_ROT_PATTERN = toPattern(DATE_ROT);
const UNRESOLVED_ENTITY = /&(?:[a-z]+|#\d+);/i;

function allText(question: Question): string {
  return [question.question, question.correct, ...question.incorrect].join(' ␟ ');
}

/** What the question is actually *about* — the prompt and the true answer. */
function subjectText(question: Question): string {
  return `${question.question} ␟ ${question.correct}`;
}

/**
 * True when a question is specific enough to the US that UK players would shrug.
 * Reads the distractors too: a wrong answer of "Super Bowl" still marks the whole
 * question as US sports trivia, and over-stripping costs nothing at this pool size.
 */
export function isUsOnly(question: Question): boolean {
  return US_ONLY_PATTERN.test(allText(question));
}

/**
 * Count of distinct British reference points in the question's subject.
 *
 * Deliberately ignores the distractors, unlike {@link isUsOnly}. A British wrong
 * answer does not make a question British — "Who wrote Jurassic Park?" with
 * "Welsh" among the options is not a UK question, and tagging it as one is how
 * the British pack fills up with things nobody would call British.
 */
export function ukScore(question: Question): number {
  const matches = subjectText(question).match(UK_PATTERN);
  if (!matches) return 0;
  return new Set(matches.map((match) => match.toLowerCase())).size;
}

/**
 * Structural soundness. Anything failing this would render broken or unanswerable
 * in the UI, so it is dropped regardless of how interesting it is.
 */
export function isWellFormed(question: Question): boolean {
  const { question: prompt, correct, incorrect } = question;

  if (prompt.trim().length < 10 || prompt.length > 300) return false;
  if (correct.trim().length === 0) return false;
  if (incorrect.length < 1) return false;
  if (incorrect.some((option) => option.trim().length === 0)) return false;

  const options = [correct, ...incorrect].map((option) => option.trim().toLowerCase());
  if (new Set(options).size !== options.length) return false;

  const text = allText(question);
  if (UNRESOLVED_ENTITY.test(text)) return false;
  if (ORDER_DEPENDENT_PATTERN.test(options.join(' '))) return false;
  if (DATE_ROT_PATTERN.test(prompt)) return false;
  if (CURRENT_TITLE.test(prompt)) return false;

  return true;
}

const CATEGORY_TO_PACK: ReadonlyArray<readonly [RegExp, PackId]> = [
  [/^entertainment: music$/i, 'music'],
  [/^entertainment: (film|television)$/i, 'tv-and-film'],
  [/^sports$/i, 'sport'],
  [/^science/i, 'science'],
  [/^history$/i, 'history'],
  [/^geography$/i, 'geography'],
];

/** Which themed pack a question belongs in, by its source category. */
export function packForCategory(category: string): PackId {
  for (const [pattern, packId] of CATEGORY_TO_PACK) {
    if (pattern.test(category)) return packId;
  }
  return 'general-knowledge';
}

export interface SortResult {
  packs: Map<PackId, Question[]>;
  dropped: { malformed: number; usOnly: number };
}

/**
 * Sorts a raw question pool into themed packs. Every kept question lands in
 * exactly one themed pack, and additionally in `uk-leaning` if it carries at
 * least one British reference point.
 */
export function sortIntoPacks(pool: Question[], minUkScore = 1): SortResult {
  const packs = new Map<PackId, Question[]>();
  const dropped = { malformed: 0, usOnly: 0 };

  const push = (packId: PackId, question: Question): void => {
    const existing = packs.get(packId);
    if (existing) existing.push(question);
    else packs.set(packId, [question]);
  };

  for (const question of pool) {
    if (!isWellFormed(question)) {
      dropped.malformed += 1;
      continue;
    }
    if (isUsOnly(question)) {
      dropped.usOnly += 1;
      continue;
    }

    push(packForCategory(question.category), question);
    if (ukScore(question) >= minUkScore) push('uk-leaning', question);
  }

  return { packs, dropped };
}
