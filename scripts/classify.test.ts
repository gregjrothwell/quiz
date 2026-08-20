import { describe, expect, test } from 'vitest';
import {
  capPack,
  isUsOnly,
  isWellFormed,
  packForCategory,
  sortIntoPacks,
  ukScore,
} from './classify';
import type { Question } from '../src/questions/types';

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    question: 'Which element has the chemical symbol Fe?',
    correct: 'Iron',
    incorrect: ['Lead', 'Tin', 'Zinc'],
    category: 'Science & Nature',
    difficulty: 'easy',
    source: 'opentdb',
    ...overrides,
  };
}

describe('isUsOnly', () => {
  test('drops a question about American football', () => {
    // #given a question referencing the Super Bowl
    const question = makeQuestion({ question: 'Who won the first Super Bowl?' });

    // #when it is classified
    const result = isUsOnly(question);

    // #then it is flagged as US-only
    expect(result).toBe(true);
  });

  test('drops a question whose answers reference US sports leagues', () => {
    // #given US-specific content in the answer options rather than the prompt
    const question = makeQuestion({
      question: 'Which league did this team play in?',
      correct: 'NBA',
      incorrect: ['Premier League', 'Bundesliga', 'Serie A'],
    });

    // #when it is classified
    const result = isUsOnly(question);

    // #then it is still flagged, because answers are read too
    expect(result).toBe(true);
  });

  test('keeps a question that merely contains the word American', () => {
    // #given a title that happens to include "American"
    const question = makeQuestion({
      question: 'Who directed the film American Beauty?',
      correct: 'Sam Mendes',
      incorrect: ['Ridley Scott', 'Danny Boyle', 'Mike Leigh'],
    });

    // #when it is classified
    const result = isUsOnly(question);

    // #then it is kept, since "American" alone is too broad to strip on
    expect(result).toBe(false);
  });
});

describe('ukScore', () => {
  test('counts distinct British reference points', () => {
    // #given a question naming two separate UK markers
    const question = makeQuestion({
      question: 'Which river flows through London?',
      correct: 'Thames',
      incorrect: ['Severn', 'Mersey', 'Tyne'],
    });

    // #when it is scored
    const score = ukScore(question);

    // #then both "london" and "thames" are counted
    expect(score).toBe(2);
  });

  test('does not double-count a repeated marker', () => {
    // #given a marker appearing twice
    const question = makeQuestion({
      question: 'Is London bigger than London Ontario?',
      correct: 'Yes',
      incorrect: ['No'],
    });

    // #when it is scored
    const score = ukScore(question);

    // #then the repeat counts once
    expect(score).toBe(1);
  });

  test('ignores British reference points that appear only in a wrong answer', () => {
    // #given a non-British question whose distractors happen to include "Welsh"
    const question = makeQuestion({
      question: 'Who is the author of Jurassic Park?',
      correct: 'Michael Crichton',
      incorrect: ['Welsh', 'Stephen King', 'Dean Koontz'],
    });

    // #when it is scored
    const score = ukScore(question);

    // #then it scores zero, so the British pack is not padded with non-British questions
    expect(score).toBe(0);
  });

  test('still counts a British reference point in the correct answer', () => {
    // #given a question whose true answer is the British marker
    const question = makeQuestion({
      question: 'The tale of Robin Hood originates from which country?',
      correct: 'England',
      incorrect: ['France', 'Norway', 'Denmark'],
    });

    // #when it is scored
    const score = ukScore(question);

    // #then it counts, because the subject really is British
    expect(score).toBe(1);
  });

  test('scores zero for a question with no British content', () => {
    // #given a neutral science question
    const question = makeQuestion();

    // #when it is scored
    const score = ukScore(question);

    // #then it scores zero
    expect(score).toBe(0);
  });
});

