/**
 * The Blankety Blank pack. **Greg plays this round blind** — slugs are numbers
 * so that a test failure, a check report or a commit message cannot spoil a
 * question. Never renumber: a slug is a vault id (`stableId`), so a dropped
 * spec leaves a gap rather than shifting the rest.
 *
 * Sayings are Wiktionary entry titles, verbatim. Slogans and catchphrases cite
 * the Wikipedia article whose text quotes them. `npm run blanks-check` fetches
 * every source and refuses a phrase it cannot find, or a distractor that turns
 * out to be a real variant. See docs/decisions/blankety-blank.md.
 */

import type { Difficulty } from '../src/questions/types';
import type { BlankKind } from './blanks-core';

export interface BlankSpec {
  /** `blank-` and three digits. Never the phrase. */
  slug: string;
  kind: BlankKind;
  /** The whole phrase, exactly as its source has it (a saying: its Wiktionary title). */
  phrase: string;
  /** The blanked word. Stands in `phrase` exactly once, as a whole word. */
  answer: string;
  incorrect: string[];
  difficulty: Difficulty;
  /** Shown in front of a slogan or catchphrase: the brand, the character, the show. */
  clue?: string;
  source: { site: 'wiktionary' | 'wikipedia'; title: string };
}

export const BLANKS_MIN_PACK = 60;
/** A default round is fifteen, so every level must fill one. */
export const BLANKS_MIN_PER_LEVEL = 15;

function saying(
  n: number,
  phrase: string,
  answer: string,
  incorrect: string[],
  difficulty: Difficulty,
): BlankSpec {
  return {
    slug: `blank-${String(n).padStart(3, '0')}`,
    kind: 'saying',
    phrase,
    answer,
    incorrect,
    difficulty,
    source: { site: 'wiktionary', title: phrase },
  };
}

function quoted(
  kind: 'slogan' | 'catchphrase',
  n: number,
  phrase: string,
  answer: string,
  incorrect: string[],
  difficulty: Difficulty,
  article: string,
  clue?: string,
): BlankSpec {
  return {
    slug: `blank-${String(n).padStart(3, '0')}`,
    kind,
    phrase,
    answer,
    incorrect,
    difficulty,
    ...(clue ? { clue } : {}),
    source: { site: 'wikipedia', title: article },
  };
}

