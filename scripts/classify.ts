import type { Question, PackId } from '../src/questions/types';

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

  // Franchises, which is how most US sport questions actually refer to it —
  // naming the league is the exception. The list above caught about 80% of the
  // obvious US sport in the OpenTriviaQA pool; these are what it left behind.
  // Named with their city wherever the nickname is also an ordinary English
  // word, which is most of them. A bare "vikings" cost us Lindisfarne and the
  // Danelaw; "raiders" cost us Raiders of the Lost Ark, "pirates" the Disneyland
  // ride, "cubs" the answer to what a baby shark is called, and "mariners" the
  // Ancient Mariner. Roughly 370 questions, none of them about American sport.
  'yankees',
  'dodgers',
  'red sox',
  'white sox',
  'chicago cubs',
  'new york mets',
  'atlanta braves',
  'baltimore orioles',
  'philadelphia phillies',
  'san diego padres',
  'seattle mariners',
  'miami marlins',
  'milwaukee brewers',
  'pittsburgh pirates',
  'colorado rockies',
  'houston astros',
  'toronto blue jays',
  'celtics',
  'lakers',
  'knicks',
  'chicago bulls',
  'dallas cowboys',
  'green bay packers',
  'pittsburgh steelers',
  'new england patriots',
  '49ers',
  'denver broncos',
  'miami dolphins',
  'las vegas raiders',
  'oakland raiders',
  'seattle seahawks',
  'minnesota vikings',
  'cincinnati bengals',
  'los angeles chargers',
  'san diego chargers',
  'ncaa',
  'heisman',
  'little league',
  'softball',
  'kentucky derby',
  'indy 500',
  'daytona',

  // City-and-nickname rather than the nickname alone, because the nicknames
  // collide with things worth keeping: Rangers is a Glasgow football club,
  // Giants and Kings are ordinary words, and Phoenix is a bird.
  'sacramento kings',
  'phoenix suns',
  'philadelphia eagles',
  'san francisco giants',
  'cleveland cavaliers',
  'detroit pistons',
  'milwaukee bucks',
  'indiana pacers',
  'atlanta hawks',
  'miami heat',
  'orlando magic',
  'utah jazz',
  'denver nuggets',
  'san antonio spurs',
  'oklahoma city thunder',
  'minnesota timberwolves',
  'new orleans pelicans',
  'memphis grizzlies',
  'portland trail blazers',
  'houston rockets',
  'dallas mavericks',
  'brooklyn nets',
  'toronto raptors',
  'washington wizards',
  'charlotte hornets',
  'chicago bears',
  'green bay',
  'kansas city chiefs',
  'buffalo bills',
  'cleveland browns',
  'baltimore ravens',
  'tennessee titans',
  'arizona cardinals',
  'carolina panthers',
  'new orleans saints',
  'tampa bay',
  'detroit lions',

  // The structural vocabulary of American sport, which travels even worse than
  // the teams: a UK player has no idea what a division or a draft pick is.
  'all-star',
  'all star',
  'mvp',
  'most valuable player',
  'hall of fame',
  'rookie',
  'draft pick',
  'drafted by',
  'linebacker',
  'wide receiver',
  'running back',
  'point guard',
  'power forward',
  'shortstop',
  'outfielder',
  'designated hitter',
  'free throw',
  'slam dunk',
  'field goal',
  'end zone',
  'final four',
  'march madness',
  'varsity',
  'eastern conference',
  'western conference',
  'atlantic division',
  'immaculate reception',
  'back to back super bowl',

  // States, minus the ones a British player could actually place. California,
  // Texas, New York and Florida are common cultural currency here and stay;
  // Delaware and Nebraska are the ones that make a question unanswerable rather
  // than merely American. Also skipped: Georgia, Washington, Virginia, Indiana
  // and Montana, each of which collides with something we want to keep.
  'alabama',
  'alaska',
  'arkansas',
  'connecticut',
  'delaware',
  'idaho',
  'illinois',
  'iowa',
  'kansas',
  'kentucky',
  'louisiana',
  'massachusetts',
  'michigan',
  'minnesota',
  'mississippi',
  'missouri',
  'nebraska',
  'new hampshire',
  'new jersey',
  'new mexico',
  'north dakota',
  'ohio',
  'oklahoma',
  'oregon',
  'pennsylvania',
  'rhode island',
  'south dakota',
  'tennessee',
  'utah',
  'vermont',
  'wisconsin',
  'wyoming',

  // Civics and schooling, which travel worst of all — there is no British
  // equivalent of a sophomore or a state bird to reason from.
  'electoral college',
  'bill of rights',
  'state capital',
  'state bird',
  'state flower',
  'governor of',
  'confederate',
  'house of representatives',
  'fourth of july',
  'memorial day',
  'labor day',
  'groundhog day',
  'valedictorian',
  'sophomore',
  'freshman year',
  'junior high',
  'high school senior',
  'sorority',
  'fraternity',

  // Domestic television. Hollywood travels; daytime schedules do not.
  'saturday night live',
  'wheel of fortune',
  'the tonight show',
  'daytime emmy',
  'nickelodeon',
  'espn',
  'nbc',
  'cbs',
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

