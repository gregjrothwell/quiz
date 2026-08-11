import { describe, expect, test } from 'vitest';
import { decodeSource, isUndamaged, parseBlocks } from './opentriviaqa';

describe('decodeSource', () => {
  test('reads a UTF-8 file as UTF-8', () => {
    // #given a curly apostrophe encoded as UTF-8
    const bytes = Buffer.from('#Q Aristotle’s work', 'utf8');

    // #when it is decoded
    const text = decodeSource(bytes);

    // #then the character survives intact
    expect(text).toBe('#Q Aristotle’s work');
  });

  test('falls back to cp1252 for a file that is not valid UTF-8', () => {
    // #given 0x92, a cp1252 curly apostrophe and an invalid UTF-8 sequence
    const bytes = Buffer.from([0x41, 0x92, 0x73]);

    // #when it is decoded
    const text = decodeSource(bytes);

    // #then it is read as cp1252 rather than throwing or producing U+FFFD
    expect(text).toBe('A’s');
  });

  test('does not mojibake a UTF-8 file by decoding it as cp1252', () => {
    // #given an accented character encoded as UTF-8, which cp1252 would mangle
    // #and which is the failure the per-file check exists to prevent
    const bytes = Buffer.from('Renée', 'utf8');

    // #when it is decoded
    const text = decodeSource(bytes);

    // #then it is not the double-encoded form
    expect(text).not.toContain('Ã');
  });
});

describe('parseBlocks', () => {
  const block = [
    '#Q Which river flows through London?',
    '^ Thames',
    'A Severn',
    'B Thames',
    'C Mersey',
    'D Tyne',
  ].join('\n');

  test('reads a well-formed block', () => {
    // #given one complete block
    // #when it is parsed
    const [parsed] = parseBlocks(block);

    // #then the prompt, answer and all four options are recovered
    expect(parsed).toEqual({
      prompt: 'Which river flows through London?',
      correct: 'Thames',
      options: ['Severn', 'Thames', 'Mersey', 'Tyne'],
    });
  });

  test('separates blocks on blank lines', () => {
    // #given two blocks
    const text = `${block}\n\n${block.replace('London', 'Paris')}`;

    // #when they are parsed
    const parsed = parseBlocks(text);

    // #then both are returned
    expect(parsed).toHaveLength(2);
  });

  test('drops a true/false block', () => {
    // #given a two-option block, which cannot fill four lecterns
    const text = ['#Q Is the sky blue?', '^ True', 'A True', 'B False'].join('\n');

    // #when it is parsed
    const parsed = parseBlocks(text);

    // #then it is discarded
    expect(parsed).toHaveLength(0);
  });

  test('drops a block whose answer is not among its options', () => {
    // #given a block where the ^ line matches no option, so no lectern is right
    const text = block.replace('B Thames', 'B Trent');

    // #when it is parsed
    const parsed = parseBlocks(text);

    // #then it is discarded rather than shipped unanswerable
    expect(parsed).toHaveLength(0);
  });

  test('drops a block with more than four options', () => {
    // #given a five-option block
    const text = `${block}\nE Avon`;

    // #when it is parsed
    const parsed = parseBlocks(text);

    // #then it is discarded
    expect(parsed).toHaveLength(0);
  });

  test('ignores a block with no question line', () => {
    // #given options with no #Q
    const text = ['^ Thames', 'A Severn', 'B Thames', 'C Mersey', 'D Tyne'].join('\n');

    // #when it is parsed
    const parsed = parseBlocks(text);

    // #then nothing is returned
    expect(parsed).toHaveLength(0);
  });

  test('returns nothing for empty input', () => {
    // #given an empty file
    // #when it is parsed
    const parsed = parseBlocks('');

    // #then nothing is returned
    expect(parsed).toHaveLength(0);
  });
});

describe('isUndamaged', () => {
  test('keeps ordinary text', () => {
    // #given a clean question
    // #when it is checked
    // #then it survives
    expect(isUndamaged('Which river flows through London?')).toBe(true);
  });

  test('keeps correctly decoded curly punctuation', () => {
    // #given the characters cp1252 encodes in the 0x80-0x9F range, decoded right
    // #when it is checked
    // #then it survives — these are the payoff for decoding cp1252 properly,
    // #and a filter that rejected them would throw away what the fix recovered
    expect(isUndamaged('What is the name of NASA’s most famous telescope?')).toBe(true);
  });

  test('drops text carrying a C1 control character', () => {
    // #given the double-encoding that survives a clean UTF-8 decode
    const text = `SiddhÄrtha Gautama`;

    // #when it is checked
    // #then it is rejected
    expect(isUndamaged(text)).toBe(false);
  });

  test('drops text where both mojibake characters stay printable', () => {
    // #given "Renée" double-encoded, which carries no control character at all
    const text = 'RenÃ©e Zellweger';

    // #when it is checked
    // #then it is still rejected — the C1 rule alone would let this through
    expect(isUndamaged(text)).toBe(false);
  });

  test('drops text with apostrophes stripped upstream', () => {
    // #given a contraction the source mangled
    // #when it is checked
    // #then it is rejected
    expect(isUndamaged('Geckos cant blink, so how do they clean their eyes?')).toBe(false);
  });
});
