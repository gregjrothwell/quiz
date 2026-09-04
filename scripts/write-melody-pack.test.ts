import { describe, expect, test } from 'vitest';
import {
  MELODY_MIN_PACK,
  MELODY_ROUND_LENGTH,
  MELODY_SPECS,
} from './hand-melody-data';
import { tuneAllowed } from '../src/questions/tune-rights';
import {
  buildMelodyPack,
  mergeMelodyVault,
  upsertMelodySummary,
} from './write-melody-pack';

const KEPT = [
  'ode-to-joy',
  'mountain-king',
  'entertainer',
  'liberty-bell',
  'pomp',
  'jupiter',
] as const;

describe('melody pack size', () => {
  test('covers three default rounds without a repeat', () => {
    expect(MELODY_ROUND_LENGTH).toBe(15);
    expect(MELODY_SPECS.length).toBeGreaterThanOrEqual(MELODY_MIN_PACK);
  });

  test('keeps the original six slugs', () => {
    const slugs = new Set(MELODY_SPECS.map((spec) => spec.slug));
    expect(KEPT.every((slug) => slugs.has(slug))).toBe(true);
  });

  test('drops the conservatoire residue and adds the office hooks', () => {
    const slugs = new Set(MELODY_SPECS.map((spec) => spec.slug));
    const dropped = [
      'early-one-morning',
      'british-grenadiers',
      'aquarium',
      'minute-waltz',
      'habanera',
      'la-donna-e-mobile',
      'rondo-alla-turca',
      'bach-air',
    ];
    const added = [
      'silent-night',
      'daisy-bell',
      'beside-the-seaside',
      'dont-dilly-dally',
      'colonel-bogey',
      'zadok',
      'entry-of-the-gladiators',
      'abide-with-me',
      'jerusalem',
      'swing-low',
      'bolero',
      'rhapsody-in-blue',
      'space-odyssey-2001',
      'dance-of-the-knights',
      'flower-duet',
      'air-on-the-g-string',
      'korobeiniki',
      'wellerman',
      'house-of-the-rising-sun',
      'beethoven-fifth',
      'nimrod',
      'mars',
      'ride-of-the-valkyries',
      'cavalleria-intermezzo',
      'gymnopedie',
      'danny-boy',
      'drunken-sailor',
    ];
    expect(dropped.filter((slug) => slugs.has(slug))).toEqual([]);
    expect(added.filter((slug) => !slugs.has(slug))).toEqual([]);
  });
});

describe('melody rights', () => {
  test('every published tune passes the 1956 test', () => {
    const refused = MELODY_SPECS.filter((spec) => !tuneAllowed(spec.rights));
    expect(refused.map((spec) => spec.slug)).toEqual([]);
  });

  test('Happy Birthday is not in the published specs', () => {
    expect(MELODY_SPECS.some((spec) => /birthday/i.test(spec.correct))).toBe(false);
  });

  test('living writers stay out on copyright, not taste', () => {
    const titles = MELODY_SPECS.map((spec) => spec.correct).join(' ');
    expect(titles).not.toMatch(/arctic monkeys|bond|star wars|in the mood|take five/i);
    expect(titles).not.toMatch(/you.ll never walk alone|white christmas|flower of scotland/i);
    expect(titles).not.toMatch(/knees up|lambeth walk|heart and soul|singin. in the rain|charleston/i);
    expect(titles).not.toMatch(/o fortuna|carmina burana|albinoni|giazotto|lion sleeps/i);
    expect(titles).not.toMatch(/wild mountain thyme|st james infirmary|little brown jug/i);
  });
});