/**
 * Sports with a following in Britain. A question routed to the sport pack has to
 * name one of these to stay.
 *
 * This is the only pack filtered positively, because it is the only one where
 * the source is overwhelmingly about a version of the subject that does not
 * travel. OpenTriviaQA's `sports` file is mostly American, and stripping it by
 * exclusion was a losing game: three passes of adding leagues, franchises and
 * positional vocabulary each caught more and each left a long tail — the last
 * of them defeated by the source having stripped an apostrophe, so that "NBAs"
 * slipped past a pattern that matches "NBA".
 *
 * Inverting it is both shorter and stricter. It costs volume, which the pool can
 * afford: what survives is several times the 125 questions the pack held before,
 * and all of it is about a sport somebody in the room follows.
 */
const UK_SPORTS = [
  'football',
  'soccer',
  'premier league',
  'fa cup',
  'world cup',
  'cricket',
  'the ashes',
  'rugby',
  'six nations',
  'tennis',
  'wimbledon',
  'golf',
  'the open',
  'ryder cup',
  'boxing',
  'formula one',
  'formula 1',
  'grand prix',
  'olympic',
  'olympics',
  'commonwealth games',
  'athletics',
  'marathon',
  'snooker',
  'darts',
  'horse racing',
  'grand national',
  'cycling',
  'tour de france',
  'swimming',
  'rowing',
  'boat race',
  'netball',
  'hockey',
  'badminton',
  'squash',
  'sailing',
  'equestrian',
  'triathlon',
  'gymnastics',
  'fencing',
  'archery',
  'judo',
  'taekwondo',
  'wrestling',
  'motorsport',
  'rally',
  'skiing',
  'figure skating',
  'referee',
  'goalkeeper',
  'penalty',
  'midfielder',
  'striker',
  'batsman',
  'bowler',
  'wicket',
  'scrum',
  'knockout',
  'heavyweight',
  'champion',
  'medal',
  'stadium',
  'team',
  'player',
  'league',
  'tournament',
  'match',
  'coach',
  'athlete',
  'fifa',
  'uefa',
  'batsmen',
  'matches',
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

/**
 * Word-boundary matching, tolerant of a trailing plural.
 *
 * The `s?` is load-bearing rather than tidy. Without it `\bsuper bowl\b` misses
 * "Super Bowls" and `\bteam\b` misses "teams" — and questions are asked in the
 * plural at least as often as the singular, so an intact-looking list quietly
 * catches half of what it names. It let American football through the sport
 * filter twice before it was spotted.
 */
function toPattern(terms: string[]): RegExp {
  const escaped = terms.map((term) => {
    const body = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lead = /^\w/.test(term) ? '\\b' : '';
    const tail = /\w$/.test(term) ? 's?\\b' : '';
    return `${lead}${body}${tail}`;
  });
  return new RegExp(escaped.join('|'), 'i');
}

const US_ONLY_PATTERN = toPattern(US_ONLY);
const UK_SPORTS_PATTERN = toPattern(UK_SPORTS);
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
/**
 * True when a sport question is about a sport followed in Britain.
 *
 * Reads the distractors as well as the subject, like {@link isUsOnly} and unlike
 * {@link ukScore}: a question whose options are four football clubs is a
 * football question however the prompt is worded.
 */
export function isUkRelevantSport(question: Question): boolean {
  return UK_SPORTS_PATTERN.test(allText(question));
}

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
  // Matched explicitly. Falling through to general-knowledge made that pack
  // 68% video-game questions, so picking "General Knowledge" mostly served
  // something else entirely.
  [/^general knowledge$/i, 'general-knowledge'],
  [/^entertainment: video games$/i, 'video-games'],
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
  // Anything with no themed home of its own, rather than being passed off as
  // general knowledge.
  return 'mixed-bag';
}

