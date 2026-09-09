import type { Difficulty } from '../src/questions/types';

export interface ScreenSpec {
  slug: string;
  prompt: string;
  correct: string;
  incorrect: string[];
  difficulty: Difficulty;
  kind: 'movie' | 'tv';
  query: string;
  year: number;
  /** TMDB `origin_country`, when the title collides (The Office UK vs US). */
  originCountry?: string;
}

const FILM = 'Which film is this?';
const SHOW = 'Which TV show is this?';

/**
 * On the box. Mix of eras for a 2026 UK office — not a wall of 1960s–80s
 * “classics”. Fine Art already did that: PD-Art / Commons selected 15th–1930s
 * paintings because those stills were legal to hash, not because the room would
 * know them. Untitled TMDB backdrops (stills, then a cropped poster) must not
 * make the same call.
 */
export const SCREEN_SPECS: ScreenSpec[] = [
  // A few stills everyone has actually seen.
  { slug: 'jaws', prompt: FILM, correct: 'Jaws', incorrect: ['Jurassic Park', 'The Meg', 'Open Water'], difficulty: 'easy', kind: 'movie', query: 'Jaws', year: 1975 },
  { slug: 'star-wars', prompt: FILM, correct: 'Star Wars', incorrect: ['Star Trek', 'Dune', 'Guardians of the Galaxy'], difficulty: 'easy', kind: 'movie', query: 'Star Wars', year: 1977 },
  { slug: 'back-to-the-future', prompt: FILM, correct: 'Back to the Future', incorrect: ['Bill & Ted’s Excellent Adventure', 'Hot Tub Time Machine', 'Peggy Sue Got Married'], difficulty: 'easy', kind: 'movie', query: 'Back to the Future', year: 1985 },
  { slug: 'home-alone', prompt: FILM, correct: 'Home Alone', incorrect: ['Mrs. Doubtfire', 'Elf', 'The Santa Clause'], difficulty: 'easy', kind: 'movie', query: 'Home Alone', year: 1990 },
  { slug: 'jurassic-park', prompt: FILM, correct: 'Jurassic Park', incorrect: ['Jaws', 'King Kong', 'Godzilla'], difficulty: 'easy', kind: 'movie', query: 'Jurassic Park', year: 1993 },
  { slug: 'lion-king', prompt: FILM, correct: 'The Lion King', incorrect: ['The Jungle Book', 'Madagascar', 'Tarzan'], difficulty: 'easy', kind: 'movie', query: 'The Lion King', year: 1994 },
  { slug: 'toy-story', prompt: FILM, correct: 'Toy Story', incorrect: ['A Bug’s Life', 'Monsters, Inc.', 'Shrek'], difficulty: 'easy', kind: 'movie', query: 'Toy Story', year: 1995 },
  { slug: 'titanic', prompt: FILM, correct: 'Titanic', incorrect: ['The Notebook', 'Pearl Harbor', 'Atonement'], difficulty: 'easy', kind: 'movie', query: 'Titanic', year: 1997 },
  { slug: 'matrix', prompt: FILM, correct: 'The Matrix', incorrect: ['Inception', 'Blade Runner', 'Tron'], difficulty: 'easy', kind: 'movie', query: 'The Matrix', year: 1999 },
  { slug: 'harry-potter', prompt: FILM, correct: 'Harry Potter and the Philosopher’s Stone', incorrect: ['The Lord of the Rings: The Fellowship of the Ring', 'The Chronicles of Narnia', 'Percy Jackson & the Olympians'], difficulty: 'easy', kind: 'movie', query: 'Harry Potter and the Philosopher\'s Stone', year: 2001 },
  { slug: 'lotr', prompt: FILM, correct: 'The Lord of the Rings: The Fellowship of the Ring', incorrect: ['Harry Potter and the Philosopher’s Stone', 'The Hobbit: An Unexpected Journey', 'Willow'], difficulty: 'easy', kind: 'movie', query: 'The Lord of the Rings: The Fellowship of the Ring', year: 2001 },
  { slug: 'shrek', prompt: FILM, correct: 'Shrek', incorrect: ['Shrek 2', 'Monsters, Inc.', 'Ice Age'], difficulty: 'easy', kind: 'movie', query: 'Shrek', year: 2001 },
  { slug: 'love-actually', prompt: FILM, correct: 'Love Actually', incorrect: ['Notting Hill', 'Bridget Jones’s Diary', 'Four Weddings and a Funeral'], difficulty: 'easy', kind: 'movie', query: 'Love Actually', year: 2003 },
  { slug: 'finding-nemo', prompt: FILM, correct: 'Finding Nemo', incorrect: ['Shark Tale', 'The Little Mermaid', 'Happy Feet'], difficulty: 'easy', kind: 'movie', query: 'Finding Nemo', year: 2003 },
  { slug: 'mean-girls', prompt: FILM, correct: 'Mean Girls', incorrect: ['Clueless', '10 Things I Hate About You', 'Legally Blonde'], difficulty: 'medium', kind: 'movie', query: 'Mean Girls', year: 2004 },
  { slug: 'casino-royale', prompt: FILM, correct: 'Casino Royale', incorrect: ['Skyfall', 'Quantum of Solace', 'Die Another Day'], difficulty: 'medium', kind: 'movie', query: 'Casino Royale', year: 2006 },
  { slug: 'mamma-mia', prompt: FILM, correct: 'Mamma Mia!', incorrect: ['Mamma Mia! Here We Go Again', 'Grease', 'The Greatest Showman'], difficulty: 'easy', kind: 'movie', query: 'Mamma Mia', year: 2008 },
  { slug: 'dark-knight', prompt: FILM, correct: 'The Dark Knight', incorrect: ['Batman Begins', 'Joker', 'The Batman'], difficulty: 'easy', kind: 'movie', query: 'The Dark Knight', year: 2008 },
  { slug: 'avatar', prompt: FILM, correct: 'Avatar', incorrect: ['Avatar: The Way of Water', 'Dune', 'Guardians of the Galaxy'], difficulty: 'easy', kind: 'movie', query: 'Avatar', year: 2009 },
  { slug: 'inception', prompt: FILM, correct: 'Inception', incorrect: ['The Matrix', 'Interstellar', 'Tenet'], difficulty: 'easy', kind: 'movie', query: 'Inception', year: 2010 },
  { slug: 'skyfall', prompt: FILM, correct: 'Skyfall', incorrect: ['Casino Royale', 'Spectre', 'No Time to Die'], difficulty: 'medium', kind: 'movie', query: 'Skyfall', year: 2012 },
  { slug: 'hunger-games', prompt: FILM, correct: 'The Hunger Games', incorrect: ['Divergent', 'The Maze Runner', 'Twilight'], difficulty: 'easy', kind: 'movie', query: 'The Hunger Games', year: 2012 },
  { slug: 'frozen', prompt: FILM, correct: 'Frozen', incorrect: ['Tangled', 'Brave', 'Moana'], difficulty: 'easy', kind: 'movie', query: 'Frozen', year: 2013 },
  { slug: 'guardians', prompt: FILM, correct: 'Guardians of the Galaxy', incorrect: ['Thor: Ragnarok', 'Ant-Man', 'The Avengers'], difficulty: 'easy', kind: 'movie', query: 'Guardians of the Galaxy', year: 2014 },
  { slug: 'deadpool', prompt: FILM, correct: 'Deadpool', incorrect: ['Deadpool 2', 'Logan', 'Venom'], difficulty: 'easy', kind: 'movie', query: 'Deadpool', year: 2016 },
  { slug: 'get-out', prompt: FILM, correct: 'Get Out', incorrect: ['Us', 'Nope', 'The Invisible Man'], difficulty: 'medium', kind: 'movie', query: 'Get Out', year: 2017 },
  { slug: 'paddington-2', prompt: FILM, correct: 'Paddington 2', incorrect: ['Paddington', 'Christopher Robin', 'Ted'], difficulty: 'easy', kind: 'movie', query: 'Paddington 2', year: 2017 },
  { slug: 'coco', prompt: FILM, correct: 'Coco', incorrect: ['Encanto', 'The Book of Life', 'Soul'], difficulty: 'easy', kind: 'movie', query: 'Coco', year: 2017 },
  { slug: 'black-panther', prompt: FILM, correct: 'Black Panther', incorrect: ['Black Panther: Wakanda Forever', 'Captain America: Civil War', 'Doctor Strange'], difficulty: 'easy', kind: 'movie', query: 'Black Panther', year: 2018 },
  { slug: 'joker', prompt: FILM, correct: 'Joker', incorrect: ['The Dark Knight', 'The Batman', 'Joker: Folie à Deux'], difficulty: 'medium', kind: 'movie', query: 'Joker', year: 2019 },
  { slug: 'endgame', prompt: FILM, correct: 'Avengers: Endgame', incorrect: ['Avengers: Infinity War', 'The Avengers', 'Spider-Man: No Way Home'], difficulty: 'easy', kind: 'movie', query: 'Avengers Endgame', year: 2019 },
  { slug: 'dune', prompt: FILM, correct: 'Dune', incorrect: ['Dune: Part Two', 'Star Wars', 'Avatar'], difficulty: 'medium', kind: 'movie', query: 'Dune', year: 2021 },
  { slug: 'no-way-home', prompt: FILM, correct: 'Spider-Man: No Way Home', incorrect: ['Spider-Man: Far From Home', 'Avengers: Endgame', 'The Amazing Spider-Man'], difficulty: 'easy', kind: 'movie', query: 'Spider-Man No Way Home', year: 2021 },
  { slug: 'top-gun-maverick', prompt: FILM, correct: 'Top Gun: Maverick', incorrect: ['Top Gun', 'Days of Thunder', 'Mission: Impossible – Fallout'], difficulty: 'easy', kind: 'movie', query: 'Top Gun Maverick', year: 2022 },
  { slug: 'barbie', prompt: FILM, correct: 'Barbie', incorrect: ['Barbie as The Princess and the Pauper', 'The Lego Movie', 'Wicked'], difficulty: 'easy', kind: 'movie', query: 'Barbie', year: 2023 },
  { slug: 'oppenheimer', prompt: FILM, correct: 'Oppenheimer', incorrect: ['The Imitation Game', 'Dunkirk', 'Napoleon'], difficulty: 'medium', kind: 'movie', query: 'Oppenheimer', year: 2023 },

  { slug: 'friends', prompt: SHOW, correct: 'Friends', incorrect: ['How I Met Your Mother', 'Seinfeld', 'The Big Bang Theory'], difficulty: 'easy', kind: 'tv', query: 'Friends', year: 1994 },
  { slug: 'the-office-uk', prompt: SHOW, correct: 'The Office', incorrect: ['Peep Show', 'The Inbetweeners', 'Parks and Recreation'], difficulty: 'medium', kind: 'tv', query: 'The Office', year: 2001, originCountry: 'GB' },
  { slug: 'doctor-who', prompt: SHOW, correct: 'Doctor Who', incorrect: ['Torchwood', 'Sherlock', 'Merlin'], difficulty: 'easy', kind: 'tv', query: 'Doctor Who', year: 2005 },
  { slug: 'gavin-and-stacey', prompt: SHOW, correct: 'Gavin & Stacey', incorrect: ['Gimme Gimme Gimme', 'This Country', 'The Inbetweeners'], difficulty: 'medium', kind: 'tv', query: 'Gavin & Stacey', year: 2007 },
  { slug: 'breaking-bad', prompt: SHOW, correct: 'Breaking Bad', incorrect: ['Better Call Saul', 'The Wire', 'Ozark'], difficulty: 'easy', kind: 'tv', query: 'Breaking Bad', year: 2008 },
  { slug: 'sherlock', prompt: SHOW, correct: 'Sherlock', incorrect: ['Elementary', 'Luther', 'Broadchurch'], difficulty: 'medium', kind: 'tv', query: 'Sherlock', year: 2010 },
  { slug: 'downton', prompt: SHOW, correct: 'Downton Abbey', incorrect: ['The Crown', 'Bridgerton', 'Upstairs, Downstairs'], difficulty: 'medium', kind: 'tv', query: 'Downton Abbey', year: 2010 },
  { slug: 'game-of-thrones', prompt: SHOW, correct: 'Game of Thrones', incorrect: ['The Witcher', 'House of the Dragon', 'Vikings'], difficulty: 'easy', kind: 'tv', query: 'Game of Thrones', year: 2011 },
  { slug: 'line-of-duty', prompt: SHOW, correct: 'Line of Duty', incorrect: ['Bodyguard', 'Happy Valley', 'Broadchurch'], difficulty: 'medium', kind: 'tv', query: 'Line of Duty', year: 2012 },
  { slug: 'peaky-blinders', prompt: SHOW, correct: 'Peaky Blinders', incorrect: ['Boardwalk Empire', 'Gangs of London', 'Taboo'], difficulty: 'medium', kind: 'tv', query: 'Peaky Blinders', year: 2013 },
  { slug: 'happy-valley', prompt: SHOW, correct: 'Happy Valley', incorrect: ['Line of Duty', 'Broadchurch', 'Scott & Bailey'], difficulty: 'hard', kind: 'tv', query: 'Happy Valley', year: 2014 },
  { slug: 'stranger-things', prompt: SHOW, correct: 'Stranger Things', incorrect: ['Dark', 'The OA', 'Wednesday'], difficulty: 'easy', kind: 'tv', query: 'Stranger Things', year: 2016 },
  { slug: 'fleabag', prompt: SHOW, correct: 'Fleabag', incorrect: ['Killing Eve', 'Catastrophe', 'I May Destroy You'], difficulty: 'medium', kind: 'tv', query: 'Fleabag', year: 2016 },
  { slug: 'the-crown', prompt: SHOW, correct: 'The Crown', incorrect: ['Downton Abbey', 'The Queen', 'Victoria'], difficulty: 'medium', kind: 'tv', query: 'The Crown', year: 2016 },
  { slug: 'succession', prompt: SHOW, correct: 'Succession', incorrect: ['Billions', 'Industry', 'The White Lotus'], difficulty: 'medium', kind: 'tv', query: 'Succession', year: 2018 },
  { slug: 'bridgerton', prompt: SHOW, correct: 'Bridgerton', incorrect: ['Downton Abbey', 'The Crown', 'Sanditon'], difficulty: 'easy', kind: 'tv', query: 'Bridgerton', year: 2020 },
  { slug: 'squid-game', prompt: SHOW, correct: 'Squid Game', incorrect: ['Alice in Borderland', 'The Traitors', 'Money Heist'], difficulty: 'easy', kind: 'tv', query: 'Squid Game', year: 2021 },
  { slug: 'wednesday', prompt: SHOW, correct: 'Wednesday', incorrect: ['Stranger Things', 'The Addams Family', 'Locke & Key'], difficulty: 'easy', kind: 'tv', query: 'Wednesday', year: 2022 },
];
