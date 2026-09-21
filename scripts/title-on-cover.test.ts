import { describe, expect, test } from 'vitest';
import { artistOnCover, joinCoverText, sleeveVerdict, titleOnCover } from './title-on-cover';

/**
 * The gate that decides which album covers can be asked about.
 *
 * Every string below is what Apple's Vision framework actually read off the
 * artwork on 21 September 2026, not an invention — including the misreadings,
 * which are the whole difficulty. A matcher tuned on clean text would pass
 * every one of these covers.
 *
 * The round that prompted it (`53FN`, 21 September): eleven of fifteen sleeves
 * printed their own title. All four hard questions whose cover did scored 100%;
 * the one hard question with a wordless cover scored 50%.
 */

describe('titleOnCover', () => {
  test('catches a cover that prints the title next to the artist', () => {
    // #given the artist, then the title, which is how most covers are laid out
    const verdict = titleOnCover('Aladdin Sane', 'david bowie aladdin sane');

    // #then the whole title was found
    expect(verdict.givesItAway).toBe(true);
    expect(verdict.matched).toContain('aladdin');
  });

  test('sees through a letter swapped for one that looks like it', () => {
    // #given Vision's readings of four covers it got wrong in the same way —
    // a letter mistaken for another of similar shape
    // #then each is still the title
    expect(titleOnCover('Nevermind', 'nirvana nevernino').givesItAway).toBe(true);
    expect(titleOnCover('Back to Black', 'amy winiehouse eack to black').givesItAway).toBe(true);
    expect(titleOnCover('The Wall', 'rink floyp he wall').givesItAway).toBe(true);
    expect(titleOnCover('Thriller', 'michael jackson thrille').givesItAway).toBe(true);
  });

  test('joins a word OCR split in two', () => {
    // #given Illmatic, read as two tokens
    // #then the pair joined is the title
    expect(titleOnCover('Illmatic', 'ill matic ment').givesItAway).toBe(true);
  });

  test('catches a title the cover only partly shows', () => {
    // #given covers where the title is scattered, cropped or half-read. This is
    // the case the whole-phrase match could not express and a person has no
    // trouble with at all.
    expect(titleOnCover('London Calling', '25th anniversary legacy edition the clash calling').givesItAway).toBe(true);
    expect(titleOnCover('Appetite for Destruction', 'guns roses destruction').givesItAway).toBe(true);
    expect(titleOnCover('Sgt. Pepper’s Lonely Hearts Club Band', 'lonely hearts').givesItAway).toBe(true);
  });

  test('an artist name alone is not the album', () => {
    // #given covers whose only text is who made them
    // #then clean — every option on these questions is by that artist, so the
    // name narrows nothing
    expect(titleOnCover('Parallel Lines', 'bloncie').givesItAway).toBe(false);
    expect(titleOnCover('The Fame', 'lady gaga tma il').givesItAway).toBe(false);
  });

  test('a wordless cover is clean', () => {
    expect(titleOnCover('The Dark Side of the Moon', '').givesItAway).toBe(false);
    expect(titleOnCover('Abbey Road', '').givesItAway).toBe(false);
  });

  test('a title with no letters in it cannot be gated', () => {
    // #given Ed Sheeran's symbol albums, where the title *is* the artwork
    // #then nothing to match, and the busy rule in `sleeveVerdict` is what
    // actually protects these
    expect(titleOnCover('÷', 'divide').givesItAway).toBe(false);
    expect(titleOnCover('+', '').givesItAway).toBe(false);
  });
});

describe('artistOnCover', () => {
  test('recognises the artist even when it is read badly', () => {
    expect(artistOnCover('Blondie', 'bloncie')).toBe(true);
    expect(artistOnCover('Michael Jackson', 'michael jaskson')).toBe(true);
  });

  test('does not see an artist who is not there', () => {
    expect(artistOnCover('Pink Floyd', '')).toBe(false);
    expect(artistOnCover('Radiohead', 'peel slowly and see')).toBe(false);
  });
});

describe('sleeveVerdict', () => {
  test('publishes a cover with nothing on it', () => {
    expect(sleeveVerdict('The Dark Side of the Moon', 'Pink Floyd', '').publishable).toBe(true);
  });

  test('publishes a cover whose only text is the band, however badly read', () => {
    // #given Vision's reading of two covers that carry a name and nothing else
    // #then both stay: striking the artist out tightly would leave the
    // misreading behind to be counted as something the cover says
    expect(sleeveVerdict('Low', 'David Bowie', 'davlorowie').publishable).toBe(true);
    expect(sleeveVerdict('Frank', 'Amy Winehouse', 'amy wrafhouse').publishable).toBe(true);
  });

  test('refuses a cover covered in writing the matcher cannot read', () => {
    // #given Kendrick's good kid, m.A.A.d city and Prince's Purple Rain as
    // Vision read them — both print their title, both are mangled past any
    // matcher, and both are plainly covered in words
    const kendrick = sleeveVerdict(
      'good kid, m.A.A.d city',
      'Kendrick Lamar',
      'jo00 k d aao city ag orteilte 3y vemorio lartar',
    );
    const prince = sleeveVerdict(
      'Purple Rain',
      'Prince',
      'pustetain phucstane the fevolation',
    );

    // #then refused. A round that asks what a picture is has no use for a
    // picture with writing on it, whatever the writing turns out to say.
    expect(kendrick.publishable).toBe(false);
    expect(prince.publishable).toBe(false);
    expect(prince.why).toContain('letters of text');
  });

  test('says which rule refused it, so the log is worth reading', () => {
    const named = sleeveVerdict('Rumours', 'Fleetwood Mac', 'fieetwoodnac rumours');
    expect(named.publishable).toBe(false);
    expect(named.why).toContain('names the album');
  });

  test('tolerates a short garbled fragment', () => {
    // #given the noise Vision leaves on an otherwise blank cover
    // #then not counted as the cover saying something — the alternative is
    // failing good sleeves for a five-letter smudge
    expect(sleeveVerdict('Homework', 'Daft Punk', 'cluks').publishable).toBe(true);
    expect(sleeveVerdict('Funeral', 'Arcade Fire', 'rcad').publishable).toBe(true);
  });
});

describe('joinCoverText', () => {
  test('drops the runs Vision was not sure of', () => {
    // #given one confident reading and one guess
    const text = joinCoverText([
      { text: 'PARKLIFE', confidence: 0.9 },
      { text: 'zzqx', confidence: 0.1 },
    ]);

    // #then only the confident one survives, folded for matching
    expect(text).toBe('parklife');
  });
});
