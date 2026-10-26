import { describe, expect, it } from 'vitest';
import { formatTally, switched, tallyShots } from './cannon-report';

describe('read-cannon (D4)', () => {
  it('counts rounds loaded, Keep, Bin, and who said nothing', () => {
    const tallies = tallyShots(
      [
        { gameId: 'g1', players: ['a', 'b', 'c'], shots: ['alpha'] },
        { gameId: 'g2', players: ['a', 'b'], shots: ['alpha', 'beta'] },
      ],
      [
        { gameId: 'g1', shot: 'alpha', uid: 'a', verdict: 'keep' },
        { gameId: 'g1', shot: 'alpha', uid: 'b', verdict: 'bin' },
        { gameId: 'g2', shot: 'alpha', uid: 'a', verdict: 'keep' },
      ],
    );
    expect(tallies).toEqual([
      { shot: 'alpha', rounds: 2, keep: 2, bin: 1, silent: 2 },
      { shot: 'beta', rounds: 1, keep: 0, bin: 0, silent: 2 },
    ]);
    expect(formatTally(tallies[0]!)).toMatch(/alpha\s+2 rounds\s+keep\s+2\s+bin\s+1\s+no vote\s+2/);
  });
});

describe('cannon off|on (C4)', () => {
  it('adds and removes an id, once', () => {
    expect(switched([], 'off', 'alpha')).toEqual(['alpha']);
    expect(switched(['alpha'], 'off', 'alpha')).toEqual(['alpha']);
    expect(switched(['alpha', 'beta'], 'on', 'alpha')).toEqual(['beta']);
  });
});
