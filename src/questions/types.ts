export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

/** How many questions a pack holds at each level. */
export type DifficultyCounts = Record<Difficulty, number>;

/**
 * What the lobby needs to describe a pack without downloading it. The
 * per-difficulty counts are what let the picker disable a level a pack cannot
 * fill, rather than silently serving a shorter round.
 */
export interface PackSummary {
  id: PackId;
  title: string;
  blurb: string;
  count: number;
  counts: DifficultyCounts;
}

export const PACK_IDS = [
  'general-knowledge',
  'uk-leaning',
  'video-games',
  'mixed-bag',
  'music',
  'tv-and-film',
  'sport',
  'science',
  'history',
  'geography',
] as const;

export type PackId = (typeof PACK_IDS)[number];

/**
 * A question as harvested, with its answer. **Only the build scripts ever see
 * this shape.** Nothing under `src/` outside this file may name `correct`: the
 * whole point of the vault is that a player's device never holds the answer,
 * and a type that cannot travel is the cheapest way to keep that true.
 */
export interface Question {
  id: string;
  question: string;
  correct: string;
  incorrect: string[];
  category: string;
  difficulty: Difficulty;
  /**
   * Which corpus it came from. Only the Open Trivia DB half carries a real
   * difficulty rating, so a pack that has to be trimmed keeps those first —
   * dropping them would empty the easy and hard buckets and leave the level
   * picker offering rounds it cannot fill. Never published: `sealQuestion`
   * builds its result field by field, so this stays in the build scripts.
   */
  source: QuestionSource;
}

export type QuestionSource = 'opentdb' | 'opentriviaqa';

/**
 * A question as published. The four options are there; which one is right is
 * not, and is not derivable — the options are written in a fixed sorted order
 * so their position carries no signal either.
 *
 * The answer lives in the `vault` collection in Firestore, which no client can
 * read. See docs/HANDOVER.md.
 */
export interface SealedQuestion {
  id: string;
  question: string;
  options: string[];
  category: string;
  difficulty: Difficulty;
}

/** Puts the options in an order that says nothing about which one is right. */
export function sealQuestion(question: Question): SealedQuestion {
  return {
    id: question.id,
    question: question.question,
    options: [question.correct, ...question.incorrect].sort((a, b) => a.localeCompare(b)),
    category: question.category,
    difficulty: question.difficulty,
  };
}

export interface Pack {
  id: PackId;
  title: string;
  blurb: string;
  questions: SealedQuestion[];
}

export const PACK_META: Record<PackId, { title: string; blurb: string }> = {
  'general-knowledge': {
    title: 'General Knowledge',
    blurb: 'Proper general knowledge. The safe opener.',
  },
  'uk-leaning': {
    title: 'Best of British',
    blurb: 'Questions that land better on this side of the Atlantic.',
  },
  'video-games': { title: 'Video Games', blurb: 'Consoles, classics and boss fights.' },
  'mixed-bag': { title: 'Odds & Ends', blurb: 'Books, anime and everything unfiled.' },
  music: { title: 'Music', blurb: 'Chart history, bands and one-hit wonders.' },
  'tv-and-film': { title: 'TV & Film', blurb: 'The box and the big screen.' },
  sport: { title: 'Sport', blurb: 'Pitches, tracks and podiums.' },
  science: { title: 'Science', blurb: 'Nature, numbers and machines.' },
  history: { title: 'History', blurb: 'Everything that already happened.' },
  geography: { title: 'Geography', blurb: 'Places, borders and capitals.' },
};
