import type { Difficulty } from '../src/questions/types';

/**
 * Theme Tunes — name the programme from its theme. **Greg plays this blind.**
 *
 * Slugs are `theme-NNN`, the row of the candidate list measured on 24 October
 * 2026 (`.cache/tv-themes/`), so a test failure or a build log names a number,
 * never a programme. Keep it that way: nothing outside this file names one.
 * See docs/decisions/tv-themes.md.
 */
export interface ThemeSpec {
  slug: string;
  correct: string;
  incorrect: string[];
  difficulty: Difficulty;
  /** Credited artist of the original recording, as the GB store has it. */
  artist: string;
  /** The recording's own title — often not the programme's. */
  track: string;
  /** Measured by `npm run tune-audit -- --pack themes`, not guessed. */
  previewStart?: number;
  previewSeconds?: number;
}

export const THEMES_ROUND_LENGTH = 15;
export const THEMES_MIN_PACK = THEMES_ROUND_LENGTH * 3;
export const THEME_PROMPT = 'Which programme is this the theme to?';

/** The search a spec resolves with: the recording, then who made it. */
export function themeTerm(spec: ThemeSpec): string {
  return `${spec.track} ${spec.artist}`;
}

/**
 * Originals only (D1, Greg, 24 October 2026). American programmes are the
 * world-famous ones, and at most one in six (`hand-pack-quality.test.ts`).
 *
 * Cut by the title audit, 24 October 2026, and left out on purpose: theme-046
 * sings its title three times in fifteen seconds, and no eight-second clip
 * avoids it; theme-085 shouts its title through the whole clip, which whisper
 * heard as nothing at all — a transcriber's silence is not a clean clip.
 */
/**
 * Played, and taken out by Greg, 2 November 2026 (PROJ-96). Kept in the specs and
 * skipped by the writer, so the list says which and nothing says what. theme-041
 * is credited right but is an arrangement from the artist's own album that the
 * office heard as a random song; theme-034 and theme-077 share its three flags
 * (titled with only the programme's name, a non-soundtrack genre, an album with
 * no TV or theme words). A metadata pass, not a listen.
 *
 * The other eighteen, same day: a private review of the names and metadata
 * (nobody listened) judged 018 the wrong recording, nine an arrangement or era a
 * British viewer would not know (001, 014, 037, 039, 043, 047, 059, 072, 089), and
 * eight impossible to tell without a listen (007, 013, 015, 017, 044, 062, 063,
 * 064). Greg: drop the lot and find more.
 *
 * theme-101 to theme-128 were found the same day, privately, to replace them.
 * Seven of those the finder was not sure of (104, 110, 111, 112, 114, 118, 120)
 * go too, on the same rule: unsure is out.
 */
export const THEMES_DROPPED: ReadonlySet<string> = new Set([
  'theme-001',
  'theme-007',
  'theme-013',
  'theme-014',
  'theme-015',
  'theme-017',
  'theme-018',
  'theme-034',
  'theme-037',
  'theme-039',
  'theme-041',
  'theme-043',
  'theme-044',
  'theme-047',
  'theme-059',
  'theme-062',
  'theme-063',
  'theme-064',
  'theme-072',
  'theme-077',
  'theme-089',
  'theme-104',
  'theme-110',
  'theme-111',
  'theme-112',
  'theme-114',
  'theme-118',
  'theme-120',
]);

