export type Difficulty = 'easy' | 'medium' | 'hard';

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

export interface Question {
  id: string;
  question: string;
  correct: string;
  incorrect: string[];
  category: string;
  difficulty: Difficulty;
}

export interface Pack {
  id: PackId;
  title: string;
  blurb: string;
  questions: Question[];
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
