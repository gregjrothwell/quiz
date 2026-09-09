import type { Difficulty } from '../src/questions/types';

export interface TuneSpec {
  slug: string;
  prompt: string;
  correct: string;
  incorrect: string[];
  difficulty: Difficulty;
  artist: string;
  term: string;
  previewStart?: number;
}

export const TUNES_ROUND_LENGTH = 15;
export const TUNES_MIN_PACK = TUNES_ROUND_LENGTH * 3;

const NAME = 'Name this tune.';

/**
 * UK-office karaoke, not the iTunes chart. Distractors are other artists — the
 * Bach-four problem from the synth pack. Titles only, unless two famous songs
 * share a name.
 */
export const TUNE_SPECS: TuneSpec[] = [
  { slug: 'mr-brightside', prompt: NAME, correct: 'Mr. Brightside', incorrect: ['Take Me Out', 'Last Nite', 'Somebody Told Me'], difficulty: 'easy', artist: 'The Killers', term: 'mr brightside killers' },
  { slug: 'wonderwall', prompt: NAME, correct: 'Wonderwall', incorrect: ['Champagne Supernova', 'Parklife', 'Yellow'], difficulty: 'easy', artist: 'Oasis', term: 'wonderwall oasis' },
  { slug: 'dont-look-back-in-anger', prompt: NAME, correct: "Don't Look Back in Anger", incorrect: ['Wonderwall', 'Common People', 'Song 2'], difficulty: 'easy', artist: 'Oasis', term: "don't look back in anger oasis" },
  { slug: 'bohemian-rhapsody', prompt: NAME, correct: 'Bohemian Rhapsody', incorrect: ['We Are the Champions', 'Piano Man', 'Tiny Dancer'], difficulty: 'easy', artist: 'Queen', term: 'bohemian rhapsody queen' },
  { slug: 'we-will-rock-you', prompt: NAME, correct: 'We Will Rock You', incorrect: ['We Are the Champions', 'Seven Nation Army', 'Song 2'], difficulty: 'easy', artist: 'Queen', term: 'we will rock you queen' },
  { slug: 'hey-jude', prompt: NAME, correct: 'Hey Jude', incorrect: ['Let It Be', 'Sweet Caroline', 'Angels'], difficulty: 'easy', artist: 'The Beatles', term: 'hey jude beatles' },
  { slug: 'sweet-caroline', prompt: NAME, correct: 'Sweet Caroline', incorrect: ['Delilah', "I'm a Believer", 'Build Me Up Buttercup'], difficulty: 'easy', artist: 'Neil Diamond', term: 'sweet caroline neil diamond' },
  { slug: 'angels', prompt: NAME, correct: 'Angels', incorrect: ['Wonderwall', "She's the One", 'Let Me Entertain You'], difficulty: 'easy', artist: 'Robbie Williams', term: 'angels robbie williams' },
  { slug: 'come-on-eileen', prompt: NAME, correct: 'Come On Eileen', incorrect: ['Baggy Trousers', 'Our House', 'Town Called Malice'], difficulty: 'easy', artist: 'Dexys', term: 'come on eileen dexys' },
  { slug: 'livin-on-a-prayer', prompt: NAME, correct: "Livin' on a Prayer", incorrect: ["Sweet Child o' Mine", "Summer of '69", "Don't Stop Believin'"], difficulty: 'easy', artist: 'Bon Jovi', term: "livin on a prayer bon jovi" },
  { slug: 'summer-of-69', prompt: NAME, correct: "Summer of '69", incorrect: ['Run to You', 'Born to Run', 'Glory Days'], difficulty: 'easy', artist: 'Bryan Adams', term: "summer of 69 bryan adams" },
  { slug: 'dancing-queen', prompt: NAME, correct: 'Dancing Queen', incorrect: ['Waterloo', 'Mamma Mia', "I Wanna Dance with Somebody"], difficulty: 'easy', artist: 'ABBA', term: 'dancing queen abba' },
  { slug: 'wannabe', prompt: NAME, correct: 'Wannabe', incorrect: ['2 Become 1', '...Baby One More Time', 'Genie in a Bottle'], difficulty: 'easy', artist: 'Spice Girls', term: 'wannabe spice girls' },
  { slug: 'dont-stop-believin', prompt: NAME, correct: "Don't Stop Believin'", incorrect: ['Livin on a Prayer', 'Sweet Caroline', 'Mr. Brightside'], difficulty: 'easy', artist: 'Journey', term: "don't stop believin journey" },
  { slug: 'song-2', prompt: NAME, correct: 'Song 2', incorrect: ['Parklife', 'Seven Nation Army', 'Smells Like Teen Spirit'], difficulty: 'easy', artist: 'Blur', term: 'song 2 blur' },
  { slug: 'common-people', prompt: NAME, correct: 'Common People', incorrect: ['Disco 2000', 'Country House', "Don't Look Back in Anger"], difficulty: 'easy', artist: 'Pulp', term: 'common people pulp' },
  { slug: 'take-me-out', prompt: NAME, correct: 'Take Me Out', incorrect: ['Mr. Brightside', 'I Bet You Look Good on the Dancefloor', 'Last Nite'], difficulty: 'easy', artist: 'Franz Ferdinand', term: 'take me out franz ferdinand' },
  { slug: 'seven-nation-army', prompt: NAME, correct: 'Seven Nation Army', incorrect: ['Song 2', 'We Will Rock You', 'Chelsea Dagger'], difficulty: 'easy', artist: 'The White Stripes', term: 'seven nation army white stripes' },
  { slug: 'rolling-in-the-deep', prompt: NAME, correct: 'Rolling in the Deep', incorrect: ['Someone Like You', 'Set Fire to the Rain', 'Halo'], difficulty: 'easy', artist: 'Adele', term: 'rolling in the deep adele' },
  { slug: 'shape-of-you', prompt: NAME, correct: 'Shape of You', incorrect: ['Thinking Out Loud', 'Uptown Funk', 'Happy'], difficulty: 'easy', artist: 'Ed Sheeran', term: 'shape of you ed sheeran' },
  { slug: 'uptown-funk', prompt: NAME, correct: 'Uptown Funk', incorrect: ['Happy', 'Get Lucky', 'Treasure'], difficulty: 'easy', artist: 'Mark Ronson', term: 'uptown funk mark ronson' },
  { slug: 'billie-jean', prompt: NAME, correct: 'Billie Jean', incorrect: ['Thriller', 'Beat It', 'Superstition'], difficulty: 'easy', artist: 'Michael Jackson', term: 'billie jean michael jackson' },
  { slug: 'hotel-california', prompt: NAME, correct: 'Hotel California', incorrect: ['Stairway to Heaven', 'Wish You Were Here', 'Go Your Own Way'], difficulty: 'easy', artist: 'Eagles', term: 'hotel california eagles', previewStart: 8 },
  { slug: 'sweet-child', prompt: NAME, correct: "Sweet Child o' Mine", incorrect: ["Livin' on a Prayer", 'Welcome to the Jungle', 'November Rain'], difficulty: 'easy', artist: "Guns N' Roses", term: 'sweet child o mine guns' },
  { slug: 'delilah', prompt: NAME, correct: 'Delilah', incorrect: ["It's Not Unusual", 'Sweet Caroline', 'Green Green Grass of Home'], difficulty: 'easy', artist: 'Tom Jones', term: 'delilah tom jones' },
  { slug: 'yellow', prompt: NAME, correct: 'Yellow', incorrect: ['The Scientist', 'Wonderwall', 'Chasing Cars'], difficulty: 'easy', artist: 'Coldplay', term: 'yellow coldplay' },
  { slug: 'chasing-cars', prompt: NAME, correct: 'Chasing Cars', incorrect: ['Run', 'Yellow', 'Fix You'], difficulty: 'easy', artist: 'Snow Patrol', term: 'chasing cars snow patrol' },
  { slug: 'i-bet-you-look-good', prompt: NAME, correct: 'I Bet You Look Good on the Dancefloor', incorrect: ['When the Sun Goes Down', 'Take Me Out', 'Fluorescent Adolescent'], difficulty: 'easy', artist: 'Arctic Monkeys', term: 'i bet you look good on the dancefloor' },
  { slug: 'sex-on-fire', prompt: NAME, correct: 'Sex on Fire', incorrect: ['Use Somebody', 'Mr. Brightside', 'Take Me Out'], difficulty: 'easy', artist: 'Kings of Leon', term: 'sex on fire kings of leon' },
  { slug: 'take-on-me', prompt: NAME, correct: 'Take On Me', incorrect: ['The Sun Always Shines on TV', 'Wake Me Up Before You Go-Go', 'Girls Just Want to Have Fun'], difficulty: 'easy', artist: 'a-ha', term: 'take on me a-ha' },
  { slug: 'careless-whisper', prompt: NAME, correct: 'Careless Whisper', incorrect: ['Last Christmas', 'Wake Me Up Before You Go-Go', 'Faith'], difficulty: 'easy', artist: 'George Michael', term: 'careless whisper george michael' },
  { slug: 'your-song', prompt: NAME, correct: 'Your Song', incorrect: ['Rocket Man', 'Tiny Dancer', "Don't Let the Sun Go Down on Me"], difficulty: 'easy', artist: 'Elton John', term: 'your song elton john' },
  { slug: 'tainted-love', prompt: NAME, correct: 'Tainted Love', incorrect: ["Don't You Want Me", 'Sweet Dreams (Are Made of This)', 'Blue Monday'], difficulty: 'medium', artist: 'Soft Cell', term: 'tainted love soft cell' },
  { slug: 'dont-you-want-me', prompt: NAME, correct: "Don't You Want Me", incorrect: ['Tainted Love', 'The Model', 'Vienna'], difficulty: 'medium', artist: 'The Human League', term: "don't you want me human league" },
  { slug: 'blue-monday', prompt: NAME, correct: 'Blue Monday', incorrect: ['Love Will Tear Us Apart', 'Temptation', 'Bizarre Love Triangle'], difficulty: 'medium', artist: 'New Order', term: 'blue monday new order' },
  { slug: 'heroes', prompt: NAME, correct: 'Heroes', incorrect: ["Let's Dance", 'Starman', 'Under Pressure'], difficulty: 'medium', artist: 'David Bowie', term: 'heroes david bowie' },
  { slug: 'under-pressure', prompt: NAME, correct: 'Under Pressure', incorrect: ['Another One Bites the Dust', 'Heroes', 'Ice Ice Baby'], difficulty: 'medium', artist: 'Queen', term: 'under pressure queen bowie' },
  { slug: 'creep', prompt: NAME, correct: 'Creep', incorrect: ['Karma Police', 'Wonderwall', 'Losing My Religion'], difficulty: 'medium', artist: 'Radiohead', term: 'creep radiohead' },
  { slug: 'parklife', prompt: NAME, correct: 'Parklife', incorrect: ['Country House', 'Common People', 'Song 2'], difficulty: 'medium', artist: 'Blur', term: 'parklife blur' },
  { slug: 'bittersweet-symphony', prompt: NAME, correct: 'Bitter Sweet Symphony', incorrect: ['The Drugs Don’t Work', 'Lucky Man', 'Why Does It Always Rain on Me?'], difficulty: 'medium', artist: 'The Verve', term: 'bitter sweet symphony verve' },
  { slug: 'why-does-it-always-rain', prompt: NAME, correct: 'Why Does It Always Rain on Me?', incorrect: ["She's the One", 'Mambo No. 5', 'Flying Without Wings'], difficulty: 'medium', artist: 'Travis', term: 'why does it always rain on me travis' },
  { slug: 'torn', prompt: NAME, correct: 'Torn', incorrect: ['...Baby One More Time', 'Genie in a Bottle', 'Believe'], difficulty: 'medium', artist: 'Natalie Imbruglia', term: 'torn natalie imbruglia' },
  { slug: 'believe', prompt: NAME, correct: 'Believe', incorrect: ['If I Could Turn Back Time', 'Heart of Glass', 'Hung Up'], difficulty: 'medium', artist: 'Cher', term: 'believe cher' },
  { slug: 'africa', prompt: NAME, correct: 'Africa', incorrect: ['Hold the Line', 'Rosanna', 'Everybody Wants to Rule the World'], difficulty: 'medium', artist: 'Toto', term: 'africa toto' },
  { slug: 'everybody-wants-to-rule', prompt: NAME, correct: 'Everybody Wants to Rule the World', incorrect: ['Shout', 'Mad World', 'Africa'], difficulty: 'medium', artist: 'Tears for Fears', term: 'everybody wants to rule the world' },
  { slug: 'sweet-dreams', prompt: NAME, correct: 'Sweet Dreams (Are Made of This)', incorrect: ['Tainted Love', 'Here Comes the Rain Again', 'Relax'], difficulty: 'medium', artist: 'Eurythmics', term: 'sweet dreams eurythmics' },
  { slug: 'relax', prompt: NAME, correct: 'Relax', incorrect: ['Two Tribes', 'The Power of Love', 'Welcome to the Pleasuredome'], difficulty: 'medium', artist: 'Frankie Goes to Hollywood', term: 'relax frankie goes to hollywood' },
  { slug: 'vienna', prompt: NAME, correct: 'Vienna', incorrect: ['Fade to Grey', "Don't You Want Me", 'Cars'], difficulty: 'medium', artist: 'Ultravox', term: 'vienna ultravox' },
  { slug: 'whole-of-the-moon', prompt: NAME, correct: 'The Whole of the Moon', incorrect: ['This Is the Sea', 'Purple Rain', "Don't You (Forget About Me)"], difficulty: 'medium', artist: 'The Waterboys', term: 'the whole of the moon waterboys' },
  { slug: 'purple-rain', prompt: NAME, correct: 'Purple Rain', incorrect: ['Kiss', 'When Doves Cry', '1999'], difficulty: 'medium', artist: 'Prince', term: 'purple rain prince' },
  { slug: 'smells-like-teen-spirit', prompt: NAME, correct: 'Smells Like Teen Spirit', incorrect: ['Come as You Are', 'Even Flow', 'Lithium'], difficulty: 'medium', artist: 'Nirvana', term: 'smells like teen spirit nirvana' },
  { slug: 'losing-my-religion', prompt: NAME, correct: 'Losing My Religion', incorrect: ['Everybody Hurts', 'Creep', 'Zombie'], difficulty: 'medium', artist: 'R.E.M.', term: 'losing my religion rem' },
  { slug: 'zombie', prompt: NAME, correct: 'Zombie', incorrect: ['Linger', 'Dreams', 'Nothing Compares 2 U'], difficulty: 'medium', artist: 'The Cranberries', term: 'zombie cranberries' },
  { slug: 'nothing-compares', prompt: NAME, correct: 'Nothing Compares 2 U', incorrect: ['Zombie', 'I Will Always Love You', 'Hero'], difficulty: 'medium', artist: 'Sinéad O’Connor', term: 'nothing compares 2 u sinead' },
  { slug: 'i-will-always-love-you', prompt: NAME, correct: 'I Will Always Love You', incorrect: ['My Heart Will Go On', 'Hero', 'Without You'], difficulty: 'easy', artist: 'Whitney Houston', term: 'i will always love you whitney houston' },
  { slug: 'my-heart-will-go-on', prompt: NAME, correct: 'My Heart Will Go On', incorrect: ['I Will Always Love You', 'Think Twice', 'Eternal Flame'], difficulty: 'easy', artist: 'Celine Dion', term: 'my heart will go on celine dion' },
  { slug: 'think-twice', prompt: NAME, correct: 'Think Twice', incorrect: ['Without You', 'Love Is All Around', 'Stay Another Day'], difficulty: 'medium', artist: 'Celine Dion', term: 'think twice celine dion' },
  { slug: 'love-is-all-around', prompt: NAME, correct: 'Love Is All Around', incorrect: ["You're the One That I Want", 'Stay Another Day', 'Angels'], difficulty: 'medium', artist: 'Wet Wet Wet', term: 'love is all around wet wet wet' },
  { slug: 'stay-another-day', prompt: NAME, correct: 'Stay Another Day', incorrect: ['Love Is All Around', 'Fairytale of New York', 'Last Christmas'], difficulty: 'medium', artist: 'East 17', term: 'stay another day east 17' },
  { slug: 'last-christmas', prompt: NAME, correct: 'Last Christmas', incorrect: ['Stay Another Day', 'Fairytale of New York', 'Merry Christmas Everyone'], difficulty: 'easy', artist: 'Wham!', term: 'last christmas wham' },
  { slug: 'fairytale-of-new-york', prompt: NAME, correct: 'Fairytale of New York', incorrect: ['Last Christmas', 'A Spaceman Came Travelling', 'Stop the Cavalry'], difficulty: 'easy', artist: 'The Pogues', term: 'fairytale of new york pogues' },
  { slug: 'do-i-wanna-know', prompt: NAME, correct: 'Do I Wanna Know?', incorrect: ['R U Mine?', 'Fluorescent Adolescent', 'Use Somebody'], difficulty: 'medium', artist: 'Arctic Monkeys', term: 'do i wanna know arctic monkeys' },
  { slug: 'use-somebody', prompt: NAME, correct: 'Use Somebody', incorrect: ['Sex on Fire', 'Mr. Brightside', 'Somebody Told Me'], difficulty: 'medium', artist: 'Kings of Leon', term: 'use somebody kings of leon' },
  { slug: 'somebody-told-me', prompt: NAME, correct: 'Somebody Told Me', incorrect: ['Mr. Brightside', 'Human', 'When You Were Young'], difficulty: 'medium', artist: 'The Killers', term: 'somebody told me killers' },
  { slug: 'human', prompt: NAME, correct: 'Human', incorrect: ['Somebody Told Me', 'Mr. Brightside', "Don't Stop Believin'"], difficulty: 'hard', artist: 'The Killers', term: 'human the killers' },
  { slug: 'fluorescent-adolescent', prompt: NAME, correct: 'Fluorescent Adolescent', incorrect: ['I Bet You Look Good on the Dancefloor', 'Do I Wanna Know?', 'Teddy Picker'], difficulty: 'hard', artist: 'Arctic Monkeys', term: 'fluorescent adolescent arctic monkeys' },
  { slug: 'country-house', prompt: NAME, correct: 'Country House', incorrect: ['Parklife', 'Common People', 'Charmless Man'], difficulty: 'hard', artist: 'Blur', term: 'country house blur' },
  { slug: 'disco-2000', prompt: NAME, correct: 'Disco 2000', incorrect: ['Common People', 'Sorted for E’s & Wizz', 'Parklife'], difficulty: 'hard', artist: 'Pulp', term: 'disco 2000 pulp' },
  { slug: 'karma-police', prompt: NAME, correct: 'Karma Police', incorrect: ['Creep', 'No Surprises', 'Paranoid Android'], difficulty: 'hard', artist: 'Radiohead', term: 'karma police radiohead' },
  { slug: 'no-surprises', prompt: NAME, correct: 'No Surprises', incorrect: ['Karma Police', 'Street Spirit (Fade Out)', 'Fake Plastic Trees'], difficulty: 'hard', artist: 'Radiohead', term: 'no surprises radiohead' },
  { slug: 'love-will-tear-us-apart', prompt: NAME, correct: 'Love Will Tear Us Apart', incorrect: ['Blue Monday', "She's Lost Control", 'Transmission'], difficulty: 'hard', artist: 'Joy Division', term: 'love will tear us apart joy division' },
  { slug: 'mad-world', prompt: NAME, correct: 'Mad World', incorrect: ['Everybody Wants to Rule the World', 'Pale Shelter', 'True'], difficulty: 'hard', artist: 'Tears for Fears', term: 'mad world tears for fears' },
  { slug: 'baggy-trousers', prompt: NAME, correct: 'Baggy Trousers', incorrect: ['Our House', 'Come On Eileen', 'House of Fun'], difficulty: 'hard', artist: 'Madness', term: 'baggy trousers madness' },
  { slug: 'our-house', prompt: NAME, correct: 'Our House', incorrect: ['Baggy Trousers', 'Driving in My Car', 'House of Fun'], difficulty: 'hard', artist: 'Madness', term: 'our house madness' },
  { slug: 'town-called-malice', prompt: NAME, correct: 'A Town Called Malice', incorrect: ["That's Entertainment", 'Going Underground', 'Come On Eileen'], difficulty: 'hard', artist: 'The Jam', term: 'town called malice jam' },
  { slug: 'going-underground', prompt: NAME, correct: 'Going Underground', incorrect: ['A Town Called Malice', "That's Entertainment", 'Down in the Tube Station at Midnight'], difficulty: 'hard', artist: 'The Jam', term: 'going underground jam' },
  { slug: 'there-she-goes', prompt: NAME, correct: 'There She Goes', incorrect: ['Waterfall', 'She Bangs the Drums', 'I Am the Resurrection'], difficulty: 'hard', artist: 'The La’s', term: 'there she goes the las' },
  { slug: 'she-bangs-the-drums', prompt: NAME, correct: 'She Bangs the Drums', incorrect: ['I Wanna Be Adored', 'Waterfall', 'There She Goes'], difficulty: 'hard', artist: 'The Stone Roses', term: 'she bangs the drums stone roses' },
  { slug: 'step-on', prompt: NAME, correct: 'Step On', incorrect: ['She Bangs the Drums', 'Written in Red', 'Kinky Afro'], difficulty: 'hard', artist: 'Happy Mondays', term: 'step on happy mondays' },
];