export interface SortResult {
  packs: Map<PackId, Question[]>;
  dropped: { malformed: number; usOnly: number; capped: number; offTopicSport: number };
}

/**
 * How many questions a pack may hold.
 *
 * Not a storage limit — a limit on what the quizmaster's device downloads.
 * `loadPackQuestions` fetches the whole pack JSON to pick fifteen questions, so
 * an uncapped pack is a download at the top of every round: the full
 * OpenTriviaQA import would put 10,000 questions and about 2 MB into `mixed-bag`
 * alone. At roughly 209 bytes a question this keeps every pack near 300 kB, in
 * line with the 237 kB `video-games` already ships.
 *
 * It also keeps the vault seedable in one pass. Every question needs a vault
 * document and the free tier allows 20,000 writes a day, so an uncapped import
 * would span two days and leave the game half-answerable in between.
 */
export const PACK_CAP = 1500;

/**
 * Trims a pack to {@link PACK_CAP}, keeping the rated questions first.
 *
 * Open Trivia DB questions carry a real difficulty; OpenTriviaQA questions do
 * not and are all marked medium. Trimming those first would be the wrong way
 * round — it would thin the only questions the easy and hard levels can draw on,
 * to make room for questions neither level will ever serve.
 *
 * Within a source the order is by id, which is a hash of the prompt: arbitrary,
 * but stable across runs. A re-harvest that shuffled its selection would orphan
 * vault entries and need a re-seed for no gain.
 */
export function capPack(questions: Question[], cap = PACK_CAP): Question[] {
  if (questions.length <= cap) return questions;

  const rank = (question: Question): number => (question.source === 'opentdb' ? 0 : 1);
  return [...questions]
    .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))
    .slice(0, cap);
}

/**
 * Sorts a raw question pool into themed packs. Every kept question lands in
 * exactly one themed pack, and additionally in `uk-leaning` if it carries at
 * least one British reference point.
 */
export function sortIntoPacks(pool: Question[], minUkScore = 1, cap = PACK_CAP): SortResult {
  const packs = new Map<PackId, Question[]>();
  const dropped = { malformed: 0, usOnly: 0, capped: 0, offTopicSport: 0 };

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

    const packId = packForCategory(question.category);

    // Dropped outright rather than moved to mixed-bag: a question filed under
    // sport that names no sport anyone here follows is American sport the
    // exclusion list missed, and it is no more wanted in the catch-all pack.
    if (packId === 'sport' && !isUkRelevantSport(question)) {
      dropped.offTopicSport += 1;
      continue;
    }

    push(packId, question);
    if (ukScore(question) >= minUkScore) push('uk-leaning', question);
  }

  for (const [packId, questions] of packs) {
    const trimmed = capPack(questions, cap);
    dropped.capped += questions.length - trimmed.length;
    packs.set(packId, trimmed);
  }

  return { packs, dropped };
}