describe('isWellFormed', () => {
  test('accepts a normal multiple-choice question', () => {
    // #given a well-formed question
    const question = makeQuestion();

    // #when it is validated
    const result = isWellFormed(question);

    // #then it passes
    expect(result).toBe(true);
  });

  test('rejects duplicate answer options', () => {
    // #given the correct answer repeated among the distractors
    const question = makeQuestion({ incorrect: ['Iron', 'Tin', 'Zinc'] });

    // #when it is validated
    const result = isWellFormed(question);

    // #then it is rejected, because two options would both be correct
    expect(result).toBe(false);
  });

  test('rejects unresolved HTML entities', () => {
    // #given a prompt that still carries an encoded entity
    const question = makeQuestion({ question: 'Which band released &quot;Parklife&quot;?' });

    // #when it is validated
    const result = isWellFormed(question);

    // #then it is rejected rather than shown raw to players
    expect(result).toBe(false);
  });

  test('rejects order-dependent options', () => {
    // #given an "all of the above" option in a game that shuffles answers
    const question = makeQuestion({ incorrect: ['All of the above', 'Tin', 'Zinc'] });

    // #when it is validated
    const result = isWellFormed(question);

    // #then it is rejected
    expect(result).toBe(false);
  });

  test('rejects questions whose answer decays over time', () => {
    // #given a prompt tied to the present moment
    const question = makeQuestion({ question: 'Who is the current Formula 1 champion?' });

    // #when it is validated
    const result = isWellFormed(question);

    // #then it is rejected
    expect(result).toBe(false);
  });

  test('keeps a question about electric current', () => {
    // #given "current" used as a physics term rather than a time reference
    const question = makeQuestion({
      question: 'Which unit is used to measure electric current?',
      correct: 'Ampere',
      incorrect: ['Volt', 'Ohm', 'Watt'],
    });

    // #when it is validated
    const result = isWellFormed(question);

    // #then it is kept, because the date-rot rule requires a title or record
    expect(result).toBe(true);
  });

  test('rejects a question with no distractors', () => {
    // #given an empty incorrect-answer list
    const question = makeQuestion({ incorrect: [] });

    // #when it is validated
    const result = isWellFormed(question);

    // #then it is rejected as unanswerable
    expect(result).toBe(false);
  });

  test('rejects a prompt shorter than ten characters', () => {
    // #given a truncated prompt at the boundary
    const question = makeQuestion({ question: 'Why?' });

    // #when it is validated
    const result = isWellFormed(question);

    // #then it is rejected
    expect(result).toBe(false);
  });
});

describe('packForCategory', () => {
  test('maps film and television into one pack', () => {
    // #given the two source categories that share a pack
    const categories = ['Entertainment: Film', 'Entertainment: Television'];

    // #when each is mapped
    const packs = categories.map(packForCategory);

    // #then both land in tv-and-film
    expect(packs).toEqual(['tv-and-film', 'tv-and-film']);
  });

  test('sends unmapped categories to the catch-all, not general knowledge', () => {
    // #given a category with no dedicated pack
    const category = 'Entertainment: Board Games';

    // #when it is mapped
    const pack = packForCategory(category);

    // #then it lands in mixed-bag, so General Knowledge stays general knowledge
    expect(pack).toBe('mixed-bag');
  });

  test('keeps video games out of general knowledge', () => {
    // #given the single largest source category
    const pack = packForCategory('Entertainment: Video Games');

    // #when it is mapped
    const result = pack;

    // #then it has its own pack rather than swamping general knowledge
    expect(result).toBe('video-games');
  });

  test('maps General Knowledge to itself', () => {
    // #given the real general knowledge category
    const pack = packForCategory('General Knowledge');

    // #when it is mapped
    const result = pack;

    // #then it lands where a player would expect
    expect(result).toBe('general-knowledge');
  });
});

