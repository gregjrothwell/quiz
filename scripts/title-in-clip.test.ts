import { describe, expect, test } from 'vitest';
import {
  chooseClip,
  phonetic,
  similarity,
  thresholdFor,
  titleHits,
  words,
  type TranscriptWord,
} from './title-in-clip';

/** Turns "one two three" into a word a second, which is close enough to sung. */
function transcript(line: string, from = 0): TranscriptWord[] {
  return line.split(' ').map((word, index) => ({
    word,
    start: from + index,
    end: from + index + 0.9,
  }));
}

describe('words', () => {
  test('drops the articles that carry none of a title', () => {
    expect(words('The Whole of the Moon')).toEqual(['whole', 'of', 'moon']);
  });

  test('folds punctuation and accents the transcriber will not produce', () => {
    expect(words("Don't Look Back in Anger")).toEqual(['don', 't', 'look', 'back', 'in', 'anger']);
    expect(words('Sinéad & Me')).toEqual(['sinead', 'and', 'me']);
  });
});

describe('phonetic', () => {
  test('collapses spellings that sound the same', () => {
    expect(phonetic('phone')).toBe(phonetic('fone'));
    expect(phonetic('rock')).toBe(phonetic('rok'));
  });

  test('keeps words that sound different apart', () => {
    expect(phonetic('jude')).not.toBe(phonetic('rude'));
  });
});

describe('thresholdFor', () => {
  test('is strictest on a one-word title, because that is where guesses land', () => {
    // #given titles of one, two and four words
    // #then the shorter the title, the closer the transcript has to be — a
    // mumbled "born" should not convict "Torn"
    expect(thresholdFor(1)).toBeGreaterThan(thresholdFor(2));
    expect(thresholdFor(2)).toBeGreaterThan(thresholdFor(4));
  });
});

describe('titleHits', () => {
  test('finds the title sung plainly, with the time it lands', () => {
    // #given a clip where the singer names the song eight seconds in
    const clip = transcript('and the sky was made of amethyst sweet caroline good times', 4);

    // #when the title is looked for
    const hits = titleHits('Sweet Caroline', clip);

    // #then it is found, once, where it was sung
    expect(hits).toHaveLength(1);
    expect(hits[0]?.start).toBe(11);
  });

  test('lines the title up with the transcript when both carry articles', () => {
    // #given a title whose articles are dropped, sung in full
    const clip = transcript('i saw the whole of the moon', 5);

    // #then the window still matches — both sides lose their articles, or a
    // three-word title is compared against "whole of the"
    const hits = titleHits('The Whole of the Moon', clip);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.start).toBe(8);
  });

  test('survives the transcriber mishearing the title', () => {
    // #given what whisper actually returned for the Come On Eileen preview:
    // the name came back as "and", which is what a sung vowel does to a
    // transcriber
    const clip = transcript('we can sing the song of old times come on and oh i swear', 1);

    // #when the title is looked for
    const hits = titleHits('Come On Eileen', clip);

    // #then the mishearing is still a hit, because the match is phonetic — an
    // exact compare would have called this clip clean and shipped it
    expect(hits).toHaveLength(1);
    expect(hits[0]?.heard).toBe('come on and');
  });

  test('a mishearing that changes the consonants too is missed, and that is the limit', () => {
    // #given small.en's Hey Jude, where "hey Jude" came back as "hate you'd" —
    // both words re-consonanted, not just re-vowelled
    const clip = transcript('and anytime you feel the pain hate youd refrain', 2);

    // #then it is not caught, and pushing the threshold down far enough to
    // catch it starts convicting clean clips instead. This is why the audit
    // runs a model big enough to hear the title in the first place rather
    // than a matcher loose enough to guess at it.
    expect(titleHits('Hey Jude', clip)).toEqual([]);
  });

  test('does not convict a clip whose title is never sung', () => {
    // #given the Bohemian Rhapsody preview, which is the opening a cappella
    const clip = transcript('is this the real life is this just fantasy caught in a landslide');

    // #then nothing in it is the title
    expect(titleHits('Bohemian Rhapsody', clip)).toEqual([]);
  });

  test('a one-word title is not matched by a word that merely rhymes', () => {
    // #given a clip with "born" in it and a song called Torn
    const clip = transcript('i was born in the wrong year');

    // #then the rhyme is not the title
    expect(titleHits('Torn', clip)).toEqual([]);
  });

  test('one sung line is one hit, not one per overlapping window', () => {
    const clip = transcript('come on eileen come on eileen', 3);
    const hits = titleHits('Come On Eileen', clip);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.start).toBe(3);
  });
});

describe('chooseClip', () => {
  test('leaves a clean clip alone', () => {
    const choice = chooseClip([]);
    expect(choice.verdict).toBe('clean');
    expect(choice.previewStart).toBe(0);
    expect(choice.previewSeconds).toBeUndefined();
  });

  test('ignores a title sung after the window has already closed', () => {
    // #given a title first sung at 22s on a 15-second question
    // #then nobody ever hears it, so nothing needs changing
    expect(chooseClip([{ start: 22, end: 23, score: 1, heard: 'x' }]).verdict).toBe('clean');
  });

  test('trims rather than shifts when there is a clip worth keeping first', () => {
    // #given a title sung eleven seconds in
    const choice = chooseClip([{ start: 11, end: 12, score: 1, heard: 'x' }]);

    // #then Apple's opening is kept and the clip stops before the giveaway —
    // the opening is the recognisable half, and moving it is what made the
    // melody round unplayable
    expect(choice.verdict).toBe('trimmed');
    expect(choice.previewStart).toBe(0);
    expect(choice.previewSeconds).toBe(10.6);
  });

  test('shifts past the title when it is sung too early to trim around', () => {
    // #given a title in the first two seconds, leaving no clip in front of it
    const choice = chooseClip([{ start: 1.5, end: 2.4, score: 1, heard: 'x' }]);

    // #then the clip starts after it instead
    expect(choice.verdict).toBe('shifted');
    expect(choice.previewStart).toBe(2.8);
  });

  test('shifts rather than trimming to a stub', () => {
    // #given a title at seven seconds, which would trim to a 6.6s clip
    const choice = chooseClip([{ start: 7, end: 8, score: 1, heard: 'x' }]);

    // #then it starts after the title instead, and the question has music in
    // it throughout — 3.5 seconds of audio against 11.5 of silence is what
    // emptied the room on 8 September
    expect(choice.verdict).toBe('shifted');
    expect(choice.previewStart).toBe(8.4);
    expect(choice.previewSeconds).toBeUndefined();
  });

  test('gives up honestly when no window of the clip avoids the title', () => {
    // #given a title sung four times across the preview, with no eight-second
    // gap anywhere in reach
    const choice = chooseClip([
      { start: 1, end: 2, score: 1, heard: 'x' },
      { start: 8, end: 9, score: 1, heard: 'x' },
      { start: 15, end: 16, score: 1, heard: 'x' },
      { start: 23, end: 24, score: 1, heard: 'x' },
    ]);

    // #then it says so rather than shipping a six-second question
    expect(choice.verdict).toBe('unavoidable');
    expect(choice.previewStart).toBe(0);
    expect(choice.previewSeconds).toBeUndefined();
  });
});

describe('similarity', () => {
  test('is 1 for identical strings and 0 for nothing in common', () => {
    expect(similarity('abc', 'abc')).toBe(1);
    expect(similarity('abc', 'xyz')).toBe(0);
  });
});
