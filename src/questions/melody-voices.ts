import type { Voice } from '../lib/sound';
import type { TuneRights } from './tune-rights';

const G2 = 98.0;
const B2 = 123.47;
const C3 = 130.81;
const F3 = 174.61;
const GS3 = 207.65;
const D3 = 146.83;
const DS3 = 155.56;
const G3 = 196.0;
const A3 = 220.0;
const B3 = 246.94;
const C4 = 261.63;
const CS4 = 277.18;
const D4 = 293.66;
const DS4 = 311.13;
const E4 = 329.63;
const F4 = 349.23;
const FS4 = 369.99;
const G4 = 392.0;
const GS4 = 415.3;
const A4 = 440.0;
const AS4 = 466.16;
const B4 = 493.88;
const C5 = 523.25;
const CS5 = 554.37;
const D5 = 587.33;
const DS5 = 622.25;
const E5 = 659.25;
const F5 = 698.46;
const FS5 = 739.99;
const G5 = 783.99;
const GS5 = 830.61;
const A5 = 880.0;
const B5 = 987.77;
const C6 = 1046.5;
const E6 = 1318.51;

function note(from: number, start: number, duration: number): Voice {
  return { type: 'triangle', from, start, duration, gain: 0.7, cutoff: 2400 };
}

/** Sequential notes. `beat` is time to the next attack; sounding length is 92% of that. */
function fromBeats(beats: ReadonlyArray<readonly [number, number]>): Voice[] {
  let start = 0;
  const voices: Voice[] = [];
  for (const [from, beat] of beats) {
    const duration = Math.round(Math.min(Math.max(beat * 0.92, 0.08), 0.7) * 1000) / 1000;
    voices.push({
      type: 'triangle',
      from,
      start: Math.round(start * 1000) / 1000,
      duration,
      gain: 0.7,
      cutoff: 2400,
    });
    start += beat;
  }
  return voices;
}

/** First eight notes. Beethoven, d. 1827. */
export const ODE_TO_JOY: Voice[] = [
  note(E4, 0, 0.28),
  note(E4, 0.3, 0.28),
  note(F4, 0.6, 0.28),
  note(G4, 0.9, 0.28),
  note(G4, 1.2, 0.28),
  note(F4, 1.5, 0.28),
  note(E4, 1.8, 0.28),
  note(D4, 2.1, 0.4),
];

/**
 * Four-note cell, four bars, shrinking duration. The accel is the tell.
 * Grieg, d. 1907.
 */
export function mountainKing(): Voice[] {
  const cell = [B3, CS4, D4, E4];
  const beats = [0.32, 0.24, 0.18, 0.13];
  const voices: Voice[] = [];
  let start = 0;
  for (const beat of beats) {
    for (const pitch of cell) {
      voices.push(note(pitch, start, beat * 0.92));
      start += beat;
    }
  }
  return voices;
}

/**
 * Two bars, syncopated, C5–G4. Joplin, d. 1917.
 *
 * Short–long gaps rather than even crotchets: that is the rag.
 */
export const THE_ENTERTAINER: Voice[] = [
  note(C5, 0, 0.15),
  note(E5, 0.12, 0.12),
  note(C5, 0.28, 0.18),
  note(A4, 0.48, 0.18),
  note(B4, 0.68, 0.12),
  note(G4, 0.82, 0.28),
  note(C5, 1.14, 0.15),
  note(E5, 1.26, 0.12),
  note(C5, 1.42, 0.18),
  note(A4, 1.62, 0.18),
  note(B4, 1.82, 0.12),
  note(G4, 1.96, 0.35),
];

/** Opening fanfare. Sousa, d. 1932. */
export const LIBERTY_BELL: Voice[] = [
  note(G4, 0, 0.18),
  note(C5, 0.2, 0.18),
  note(E5, 0.4, 0.18),
  note(G5, 0.6, 0.28),
  note(E5, 0.92, 0.18),
  note(C5, 1.12, 0.18),
  note(G4, 1.32, 0.18),
  note(C5, 1.52, 0.4),
];

/** Land of Hope and Glory trio, six notes. Not the march intro. Elgar, d. 1934. */
export const POMP_AND_CIRCUMSTANCE: Voice[] = [
  note(G4, 0, 0.35),
  note(B4, 0.38, 0.35),
  note(D5, 0.76, 0.35),
  note(G5, 1.14, 0.4),
  note(739.99, 1.58, 0.32),
  note(E5, 1.94, 0.5),
];

/** Thaxted hymn, slow minims. Holst, d. 1934. */
export const JUPITER_CHORALE: Voice[] = [
  note(G4, 0, 0.45),
  note(G4, 0.5, 0.45),
  note(A4, 1.0, 0.45),
  note(B4, 1.5, 0.45),
  note(C5, 2.0, 0.7),
  note(B4, 2.75, 0.45),
  note(A4, 3.25, 0.45),
  note(G4, 3.75, 0.7),
];

/** Smoke-test only. Not in the published pack. Patty Hill, d. 1946. */
export const HAPPY_BIRTHDAY: Voice[] = [
  note(C4, 0, 0.18),
  note(C4, 0.2, 0.18),
  note(D4, 0.42, 0.32),
  note(C4, 0.78, 0.32),
  note(F4, 1.14, 0.32),
  note(E4, 1.5, 0.55),
];

/** Chromatic rush. Rimsky-Korsakov, d. 1908. Speed is the tell. */
function flightOfTheBumblebee(): Voice[] {
  const chromatic = [
    E5, DS5, E5, D5, CS5, C5, B4, AS4, A4, GS4, G4, FS4, F4, E4, DS4, E4,
    F4, FS4, G4, GS4, A4, AS4, B4, C5, CS5, D5, DS5, E5, F5, E5, DS5, D5,
    CS5, D5, DS5, E5,
  ];
  return fromBeats(chromatic.map((from) => [from, 0.07] as const));
}

export interface MelodySpec {
  slug: string;
  prompt: string;
  correct: string;
  incorrect: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  voices: Voice[];
  rights: TuneRights;
}

