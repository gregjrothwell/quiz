import type { Difficulty } from '../src/questions/types';

export interface ScreenSpec {
  slug: string;
  prompt: string;
  correct: string;
  incorrect: string[];
  difficulty: Difficulty;
  term: string;
  kind: 'movie' | 'tvSeason';
}

const FILM = 'Which film is this?';
const SHOW = 'Which TV show is this?';

export const SCREEN_SPECS: ScreenSpec[] = [
  { slug: 'jaws', prompt: FILM, correct: 'Jaws', incorrect: ['Jurassic Park', 'Alien', 'The Meg'], difficulty: 'easy', term: 'jaws spielberg', kind: 'movie' },
  { slug: 'godfather', prompt: FILM, correct: 'The Godfather', incorrect: ['Goodfellas', 'Scarface', 'The Irishman'], difficulty: 'easy', term: 'the godfather', kind: 'movie' },
  { slug: 'star-wars', prompt: FILM, correct: 'Star Wars', incorrect: ['Star Trek', 'Dune', 'Guardians of the Galaxy'], difficulty: 'easy', term: 'star wars a new hope', kind: 'movie' },
  { slug: 'pulp-fiction', prompt: FILM, correct: 'Pulp Fiction', incorrect: ['Reservoir Dogs', 'Kill Bill', 'The Big Lebowski'], difficulty: 'easy', term: 'pulp fiction', kind: 'movie' },
  { slug: 'matrix', prompt: FILM, correct: 'The Matrix', incorrect: ['Inception', 'Blade Runner', 'Tron'], difficulty: 'easy', term: 'the matrix', kind: 'movie' },
  { slug: 'jurassic-park', prompt: FILM, correct: 'Jurassic Park', incorrect: ['Jaws', 'King Kong', 'Godzilla'], difficulty: 'easy', term: 'jurassic park', kind: 'movie' },
  { slug: 'et', prompt: FILM, correct: 'E.T. the Extra-Terrestrial', incorrect: ['Close Encounters of the Third Kind', 'Super 8', 'The Iron Giant'], difficulty: 'easy', term: 'e.t. the extra-terrestrial', kind: 'movie' },
  { slug: 'back-to-the-future', prompt: FILM, correct: 'Back to the Future', incorrect: ['Bill & Ted’s Excellent Adventure', 'Hot Tub Time Machine', 'Peggy Sue Got Married'], difficulty: 'easy', term: 'back to the future', kind: 'movie' },
  { slug: 'raiders', prompt: FILM, correct: 'Raiders of the Lost Ark', incorrect: ['The Mummy', 'National Treasure', 'Lara Croft: Tomb Raider'], difficulty: 'easy', term: 'raiders of the lost ark', kind: 'movie' },
  { slug: 'alien', prompt: FILM, correct: 'Alien', incorrect: ['Aliens', 'Predator', 'The Thing'], difficulty: 'easy', term: 'alien ridley scott', kind: 'movie' },
  { slug: 'the-shining', prompt: FILM, correct: 'The Shining', incorrect: ['Psycho', 'Misery', 'The Exorcist'], difficulty: 'easy', term: 'the shining kubrick', kind: 'movie' },
  { slug: 'psycho', prompt: FILM, correct: 'Psycho', incorrect: ['The Birds', 'Vertigo', 'The Silence of the Lambs'], difficulty: 'medium', term: 'psycho hitchcock', kind: 'movie' },
  { slug: 'titanic', prompt: FILM, correct: 'Titanic', incorrect: ['The Notebook', 'Pearl Harbor', 'Atonement'], difficulty: 'easy', term: 'titanic cameron', kind: 'movie' },
  { slug: 'inception', prompt: FILM, correct: 'Inception', incorrect: ['The Matrix', 'Interstellar', 'Shutter Island'], difficulty: 'easy', term: 'inception nolan', kind: 'movie' },
  { slug: 'dark-knight', prompt: FILM, correct: 'The Dark Knight', incorrect: ['Batman Begins', 'Joker', 'The Batman'], difficulty: 'easy', term: 'the dark knight nolan', kind: 'movie' },
  { slug: 'forrest-gump', prompt: FILM, correct: 'Forrest Gump', incorrect: ['The Green Mile', 'Cast Away', 'Big'], difficulty: 'easy', term: 'forrest gump', kind: 'movie' },
  { slug: 'fight-club', prompt: FILM, correct: 'Fight Club', incorrect: ['Se7en', 'American Psycho', 'The Game'], difficulty: 'medium', term: 'fight club', kind: 'movie' },
  { slug: 'shawshank', prompt: FILM, correct: 'The Shawshank Redemption', incorrect: ['The Green Mile', 'Escape from Alcatraz', 'Cool Hand Luke'], difficulty: 'easy', term: 'the shawshank redemption', kind: 'movie' },
  { slug: 'goodfellas', prompt: FILM, correct: 'Goodfellas', incorrect: ['The Godfather', 'Casino', 'Donnie Brasco'], difficulty: 'medium', term: 'goodfellas', kind: 'movie' },
  { slug: 'blade-runner', prompt: FILM, correct: 'Blade Runner', incorrect: ['The Matrix', 'Alien', 'Ghost in the Shell'], difficulty: 'medium', term: 'blade runner 1982', kind: 'movie' },
  { slug: '2001', prompt: FILM, correct: '2001: A Space Odyssey', incorrect: ['Interstellar', 'Solaris', 'Moon'], difficulty: 'medium', term: '2001 a space odyssey', kind: 'movie' },
  { slug: 'grease', prompt: FILM, correct: 'Grease', incorrect: ['Dirty Dancing', 'Hairspray', 'West Side Story'], difficulty: 'easy', term: 'grease', kind: 'movie' },
  { slug: 'dirty-dancing', prompt: FILM, correct: 'Dirty Dancing', incorrect: ['Grease', 'Footloose', 'Flashdance'], difficulty: 'easy', term: 'dirty dancing', kind: 'movie' },
  { slug: 'home-alone', prompt: FILM, correct: 'Home Alone', incorrect: ['Mrs. Doubtfire', 'Uncle Buck', 'Dennis the Menace'], difficulty: 'easy', term: 'home alone', kind: 'movie' },
  { slug: 'die-hard', prompt: FILM, correct: 'Die Hard', incorrect: ['Lethal Weapon', 'Speed', 'The Rock'], difficulty: 'easy', term: 'die hard', kind: 'movie' },
  { slug: 'terminator-2', prompt: FILM, correct: 'Terminator 2: Judgment Day', incorrect: ['The Terminator', 'RoboCop', 'Predator'], difficulty: 'easy', term: 'terminator 2 judgment day', kind: 'movie' },
  { slug: 'rocky', prompt: FILM, correct: 'Rocky', incorrect: ['Raging Bull', 'Creed', 'Million Dollar Baby'], difficulty: 'easy', term: 'rocky 1976', kind: 'movie' },
  { slug: 'top-gun', prompt: FILM, correct: 'Top Gun', incorrect: ['Days of Thunder', 'Top Gun: Maverick', 'An Officer and a Gentleman'], difficulty: 'easy', term: 'top gun 1986', kind: 'movie' },
  { slug: 'ghostbusters', prompt: FILM, correct: 'Ghostbusters', incorrect: ['Gremlins', 'Beetlejuice', 'Men in Black'], difficulty: 'easy', term: 'ghostbusters 1984', kind: 'movie' },
  { slug: 'lion-king', prompt: FILM, correct: 'The Lion King', incorrect: ['The Jungle Book', 'Aladdin', 'Tarzan'], difficulty: 'easy', term: 'the lion king 1994', kind: 'movie' },
  { slug: 'toy-story', prompt: FILM, correct: 'Toy Story', incorrect: ['A Bug’s Life', 'Monsters, Inc.', 'Shrek'], difficulty: 'easy', term: 'toy story', kind: 'movie' },
  { slug: 'harry-potter', prompt: FILM, correct: 'Harry Potter and the Philosopher’s Stone', incorrect: ['The Lord of the Rings: The Fellowship of the Ring', 'The Chronicles of Narnia', 'Percy Jackson & the Olympians'], difficulty: 'easy', term: 'harry potter philosophers stone', kind: 'movie' },
  { slug: 'lotr', prompt: FILM, correct: 'The Lord of the Rings: The Fellowship of the Ring', incorrect: ['Harry Potter and the Philosopher’s Stone', 'The Hobbit: An Unexpected Journey', 'Willow'], difficulty: 'easy', term: 'fellowship of the ring', kind: 'movie' },
  { slug: 'frozen', prompt: FILM, correct: 'Frozen', incorrect: ['Tangled', 'Brave', 'Moana'], difficulty: 'easy', term: 'frozen disney', kind: 'movie' },
  { slug: 'mean-girls', prompt: FILM, correct: 'Mean Girls', incorrect: ['Clueless', '10 Things I Hate About You', 'Legally Blonde'], difficulty: 'medium', term: 'mean girls', kind: 'movie' },
  { slug: 'breakfast-club', prompt: FILM, correct: 'The Breakfast Club', incorrect: ['Ferris Bueller’s Day Off', 'Pretty in Pink', 'Sixteen Candles'], difficulty: 'medium', term: 'the breakfast club', kind: 'movie' },
  { slug: 'casablanca', prompt: FILM, correct: 'Casablanca', incorrect: ['Gone with the Wind', 'Citizen Kane', 'Brief Encounter'], difficulty: 'medium', term: 'casablanca', kind: 'movie' },
  { slug: 'friends', prompt: SHOW, correct: 'Friends', incorrect: ['How I Met Your Mother', 'Seinfeld', 'The Big Bang Theory'], difficulty: 'easy', term: 'friends season 1', kind: 'tvSeason' },
  { slug: 'breaking-bad', prompt: SHOW, correct: 'Breaking Bad', incorrect: ['Better Call Saul', 'The Wire', 'Ozark'], difficulty: 'easy', term: 'breaking bad season 1', kind: 'tvSeason' },
  { slug: 'game-of-thrones', prompt: SHOW, correct: 'Game of Thrones', incorrect: ['The Witcher', 'House of the Dragon', 'Vikings'], difficulty: 'easy', term: 'game of thrones season 1', kind: 'tvSeason' },
  { slug: 'stranger-things', prompt: SHOW, correct: 'Stranger Things', incorrect: ['Dark', 'The OA', 'Locke & Key'], difficulty: 'easy', term: 'stranger things season 1', kind: 'tvSeason' },
  { slug: 'the-office-uk', prompt: SHOW, correct: 'The Office', incorrect: ['Peep Show', 'The Inbetweeners', 'Parks and Recreation'], difficulty: 'medium', term: 'the office uk season 1', kind: 'tvSeason' },
  { slug: 'fleabag', prompt: SHOW, correct: 'Fleabag', incorrect: ['Killing Eve', 'Catastrophe', 'I May Destroy You'], difficulty: 'medium', term: 'fleabag season 1', kind: 'tvSeason' },
  { slug: 'peaky-blinders', prompt: SHOW, correct: 'Peaky Blinders', incorrect: ['Boardwalk Empire', 'Gangs of London', 'Taboo'], difficulty: 'medium', term: 'peaky blinders season 1', kind: 'tvSeason' },
  { slug: 'sherlock', prompt: SHOW, correct: 'Sherlock', incorrect: ['Elementary', 'Luther', 'Broadchurch'], difficulty: 'medium', term: 'sherlock bbc season 1', kind: 'tvSeason' },
  { slug: 'doctor-who', prompt: SHOW, correct: 'Doctor Who', incorrect: ['Torchwood', 'Sherlock', 'Merlin'], difficulty: 'easy', term: 'doctor who season 1', kind: 'tvSeason' },
  { slug: 'downton', prompt: SHOW, correct: 'Downton Abbey', incorrect: ['The Crown', 'Bridgerton', 'Upstairs, Downstairs'], difficulty: 'medium', term: 'downton abbey season 1', kind: 'tvSeason' },
  { slug: 'the-crown', prompt: SHOW, correct: 'The Crown', incorrect: ['Downton Abbey', 'The Queen', 'Victoria'], difficulty: 'medium', term: 'the crown season 1', kind: 'tvSeason' },
  { slug: 'line-of-duty', prompt: SHOW, correct: 'Line of Duty', incorrect: ['Bodyguard', 'Happy Valley', 'Broadchurch'], difficulty: 'medium', term: 'line of duty season 1', kind: 'tvSeason' },
  { slug: 'happy-valley', prompt: SHOW, correct: 'Happy Valley', incorrect: ['Line of Duty', 'Broadchurch', 'Scott & Bailey'], difficulty: 'hard', term: 'happy valley season 1', kind: 'tvSeason' },
  { slug: 'only-fools', prompt: SHOW, correct: 'Only Fools and Horses', incorrect: ['The Royle Family', 'Open All Hours', 'Porridge'], difficulty: 'medium', term: 'only fools and horses', kind: 'tvSeason' },
  { slug: 'fawlty-towers', prompt: SHOW, correct: 'Fawlty Towers', incorrect: ['Only Fools and Horses', 'Blackadder', 'Yes Minister'], difficulty: 'medium', term: 'fawlty towers', kind: 'tvSeason' },
  { slug: 'blackadder', prompt: SHOW, correct: 'Blackadder', incorrect: ['Fawlty Towers', 'Red Dwarf', 'The Young Ones'], difficulty: 'medium', term: 'blackadder', kind: 'tvSeason' },
  { slug: 'gavin-and-stacey', prompt: SHOW, correct: 'Gavin & Stacey', incorrect: ['Gimme Gimme Gimme', 'This Country', 'The Inbetweeners'], difficulty: 'medium', term: 'gavin and stacey', kind: 'tvSeason' },
];
