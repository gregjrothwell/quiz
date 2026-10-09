import { describe, expect, test } from 'vitest';
import { isBonusCatchphrase } from './catchphraseBonus';
import { optionsAtMs } from './optionsHold';
import {
  dealRandomRound,
  questionPack,
  quotasFor,
  randomPackSummary,
  withRandomPack,
  type RandomAsked,
  type RandomPools,
  type RandomSource,
  RANDOM_SOURCES,
} from './randomRound';
import { reduce } from './reducer';
import { songClueAtMs } from './songClue';
import { buildQuizQuestions, createRoom, type QuizQuestion, type RoomState } from './state';
import type { PackId, PackSummary, SealedQuestion } from '../questions/types';

/** Deterministic pseudo-random source so two deals can be compared. */
function seededRng(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1_103_515_245 + 12_345) % 2_147_483_648;
    return value / 2_147_483_648;
  };
}

function sealed(
  id: string,
  extra: Partial<SealedQuestion> = {},
): SealedQuestion {
  return {
    id,
    question: 'Which one?',
    options: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
    category: 'Mixed',
    difficulty: 'medium',
    ...extra,
  };
}

function pool(source: RandomSource, count: number, extra: Partial<SealedQuestion> = {}): SealedQuestion[] {
  return Array.from({ length: count }, (_, index) =>
    sealed(`${source}-${index}`, { difficulty: index % 3 === 0 ? 'easy' : index % 3 === 1 ? 'medium' : 'hard', ...extra }),
  );
}

function pools(): RandomPools {
  return {
    screens: pool('screens', 6, { image: 'still.jpg' }),
    sleeves: pool('sleeves', 6, {
      artworkUrl: 'https://example.test/art.jpg',
      previewUrl: 'https://example.test/sleeve.m4a',
    }),
    tunes: pool('tunes', 6, { previewUrl: 'https://example.test/tune.m4a' }),
    catchphrase: pool('catchphrase', 6, { image: 'phrase.jpg', question: 'Say what you see' }),
    blanks: pool('blanks', 6),
    prices: Array.from({ length: 6 }, (_, index) =>
      sealed(`prices-${index}`, {
        options: ['£10', '£20', '£30', '£40'],
        ordered: true,
        difficulty: index % 3 === 0 ? 'easy' : index % 3 === 1 ? 'medium' : 'hard',
      }),
    ),
  };
}

function asked(): RandomAsked {
  return {
    screens: new Set(),
    sleeves: new Set(),
    tunes: new Set(),
    catchphrase: new Set(),
    blanks: new Set(),
    prices: new Set(),
  };
}

function summary(id: PackSummary['id'], count: number, easy: number, medium: number, hard: number): PackSummary {
  return {
    id,
    title: id,
    blurb: id,
    count,
    counts: { easy, medium, hard },
  };
}

const TEXT: QuizQuestion = {
  id: 'q',
  prompt: 'Which one?',
  options: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
  correctIndex: null,
  category: 'Mixed',
  difficulty: 'medium',
};

describe('quotasFor', () => {
  test('a round of 15 gives the first three sources one extra', () => {
    expect(quotasFor(15, RANDOM_SOURCES.length)).toEqual([3, 3, 3, 2, 2, 2]);
  });

  test('a round of 10 still includes every source', () => {
    const quotas = quotasFor(10, RANDOM_SOURCES.length);
    expect(quotas).toEqual([2, 2, 2, 2, 1, 1]);
    expect(quotas.every((quota) => quota > 0)).toBe(true);
  });
});