export const MELODY_SPECS: readonly MelodySpec[] = [
  {
    slug: 'ode-to-joy',
    prompt: 'Name this tune.',
    correct: 'Ode to Joy',
    incorrect: ['Für Elise', 'Eine kleine Nachtmusik', 'The Blue Danube'],
    difficulty: 'easy',
    voices: ODE_TO_JOY,
    rights: { kind: 'composed', authorDied: 1827 },
  },
  {
    slug: 'mountain-king',
    prompt: 'Name this tune.',
    correct: 'In the Hall of the Mountain King',
    incorrect: ['Morning Mood', 'Anitra’s Dance', 'Peer Gynt’s Homecoming'],
    difficulty: 'easy',
    voices: mountainKing(),
    rights: { kind: 'composed', authorDied: 1907 },
  },
  {
    slug: 'entertainer',
    prompt: 'Name this tune.',
    correct: 'The Entertainer',
    incorrect: ['Maple Leaf Rag', 'The Cascades', 'Pineapple Rag'],
    difficulty: 'medium',
    voices: THE_ENTERTAINER,
    rights: { kind: 'composed', authorDied: 1917 },
  },
  {
    slug: 'liberty-bell',
    prompt: 'Name this tune.',
    correct: 'The Liberty Bell',
    incorrect: ['The Monty Python theme', 'The Stars and Stripes Forever', 'The Washington Post'],
    difficulty: 'medium',
    voices: LIBERTY_BELL,
    rights: { kind: 'composed', authorDied: 1932 },
  },
  {
    slug: 'pomp',
    prompt: 'Name this tune.',
    correct: 'Pomp and Circumstance',
    incorrect: ['Jerusalem', 'Rule, Britannia!', 'Nimrod'],
    difficulty: 'medium',
    voices: POMP_AND_CIRCUMSTANCE,
    rights: { kind: 'composed', authorDied: 1934 },
  },
  {
    slug: 'jupiter',
    prompt: 'Name this tune.',
    correct: 'Jupiter',
    incorrect: ['Mars', 'Venus', 'Saturn'],
    difficulty: 'medium',
    voices: JUPITER_CHORALE,
    rights: { kind: 'composed', authorDied: 1934 },
  },
  {
    slug: 'greensleeves',
    prompt: 'Name this tune.',
    correct: 'Greensleeves',
    incorrect: ['Scarborough Fair', 'Early One Morning', 'Drink to Me Only'],
    difficulty: 'medium',
    voices: fromBeats([
      [E4, 0.28], [G4, 0.28], [A4, 0.28], [B4, 0.42], [C5, 0.28], [B4, 0.28],
      [A4, 0.28], [G4, 0.42], [E4, 0.28], [FS4, 0.28], [G4, 0.28], [A4, 0.42],
      [FS4, 0.28], [D4, 0.28], [E4, 0.5],
    ]),
    rights: { kind: 'traditional' },
  },
  {
    slug: 'london-bridge',
    prompt: 'Name this tune.',
    correct: 'London Bridge',
    incorrect: ['Oranges and Lemons', 'Pop Goes the Weasel', 'The Grand Old Duke of York'],
    difficulty: 'easy',
    voices: fromBeats([
      [G4, 0.28], [A4, 0.28], [G4, 0.28], [F4, 0.28], [E4, 0.28], [F4, 0.28], [G4, 0.5],
      [D4, 0.28], [E4, 0.28], [F4, 0.5], [E4, 0.28], [F4, 0.28], [G4, 0.5],
    ]),
    rights: { kind: 'traditional' },
  },
  {
    slug: 'frere-jacques',
    prompt: 'Name this tune.',
    correct: 'Frère Jacques',
    incorrect: ['Alouette', 'Sur le pont d’Avignon', 'Au clair de la lune'],
    difficulty: 'easy',
    voices: fromBeats([
      [C4, 0.28], [D4, 0.28], [E4, 0.28], [C4, 0.28],
      [C4, 0.28], [D4, 0.28], [E4, 0.28], [C4, 0.28],
      [E4, 0.28], [F4, 0.28], [G4, 0.55],
      [E4, 0.28], [F4, 0.28], [G4, 0.55],
    ]),
    rights: { kind: 'traditional' },
  },
  {
    slug: 'oh-susanna',
    prompt: 'Name this tune.',
    correct: 'Oh! Susanna',
    incorrect: ['Camptown Races', 'Yankee Doodle', 'Dixie'],
    difficulty: 'easy',
    voices: fromBeats([
      [C5, 0.2], [D5, 0.2], [E5, 0.2], [G5, 0.4], [G5, 0.2], [A5, 0.2], [G5, 0.2], [E5, 0.4],
      [C5, 0.2], [D5, 0.2], [E5, 0.35], [E5, 0.2], [D5, 0.2], [C5, 0.2], [D5, 0.45],
    ]),
    rights: { kind: 'composed', authorDied: 1864 },
  },
  {
    slug: 'when-the-saints',
    prompt: 'Name this tune.',
    correct: 'When the Saints Go Marching In',
    incorrect: ['Swing Low, Sweet Chariot', 'Down by the Riverside', 'Ol’ Man River'],
    difficulty: 'easy',
    voices: fromBeats([
      [C4, 0.22], [E4, 0.22], [F4, 0.22], [G4, 0.6],
      [C4, 0.22], [E4, 0.22], [F4, 0.22], [G4, 0.6],
      [C4, 0.22], [E4, 0.22], [F4, 0.22], [G4, 0.22], [E4, 0.22], [C4, 0.22], [E4, 0.22], [D4, 0.5],
    ]),
    rights: { kind: 'traditional' },
  },
  {
    slug: 'auld-lang-syne',
    prompt: 'Name this tune.',
    correct: 'Auld Lang Syne',
    incorrect: ['Danny Boy', 'Loch Lomond', 'The Skye Boat Song'],
    difficulty: 'easy',
    voices: fromBeats([
      [C4, 0.22], [F4, 0.35], [F4, 0.18], [F4, 0.35], [A4, 0.35],
      [G4, 0.35], [F4, 0.35], [G4, 0.35], [A4, 0.35],
      [F4, 0.35], [A4, 0.35], [C5, 0.55],
    ]),
    rights: { kind: 'traditional' },
  },
  {
    slug: 'scarborough-fair',
    prompt: 'Name this tune.',
    correct: 'Scarborough Fair',
    incorrect: ['Greensleeves', 'Barbara Allen', 'The Ash Grove'],
    difficulty: 'medium',
    voices: fromBeats([
      [A4, 0.45], [E4, 0.22], [E4, 0.4], [E4, 0.22], [B4, 0.4],
      [A4, 0.4], [G4, 0.22], [E4, 0.4], [D4, 0.4], [E4, 0.55],
    ]),
    rights: { kind: 'traditional' },
  },
  {
    slug: 'rule-britannia',
    prompt: 'Name this tune.',
    correct: 'Rule, Britannia!',
    incorrect: ['Jerusalem', 'Heart of Oak', 'Land of Hope and Glory'],
    difficulty: 'medium',
    voices: fromBeats([
      [C5, 0.25], [D5, 0.25], [E5, 0.25], [F5, 0.4], [G5, 0.35], [E5, 0.25],
      [C5, 0.25], [D5, 0.25], [E5, 0.25], [F5, 0.45], [E5, 0.3], [D5, 0.3], [C5, 0.5],
    ]),
    rights: { kind: 'composed', authorDied: 1778 },
  },
  {
    slug: 'amazing-grace',
    prompt: 'Name this tune.',
    correct: 'Amazing Grace',
    incorrect: ['Abide with Me', 'How Great Thou Art', 'The Old Rugged Cross'],
    difficulty: 'easy',
    voices: fromBeats([
      [G3, 0.3], [C4, 0.5], [E4, 0.25], [C4, 0.5], [E4, 0.5],
      [D4, 0.5], [C4, 0.5], [A3, 0.5], [G3, 0.65],
    ]),
    rights: { kind: 'traditional' },
  },
  {
    slug: 'eine-kleine',
    prompt: 'Name this tune.',
    correct: 'Eine kleine Nachtmusik',
    incorrect: ['Symphony No. 40', 'The Marriage of Figaro', 'Don Giovanni'],
    difficulty: 'easy',
    voices: fromBeats([
      [G4, 0.18], [D4, 0.18], [G4, 0.18], [D4, 0.18], [G4, 0.18], [B4, 0.18], [D5, 0.5],
      [C5, 0.18], [A4, 0.18], [C5, 0.18], [A4, 0.18], [C5, 0.18], [FS4, 0.18], [A4, 0.45],
    ]),
    rights: { kind: 'composed', authorDied: 1791 },
  },
  {
    slug: 'fuer-elise',
    prompt: 'Name this tune.',
    correct: 'Für Elise',
    incorrect: ['Moonlight Sonata', 'Pathétique', 'Waldstein'],
    difficulty: 'easy',
    voices: fromBeats([
      [E5, 0.18], [DS5, 0.18], [E5, 0.18], [DS5, 0.18], [E5, 0.18], [B4, 0.18], [D5, 0.18], [C5, 0.18],
      [A4, 0.45], [C4, 0.18], [E4, 0.18], [A4, 0.18], [B4, 0.45],
    ]),
    rights: { kind: 'composed', authorDied: 1827 },
  },
  {
    slug: 'william-tell',
    prompt: 'Name this tune.',
    correct: 'William Tell Overture',
    incorrect: ['The Thieving Magpie', 'The Barber of Seville', 'Semiramide'],
    difficulty: 'easy',
    voices: fromBeats([
      [G4, 0.12], [G4, 0.12], [G4, 0.12], [C5, 0.22], [E5, 0.22], [G5, 0.4],
      [G4, 0.12], [G4, 0.12], [G4, 0.12], [C5, 0.22], [E5, 0.22], [G5, 0.4],
      [E5, 0.12], [F5, 0.12], [G5, 0.22], [G5, 0.12], [F5, 0.12], [E5, 0.12], [D5, 0.35],
    ]),
    rights: { kind: 'composed', authorDied: 1868 },
  },
  {
    slug: 'swan-lake',
    prompt: 'Name this tune.',
    correct: 'Swan Lake',
    incorrect: ['Sleeping Beauty', 'Romeo and Juliet', 'The Nutcracker'],
    difficulty: 'medium',
    voices: fromBeats([
      [A4, 0.5], [F5, 0.35], [E5, 0.35], [D5, 0.35], [CS5, 0.35],
      [D5, 0.35], [E5, 0.5], [A4, 0.65],
    ]),
    rights: { kind: 'composed', authorDied: 1893 },
  },
  {
    slug: 'sugar-plum',
    prompt: 'Name this tune.',
    correct: 'Dance of the Sugar Plum Fairy',
    incorrect: ['Waltz of the Flowers', 'Trepak', 'Arabian Dance'],
    difficulty: 'medium',
    voices: fromBeats([
      [G4, 0.15], [E5, 0.22], [D5, 0.22], [G4, 0.15], [E5, 0.22], [D5, 0.22],
      [G4, 0.15], [E5, 0.22], [D5, 0.22], [C5, 0.22], [B4, 0.35], [A4, 0.25], [G4, 0.4],
    ]),
    rights: { kind: 'composed', authorDied: 1893 },
  },
  {
    slug: 'toreador',
    prompt: 'Name this tune.',
    correct: 'Toreador Song',
    incorrect: ['Habanera', 'Flower Song', 'Seguidilla'],
    difficulty: 'medium',
    voices: fromBeats([
      [E4, 0.18], [E4, 0.18], [E4, 0.18], [E4, 0.18], [D4, 0.18], [C4, 0.18], [D4, 0.18], [E4, 0.18],
      [F4, 0.18], [F4, 0.18], [F4, 0.18], [F4, 0.18], [E4, 0.18], [D4, 0.18], [C4, 0.4],
    ]),
    rights: { kind: 'composed', authorDied: 1875 },
  },
  {
    slug: 'nessun-dorma',
    prompt: 'Name this tune.',
    correct: 'Nessun dorma',
    incorrect: ['O mio babbino caro', 'Che gelida manina', 'Un bel dì vedremo'],
    difficulty: 'medium',
    voices: fromBeats([
      [A3, 0.3], [A3, 0.3], [D4, 0.6], [D4, 0.35], [E4, 0.25],
      [D4, 0.3], [CS4, 0.3], [B3, 0.3], [A3, 0.5], [B3, 0.3], [CS4, 0.3], [D4, 0.5],
    ]),
    rights: { kind: 'composed', authorDied: 1924 },
  },
  {
    slug: 'bumblebee',
    prompt: 'Name this tune.',
    correct: 'Flight of the Bumblebee',
    incorrect: ['Scheherazade', 'Capriccio Espagnol', 'Russian Easter Festival'],
    difficulty: 'medium',
    voices: flightOfTheBumblebee(),
    rights: { kind: 'composed', authorDied: 1908 },
  },
  {
    slug: 'radetzky',
    prompt: 'Name this tune.',
    correct: 'Radetzky March',
    incorrect: ['Entry of the Gladiators', 'The Stars and Stripes Forever', 'The Washington Post'],
    difficulty: 'medium',
    voices: fromBeats([
      [G4, 0.15], [C5, 0.2], [C5, 0.2], [C5, 0.2], [B4, 0.15], [C5, 0.2], [D5, 0.35],
      [G4, 0.2], [D5, 0.2], [D5, 0.2], [D5, 0.2], [CS5, 0.15], [D5, 0.2], [E5, 0.45],
    ]),
    rights: { kind: 'composed', authorDied: 1849 },
  },
  {
    slug: 'bridal-chorus',
    prompt: 'Name this tune.',
    correct: 'Here Comes the Bride',
    incorrect: ['Wedding March', 'Ave Maria', 'Pomp and Circumstance'],
    difficulty: 'easy',
    voices: fromBeats([
      [G4, 0.4], [C5, 0.2], [C5, 0.2], [C5, 0.5], [C5, 0.25], [E5, 0.25],
      [D5, 0.25], [C5, 0.25], [D5, 0.4], [B4, 0.3], [G4, 0.5],
    ]),
    rights: { kind: 'composed', authorDied: 1883 },
  },
  {
    slug: 'toccata',
    prompt: 'Name this tune.',
    correct: 'Toccata and Fugue in D minor',
    incorrect: ['Air on the G String', 'Jesu, Joy of Man’s Desiring', 'Brandenburg Concerto No. 3'],
    difficulty: 'medium',
    voices: fromBeats([
      [A5, 0.15], [G5, 0.12], [A5, 0.4], [A4, 0.15], [G4, 0.12], [A4, 0.4],
      [A3, 0.15], [G3, 0.12], [A3, 0.5], [C4, 0.2], [B3, 0.2], [C4, 0.2], [D4, 0.4],
    ]),
    rights: { kind: 'composed', authorDied: 1750 },
  },
  {
    slug: 'canon-in-d',
    prompt: 'Name this tune.',
    correct: 'Canon in D',
    incorrect: ['Air on the G String', 'Jesu, Joy of Man’s Desiring', 'Sheep May Safely Graze'],
    difficulty: 'medium',
    voices: fromBeats([
      [FS5, 0.35], [E5, 0.35], [D5, 0.35], [CS5, 0.35],
      [B4, 0.35], [A4, 0.35], [B4, 0.35], [CS5, 0.35], [D5, 0.5],
    ]),
    rights: { kind: 'composed', authorDied: 1706 },
  },
  {
    slug: 'vivaldi-spring',
    prompt: 'Name this tune.',
    correct: 'Spring',
    incorrect: ['Water Music', 'Arrival of the Queen of Sheba', 'Music for the Royal Fireworks'],
    difficulty: 'medium',
    voices: fromBeats([
      [E5, 0.12], [E5, 0.12], [E5, 0.12], [GS5, 0.12], [GS5, 0.12], [GS5, 0.12],
      [B5, 0.12], [B5, 0.12], [B5, 0.12], [E5, 0.32],
      [DS5, 0.15], [E5, 0.15], [FS5, 0.15], [GS5, 0.15], [A5, 0.15], [B5, 0.4],
    ]),
    rights: { kind: 'composed', authorDied: 1741 },
  },
  {
    slug: 'funeral-march',
    prompt: 'Name this tune.',
    correct: 'Funeral March',
    incorrect: ['Minute Waltz', 'Raindrop Prelude', 'Revolutionary Étude'],
    difficulty: 'medium',
    voices: fromBeats([
      [C3, 0.4], [C3, 0.4], [C3, 0.4], [DS3, 0.55], [D3, 0.2],
      [C3, 0.4], [B2, 0.4], [C3, 0.4], [D3, 0.5], [G2, 0.6],
    ]),
    rights: { kind: 'composed', authorDied: 1849 },
  },
  {
    slug: 'brahms-lullaby',
    prompt: 'Name this tune.',
    correct: 'Brahms’ Lullaby',
    incorrect: ['All Through the Night', 'Golden Slumbers', 'Rock-a-bye Baby'],
    difficulty: 'easy',
    voices: fromBeats([
      [E4, 0.3], [FS4, 0.3], [G4, 0.6], [E4, 0.3], [FS4, 0.3], [G4, 0.6],
      [E4, 0.3], [G4, 0.3], [C5, 0.6], [B4, 0.3], [A4, 0.5],
    ]),
    rights: { kind: 'composed', authorDied: 1897 },
  },
  {
    slug: 'new-world-largo',
    prompt: 'Name this tune.',
    correct: 'New World Symphony (Largo)',
    incorrect: ['Slavonic Dances', 'American Quartet', 'Cello Concerto'],
    difficulty: 'medium',
    voices: fromBeats([
      [C4, 0.45], [E4, 0.45], [G4, 0.7], [E4, 0.45], [C4, 0.45],
      [D4, 0.45], [E4, 0.45], [D4, 0.45], [C4, 0.45], [A3, 0.65],
    ]),
    rights: { kind: 'composed', authorDied: 1904 },
  },
  {
    slug: 'the-swan',
    prompt: 'Name this tune.',
    correct: 'The Swan',
    incorrect: ['Aquarium', 'Fossils', 'The Elephant'],
    difficulty: 'medium',
    voices: fromBeats([
      [G4, 0.5], [A4, 0.25], [B4, 0.5], [D5, 0.35], [C5, 0.25],
      [B4, 0.35], [A4, 0.35], [G4, 0.5], [FS4, 0.35], [G4, 0.35], [A4, 0.5], [D4, 0.6],
    ]),
    rights: { kind: 'composed', authorDied: 1921 },
  },
  {
    slug: 'clair-de-lune',
    prompt: 'Name this tune.',
    correct: 'Clair de Lune',
    incorrect: ['Arabesque No. 1', 'La mer', 'Prélude à l’après-midi d’un faune'],
    difficulty: 'medium',
    voices: fromBeats([
      [F4, 0.5], [GS4, 0.35], [C5, 0.5], [F5, 0.7],
      [F5, 0.35], [DS5, 0.35], [CS5, 0.35], [C5, 0.5], [AS4, 0.45], [GS4, 0.6],
    ]),
    rights: { kind: 'composed', authorDied: 1918 },
  },
  {
    slug: 'can-can',
    prompt: 'Name this tune.',
    correct: 'Can-can',
    incorrect: ['Barcarolle', 'The Tales of Hoffmann', 'La belle Hélène'],
    difficulty: 'easy',
    voices: fromBeats([
      [G4, 0.12], [C5, 0.12], [E5, 0.12], [G5, 0.24], [G5, 0.12], [F5, 0.12], [E5, 0.12], [D5, 0.24],
      [C5, 0.12], [D5, 0.12], [E5, 0.12], [C5, 0.24], [G4, 0.12], [C5, 0.12], [E5, 0.12], [G5, 0.12],
      [C6, 0.4],
    ]),
    rights: { kind: 'composed', authorDied: 1880 },
  },
  {
    slug: 'blue-danube',
    prompt: 'Name this tune.',
    correct: 'The Blue Danube',
    incorrect: ['Tales from the Vienna Woods', 'Emperor Waltz', 'Wine, Women and Song'],
    difficulty: 'easy',
    voices: fromBeats([
      [A4, 0.2], [A4, 0.2], [B4, 0.2], [C5, 0.6],
      [C5, 0.2], [C5, 0.2], [D5, 0.2], [E5, 0.6],
      [E5, 0.2], [E5, 0.2], [F5, 0.2], [G5, 0.7],
    ]),
    rights: { kind: 'composed', authorDied: 1899 },
  },
  {
    slug: 'jingle-bells',
    prompt: 'Name this tune.',
    correct: 'Jingle Bells',
    incorrect: ['Deck the Halls', 'We Wish You a Merry Christmas', 'Silent Night'],
    difficulty: 'easy',
    voices: fromBeats([
      [E4, 0.2], [E4, 0.2], [E4, 0.4], [E4, 0.2], [E4, 0.2], [E4, 0.4],
      [E4, 0.2], [G4, 0.2], [C4, 0.3], [D4, 0.2], [E4, 0.55],
    ]),
    rights: { kind: 'composed', authorDied: 1893 },
  },
  {
    slug: 'god-save-the-king',
    prompt: 'Name this tune.',
    correct: 'God Save the King',
    incorrect: ['Jerusalem', 'Rule, Britannia!', 'Land of Hope and Glory'],
    difficulty: 'easy',
    voices: fromBeats([
      [G4, 0.35], [G4, 0.35], [A4, 0.4], [FS4, 0.25], [G4, 0.35], [A4, 0.45],
      [B4, 0.35], [B4, 0.35], [C5, 0.4], [B4, 0.25], [A4, 0.35], [G4, 0.5],
    ]),
    rights: { kind: 'traditional' },
  },
  {
    slug: 'twinkle',
    prompt: 'Name this tune.',
    correct: 'Twinkle Twinkle Little Star',
    incorrect: ['Rock-a-bye Baby', 'Hickory Dickory Dock', 'Humpty Dumpty'],
    difficulty: 'easy',
    voices: fromBeats([
      [C4, 0.28], [C4, 0.28], [G4, 0.28], [G4, 0.28], [A4, 0.28], [A4, 0.28], [G4, 0.5],
      [F4, 0.28], [F4, 0.28], [E4, 0.28], [E4, 0.28], [D4, 0.28], [D4, 0.28], [C4, 0.5],
    ]),
    rights: { kind: 'traditional' },
  },
  {
    slug: 'silent-night',
    prompt: 'Name this tune.',
    correct: 'Silent Night',
    incorrect: ['O Holy Night', 'Away in a Manger', 'White Christmas'],
    difficulty: 'easy',
    voices: fromBeats([
      [G4, 0.35], [A4, 0.2], [G4, 0.28], [E4, 0.55],
      [G4, 0.35], [A4, 0.2], [G4, 0.28], [E4, 0.55],
      [D5, 0.4], [D5, 0.28], [B4, 0.55],
      [C5, 0.4], [C5, 0.28], [G4, 0.6],
    ]),
    rights: { kind: 'composed', authorDied: 1863, lyricistDied: 1848 },
  },
  {
    slug: 'daisy-bell',
    prompt: 'Name this tune.',
    correct: 'Daisy Bell',
    incorrect: ['2001: A Space Odyssey', 'Hello Dolly', 'Moon River'],
    difficulty: 'easy',
    voices: fromBeats([
      [C5, 0.2], [C5, 0.2], [C5, 0.2], [C5, 0.2], [E5, 0.2], [G5, 0.28], [E5, 0.2], [C5, 0.35],
      [D5, 0.2], [D5, 0.2], [D5, 0.2], [D5, 0.2], [B4, 0.28], [G4, 0.5],
    ]),
    rights: { kind: 'composed', authorDied: 1922 },
  },
  {
    slug: 'beside-the-seaside',
    prompt: 'Name this tune.',
    correct: 'I Do Like to Be Beside the Seaside',
    incorrect: ['Pack Up Your Troubles', 'Any Old Iron', 'Maybe It’s Because I’m a Londoner'],
    difficulty: 'easy',
    voices: fromBeats([
      [C4, 0.18], [E4, 0.18], [G4, 0.18], [C5, 0.22], [C5, 0.18], [C5, 0.18],
      [D5, 0.18], [C5, 0.22], [A4, 0.22], [C5, 0.28], [G4, 0.45],
      [C4, 0.18], [E4, 0.18], [G4, 0.18], [C5, 0.22], [C5, 0.18], [C5, 0.18],
      [D5, 0.18], [C5, 0.22], [A4, 0.28], [G4, 0.5],
    ]),
    rights: { kind: 'composed', authorDied: 1918 },
  },
  {
    slug: 'dont-dilly-dally',
    prompt: 'Name this tune.',
    correct: 'My Old Man (Said Follow the Van)',
    incorrect: ['Any Old Iron', 'Knees Up Mother Brown', 'The Lambeth Walk'],
    difficulty: 'easy',
    voices: fromBeats([
      [C4, 0.18], [C4, 0.18], [C4, 0.18], [E4, 0.18], [G4, 0.22], [G4, 0.18], [E4, 0.18], [C4, 0.32],
      [D4, 0.18], [D4, 0.18], [D4, 0.18], [F4, 0.18], [A4, 0.22], [A4, 0.18], [F4, 0.18], [D4, 0.4],
    ]),
    rights: { kind: 'composed', authorDied: 1923, lyricistDied: 1924 },
  },
  {
    slug: 'colonel-bogey',
    prompt: 'Name this tune.',
    correct: 'Colonel Bogey',
    incorrect: ['The Bridge on the River Kwai', 'The Dam Busters', 'The Great Escape'],
    difficulty: 'medium',
    voices: fromBeats([
      [C4, 0.18], [E4, 0.18], [G4, 0.18], [E4, 0.18], [G4, 0.5],
      [C4, 0.18], [E4, 0.18], [G4, 0.18], [E4, 0.18], [G4, 0.45],
      [A4, 0.18], [A4, 0.18], [A4, 0.18], [G4, 0.18], [F4, 0.18], [E4, 0.18], [D4, 0.45],
    ]),
    rights: { kind: 'composed', authorDied: 1945 },
  },
  {
    slug: 'zadok',
    prompt: 'Name this tune.',
    correct: 'Zadok the Priest',
    incorrect: ['Champions League', 'Messiah', 'I Was Glad'],
    difficulty: 'medium',
    voices: fromBeats([
      [D5, 0.22], [D5, 0.22], [D5, 0.22], [D5, 0.22], [B4, 0.28], [G4, 0.45],
      [A4, 0.22], [A4, 0.22], [A4, 0.22], [A4, 0.22], [FS4, 0.28], [D4, 0.5],
    ]),
    rights: { kind: 'composed', authorDied: 1759 },
  },
  {
    slug: 'entry-of-the-gladiators',
    prompt: 'Name this tune.',
    correct: 'Entry of the Gladiators',
    incorrect: ['Yakety Sax', 'Match of the Day', 'The Liberty Bell'],
    difficulty: 'easy',
    voices: fromBeats([
      [C5, 0.12], [E5, 0.12], [G5, 0.12], [C6, 0.22], [AS4, 0.15], [A4, 0.15], [GS4, 0.15], [G4, 0.28],
      [C5, 0.12], [E5, 0.12], [G5, 0.12], [C6, 0.22], [E6, 0.18], [C6, 0.18], [G5, 0.35],
    ]),
    rights: { kind: 'composed', authorDied: 1916 },
  },
  {
    slug: 'abide-with-me',
    prompt: 'Name this tune.',
    correct: 'Abide with Me',
    incorrect: ['Amazing Grace', 'Jerusalem', 'How Great Thou Art'],
    difficulty: 'easy',
    voices: fromBeats([
      [G3, 0.3], [C4, 0.4], [E4, 0.28], [D4, 0.28], [C4, 0.4],
      [E4, 0.3], [G4, 0.45], [G4, 0.4],
      [A4, 0.35], [A4, 0.3], [G4, 0.3], [F4, 0.3], [E4, 0.4], [D4, 0.55],
    ]),
    rights: { kind: 'composed', authorDied: 1889, lyricistDied: 1847 },
  },
  {
    slug: 'jerusalem',
    prompt: 'Name this tune.',
    correct: 'Jerusalem',
    incorrect: ['Land of Hope and Glory', 'Rule, Britannia!', 'I Vow to Thee, My Country'],
    difficulty: 'easy',
    voices: fromBeats([
      [C4, 0.28], [F4, 0.35], [F4, 0.22], [G4, 0.28], [A4, 0.28], [AS4, 0.35],
      [A4, 0.22], [G4, 0.28], [F4, 0.28], [G4, 0.28], [A4, 0.5],
    ]),
    rights: { kind: 'composed', authorDied: 1918 },
  },
  {
    slug: 'swing-low',
    prompt: 'Name this tune.',
    correct: 'Swing Low, Sweet Chariot',
    incorrect: ['Flower of Scotland', 'You’ll Never Walk Alone', 'Bread of Heaven'],
    difficulty: 'easy',
    voices: fromBeats([
      [G3, 0.28], [C4, 0.4], [E4, 0.22], [C4, 0.28], [E4, 0.35],
      [D4, 0.35], [C4, 0.35], [A3, 0.35], [G3, 0.55],
    ]),
    rights: { kind: 'traditional' },
  },
  {
    slug: 'bolero',
    prompt: 'Name this tune.',
    correct: 'Boléro',
    incorrect: ['Torvill and Dean', 'The Flower Duet', 'Clair de Lune'],
    difficulty: 'medium',
    voices: fromBeats([
      [C5, 0.22], [B4, 0.18], [C5, 0.18], [D5, 0.22], [C5, 0.18], [B4, 0.18],
      [A4, 0.22], [C5, 0.22], [B4, 0.18], [A4, 0.18], [G4, 0.22], [A4, 0.18], [B4, 0.18], [C5, 0.4],
    ]),
    rights: { kind: 'composed', authorDied: 1937 },
  },
  {
    slug: 'rhapsody-in-blue',
    prompt: 'Name this tune.',
    correct: 'Rhapsody in Blue',
    incorrect: ['An American in Paris', 'Rhapsody on a Theme of Paganini', 'Summertime'],
    difficulty: 'medium',
    voices: fromBeats([
      [C5, 0.35], [E5, 0.28], [G5, 0.4], [FS5, 0.22], [F5, 0.22], [E5, 0.28],
      [D5, 0.28], [C5, 0.35], [B4, 0.5],
    ]),
    rights: { kind: 'composed', authorDied: 1937 },
  },
  {
    slug: 'space-odyssey-2001',
    prompt: 'Name this tune.',
    correct: '2001: A Space Odyssey',
    incorrect: ['Also sprach Zarathustra', 'Star Wars', '2010'],
    difficulty: 'easy',
    voices: fromBeats([
      [C3, 0.7], [G3, 0.7], [C4, 1.0],
      [C5, 0.2], [G5, 0.2], [C6, 0.7],
    ]),
    rights: { kind: 'composed', authorDied: 1949 },
  },
  {
    slug: 'o-come-all-ye-faithful',
    prompt: 'Name this tune.',
    correct: 'O Come All Ye Faithful',
    incorrect: ['Once in Royal David’s City', 'O Little Town of Bethlehem', 'The First Noel'],
    difficulty: 'easy',
    voices: fromBeats([
      [G4, 0.35], [G4, 0.22], [D4, 0.35], [G4, 0.35], [A4, 0.35], [D4, 0.55],
      [B4, 0.22], [A4, 0.22], [B4, 0.22], [C5, 0.28], [B4, 0.22], [A4, 0.22], [G4, 0.45],
    ]),
    rights: { kind: 'composed', authorDied: 1786 },
  },
  {
    slug: 'hark-the-herald',
    prompt: 'Name this tune.',
    correct: 'Hark the Herald Angels Sing',
    incorrect: ['O Come All Ye Faithful', 'Joy to the World', 'Silent Night'],
    difficulty: 'easy',
    voices: fromBeats([
      [C4, 0.28], [F4, 0.28], [F4, 0.22], [E4, 0.22], [F4, 0.28], [G4, 0.28],
      [A4, 0.28], [A4, 0.22], [G4, 0.45],
      [C5, 0.28], [C5, 0.22], [AS4, 0.22], [A4, 0.28], [G4, 0.28], [A4, 0.22], [G4, 0.22], [F4, 0.45],
    ]),
    rights: { kind: 'composed', authorDied: 1915 },
  },
  {
    slug: 'deck-the-halls',
    prompt: 'Name this tune.',
    correct: 'Deck the Halls',
    incorrect: ['Jingle Bells', 'We Wish You a Merry Christmas', 'The Holly and the Ivy'],
    difficulty: 'easy',
    voices: fromBeats([
      [C5, 0.22], [B4, 0.16], [A4, 0.16], [G4, 0.22], [F4, 0.16], [G4, 0.16], [A4, 0.22], [F4, 0.28],
      [G4, 0.16], [A4, 0.16], [B4, 0.16], [C5, 0.35],
    ]),
    rights: { kind: 'traditional' },
  },
  {
    slug: 'we-wish-you',
    prompt: 'Name this tune.',
    correct: 'We Wish You a Merry Christmas',
    incorrect: ['Deck the Halls', 'Jingle Bells', 'Good King Wenceslas'],
    difficulty: 'easy',
    voices: fromBeats([
      [G4, 0.22], [C5, 0.22], [C5, 0.16], [D5, 0.16], [C5, 0.16], [B4, 0.16], [A4, 0.28], [A4, 0.28],
      [D5, 0.22], [D5, 0.16], [E5, 0.16], [D5, 0.16], [C5, 0.16], [B4, 0.28], [G4, 0.4],
    ]),
    rights: { kind: 'traditional' },
  },
  {
    slug: 'sorcerers-apprentice',
    prompt: 'Name this tune.',
    correct: 'The Sorcerer’s Apprentice',
    incorrect: ['Fantasia', 'Night on Bald Mountain', 'The Nutcracker'],
    difficulty: 'medium',
    voices: fromBeats([
      [F3, 0.35], [GS3, 0.16], [F3, 0.16], [C3, 0.35],
      [F3, 0.18], [GS3, 0.18], [C4, 0.18], [F4, 0.45],
    ]),
    rights: { kind: 'composed', authorDied: 1935 },
  },
  {
    slug: 'dance-of-the-knights',
    prompt: 'Name this tune.',
    correct: 'Dance of the Knights',
    incorrect: ['The Apprentice', 'Romeo and Juliet', 'The Planets'],
    difficulty: 'easy',
    voices: fromBeats([
      [B3, 0.16], [E4, 0.16], [G4, 0.16], [B4, 0.22], [E5, 0.4],
      [B4, 0.16], [G4, 0.16], [E4, 0.28],
      [B3, 0.16], [E4, 0.16], [G4, 0.16], [B4, 0.22], [E5, 0.45],
    ]),
    rights: { kind: 'composed', authorDied: 1953 },
  },
  {
    slug: 'flower-duet',
    prompt: 'Name this tune.',
    correct: 'Flower Duet',
    incorrect: ['British Airways', 'The Pearl Fishers', 'Lakmé'],
    difficulty: 'medium',
    voices: fromBeats([
      [E5, 0.28], [G5, 0.28], [E5, 0.22], [D5, 0.22], [C5, 0.28], [D5, 0.22], [E5, 0.35],
      [G4, 0.28], [A4, 0.22], [C5, 0.22], [B4, 0.22], [A4, 0.22], [G4, 0.45],
    ]),
    rights: { kind: 'composed', authorDied: 1891 },
  },
  {
    slug: 'air-on-the-g-string',
    prompt: 'Name this tune.',
    correct: 'Air on the G String',
    incorrect: ['Hamlet cigars', 'Jesu, Joy of Man’s Desiring', 'Sheep May Safely Graze'],
    difficulty: 'medium',
    voices: fromBeats([
      [D5, 0.7], [CS5, 0.25], [D5, 0.35], [B4, 0.7],
      [A4, 0.25], [G4, 0.35], [FS4, 0.5], [G4, 0.35], [A4, 0.6],
    ]),
    rights: { kind: 'composed', authorDied: 1908 },
  },
  {
    slug: 'korobeiniki',
    prompt: 'Name this tune.',
    correct: 'Tetris',
    incorrect: ['Korobeiniki', 'Super Mario', 'Pac-Man'],
    difficulty: 'easy',
    voices: fromBeats([
      [E5, 0.2], [B4, 0.16], [C5, 0.16], [D5, 0.2], [C5, 0.16], [B4, 0.16], [A4, 0.28],
      [A4, 0.16], [C5, 0.16], [E5, 0.2], [D5, 0.16], [C5, 0.16], [B4, 0.28],
      [B4, 0.16], [C5, 0.16], [D5, 0.2], [E5, 0.22], [C5, 0.2], [A4, 0.2], [A4, 0.4],
    ]),
    rights: { kind: 'traditional' },
  },
  {
    slug: 'wellerman',
    prompt: 'Name this tune.',
    correct: 'The Wellerman',
    incorrect: ['Drunken Sailor', 'Blow the Man Down', 'Spanish Ladies'],
    difficulty: 'easy',
    voices: fromBeats([
      [C4, 0.2], [C4, 0.2], [C4, 0.2], [E4, 0.2], [G4, 0.28], [G4, 0.22], [E4, 0.2], [C4, 0.32],
      [D4, 0.2], [D4, 0.2], [D4, 0.2], [F4, 0.2], [A4, 0.28], [G4, 0.22], [E4, 0.22], [C4, 0.4],
    ]),
    rights: { kind: 'traditional' },
  },
  {
    slug: 'house-of-the-rising-sun',
    prompt: 'Name this tune.',
    correct: 'House of the Rising Sun',
    incorrect: ['The Animals', 'Worried Man Blues', 'Greensleeves'],
    difficulty: 'easy',
    voices: fromBeats([
      [A3, 0.28], [C4, 0.28], [D4, 0.32], [F4, 0.35], [A4, 0.4],
      [G4, 0.32], [F4, 0.32], [D4, 0.55],
    ]),
    rights: { kind: 'traditional' },
  },
  {
    slug: 'beethoven-fifth',
    prompt: 'Name this tune.',
    correct: 'Beethoven’s Fifth',
    incorrect: ['Beethoven’s Ninth', 'Für Elise', 'Ode to Joy'],
    difficulty: 'easy',
    voices: fromBeats([
      [G4, 0.16], [G4, 0.16], [G4, 0.16], [DS4, 0.7],
      [F4, 0.16], [F4, 0.16], [F4, 0.16], [D4, 0.7],
    ]),
    rights: { kind: 'composed', authorDied: 1827 },
  },
  {
    slug: 'nimrod',
    prompt: 'Name this tune.',
    correct: 'Nimrod',
    incorrect: ['Pomp and Circumstance', 'The Last Post', 'Enigma Variations'],
    difficulty: 'medium',
    voices: fromBeats([
      [G4, 0.55], [DS4, 0.45], [F4, 0.4], [D4, 0.4],
      [DS4, 0.4], [C4, 0.55],
    ]),
    rights: { kind: 'composed', authorDied: 1934 },
  },
  {
    slug: 'mars',
    prompt: 'Name this tune.',
    correct: 'Mars',
    incorrect: ['Jupiter', 'Imperial March', 'Also sprach Zarathustra'],
    difficulty: 'medium',
    voices: fromBeats([
      [G3, 0.16], [G3, 0.16], [G3, 0.16], [G3, 0.16], [G3, 0.28],
      [GS3, 0.16], [G3, 0.16], [G3, 0.16], [G3, 0.16], [G3, 0.28],
      [G3, 0.16], [G3, 0.16], [C4, 0.22], [DS4, 0.22], [G4, 0.45],
    ]),
    rights: { kind: 'composed', authorDied: 1934 },
  },
  {
    slug: 'ride-of-the-valkyries',
    prompt: 'Name this tune.',
    correct: 'Ride of the Valkyries',
    incorrect: ['Apocalypse Now', 'Siegfried', 'The Flying Dutchman'],
    difficulty: 'medium',
    voices: fromBeats([
      [B4, 0.16], [DS5, 0.16], [FS5, 0.16], [B5, 0.28],
      [AS4, 0.14], [GS4, 0.14], [FS4, 0.16], [GS4, 0.22], [E4, 0.28],
      [B4, 0.16], [DS5, 0.16], [FS5, 0.16], [B5, 0.4],
    ]),
    rights: { kind: 'composed', authorDied: 1883 },
  },
  {
    slug: 'cavalleria-intermezzo',
    prompt: 'Name this tune.',
    correct: 'Cavalleria Rusticana',
    incorrect: ['The Godfather', 'Pagliacci', 'Madame Butterfly'],
    difficulty: 'medium',
    voices: fromBeats([
      [F4, 0.35], [A4, 0.3], [C5, 0.35], [F5, 0.55],
      [E5, 0.3], [D5, 0.3], [C5, 0.3], [AS4, 0.35], [A4, 0.3], [G4, 0.45],
    ]),
    rights: { kind: 'composed', authorDied: 1945 },
  },
  {
    slug: 'gymnopedie',
    prompt: 'Name this tune.',
    correct: 'Gymnopédie No. 1',
    incorrect: ['Clair de Lune', 'Gnossienne No. 1', 'Pavane'],
    difficulty: 'medium',
    voices: fromBeats([
      [FS5, 0.5], [E5, 0.7], [B4, 0.85],
      [A5, 0.45], [G5, 0.4], [FS5, 0.4], [E5, 0.4], [D5, 0.55],
    ]),
    rights: { kind: 'composed', authorDied: 1925 },
  },
  {
    slug: 'danny-boy',
    prompt: 'Name this tune.',
    correct: 'Danny Boy',
    incorrect: ['Londonderry Air', 'Auld Lang Syne', 'The Skye Boat Song'],
    difficulty: 'easy',
    voices: fromBeats([
      [C4, 0.28], [F4, 0.35], [G4, 0.28], [A4, 0.4], [C5, 0.35], [A4, 0.28], [G4, 0.4],
      [F4, 0.28], [D4, 0.28], [C4, 0.28], [D4, 0.28], [F4, 0.5],
    ]),
    rights: { kind: 'traditional' },
  },
  {
    slug: 'drunken-sailor',
    prompt: 'Name this tune.',
    correct: 'Drunken Sailor',
    incorrect: ['Blow the Man Down', 'Spanish Ladies', 'Shenandoah'],
    difficulty: 'easy',
    voices: fromBeats([
      [E4, 0.18], [E4, 0.18], [E4, 0.18], [E4, 0.18], [G4, 0.22], [E4, 0.18], [D4, 0.18], [B3, 0.28],
      [E4, 0.2], [E4, 0.35],
      [D4, 0.18], [D4, 0.18], [D4, 0.18], [D4, 0.18], [FS4, 0.22], [D4, 0.18], [C4, 0.18], [A3, 0.4],
    ]),
    rights: { kind: 'traditional' },
  },
];