describe('sortIntoPacks', () => {
  test('places a British question in both its theme pack and uk-leaning', () => {
    // #given a UK-flavoured geography question
    const question = makeQuestion({
      question: 'Which river flows through London?',
      correct: 'Thames',
      incorrect: ['Severn', 'Mersey', 'Tyne'],
      category: 'Geography',
    });

    // #when the pool is sorted
    const { packs } = sortIntoPacks([question]);

    // #then it appears in geography and uk-leaning
    expect([...packs.keys()].sort()).toEqual(['geography', 'uk-leaning']);
  });

  test('reports malformed and US-only questions separately', () => {
    // #given one malformed question and one US-only question
    const pool = [
      makeQuestion({ id: 'bad', incorrect: ['Iron'] }),
      makeQuestion({ id: 'us', question: 'Who won the first Super Bowl?' }),
    ];

    // #when the pool is sorted
    const { dropped } = sortIntoPacks(pool);

    // #then each drop reason is counted independently
    expect(dropped).toEqual({ malformed: 1, usOnly: 1, capped: 0, offTopicSport: 0 });
  });

  test('drops a sport question naming no sport followed in Britain', () => {
    // #given a question the source filed under sport that is not about sport at
    // #all — the `sports` file opens with one about Aristotle and metaphysics
    const pool = [
      makeQuestion({
        category: 'Sports',
        question: 'Which science did Aristotle define as the knowledge of immaterial being?',
        correct: 'Metaphysics',
        incorrect: ['Psychology', 'Logic', 'Philosophy'],
      }),
    ];

    // #when the pool is sorted
    const { packs, dropped } = sortIntoPacks(pool);

    // #then it is dropped rather than filed under sport or moved to mixed-bag
    expect([dropped.offTopicSport, packs.size]).toEqual([1, 0]);
  });

  test('keeps a sport question about a sport followed in Britain', () => {
    // #given a football question
    const pool = [
      makeQuestion({
        category: 'Sports',
        question: 'Which club has won the most FA Cup finals?',
        correct: 'Arsenal',
        incorrect: ['Chelsea', 'Everton', 'Leeds'],
      }),
    ];

    // #when the pool is sorted
    const { packs } = sortIntoPacks(pool);

    // #then it reaches the sport pack
    expect(packs.get('sport')).toHaveLength(1);
  });

  test('returns no packs for an empty pool', () => {
    // #given nothing to sort
    const pool: Question[] = [];

    // #when the pool is sorted
    const { packs } = sortIntoPacks(pool);

    // #then no packs are created
    expect(packs.size).toBe(0);
  });

  test('counts what the cap removed', () => {
    // #given more questions in one pack than the cap allows
    const pool = Array.from({ length: 5 }, (_, i) =>
      makeQuestion({ id: `q${i}`, question: `Which element is number ${i} on the table?` }),
    );

    // #when the pool is sorted with a cap below that
    const { dropped } = sortIntoPacks(pool, 1, 3);

    // #then the overflow is reported rather than silently discarded
    expect(dropped.capped).toBe(2);
  });
});

describe('capPack', () => {
  /** Imported questions are all marked medium; only the rated half has levels. */
  function imported(id: string): Question {
    return makeQuestion({ id, difficulty: 'medium', source: 'opentriviaqa' });
  }

  function rated(id: string, difficulty: Question['difficulty']): Question {
    return makeQuestion({ id, difficulty, source: 'opentdb' });
  }

  test('keeps every rated question when trimming', () => {
    // #given a pack whose imported questions alone would fill the cap
    const pool = [
      ...Array.from({ length: 8 }, (_, i) => imported(`i${i}`)),
      rated('r1', 'easy'),
      rated('r2', 'hard'),
    ];

    // #when it is capped below its size
    const kept = capPack(pool, 4);

    // #then no rated question is among the ones dropped
    expect(kept.filter((q) => q.source === 'opentdb')).toHaveLength(2);
  });

  test('leaves a pack under the cap untouched', () => {
    // #given fewer questions than the cap
    const pool = [imported('a'), imported('b')];

    // #when it is capped
    const kept = capPack(pool, 10);

    // #then the same array comes back rather than a reordered copy
    expect(kept).toBe(pool);
  });

  test('picks the same questions on every run', () => {
    // #given a pack that has to be trimmed
    const pool = Array.from({ length: 20 }, (_, i) => imported(`i${i}`));

    // #when it is capped twice
    const first = capPack(pool, 5).map((q) => q.id);
    const second = capPack(pool, 5).map((q) => q.id);

    // #then the selection is stable, so a re-harvest orphans no vault entries
    expect(first).toEqual(second);
  });

  test('drops rated questions only once the cap is below their count', () => {
    // #given more rated questions than the cap
    const pool = [rated('r1', 'easy'), rated('r2', 'medium'), rated('r3', 'hard')];

    // #when it is capped below that
    const kept = capPack(pool, 2);

    // #then the cap still wins — it bounds the download regardless of source
    expect(kept).toHaveLength(2);
  });
});