// Gaps are specs that were dropped, never renumbered: 60 contained a Catchphrase
// answer (blanks-core.test.ts); 115, 117, 123, 136, 208, 220, 232, 243 and 244
// had no Wikipedia article that says them (blanks-check, 6 October 2026).
// 110–114, 116, 125, 126, 131, 132, 137, 224–228, 234, 235, 237, 238 and 247
// were American: Greg, after the first office round on 6 October 2026, "felt
// like there was an American slant". 138–157 and 249–265 are British
// replacements; 138, 143, 146, 148, 150, 153, 155, 262 and 266 had no article
// that says them and were dropped before they shipped.
const SAYINGS: BlankSpec[] = [
  saying(1, "don't count your chickens before they hatch", 'chickens', ['eggs', 'pennies', 'sheep'], 'easy'),
  saying(2, 'the early bird catches the worm', 'worm', ['bus', 'cold', 'eye'], 'easy'),
  saying(3, 'a bird in the hand is worth two in the bush', 'bush', ['hedge', 'nest', 'pub'], 'easy'),
  saying(4, 'too many cooks spoil the broth', 'broth', ['cake', 'gravy', 'party'], 'easy'),
  saying(5, 'actions speak louder than words', 'words', ['music', 'neighbours', 'shouting'], 'easy'),
  saying(6, "don't judge a book by its cover", 'cover', ['price', 'smell', 'title'], 'easy'),
  saying(7, 'when in Rome, do as the Romans do', 'Romans', ['Italians', 'Popes', 'tourists'], 'easy'),
  saying(8, 'every dog has its day', 'day', ['bed', 'bone', 'walk'], 'easy'),
  saying(9, 'an apple a day keeps the doctor away', 'doctor', ['dentist', 'taxman', 'vicar'], 'easy'),
  saying(10, 'curiosity killed the cat', 'cat', ['goldfish', 'parrot', 'postman'], 'easy'),
  saying(11, 'absence makes the heart grow fonder', 'heart', ['beard', 'belly', 'garden'], 'easy'),
  saying(12, 'the pen is mightier than the sword', 'sword', ['fist', 'spoon', 'stapler'], 'easy'),
  saying(13, "Rome wasn't built in a day", 'day', ['week', 'weekend', 'year'], 'easy'),
  saying(14, 'beauty is in the eye of the beholder', 'beholder', ['bartender', 'landlord', 'mirror'], 'medium'),
  saying(15, 'great minds think alike', 'alike', ['ahead', 'big', 'twice'], 'easy'),
  saying(16, "where there's a will, there's a way", 'way', ['lawyer', 'relative', 'row'], 'easy'),
  saying(17, "don't put all your eggs in one basket", 'basket', ['box', 'omelette', 'pan'], 'easy'),
  saying(18, "people who live in glass houses shouldn't throw stones", 'stones', ['frisbees', 'parties', 'tantrums'], 'medium'),
  saying(19, 'lightning never strikes twice in the same place', 'twice', ['back', 'early', 'softly'], 'medium'),
  saying(20, "you can lead a horse to water, but you can't make it drink", 'horse', ['camel', 'cat', 'teenager'], 'easy'),
  saying(21, 'a stitch in time saves nine', 'nine', ['lives', 'money', 'ten'], 'medium'),
  saying(22, 'a rolling stone gathers no moss', 'moss', ['dust', 'fans', 'mud'], 'medium'),
  saying(23, 'birds of a feather flock together', 'feather', ['beak', 'nest', 'wing'], 'easy'),
  saying(24, 'fortune favours the brave', 'brave', ['lucky', 'rich', 'young'], 'medium'),
  saying(25, 'the proof of the pudding is in the eating', 'eating', ['custard', 'oven', 'recipe'], 'medium'),
  saying(26, 'many hands make light work', 'light', ['dirty', 'extra', 'heavy'], 'medium'),
  saying(27, 'necessity is the mother of invention', 'mother', ['daughter', 'enemy', 'father'], 'medium'),
  saying(28, 'still waters run deep', 'deep', ['clear', 'cold', 'slow'], 'medium'),
  saying(29, 'better late than never', 'never', ['early', 'sober', 'sorry'], 'easy'),
  saying(30, "two wrongs don't make a right", 'right', ['left', 'party', 'rule'], 'easy'),
  saying(31, "don't look a gift horse in the mouth", 'mouth', ['ear', 'eye', 'wallet'], 'medium'),
  saying(32, "a leopard can't change its spots", 'spots', ['mind', 'socks', 'stripes'], 'medium'),
  saying(33, "an Englishman's home is his castle", 'castle', ['fortress', 'kingdom', 'pub'], 'medium'),
  saying(34, 'hell hath no fury like a woman scorned', 'scorned', ['hungry', 'late', 'scorched'], 'medium'),
  saying(35, 'cleanliness is next to godliness', 'godliness', ['laziness', 'madness', 'wellness'], 'medium'),
  saying(36, 'the road to hell is paved with good intentions', 'intentions', ['cobbles', 'excuses', 'potholes'], 'medium'),
  saying(37, "ne'er cast a clout till May be out", 'clout', ['clog', 'coat', 'line'], 'hard'),
  saying(38, 'many a mickle makes a muckle', 'muckle', ['buckle', 'mountain', 'pickle'], 'hard'),
  saying(39, "there's no fool like an old fool", 'old', ['April', 'wise', 'young'], 'medium'),
  saying(40, "it's a long road that has no turning", 'turning', ['ending', 'potholes', 'puddles'], 'hard'),
  saying(41, 'the darkest hour is just before the dawn', 'dawn', ['alarm', 'kebab', 'storm'], 'medium'),
  saying(42, "you can't make a silk purse out of a sow's ear", 'purse', ['glove', 'scarf', 'tie'], 'hard'),
  saying(43, 'a cat may look at a king', 'king', ['dog', 'mouse', 'queen'], 'hard'),
  saying(44, 'least said, soonest mended', 'mended', ['forgotten', 'healed', 'settled'], 'hard'),
  saying(45, 'one swallow does not make a summer', 'swallow', ['barbecue', 'picnic', 'robin'], 'hard'),
  saying(46, 'fine words butter no parsnips', 'parsnips', ['bread', 'carrots', 'crumpets'], 'hard'),
  saying(47, 'a bad workman always blames his tools', 'tools', ['apprentice', 'boss', 'weather'], 'medium'),
  saying(48, 'great oaks from little acorns grow', 'acorns', ['conkers', 'saplings', 'seeds'], 'medium'),
  saying(49, 'the more the merrier', 'merrier', ['cheaper', 'louder', 'messier'], 'easy'),
  saying(50, 'empty vessels make the most noise', 'noise', ['mess', 'money', 'sense'], 'hard'),
  saying(51, 'procrastination is the thief of time', 'time', ['biscuits', 'joy', 'sleep'], 'hard'),
  saying(52, "when the cat's away, the mice will play", 'mice', ['dogs', 'kids', 'rats'], 'easy'),
  saying(53, 'softly, softly, catchee monkey', 'monkey', ['chicken', 'donkey', 'mouse'], 'hard'),
  saying(54, 'a nod is as good as a wink to a blind horse', 'horse', ['bat', 'man', 'mole'], 'hard'),
  saying(55, 'he who pays the piper calls the tune', 'piper', ['drummer', 'fiddler', 'landlord'], 'hard'),
  saying(56, "there's many a slip twixt the cup and the lip", 'lip', ['hip', 'sip', 'tip'], 'hard'),
  saying(57, "one man's meat is another man's poison", 'poison', ['dinner', 'gravy', 'treasure'], 'hard'),
  saying(58, 'if wishes were horses, beggars would ride', 'horses', ['bicycles', 'buses', 'ponies'], 'hard'),
  saying(59, "you can't teach an old dog new tricks", 'tricks', ['games', 'routes', 'words'], 'easy'),
  saying(61, 'a fool and his money are soon parted', 'parted', ['gone', 'married', 'spent'], 'medium'),
  saying(62, 'it takes two to tango', 'tango', ['foxtrot', 'jive', 'waltz'], 'easy'),
  saying(63, 'pride comes before a fall', 'fall', ['bill', 'storm', 'trip'], 'medium'),
  saying(64, "the apple doesn't fall far from the tree", 'tree', ['basket', 'ground', 'orchard'], 'easy'),
  saying(65, 'it never rains but it pours', 'pours', ['drizzles', 'floods', 'snows'], 'medium'),
];