export const THEME_SPECS: ThemeSpec[] = [
  { slug: 'theme-001', correct: 'EastEnders', incorrect: ['Coronation Street', 'Emmerdale', 'Brookside'], difficulty: 'easy', artist: 'Simon May', track: 'EastEnders' },
  { slug: 'theme-003', correct: 'Doctor Who', incorrect: ["Blake's 7", 'Red Dwarf', 'The Tomorrow People'], difficulty: 'easy', artist: 'Ron Grainer', track: 'Doctor Who' },
  { slug: 'theme-005', correct: 'Neighbours', incorrect: ['Home and Away', 'Prisoner: Cell Block H', 'The Flying Doctors'], difficulty: 'easy', artist: 'Barry Crocker', track: 'Neighbours', previewStart: 2.5, previewSeconds: 10.6 },
  { slug: 'theme-006', correct: 'Grange Hill', incorrect: ['Byker Grove', 'Press Gang', "Tucker's Luck"], difficulty: 'medium', artist: 'Alan Hawkshaw', track: 'Chicken Man' },
  { slug: 'theme-007', correct: 'Countdown', incorrect: ['Blockbusters', 'Fifteen to One', '3-2-1'], difficulty: 'easy', artist: 'Alan Hawkshaw', track: 'Countdown' },
  { slug: 'theme-008', correct: 'Match of the Day', incorrect: ['Grandstand', 'Football Focus', 'Sportsnight'], difficulty: 'easy', artist: 'Barry Stoller', track: 'Match of the Day' },
  { slug: 'theme-009', correct: 'Grandstand', incorrect: ['World of Sport', 'Sportsnight', 'Ski Sunday'], difficulty: 'hard', artist: 'Keith Mansfield', track: 'Grandstand' },
  { slug: 'theme-011', correct: 'Top Gear', incorrect: ['Fifth Gear', 'Wheeler Dealers', "Tomorrow's World"], difficulty: 'easy', artist: 'The Allman Brothers Band', track: 'Jessica' },
  { slug: 'theme-012', correct: 'The Bill', incorrect: ['Casualty', 'Juliet Bravo', "London's Burning"], difficulty: 'medium', artist: 'Charlie Morgan', track: 'Overkill' },
  { slug: 'theme-013', correct: 'Blackadder', incorrect: ['Red Dwarf', 'The Young Ones', 'Bottom'], difficulty: 'medium', artist: 'Howard Goodall', track: 'Blackadder' },
  { slug: 'theme-014', correct: 'Mr. Bean', incorrect: ['The Thin Blue Line', 'Blackadder', "Not the Nine O'Clock News"], difficulty: 'medium', artist: 'Howard Goodall', track: 'Mr. Bean' },
  { slug: 'theme-015', correct: 'The Vicar of Dibley', incorrect: ['Keeping Up Appearances', 'Last of the Summer Wine', 'Ballykissangel'], difficulty: 'medium', artist: 'Howard Goodall', track: 'Vicar of Dibley' },
  { slug: 'theme-016', correct: 'Thunderbirds', incorrect: ['Joe 90', 'Space: 1999', 'Terrahawks'], difficulty: 'easy', artist: 'Barry Gray', track: 'Thunderbirds' },
  { slug: 'theme-017', correct: 'Captain Scarlet', incorrect: ['Joe 90', 'Stingray', 'Terrahawks'], difficulty: 'hard', artist: 'Barry Gray', track: 'Captain Scarlet', previewStart: 10.6, previewSeconds: 11.8 },
  { slug: 'theme-018', correct: 'Stingray', incorrect: ['Fireball XL5', 'Joe 90', 'Captain Scarlet'], difficulty: 'hard', artist: 'Barry Gray', track: 'Stingray' },
  { slug: 'theme-019', correct: 'The Avengers', incorrect: ['The Saint', 'The Persuaders!', 'Department S'], difficulty: 'hard', artist: 'Laurie Johnson', track: 'The Avengers' },
  { slug: 'theme-020', correct: 'The Professionals', incorrect: ['The Sweeney', 'Dempsey and Makepeace', 'Bergerac'], difficulty: 'medium', artist: 'Laurie Johnson', track: 'The Professionals' },
  { slug: 'theme-022', correct: 'Minder', incorrect: ['Auf Wiedersehen, Pet', 'Only Fools and Horses', 'Boon'], difficulty: 'medium', artist: 'Dennis Waterman', track: 'I Could Be So Good for You' },
  { slug: 'theme-023', correct: 'Inspector Morse', incorrect: ['A Touch of Frost', 'Taggart', 'Dalziel and Pascoe'], difficulty: 'medium', artist: 'Barrington Pheloung', track: 'Inspector Morse' },
  { slug: 'theme-024', correct: 'Midsomer Murders', incorrect: ['Rosemary & Thyme', 'Heartbeat', 'Pie in the Sky'], difficulty: 'medium', artist: 'Jim Parker', track: 'Midsomer Murders' },
  { slug: 'theme-029', correct: "Dad's Army", incorrect: ["It Ain't Half Hot Mum", "'Allo 'Allo!", 'Hi-de-Hi!'], difficulty: 'easy', artist: 'Bud Flanagan', track: 'Who Do You Think You Are Kidding Mr. Hitler' },
  { slug: 'theme-030', correct: 'Steptoe and Son', incorrect: ['Till Death Us Do Part', 'Porridge', 'Rising Damp'], difficulty: 'hard', artist: 'Ron Grainer', track: 'Old Ned' },
  { slug: 'theme-034', correct: 'One Foot in the Grave', incorrect: ['Keeping Up Appearances', 'Last of the Summer Wine', 'Waiting for God'], difficulty: 'medium', artist: 'Eric Idle', track: 'One Foot in the Grave', previewSeconds: 11.1 },
  { slug: 'theme-036', correct: 'The Office', incorrect: ['The Thick of It', 'Gavin & Stacey', 'Extras'], difficulty: 'medium', artist: 'Big George', track: 'Handbags and Gladrags' },
  { slug: 'theme-037', correct: 'Father Ted', incorrect: ['Black Books', 'Spaced', 'Ballykissangel'], difficulty: 'medium', artist: 'The Divine Comedy', track: 'Songs of Love' },
  { slug: 'theme-039', correct: 'Absolutely Fabulous', incorrect: ['French and Saunders', 'Birds of a Feather', 'Men Behaving Badly'], difficulty: 'medium', artist: 'Julie Driscoll', track: "This Wheel's on Fire" },
  { slug: 'theme-041', correct: 'Blue Peter', incorrect: ['Magpie', "Why Don't You?", 'Multi-Coloured Swap Shop'], difficulty: 'easy', artist: 'Mike Oldfield', track: 'Blue Peter' },
  { slug: 'theme-043', correct: 'Fireman Sam', incorrect: ['Postman Pat', 'Bob the Builder', 'Camberwick Green'], difficulty: 'easy', artist: 'Fireman Sam', track: 'Fireman Sam' },
  { slug: 'theme-044', correct: 'Bob the Builder', incorrect: ['Fireman Sam', 'Postman Pat', 'Thomas the Tank Engine'], difficulty: 'easy', artist: 'Bob the Builder', track: 'Can We Fix It', previewStart: 6.8, previewSeconds: 12.6 },
  { slug: 'theme-047', correct: 'BBC News', incorrect: ['ITV News', 'Sky News', 'Channel 4 News'], difficulty: 'medium', artist: 'David Lowe', track: 'BBC News' },
  { slug: 'theme-048', correct: 'News at Ten', incorrect: ['BBC Six O’Clock News', 'Newsnight', 'Channel 4 News'], difficulty: 'medium', artist: 'Johnny Pearson', track: 'The Awakening' },
  { slug: 'theme-050', correct: 'Mastermind', incorrect: ['University Challenge', 'Fifteen to One', 'The Weakest Link'], difficulty: 'easy', artist: 'Neil Richardson', track: 'Approaching Menace' },
  { slug: 'theme-055', correct: 'Top of the Pops', incorrect: ['The Old Grey Whistle Test', 'The Tube', 'Ready Steady Go!'], difficulty: 'medium', artist: 'CCS', track: 'Whole Lotta Love' },
  { slug: 'theme-057', correct: 'Wimbledon', incorrect: ['Grandstand', 'Ski Sunday', 'Pot Black'], difficulty: 'hard', artist: 'Keith Mansfield', track: 'Light and Tune' },
  { slug: 'theme-058', correct: 'Test Match Special', incorrect: ['A Question of Sport', 'Sportsnight', 'Football Focus'], difficulty: 'medium', artist: "Booker T. & the M.G.'s", track: 'Soul Limbo' },
  { slug: 'theme-059', correct: 'Formula One', incorrect: ['Top Gear', 'Grandstand', 'Sportsnight'], difficulty: 'easy', artist: 'Fleetwood Mac', track: 'The Chain' },
  { slug: 'theme-060', correct: 'Emmerdale', incorrect: ['Coronation Street', 'Crossroads', 'Heartbeat'], difficulty: 'medium', artist: 'Tony Hatch', track: 'Emmerdale' },
  { slug: 'theme-061', correct: 'Crossroads', incorrect: ['Emmerdale', 'Coronation Street', 'Brookside'], difficulty: 'medium', artist: 'Tony Hatch', track: 'Crossroads' },
  { slug: 'theme-062', correct: 'Peaky Blinders', incorrect: ['Line of Duty', 'Ripper Street', 'Happy Valley'], difficulty: 'easy', artist: 'Nick Cave', track: 'Red Right Hand' },
  { slug: 'theme-063', correct: 'Downton Abbey', incorrect: ['Upstairs, Downstairs', 'Call the Midwife', 'The Crown'], difficulty: 'easy', artist: 'John Lunn', track: 'Downton Abbey' },
  { slug: 'theme-064', correct: 'Sherlock', incorrect: ['Spooks', 'Luther', 'Endeavour'], difficulty: 'medium', artist: 'David Arnold', track: 'Sherlock' },
  { slug: 'theme-065', correct: 'Line of Duty', incorrect: ['Bodyguard', 'Happy Valley', 'Spooks'], difficulty: 'medium', artist: 'Carly Paradis', track: 'Line of Duty' },
  { slug: 'theme-066', correct: 'Luther', incorrect: ['Line of Duty', 'Broadchurch', 'Happy Valley'], difficulty: 'hard', artist: 'Massive Attack', track: 'Paradise Circus' },
  { slug: 'theme-067', correct: 'Game of Thrones', incorrect: ['The Witcher', 'Vikings', 'The Last Kingdom'], difficulty: 'easy', artist: 'Ramin Djawadi', track: 'Game of Thrones' },
  { slug: 'theme-068', correct: 'Friends', incorrect: ['Frasier', 'Cheers', 'How I Met Your Mother'], difficulty: 'easy', artist: 'The Rembrandts', track: "I'll Be There for You" },
  { slug: 'theme-070', correct: 'The Sopranos', incorrect: ['Breaking Bad', 'The Wire', 'Mad Men'], difficulty: 'medium', artist: 'Alabama 3', track: 'Woke Up This Morning' },
  { slug: 'theme-071', correct: 'Twin Peaks', incorrect: ['The X-Files', 'Lost', 'True Detective'], difficulty: 'hard', artist: 'Angelo Badalamenti', track: 'Twin Peaks' },
  { slug: 'theme-072', correct: 'The X-Files', incorrect: ['The Twilight Zone', 'Twin Peaks', 'Stranger Things'], difficulty: 'easy', artist: 'Mark Snow', track: 'X-Files' },
  { slug: 'theme-073', correct: 'Knight Rider', incorrect: ['The A-Team', 'Airwolf', 'Street Hawk'], difficulty: 'easy', artist: 'Stu Phillips', track: 'Knight Rider' },
  { slug: 'theme-075', correct: 'Z-Cars', incorrect: ['Softly, Softly', 'Dixon of Dock Green', 'The Sweeney'], difficulty: 'hard', artist: 'Johnny Keating', track: 'Z-Cars' },
  { slug: 'theme-077', correct: 'Heartbeat', incorrect: ['Emmerdale', 'The Royal', 'All Creatures Great and Small'], difficulty: 'medium', artist: 'Nick Berry', track: 'Heartbeat' },
  { slug: 'theme-078', correct: 'Auf Wiedersehen, Pet', incorrect: ['Minder', 'Boon', 'Boys from the Blackstuff'], difficulty: 'medium', artist: 'Joe Fagin', track: "That's Livin' Alright" },
  { slug: 'theme-079', correct: 'The Benny Hill Show', incorrect: ['The Two Ronnies', 'The Morecambe & Wise Show', 'The Generation Game'], difficulty: 'easy', artist: 'Boots Randolph', track: 'Yakety Sax' },
  { slug: 'theme-080', correct: "Monty Python's Flying Circus", incorrect: ['The Goodies', 'Fawlty Towers', "Not the Nine O'Clock News"], difficulty: 'easy', artist: 'John Philip Sousa', track: 'The Liberty Bell' },
  { slug: 'theme-082', correct: 'Mission: Impossible', incorrect: ['The Man from U.N.C.L.E.', 'The Saint', 'Hawaii Five-O'], difficulty: 'easy', artist: 'Lalo Schifrin', track: 'Mission: Impossible' },
  { slug: 'theme-083', correct: 'Hawaii Five-O', incorrect: ['Magnum, P.I.', 'Starsky & Hutch', 'Kojak'], difficulty: 'easy', artist: 'The Ventures', track: 'Hawaii Five-O' },
  { slug: 'theme-084', correct: 'Star Trek', incorrect: ['Doctor Who', 'Lost in Space', 'Battlestar Galactica'], difficulty: 'easy', artist: 'Alexander Courage', track: 'Star Trek' },
  { slug: 'theme-086', correct: 'Tales of the Unexpected', incorrect: ['The Twilight Zone', 'Hammer House of Horror', 'Armchair Thriller'], difficulty: 'hard', artist: 'Ron Grainer', track: 'Tales of the Unexpected' },
  { slug: 'theme-088', correct: 'The Royle Family', incorrect: ['The Office', 'Early Doors', 'The Likely Lads'], difficulty: 'medium', artist: 'Oasis', track: 'Half the World Away' },
  { slug: 'theme-089', correct: 'Big Brother', incorrect: ["I'm a Celebrity... Get Me Out of Here!", 'The X Factor', 'Love Island'], difficulty: 'easy', artist: 'Paul Oakenfold', track: 'Big Brother' },
  { slug: 'theme-090', correct: 'Bergerac', incorrect: ['Shoestring', 'Taggart', 'The Chief'], difficulty: 'hard', artist: 'George Fenton', track: 'Bergerac' },
  { slug: 'theme-092', correct: 'Poirot', incorrect: ['Miss Marple', 'Inspector Morse', 'Midsomer Murders'], difficulty: 'medium', artist: 'Christopher Gunning', track: 'Poirot' },
  { slug: 'theme-095', correct: 'Lovejoy', incorrect: ['Boon', 'Minder', 'Bergerac'], difficulty: 'hard', artist: 'Denis King', track: 'Lovejoy' },
  { slug: 'theme-097', correct: "Howards' Way", incorrect: ['Triangle', 'Bergerac', 'The Onedin Line'], difficulty: 'hard', artist: 'Simon May', track: "Howards' Way" },
  { slug: 'theme-100', correct: 'Wallace & Gromit', incorrect: ['Shaun the Sheep', 'Postman Pat', 'Creature Comforts'], difficulty: 'easy', artist: 'Julian Nott', track: 'Wallace & Gromit' },
  { slug: 'theme-101', correct: 'The Morecambe & Wise Show', incorrect: ['The Two Ronnies', 'The Benny Hill Show', 'The Generation Game'], difficulty: 'easy', artist: 'Morecambe & Wise', track: 'Bring Me Sunshine' },
  { slug: 'theme-102', correct: 'Who Wants to Be a Millionaire?', incorrect: ['The Weakest Link', 'Deal or No Deal', 'The Chase'], difficulty: 'easy', artist: 'Keith Strachan & Matthew Strachan', track: 'Opening Theme' },
  { slug: 'theme-103', correct: 'The Great British Bake Off', incorrect: ['MasterChef', 'The Great Pottery Throw Down', 'Come Dine with Me'], difficulty: 'easy', artist: 'Tom Howe', track: 'The Great British Bake Off' },
  { slug: 'theme-104', correct: 'The Archers', incorrect: ['Desert Island Discs', "Gardeners' Question Time", 'Just a Minute'], difficulty: 'easy', artist: 'Arthur Wood', track: 'Barwick Green' },
  { slug: 'theme-105', correct: 'The Pink Panther Show', incorrect: ['The Flintstones', 'Top Cat', 'Wacky Races'], difficulty: 'easy', artist: 'Henry Mancini', track: 'The Pink Panther Theme' },
  { slug: 'theme-106', correct: 'Stranger Things', incorrect: ['The X-Files', 'Twin Peaks', 'Black Mirror'], difficulty: 'easy', artist: 'Kyle Dixon', track: 'Stranger Things' },
  { slug: 'theme-107', correct: 'Squid Game', incorrect: ['Money Heist', 'Alice in Borderland', 'Kingdom'], difficulty: 'easy', artist: 'Jung Jae Il', track: 'Way Back then' },
  { slug: 'theme-108', correct: 'Ski Sunday', incorrect: ['Grandstand', 'Wimbledon', 'Pot Black'], difficulty: 'medium', artist: 'Sam Fonteyn', track: 'Pop Looks Bach' },
  { slug: 'theme-109', correct: 'The Adventures of Black Beauty', incorrect: ['Follyfoot', 'Champion the Wonder Horse', 'The Famous Five'], difficulty: 'medium', artist: 'London String Chorale', track: 'Galloping Home' },
  { slug: 'theme-110', correct: 'The Inbetweeners', incorrect: ['Skins', 'Fresh Meat', 'Him & Her'], difficulty: 'medium', artist: 'Morning Runner', track: 'Gone Up in Flames' },
  { slug: 'theme-111', correct: 'Happy Valley', incorrect: ['Line of Duty', 'Broadchurch', 'The Fall'], difficulty: 'medium', artist: 'Jake Bugg', track: 'Trouble Town' },
  { slug: 'theme-112', correct: 'All Creatures Great and Small', incorrect: ['Heartbeat', 'The Darling Buds of May', 'Emmerdale'], difficulty: 'medium', artist: 'Johnny Pearson', track: 'All Creatures Great and Small' },
  { slug: 'theme-113', correct: 'Cheers', incorrect: ['Frasier', 'Taxi', 'Friends'], difficulty: 'medium', artist: 'Gary Portnoy', track: 'Cheers Theme Song (TV Version)' },
  { slug: 'theme-114', correct: 'Silent Witness', incorrect: ['Waking the Dead', 'Prime Suspect', 'Spooks'], difficulty: 'medium', artist: 'John Harle', track: 'Silent Witness Theme (Silencium)' },
  { slug: 'theme-115', correct: 'Call the Midwife', incorrect: ['The Village', 'Lark Rise to Candleford', 'Cranford'], difficulty: 'medium', artist: 'Peter Salem', track: 'Call the Midwife' },
  { slug: 'theme-116', correct: 'Desert Island Discs', incorrect: ['The Archers', 'Just a Minute', "Woman's Hour"], difficulty: 'medium', artist: 'Eric Coates', track: 'By the Sleepy Lagoon' },
  { slug: 'theme-117', correct: 'The Crown', incorrect: ['Victoria', 'The Tudors', 'Wolf Hall'], difficulty: 'medium', artist: 'Hans Zimmer', track: 'The Crown' },
  { slug: 'theme-118', correct: 'Robin of Sherwood', incorrect: ['The Adventures of Robin Hood', 'Robin Hood', 'Maid Marian and Her Merry Men'], difficulty: 'medium', artist: 'Clannad', track: 'Robin (The Hooded Man)' },
  { slug: 'theme-119', correct: 'Prisoner: Cell Block H', incorrect: ['Neighbours', 'Sons and Daughters', 'The Flying Doctors'], difficulty: 'hard', artist: 'Lynne Hamilton', track: 'On the Inside' },
  { slug: 'theme-120', correct: 'Pot Black', incorrect: ['Ski Sunday', 'Grandstand', 'Superstars'], difficulty: 'hard', artist: 'Winifred Atwell', track: 'Black and White Rag' },
  { slug: 'theme-121', correct: 'Van der Valk', incorrect: ['The Sweeney', 'Softly, Softly', 'Special Branch'], difficulty: 'hard', artist: 'Simon Park', track: 'Eye Level' },
  { slug: 'theme-122', correct: 'The Saint', incorrect: ['The Persuaders!', 'Danger Man', 'The Avengers'], difficulty: 'hard', artist: 'Edwin Astley', track: 'The Saint' },
  { slug: 'theme-123', correct: 'The Old Grey Whistle Test', incorrect: ['Top of the Pops', 'The Tube', 'Later... with Jools Holland'], difficulty: 'hard', artist: 'Area Code 615', track: 'Stone Fox Chase' },
  { slug: 'theme-124', correct: 'Whatever Happened to the Likely Lads?', incorrect: ['Porridge', 'Rising Damp', 'Man About the House'], difficulty: 'hard', artist: 'Highly Likely', track: 'Whatever Happened to You' },
  { slug: 'theme-125', correct: 'Brideshead Revisited', incorrect: ['The Jewel in the Crown', 'Upstairs, Downstairs', 'The Forsyte Saga'], difficulty: 'hard', artist: 'Geoffrey Burgon', track: 'Brideshead Revisited' },
  { slug: 'theme-126', correct: 'Roobarb', incorrect: ['Mr Benn', 'Ivor the Engine', 'Bod'], difficulty: 'hard', artist: 'Johnny Hawksworth', track: 'Roobarb' },
  { slug: 'theme-127', correct: 'Detectorists', incorrect: ["Mackenzie Crook's Worzel Gummidge", 'This Country', 'The Durrells'], difficulty: 'hard', artist: 'Johnny Flynn', track: 'Detectorists' },
  { slug: 'theme-128', correct: 'Superstars', incorrect: ['A Question of Sport', 'Pot Black', "It's a Knockout"], difficulty: 'hard', artist: 'Johnny Pearson', track: 'Heavy Action' },
];

/** The world-famous American ones, counted against the one-in-six cap. */
export const AMERICAN_THEMES: readonly string[] = [
  'theme-067', 'theme-068', 'theme-070', 'theme-071', 'theme-072',
  'theme-073', 'theme-082', 'theme-083', 'theme-084',
  'theme-105', 'theme-106', 'theme-113',
];
