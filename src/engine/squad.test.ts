import { describe, expect, test } from 'vitest';
import { MAX_SQUAD_LENGTH, SQUADS, cleanSquad, isSquad, squadKey, squadsOf } from './squad';

describe('cleanSquad', () => {
  test('trims the spelling it was given', () => {
    // #given a value with space around it
    // #when it is cleaned
    // #then the name survives and the space does not
    expect(cleanSquad('  Hermes  ')).toBe('Hermes');
  });

  test('caps a legacy value at the length the rules bound', () => {
    // #given something far longer than firestore.rules will accept
    const squad = cleanSquad('E'.repeat(200));

    // #when it is cleaned
    // #then it is cut to the bound, so a write cannot be refused for a length
    // the client could have fixed
    expect(squad).toHaveLength(MAX_SQUAD_LENGTH);
  });

  test('reads anything that is not a string as no squad', () => {
    // #given whatever an earlier build or a bored console left in storage
    // #when it is cleaned
    // #then it is no squad rather than a crash
    expect(cleanSquad(42)).toBe('');
    expect(cleanSquad(null)).toBe('');
    expect(cleanSquad(undefined)).toBe('');
  });

  test('still accepts a name the picker no longer offers', () => {
    // #given a value from the free-text era
    // #when it is cleaned
    // #then it survives. This runs on the way out of Firestore as well as in,
    // so narrowing it to SQUADS would erase those rows from the board
    expect(cleanSquad('Engineering')).toBe('Engineering');
  });
});

describe('isSquad', () => {
  test('recognises the squads on offer', () => {
    // #given each name in the list
    // #when each is checked
    // #then all three are recognised
    for (const squad of SQUADS) expect(isSquad(squad)).toBe(true);
  });

  test('rejects a legacy value, so the picker never offers one', () => {
    // #given a free-text value and some non-strings
    // #when they are checked
    // #then none is a squad — this is what stops a select rendering a value
    // that matches none of its options
    expect(isSquad('Engineering')).toBe(false);
    expect(isSquad('')).toBe(false);
    expect(isSquad(null)).toBe(false);
  });

  test('names Lurkers as a squad in its own right', () => {
    // #given the squad for people attached to neither side
    // #when it is checked
    // #then it is a squad, not an absence — it appears on the board as itself
    expect(isSquad('Lurkers')).toBe(true);
  });
});

describe('squadKey', () => {
  test('keys two spellings of one squad alike', () => {
    // #given the same squad written three ways
    // #when each is keyed
    // #then they group together while each row still shows its own spelling
    expect(squadKey(' Hermes ')).toBe('hermes');
    expect(squadKey('HERMES')).toBe('hermes');
  });

  test('does not guess that a shorter name means the same squad', () => {
    // #given an abbreviation
    // #when it is keyed
    // #then it is its own squad. Collapsing it would need a dictionary, and
    // quietly merging two squads somebody meant to keep apart is worse
    expect(squadKey('Herm')).not.toBe(squadKey('Hermes'));
  });
});

describe('squadsOf', () => {
  test('offers the known squads in their own order, not alphabetically', () => {
    // #given rows in every squad, arriving in some other order
    const rows = [{ squad: 'Lurkers' }, { squad: 'Bundae' }, { squad: 'Hermes' }];

    // #when the filters are worked out
    // #then they read as the office says them, rather than burying Lurkers
    // between two strangers
    expect(squadsOf(rows)).toEqual(['Hermes', 'Bundae', 'Lurkers']);
  });

  test('only offers a squad somebody is actually in', () => {
    // #given a board with one squad on it
    const rows = [{ squad: 'Bundae' }, { squad: 'Bundae' }];

    // #when the filters are worked out
    // #then there is no chip for an empty squad
    expect(squadsOf(rows)).toEqual(['Bundae']);
  });

  test('keeps a legacy value so its holder can still find themselves', () => {
    // #given a squad on the list and one from the free-text era
    const rows = [{ squad: 'Hermes' }, { squad: 'Engineering' }];

    // #when the filters are worked out
    // #then the legacy name still gets a chip, after the known ones
    expect(squadsOf(rows)).toEqual(['Hermes', 'Engineering']);
  });

  test('does not offer a squad twice for two spellings of it', () => {
    // #given a legacy lowercase spelling of a squad now on the list
    const rows = [{ squad: 'hermes' }, { squad: 'Hermes' }];

    // #when the filters are worked out
    // #then one chip, under the proper spelling — a case-sensitive membership
    // test would have shown both
    expect(squadsOf(rows)).toEqual(['Hermes']);
  });

  test('ignores rows with no squad at all', () => {
    // #given rows that predate squads, or belong to somebody who set none
    const rows = [{}, { squad: '' }, { squad: '   ' }, { squad: 'Bundae' }];

    // #when the filters are worked out
    // #then only the real one is offered
    expect(squadsOf(rows)).toEqual(['Bundae']);
  });

  test('sorts several legacy values so every device agrees', () => {
    // #given more than one name from the free-text era
    const rows = [{ squad: 'Marketing' }, { squad: 'Bundae' }, { squad: 'Engineering' }];

    // #when the filters are worked out
    // #then the known squad leads and the rest are alphabetical
    expect(squadsOf(rows)).toEqual(['Bundae', 'Engineering', 'Marketing']);
  });
});