type QuotedArgs = [
  n: number,
  phrase: string,
  answer: string,
  incorrect: string[],
  difficulty: Difficulty,
  article: string,
  clue?: string,
];

const slogan = (...args: QuotedArgs): BlankSpec => quoted('slogan', ...args);
const catchphrase = (...args: QuotedArgs): BlankSpec => quoted('catchphrase', ...args);

const SLOGANS: BlankSpec[] = [
  slogan(101, 'Every little helps', 'helps', ['counts', 'hurts', 'matters'], 'easy', 'Tesco', 'Tesco'),
  slogan(102, "Should've gone to Specsavers", 'gone', ['been', 'listened', 'popped'], 'easy', 'Specsavers'),
  slogan(103, "Because you're worth it", 'worth', ['gorgeous', 'paying', 'special'], 'easy', "L'Oréal", "L'Oréal"),
  slogan(104, 'Does exactly what it says on the tin', 'tin', ['box', 'label', 'packet'], 'easy', 'Ronseal', 'Ronseal'),
  slogan(105, 'Vorsprung durch Technik', 'Technik', ['Kunst', 'Motorik', 'Technologie'], 'hard', 'Vorsprung durch Technik', 'Audi'),
  slogan(106, 'Have a break, have a Kit Kat', 'break', ['bath', 'biscuit', 'nap'], 'easy', 'Kit Kat'),
  slogan(107, 'Beanz Meanz Heinz', 'Meanz', ['Feedz', 'Lovez', 'Makez'], 'medium', 'Heinz Baked Beans'),
  slogan(108, 'Probably the best lager in the world', 'Probably', ['Arguably', 'Definitely', 'Possibly'], 'medium', 'Carlsberg Group', 'Carlsberg'),
  slogan(109, 'Refreshes the parts other beers cannot reach', 'parts', ['bits', 'people', 'places'], 'hard', 'Heineken', 'Heineken'),
  slogan(118, "The future's bright, the future's Orange", 'Orange', ['golden', 'ours', 'Vodafone'], 'medium', 'Orange (UK)'),
  slogan(119, 'Never knowingly undersold', 'undersold', ['oversold', 'outsold', 'undercut'], 'medium', 'John Lewis & Partners', 'John Lewis'),
  slogan(120, 'Love it or hate it', 'hate', ['eat', 'leave', 'spread'], 'easy', 'Marmite', 'Marmite'),
  slogan(121, 'A Mars a day helps you work, rest and play', 'rest', ['eat', 'shop', 'sleep'], 'medium', 'Mars (chocolate bar)'),
  slogan(122, 'The mint with the hole', 'hole', ['crunch', 'dot', 'ring'], 'medium', 'Polo (confectionery)', 'Polo'),
  slogan(124, 'Put a tiger in your tank', 'tiger', ['cheetah', 'lion', 'monkey'], 'medium', 'Esso', 'Esso'),
  slogan(127, 'For mash get Smash', 'mash', ['cash', 'chips', 'gravy'], 'hard', 'Smash (instant mashed potato)'),
  slogan(128, 'Exceedingly good cakes', 'Exceedingly', ['Extremely', 'Remarkably', 'Ridiculously'], 'medium', 'Mr Kipling', 'Mr Kipling'),
  slogan(129, 'Reassuringly expensive', 'expensive', ['Belgian', 'cheap', 'strong'], 'medium', 'Stella Artois', 'Stella Artois'),
  slogan(130, 'Happiness is a cigar called Hamlet', 'Happiness', ['Bliss', 'Loneliness', 'Sadness'], 'hard', 'Hamlet (cigar)'),
  slogan(133, 'Snap! Crackle! Pop!', 'Crackle', ['Crunch', 'Fizz', 'Sizzle'], 'easy', 'Snap, Crackle and Pop', 'Rice Krispies'),
  slogan(134, 'Go to work on an egg', 'work', ['holiday', 'school', 'sleep'], 'hard', 'Go to work on an egg'),
  slogan(135, 'Naughty but nice', 'Naughty', ['Cheeky', 'Saucy', 'Sinful'], 'hard', 'Naughty but nice', 'Fresh cream cakes'),
  slogan(139, 'Your flexible friend', 'flexible', ['faithful', 'plastic', 'trusty'], 'hard', 'Access (credit card)', 'Access'),
  slogan(140, "The world's favourite airline", 'favourite', ['biggest', 'finest', 'friendliest'], 'medium', 'British Airways', 'British Airways'),
  slogan(141, 'Made to make your mouth water', 'water', ['pop', 'smile', 'tingle'], 'medium', 'Starburst (confectionery)', 'Opal Fruits'),
  slogan(142, 'Secret lemonade drinker', 'lemonade', ['cider', 'milkshake', 'sherry'], 'medium', "R. White's Lemonade", "R. White's"),
  slogan(144, "You know when you've been Tango'd", 'know', ['feel', 'learn', 'see'], 'medium', 'Tango (drink)'),
  slogan(145, "Calm down dear, it's a commercial", 'dear', ['love', 'mate', 'son'], 'medium', 'Esure', 'Michael Winner'),
  slogan(147, 'Made in Scotland from girders', 'girders', ['granite', 'haggis', 'thistles'], 'medium', 'Irn-Bru', 'Irn-Bru'),
  slogan(149, 'This is not just food, this is M&S food', 'just', ['any', 'cheap', 'fast'], 'easy', 'Marks & Spencer'),
  slogan(151, 'Hello Boys', 'Boys', ['Darling', 'Ladies', 'Sailor'], 'medium', 'Wonderbra', 'Wonderbra'),
  slogan(152, "Good food costs less at Sainsbury's", 'less', ['extra', 'more', 'nothing'], 'medium', "Sainsbury's"),
  slogan(154, 'Kills all known germs', 'germs', ['bugs', 'smells', 'stains'], 'easy', 'Domestos', 'Domestos'),
  slogan(156, 'Nice one, Cyril', 'Cyril', ['Cedric', 'Clive', 'Colin'], 'hard', 'Nice One, Cyril', 'Wonderloaf'),
  slogan(157, 'Va va voom', 'voom', ['boom', 'vroom', 'zoom'], 'easy', 'Renault Clio', 'Renault Clio'),
];