describe('dealRandomRound', () => {
  test('writes a source pack on every question and keeps a prices order', () => {
    const dealt = dealRandomRound(pools(), asked(), 6, 'mixed', seededRng(1));
    expect(dealt).toHaveLength(6);
    expect(new Set(dealt.map((question) => question.sourcePack))).toEqual(new Set(RANDOM_SOURCES));

    const price = dealt.find((question) => question.sourcePack === 'prices');
    expect(price?.options).toEqual(['£10', '£20', '£30', '£40']);

    const tune = dealt.find((question) => question.sourcePack === 'tunes');
    expect(tune?.previewUrl).toBe('https://example.test/tune.m4a');
    expect(songClueAtMs(tune ?? {}, 10_000)).toBe(0);

    const sleeve = dealt.find((question) => question.sourcePack === 'sleeves');
    expect(songClueAtMs(sleeve ?? {}, 10_000)).toBe(0);

    const blank = dealt.find((question) => question.sourcePack === 'blanks');
    expect(songClueAtMs(blank ?? {}, 10_000)).toBeNull();

    const ordinary = buildQuizQuestions([sealed('plain')], 1, 'mixed', seededRng(1));
    expect(ordinary[0]?.sourcePack).toBeUndefined();
  });

  test('a Catchphrase question holds and bonuses from its own pack, not the room', () => {
    const questions: QuizQuestion[] = RANDOM_SOURCES.map((source, index) => ({
      ...TEXT,
      id: source,
      sourcePack: source,
      ...(index === 4 ? {} : {}),
    }));
    // Fifth slot (index 4) is Catchphrase; the room's pack is the mix.
    questions[4] = { ...TEXT, id: 'catchphrase', sourcePack: 'catchphrase' };
    questions[0] = { ...TEXT, id: 'catchphrase-early', sourcePack: 'catchphrase' };
    questions[3] = { ...TEXT, id: 'screens', sourcePack: 'screens' };

    expect(questionPack('random', questions[4])).toBe('catchphrase');
    expect(isBonusCatchphrase(questionPack('random', questions[4]), 4)).toBe(true);
    expect(optionsAtMs(questionPack('random', questions[4]), 4, 10_000)).toBe(0);

    expect(isBonusCatchphrase(questionPack('random', questions[0]), 0)).toBe(false);
    expect(optionsAtMs(questionPack('random', questions[0]), 0, 10_000)).toBe(5_000);

    expect(isBonusCatchphrase(questionPack('random', questions[3]), 4)).toBe(false);
    expect(optionsAtMs(questionPack('random', questions[3]), 4, 10_000)).toBe(0);

    // An ordinary Catchphrase round has no source pack, and the room's pack stands.
    expect(questionPack('catchphrase', TEXT)).toBe('catchphrase');
    expect(isBonusCatchphrase(questionPack('catchphrase', TEXT), 4)).toBe(true);
  });

  test('the same rng deals the same list, and a different rng does not', () => {
    const first = dealRandomRound(pools(), asked(), 12, 'mixed', seededRng(4));
    const again = dealRandomRound(pools(), asked(), 12, 'mixed', seededRng(4));
    const other = dealRandomRound(pools(), asked(), 12, 'mixed', seededRng(9));
    expect(again).toEqual(first);
    expect(other.map((question) => question.id)).not.toEqual(first.map((question) => question.id));
  });

  test('two clients see the list that was written, not a second deal', () => {
    const dealt = dealRandomRound(pools(), asked(), 12, 'mixed', seededRng(4));
    const redealt = dealRandomRound(pools(), asked(), 12, 'mixed', seededRng(9));

    const room = reduce(
      reduce(createRoom('ABCD'), { type: 'join', uid: 'host', name: 'Greg', at: 1 }),
      {
        type: 'selectPack',
        packId: 'random',
        packTitle: 'Random Round',
        questions: dealt,
        wagerEnabled: false,
        stealEnabled: false,
      },
    );

    const clientA = room.questions;
    const clientB = room.questions;
    expect(clientA).toEqual(dealt);
    expect(clientB).toEqual(clientA);
    expect(clientB.map((question) => question.id)).not.toEqual(redealt.map((question) => question.id));

    for (let index = 0; index < clientA.length; index += 1) {
      expect(questionPack('random', clientA[index])).toBe(questionPack('random', clientB[index]));
      expect(optionsAtMs(questionPack('random', clientA[index]), index, 10_000)).toBe(
        optionsAtMs(questionPack('random', clientB[index]), index, 10_000),
      );
      expect(isBonusCatchphrase(questionPack('random', clientA[index]), index)).toBe(
        isBonusCatchphrase(questionPack('random', clientB[index]), index),
      );
      expect(clientA[index]?.options).toEqual(clientB[index]?.options);
    }
  });

  test('The Ladder still deals every source, then climbs', () => {
    const dealt = dealRandomRound(pools(), asked(), 12, 'ramp', seededRng(3));
    expect(new Set(dealt.map((question) => question.sourcePack))).toEqual(new Set(RANDOM_SOURCES));
    const ranks = dealt.map((question) => DIFFICULTY_RANK[question.difficulty]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  test('prefers a question the season has not served', () => {
    const source = pools();
    const seen: RandomAsked = { ...asked(), screens: new Set(['screens-0']) };
    const dealt = dealRandomRound(source, seen, 6, 'mixed', seededRng(2));
    const fromScreens = dealt.filter((question) => question.sourcePack === 'screens').map((question) => question.id);
    expect(fromScreens).not.toContain('screens-0');
  });
});

const DIFFICULTY_RANK = { easy: 0, medium: 1, hard: 2 } as const;

describe('a mixed Catchphrase scores from the question', () => {
  function revealed(sourcePack: PackId, index: number): RoomState {
    const questions: QuizQuestion[] = Array.from({ length: 5 }, (_, position) => ({
      ...TEXT,
      id: `q${position}`,
      sourcePack: position === index ? sourcePack : 'blanks',
    }));
    const room: RoomState = {
      ...createRoom('ABCD'),
      phase: 'question',
      packId: 'random',
      packTitle: 'Random Round',
      players: { guest: { name: 'Sam', joinedAt: 1 } },
      scores: { guest: 0 },
      durationSecs: 10,
      questions,
      index,
      answers: { guest: { optionIndex: 1, elapsedMs: 0 } },
    };
    return reduce(room, { type: 'reveal', correctIndex: 1, questionId: questions[index]?.id ?? '' });
  }

  test('the fifth question doubles when it came from Catchphrase', () => {
    expect(revealed('catchphrase', 4).lastDeltas).toEqual({ guest: 2000 });
  });

  test('the fifth question does not double when it came from somewhere else', () => {
    expect(revealed('screens', 4).lastDeltas).toEqual({ guest: 1000 });
  });

  test('an earlier Catchphrase question does not double', () => {
    expect(revealed('catchphrase', 0).lastDeltas).toEqual({ guest: 1000 });
  });
});

describe('randomPackSummary', () => {
  const sources = [
    summary('screens', 445, 105, 261, 79),
    summary('sleeves', 212, 14, 74, 124),
    summary('tunes', 424, 177, 196, 51),
    summary('catchphrase', 90, 8, 51, 31),
    summary('blanks', 148, 56, 58, 34),
    summary('prices', 95, 21, 26, 48),
  ];

  test('is six times the thinnest source, and absent when one is missing', () => {
    expect(randomPackSummary(sources)).toMatchObject({
      id: 'random',
      title: 'Random Round',
      count: 90 * 6,
      counts: { easy: 8 * 6, medium: 26 * 6, hard: 31 * 6 },
    });
    expect(randomPackSummary(sources.slice(0, 5))).toBeNull();
  });

  test('replaces a row already in the index rather than listing two', () => {
    const listed = withRandomPack([...sources, summary('random', 1, 0, 1, 0)]);
    expect(listed.filter((pack) => pack.id === 'random')).toHaveLength(1);
    expect(listed.at(-1)?.count).toBe(90 * 6);
  });
});
