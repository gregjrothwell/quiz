import { describe, expect, test } from 'vitest';
import { seatedNames, testRunOf } from './testRun';

describe('testRunOf', () => {
  test('a harness id is a harness run, whoever is seated', () => {
    expect(testRunOf('rank-1792097239825', ['Claude', 'Ada', 'Host'])).toBe('harness run');
    expect(testRunOf('final-1792691983738', ['Bo', 'Ada'])).toBe('harness run');
    expect(testRunOf('host-1792691983738', ['Greg'])).toBe('harness run');
    expect(testRunOf('harness-game', ['P0'])).toBe('harness run');
  });

  test('a table of test names is a test run', () => {
    expect(testRunOf('0aea73e2-2d65', ['CC test'])).toBe('test run');
    expect(testRunOf('6346bca0-20b3', ['Test Jo', 'Test Kit', 'G TEST', 'Test Ivy'])).toBe('test run');
  });

  test('one real name keeps the round', () => {
    expect(testRunOf('6346bca0-20b3', ['G TEST', 'Steve'])).toBeUndefined();
    expect(testRunOf('6346bca0-20b3', ['Steve'])).toBeUndefined();
  });

  test('an id that only starts like a harness one is real', () => {
    expect(testRunOf('rank-ed', ['Steve'])).toBeUndefined();
    expect(testRunOf('rank-1792-x', ['Steve'])).toBeUndefined();
  });

  test('nobody seated is not evidence of a test', () => {
    expect(testRunOf('x', [])).toBeUndefined();
  });
});

describe('seatedNames', () => {
  test('reads names off a stored players map, and blanks what is not one', () => {
    expect(seatedNames({ a: { name: 'Steve' }, b: { name: 7 }, c: null })).toEqual(['Steve', '', '']);
    expect(seatedNames(undefined)).toEqual([]);
    expect(seatedNames('players')).toEqual([]);
  });
});