const CATCHPHRASES: BlankSpec[] = [
  catchphrase(201, "I don't believe it!", 'believe', ['deserve', 'like', 'want'], 'easy', 'Victor Meldrew', 'Victor Meldrew'),
  catchphrase(202, 'Lovely jubbly', 'jubbly', ['bubbly', 'cushty', 'jelly'], 'easy', 'Del Boy', 'Del Boy'),
  catchphrase(203, "Didn't he do well?", 'well', ['badly', 'good', 'great'], 'medium', 'Bruce Forsyth', 'Bruce Forsyth'),
  catchphrase(204, 'Stupid boy', 'boy', ['child', 'man', 'Pike'], 'easy', "Dad's Army", 'Captain Mainwaring'),
  catchphrase(205, "Don't panic!", 'panic', ['move', 'shout', 'worry'], 'easy', 'Lance Corporal Jones', 'Corporal Jones'),
  catchphrase(206, 'Am I bovvered?', 'bovvered', ['fussed', 'mithered', 'worried'], 'easy', 'Lauren Cooper', 'Lauren Cooper'),
  catchphrase(207, 'Computer says no', 'no', ['maybe', 'wait', 'yes'], 'easy', 'Carol Beer', 'Little Britain'),
  catchphrase(209, "I've started, so I'll finish", 'finish', ['continue', 'stop', 'win'], 'easy', 'Mastermind (British game show)', 'Mastermind'),
  catchphrase(210, 'Come on down!', 'down', ['in', 'over', 'up'], 'easy', 'The Price Is Right (British game show)', 'The Price Is Right'),
  catchphrase(211, "And it's good night from him", 'him', ['her', 'them', 'you'], 'medium', 'The Two Ronnies', 'The Two Ronnies'),
  catchphrase(212, 'Listen very carefully, I shall say this only once', 'once', ['quietly', 'slowly', 'twice'], 'medium', 'Kirsten Cooke', "'Allo 'Allo!"),
  catchphrase(213, "This time next year, we'll be millionaires", 'millionaires', ['billionaires', 'famous', 'married'], 'medium', 'Del Boy', 'Del Boy'),
  catchphrase(214, 'Shut that door!', 'door', ['gate', 'mouth', 'window'], 'medium', 'Larry Grayson', 'Larry Grayson'),
  catchphrase(215, "Here's one I made earlier", 'earlier', ['before', 'later', 'yesterday'], 'easy', 'Blue Peter', 'Blue Peter'),
  catchphrase(216, 'You are the weakest link, goodbye', 'goodbye', ['farewell', 'leave', 'next'], 'easy', 'The Weakest Link (British game show)', 'Anne Robinson'),
  catchphrase(217, 'Is that your final answer?', 'final', ['best', 'last', 'real'], 'easy', 'Who Wants to Be a Millionaire? (British game show)', 'Chris Tarrant'),
  catchphrase(218, 'I have a cunning plan', 'cunning', ['brilliant', 'clever', 'sneaky'], 'easy', 'Baldrick', 'Baldrick'),
  catchphrase(219, 'Super, smashing, great', 'smashing', ['brilliant', 'cracking', 'lovely'], 'medium', 'Jim Bowen', 'Jim Bowen'),
  catchphrase(221, 'Just like that!', 'that', ['magic', 'so', 'this'], 'easy', 'Tommy Cooper', 'Tommy Cooper'),
  catchphrase(222, 'Ooh, Betty', 'Betty', ['Barbara', 'Bertie', 'Brenda'], 'medium', "Some Mothers Do 'Ave 'Em", 'Frank Spencer'),
  catchphrase(223, "What's occurring?", 'occurring', ['brewing', 'cooking', 'happening'], 'easy', 'Nessa Jenkins', 'Gavin & Stacey'),
  catchphrase(229, "You're fired!", 'fired', ['done', 'finished', 'out'], 'easy', 'The Apprentice (British TV series)', 'The Apprentice'),
  catchphrase(230, "They don't like it up 'em", 'like', ['expect', 'need', 'want'], 'medium', 'Lance Corporal Jones', 'Corporal Jones'),
  catchphrase(231, 'Down with this sort of thing', 'thing', ['carry-on', 'nonsense', 'stuff'], 'medium', 'Father Ted', 'Father Ted'),
  catchphrase(233, "Don't have nightmares", 'nightmares', ['burglars', 'dreams', 'kittens'], 'medium', 'Nick Ross', 'Crimewatch'),
  catchphrase(236, 'Thunderbirds are go!', 'go', ['here', 'off', 'ready'], 'easy', 'Thunderbirds (TV series)'),
  catchphrase(239, 'Lorra lorra laughs', 'laughs', ['fun', 'larks', 'love'], 'medium', 'Cilla Black', 'Cilla Black'),
  catchphrase(240, 'Ooh, you are awful... but I like you!', 'awful', ['cheeky', 'naughty', 'terrible'], 'hard', 'Dick Emery', 'Dick Emery'),
  catchphrase(241, 'Titter ye not', 'Titter', ['Chuckle', 'Giggle', 'Snigger'], 'hard', 'Frankie Howerd', 'Frankie Howerd'),
  catchphrase(242, "'Er indoors", 'indoors', ['downstairs', 'outdoors', 'upstairs'], 'medium', 'Arthur Daley', 'Arthur Daley'),
  catchphrase(245, 'Hello, good evening, and welcome', 'welcome', ['cheers', 'goodbye', 'sorry'], 'hard', 'David Frost', 'David Frost'),
  catchphrase(246, "I'm free!", 'free', ['here', 'off', 'single'], 'medium', 'Mr Humphries', 'Mr Humphries'),
  catchphrase(248, 'You plonker', 'plonker', ['muppet', 'numpty', 'wally'], 'easy', 'Del Boy', 'Del Boy'),
  catchphrase(249, 'Suit you, sir!', 'Suit', ['Bless', 'Fits', 'Thank'], 'easy', 'The Fast Show', 'The Fast Show'),
  catchphrase(250, "I'm the only gay in the village", 'village', ['office', 'town', 'valley'], 'easy', 'Daffyd Thomas', 'Little Britain'),
  catchphrase(251, "Smoke me a kipper, I'll be back for breakfast", 'kipper', ['haddock', 'pipe', 'sausage'], 'medium', 'Ace Rimmer', 'Ace Rimmer'),
  catchphrase(252, 'Nobody expects the Spanish Inquisition', 'Inquisition', ['Armada', 'Omelette', 'Waiter'], 'easy', 'The Spanish Inquisition (Monty Python)', 'Monty Python'),
  catchphrase(253, 'And now for something completely different', 'completely', ['entirely', 'slightly', 'totally'], 'medium', 'And Now for Something Completely Different', 'Monty Python'),
  catchphrase(254, 'Bernie, the bolt!', 'bolt', ['arrow', 'bow', 'trigger'], 'hard', 'The Golden Shot', 'The Golden Shot'),
  catchphrase(255, 'You dirty old man!', 'dirty', ['filthy', 'grumpy', 'silly'], 'medium', 'Albert Steptoe', 'Steptoe and Son'),
  catchphrase(256, 'Silly moo', 'moo', ['billy', 'cow', 'sausage'], 'hard', 'Till Death Us Do Part', 'Alf Garnett'),
  catchphrase(257, "We're doomed!", 'doomed', ['done', 'finished', 'sunk'], 'easy', 'Private Frazer', 'Private Frazer'),
  catchphrase(258, 'Ooh, I could crush a grape!', 'grape', ['grapefruit', 'peanut', 'plum'], 'hard', 'Stu Francis', 'Stu Francis'),
  catchphrase(259, 'Hello playmates!', 'playmates', ['campers', 'chums', 'sweethearts'], 'hard', 'Arthur Askey', 'Arthur Askey'),
  catchphrase(260, "You might very well think that; I couldn't possibly comment", 'comment', ['agree', 'confirm', 'say'], 'hard', 'Francis Urquhart', 'Francis Urquhart'),
  catchphrase(261, 'Look at what you could have won', 'won', ['bought', 'got', 'lost'], 'medium', 'Jim Bowen', 'Bullseye'),
  catchphrase(263, 'Evening all', 'Evening', ['Afternoon', 'Cheers', 'Morning'], 'medium', 'Dixon of Dock Green', 'Dixon of Dock Green'),
  catchphrase(264, 'Gizza job', 'job', ['break', 'fiver', 'hand'], 'hard', 'Yosser Hughes', 'Yosser Hughes'),
  catchphrase(265, 'Hello, my darlings!', 'darlings', ['lovelies', 'petals', 'sweethearts'], 'hard', 'Charlie Drake', 'Charlie Drake'),
];

export const BLANK_SPECS: BlankSpec[] = [...SAYINGS, ...SLOGANS, ...CATCHPHRASES];
