import type { Difficulty } from '../src/questions/types';

export interface SleeveSpec {
  slug: string;
  prompt: string;
  correct: string;
  incorrect: string[];
  difficulty: Difficulty;
  artist: string;
  term: string;
  /** When search is drowned by tributes, lookup this GB collection id. */
  collectionId?: number;
}

const COVER = 'Which album is this?';

export const SLEEVE_SPECS: SleeveSpec[] = [
  { slug: 'abbey-road', prompt: COVER, correct: 'Abbey Road', incorrect: ['Let It Be', 'Sgt. Pepper’s Lonely Hearts Club Band', 'Revolver'], difficulty: 'easy', artist: 'The Beatles', term: 'abbey road beatles' },
  { slug: 'dark-side', prompt: COVER, correct: 'The Dark Side of the Moon', incorrect: ['The Wall', 'Wish You Were Here', 'Animals'], difficulty: 'easy', artist: 'Pink Floyd', term: 'dark side of the moon pink floyd', collectionId: 1065973699 },
  { slug: 'nevermind', prompt: COVER, correct: 'Nevermind', incorrect: ['In Utero', 'Ten', 'Siamese Dream'], difficulty: 'easy', artist: 'Nirvana', term: 'Nevermind Nirvana', collectionId: 1440783617 },
  { slug: 'sgt-pepper', prompt: COVER, correct: 'Sgt. Pepper’s Lonely Hearts Club Band', incorrect: ['Magical Mystery Tour', 'Abbey Road', 'Their Satanic Majesties Request'], difficulty: 'easy', artist: 'The Beatles', term: 'sgt pepper beatles' },
  { slug: 'ziggy', prompt: COVER, correct: 'The Rise and Fall of Ziggy Stardust and the Spiders from Mars', incorrect: ['Aladdin Sane', 'Hunky Dory', 'Diamond Dogs'], difficulty: 'medium', artist: 'David Bowie', term: 'ziggy stardust bowie' },
  { slug: 'aladdin-sane', prompt: COVER, correct: 'Aladdin Sane', incorrect: ['Ziggy Stardust', 'Heroes', 'Low'], difficulty: 'medium', artist: 'David Bowie', term: 'aladdin sane bowie' },
  { slug: 'london-calling', prompt: COVER, correct: 'London Calling', incorrect: ['The Clash', 'Combat Rock', 'Give ’Em Enough Rope'], difficulty: 'easy', artist: 'The Clash', term: 'london calling clash' },
  { slug: 'queen-is-dead', prompt: COVER, correct: 'The Queen Is Dead', incorrect: ['Meat Is Murder', 'Strangeways, Here We Come', 'The Smiths'], difficulty: 'medium', artist: 'The Smiths', term: 'the queen is dead smiths' },
  { slug: 'definitely-maybe', prompt: COVER, correct: 'Definitely Maybe', incorrect: ['(What’s the Story) Morning Glory?', 'Be Here Now', 'Parklife'], difficulty: 'easy', artist: 'Oasis', term: 'definitely maybe oasis' },
  { slug: 'morning-glory', prompt: COVER, correct: '(What’s the Story) Morning Glory?', incorrect: ['Definitely Maybe', 'The Bends', 'Parklife'], difficulty: 'easy', artist: 'Oasis', term: 'morning glory oasis' },
  { slug: 'ok-computer', prompt: COVER, correct: 'OK Computer', incorrect: ['The Bends', 'Kid A', 'In Rainbows'], difficulty: 'medium', artist: 'Radiohead', term: 'ok computer radiohead' },
  { slug: 'the-bends', prompt: COVER, correct: 'The Bends', incorrect: ['OK Computer', 'Pablo Honey', 'The Queen Is Dead'], difficulty: 'hard', artist: 'Radiohead', term: 'the bends radiohead' },
  { slug: 'stone-roses', prompt: COVER, correct: 'The Stone Roses', incorrect: ['Second Coming', 'Pills ’n’ Thrills and Bellyaches', 'Screamadelica'], difficulty: 'medium', artist: 'The Stone Roses', term: 'the stone roses album' },
  { slug: 'different-class', prompt: COVER, correct: 'Different Class', incorrect: ['His ’n’ Hers', 'This Is Hardcore', 'Parklife'], difficulty: 'medium', artist: 'Pulp', term: 'Different Class Pulp', collectionId: 1440923838 },
  { slug: 'parklife-album', prompt: COVER, correct: 'Parklife', incorrect: ['The Great Escape', 'Modern Life Is Rubbish', 'Definitely Maybe'], difficulty: 'medium', artist: 'Blur', term: 'parklife blur album' },
  { slug: 'am', prompt: COVER, correct: 'AM', incorrect: ['Whatever People Say I Am, That’s What I’m Not', 'Favourite Worst Nightmare', 'Tranquility Base Hotel & Casino'], difficulty: 'medium', artist: 'Arctic Monkeys', term: 'am arctic monkeys', collectionId: 663097964 },
  { slug: 'whatever-people-say', prompt: COVER, correct: 'Whatever People Say I Am, That’s What I’m Not', incorrect: ['AM', 'Favourite Worst Nightmare', 'Is This It'], difficulty: 'medium', artist: 'Arctic Monkeys', term: "Whatever People Say I Am That's What I'm Not", collectionId: 111153953 },
  { slug: 'rumours', prompt: COVER, correct: 'Rumours', incorrect: ['Tusk', 'Fleetwood Mac', 'Hotel California'], difficulty: 'easy', artist: 'Fleetwood Mac', term: 'rumours fleetwood mac' },
  { slug: 'thriller', prompt: COVER, correct: 'Thriller', incorrect: ['Bad', 'Off the Wall', 'Purple Rain'], difficulty: 'easy', artist: 'Michael Jackson', term: 'thriller michael jackson' },
  { slug: 'back-in-black', prompt: COVER, correct: 'Back in Black', incorrect: ['Highway to Hell', 'The Razors Edge', 'Appetite for Destruction'], difficulty: 'easy', artist: 'AC/DC', term: 'back in black acdc' },
  { slug: 'led-zeppelin-iv', prompt: COVER, correct: 'Led Zeppelin IV', incorrect: ['Led Zeppelin II', 'Houses of the Holy', 'Physical Graffiti'], difficulty: 'easy', artist: 'Led Zeppelin', term: 'led zeppelin iv' },
  { slug: 'the-wall', prompt: COVER, correct: 'The Wall', incorrect: ['The Dark Side of the Moon', 'Animals', 'Wish You Were Here'], difficulty: 'easy', artist: 'Pink Floyd', term: 'The Wall Pink Floyd', collectionId: 1065975633 },
  { slug: 'unknown-pleasures', prompt: COVER, correct: 'Unknown Pleasures', incorrect: ['Closer', 'Substance', 'The Queen Is Dead'], difficulty: 'medium', artist: 'Joy Division', term: 'unknown pleasures joy division' },
  { slug: 'velvet-underground-nico', prompt: COVER, correct: 'The Velvet Underground & Nico', incorrect: ['White Light/White Heat', 'Loaded', 'Transformer'], difficulty: 'medium', artist: 'The Velvet Underground', term: 'velvet underground nico' },
  { slug: 'sticky-fingers', prompt: COVER, correct: 'Sticky Fingers', incorrect: ['Exile on Main St.', 'Let It Bleed', 'Some Girls'], difficulty: 'medium', artist: 'The Rolling Stones', term: 'sticky fingers rolling stones' },
  { slug: 'appetite', prompt: COVER, correct: 'Appetite for Destruction', incorrect: ['Use Your Illusion I', 'Back in Black', 'Nevermind'], difficulty: 'medium', artist: "Guns N' Roses", term: 'Appetite for Destruction Guns N Roses', collectionId: 1377813284 },
  { slug: 'joshua-tree', prompt: COVER, correct: 'The Joshua Tree', incorrect: ['Achtung Baby', 'War', 'The Unforgettable Fire'], difficulty: 'easy', artist: 'U2', term: 'the joshua tree u2' },
  { slug: 'automatic-for-the-people', prompt: COVER, correct: 'Automatic for the People', incorrect: ['Out of Time', 'Monster', 'Document'], difficulty: 'medium', artist: 'R.E.M.', term: 'automatic for the people rem', collectionId: 1440949853 },
  { slug: 'is-this-it', prompt: COVER, correct: 'Is This It', incorrect: ['Room on Fire', 'Whatever People Say I Am, That’s What I’m Not', 'Turn On the Bright Lights'], difficulty: 'medium', artist: 'The Strokes', term: 'Is This It The Strokes', collectionId: 269080434 },
  { slug: 'discovery', prompt: COVER, correct: 'Discovery', incorrect: ['Homework', 'Random Access Memories', 'Human After All'], difficulty: 'medium', artist: 'Daft Punk', term: 'discovery daft punk' },
  { slug: '21-adele', prompt: COVER, correct: '21', incorrect: ['19', '25', '30'], difficulty: 'easy', artist: 'Adele', term: '21 adele' },
  { slug: '25-adele', prompt: COVER, correct: '25', incorrect: ['21', '19', '30'], difficulty: 'medium', artist: 'Adele', term: '25 adele' },
  { slug: 'x-ed', prompt: COVER, correct: 'x', incorrect: ['+', '÷', '='], difficulty: 'medium', artist: 'Ed Sheeran', term: 'x ed sheeran' },
  { slug: 'back-to-black', prompt: COVER, correct: 'Back to Black', incorrect: ['Frank', 'Lioness: Hidden Treasures', '19'], difficulty: 'easy', artist: 'Amy Winehouse', term: 'back to black amy winehouse' },
  { slug: 'dummy', prompt: COVER, correct: 'Dummy', incorrect: ['Mezzanine', 'Third', 'Homogenic'], difficulty: 'hard', artist: 'Portishead', term: 'dummy portishead' },
  { slug: 'homogenic', prompt: COVER, correct: 'Homogenic', incorrect: ['Debut', 'Post', 'Vespertine'], difficulty: 'hard', artist: 'Björk', term: 'homogenic bjork' },
  { slug: 'kid-a', prompt: COVER, correct: 'Kid A', incorrect: ['OK Computer', 'Amnesiac', 'Hail to the Thief'], difficulty: 'hard', artist: 'Radiohead', term: 'kid a radiohead' },
  { slug: 'in-rainbows', prompt: COVER, correct: 'In Rainbows', incorrect: ['OK Computer', 'Kid A', 'A Moon Shaped Pool'], difficulty: 'hard', artist: 'Radiohead', term: 'in rainbows radiohead' },
  { slug: 'hounds-of-love', prompt: COVER, correct: 'Hounds of Love', incorrect: ['The Kick Inside', 'The Dreaming', 'Aerial'], difficulty: 'hard', artist: 'Kate Bush', term: 'hounds of love kate bush' },
  { slug: 'parallel-lines', prompt: COVER, correct: 'Parallel Lines', incorrect: ['Eat to the Beat', 'Autoamerican', 'Plastic Letters'], difficulty: 'medium', artist: 'Blondie', term: 'parallel lines blondie' },
  { slug: 'born-to-run', prompt: COVER, correct: 'Born to Run', incorrect: ['Darkness on the Edge of Town', 'Born in the U.S.A.', 'The River'], difficulty: 'medium', artist: 'Bruce Springsteen', term: 'born to run springsteen' },
  { slug: 'hotel-california-album', prompt: COVER, correct: 'Hotel California', incorrect: ['The Long Run', 'One of These Nights', 'Rumours'], difficulty: 'medium', artist: 'Eagles', term: 'hotel california eagles album' },
  { slug: 'illmatic', prompt: COVER, correct: 'Illmatic', incorrect: ['Ready to Die', 'The Chronic', 'Enter the Wu-Tang (36 Chambers)'], difficulty: 'hard', artist: 'Nas', term: 'illmatic nas' },
  { slug: 'to-pimp-a-butterfly', prompt: COVER, correct: 'To Pimp a Butterfly', incorrect: ['good kid, m.A.A.d city', 'DAMN.', 'Channel Orange'], difficulty: 'hard', artist: 'Kendrick Lamar', term: 'to pimp a butterfly kendrick' },
  { slug: 'channel-orange', prompt: COVER, correct: 'Channel Orange', incorrect: ['Blonde', 'Nostalgia, Ultra', 'To Pimp a Butterfly'], difficulty: 'hard', artist: 'Frank Ocean', term: 'channel orange frank ocean', collectionId: 1440765580 },
  { slug: 'the-fame', prompt: COVER, correct: 'The Fame', incorrect: ['Born This Way', 'The Fame Monster', 'Artpop'], difficulty: 'medium', artist: 'Lady Gaga', term: 'the fame lady gaga', collectionId: 1440818588 },
  { slug: '1989', prompt: COVER, correct: '1989', incorrect: ['Red', 'Lover', 'Midnights'], difficulty: 'easy', artist: 'Taylor Swift', term: '1989 taylor swift' },
  { slug: 'american-idiot', prompt: COVER, correct: 'American Idiot', incorrect: ['Dookie', 'Nimrod', 'Warning'], difficulty: 'medium', artist: 'Green Day', term: 'American Idiot Green Day', collectionId: 1161539183 },
  { slug: 'californication', prompt: COVER, correct: 'Californication', incorrect: ['Blood Sugar Sex Magik', 'Stadium Arcadium', 'By the Way'], difficulty: 'medium', artist: 'Red Hot Chili Peppers', term: 'californication rhcp', collectionId: 947680622 },
  { slug: 'screamadelica', prompt: COVER, correct: 'Screamadelica', incorrect: ['The Stone Roses', 'Pills ’n’ Thrills and Bellyaches', 'Lazer Guided Melodies'], difficulty: 'hard', artist: 'Primal Scream', term: 'screamadelica primal scream' },
  { slug: 'urban-hymns', prompt: COVER, correct: 'Urban Hymns', incorrect: ['A Northern Soul', 'A Storm in Heaven', 'The Bends'], difficulty: 'hard', artist: 'The Verve', term: 'urban hymns verve' },
  { slug: 'rush-of-blood', prompt: COVER, correct: 'A Rush of Blood to the Head', incorrect: ['Parachutes', 'X&Y', 'Viva la Vida or Death and All His Friends'], difficulty: 'medium', artist: 'Coldplay', term: 'a rush of blood to the head coldplay' },
];