describe('melody options', () => {
  test('slugs and correct titles are unique', () => {
    const slugs = MELODY_SPECS.map((spec) => spec.slug);
    const titles = MELODY_SPECS.map((spec) => spec.correct);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(titles).size).toBe(titles.length);
  });

  test('no card lists Twinkle, Baa Baa and ABC as the same tune', () => {
    const aliases = [/twinkle/i, /baa baa/i, /abc/i, /alphabet song/i];
    for (const spec of MELODY_SPECS) {
      const options = [spec.correct, ...spec.incorrect];
      const hits = aliases.filter((pattern) => options.some((option) => pattern.test(option)));
      expect(hits.length).toBeLessThan(2);
    }
  });

  test('God Save the King is not paired with My Country ’Tis of Thee', () => {
    for (const spec of MELODY_SPECS) {
      const options = [spec.correct, ...spec.incorrect].join(' ');
      const anthem = /god save the (king|queen)/i.test(options);
      const america = /tis of thee/i.test(options);
      expect(anthem && america).toBe(false);
    }
  });

  test('William Tell is not paired with the Lone Ranger', () => {
    for (const spec of MELODY_SPECS) {
      const options = [spec.correct, ...spec.incorrect].join(' ');
      const tell = /william tell/i.test(options);
      const ranger = /lone ranger/i.test(options);
      expect(tell && ranger).toBe(false);
    }
  });

  test('Zadok offers Champions League as a distractor, not the key', () => {
    const zadok = MELODY_SPECS.find((spec) => spec.slug === 'zadok');
    expect(zadok?.correct).toBe('Zadok the Priest');
    expect(zadok?.incorrect).toContain('Champions League');
  });

  test('the Strauss sunrise is answered as 2001, not the German title', () => {
    const sunrise = MELODY_SPECS.find((spec) => spec.slug === 'space-odyssey-2001');
    expect(sunrise?.correct).toBe('2001: A Space Odyssey');
    expect(sunrise?.incorrect).toContain('Also sprach Zarathustra');
  });

  test('PD-via-fame cards use the office name as key or distractor', () => {
    const bySlug = Object.fromEntries(MELODY_SPECS.map((spec) => [spec.slug, spec]));
    expect(bySlug['dance-of-the-knights']?.incorrect).toContain('The Apprentice');
    expect(bySlug['flower-duet']?.incorrect).toContain('British Airways');
    expect(bySlug['air-on-the-g-string']?.correct).toBe('Air on the G String');
    expect(bySlug['air-on-the-g-string']?.incorrect).toContain('Hamlet cigars');
    expect(bySlug.korobeiniki?.correct).toBe('Tetris');
    expect(bySlug.korobeiniki?.incorrect).toContain('Korobeiniki');
    expect(bySlug['house-of-the-rising-sun']?.incorrect).toContain('The Animals');
    expect(bySlug['ride-of-the-valkyries']?.incorrect).toContain('Apocalypse Now');
  });

  test('Rising Sun is a slow vocal line, not Price’s organ arpeggio', () => {
    const rising = MELODY_SPECS.find((spec) => spec.slug === 'house-of-the-rising-sun');
    expect(rising?.voices.every((voice) => voice.type === 'triangle')).toBe(true);
    const gaps = rising?.voices.slice(1).map((voice, i) => voice.start - (rising.voices[i]?.start ?? 0)) ?? [];
    expect(gaps.every((gap) => gap >= 0.25)).toBe(true);
  });
});

describe('mergeMelodyVault', () => {
  test('keeps picture answers and writes the melody set over them', () => {
    const previous = { existingTune: 'Ode to Joy', still: 'The Hay Wain' };
    const melody = { existingTune: 'Ode to Joy', newTune: 'Für Elise' };
    expect(mergeMelodyVault(previous, melody)).toEqual({
      existingTune: 'Ode to Joy',
      still: 'The Hay Wain',
      newTune: 'Für Elise',
    });
  });

  test('drops retired melody ids and leaves picture answers', () => {
    expect(
      mergeMelodyVault(
        { oldTune: 'Early One Morning', still: 'The Hay Wain', kept: 'Ode to Joy' },
        { kept: 'Ode to Joy', newTune: 'Silent Night' },
        ['oldTune'],
      ),
    ).toEqual({
      still: 'The Hay Wain',
      kept: 'Ode to Joy',
      newTune: 'Silent Night',
    });
  });
});

describe('upsertMelodySummary', () => {
  test('replaces only the melody row', () => {
    const index = [
      { id: 'geography' as const, title: 'Geography', blurb: 'Places', count: 10, counts: { easy: 1, medium: 8, hard: 1 } },
      { id: 'melody' as const, title: 'Name that Tune', blurb: 'Six', count: 6, counts: { easy: 2, medium: 4, hard: 0 } },
      { id: 'picture' as const, title: 'Picture Round', blurb: 'Stills', count: 9, counts: { easy: 7, medium: 2, hard: 0 } },
    ];
    const melody = {
      id: 'melody' as const,
      title: 'Name that Tune',
      blurb: 'Public-domain melodies, played by the house synth.',
      count: 70,
      counts: { easy: 28, medium: 28, hard: 0 },
    };
    const next = upsertMelodySummary(index, melody);
    expect(next.map((pack) => pack.id)).toEqual(['geography', 'melody', 'picture']);
    expect(next[1]).toEqual(melody);
    expect(next[2]?.count).toBe(9);
  });
});

describe('buildMelodyPack', () => {
  test('seals every question with no answer keys', () => {
    const { pack, answers } = buildMelodyPack();
    expect(pack.questions.length).toBe(MELODY_SPECS.length);
    expect(Object.keys(answers)).toHaveLength(MELODY_SPECS.length);
    for (const question of pack.questions) {
      expect(question.options).toHaveLength(4);
      expect(question.voices?.every((voice) => voice.type === 'triangle')).toBe(true);
      expect('correct' in question).toBe(false);
      expect('incorrect' in question).toBe(false);
    }
  });
});
