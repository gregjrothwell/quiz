import { describe, expect, test } from 'vitest';
import {
  commitmentDoc,
  commitmentFor,
  freshNonce,
  hasCommitted,
  openedPick,
  revealDoc,
  sealedPickDocFrom,
  type SealedPickDoc,
} from './sealedPick';

const NONCE = '0123456789abcdef0123456789abcdef';

async function sealed(pick: 'share' | 'shaft', uid: string, gameId = 'game-1'): Promise<SealedPickDoc> {
  return { ...(await commitmentDoc(pick, NONCE, gameId, uid)), ...revealDoc(pick, NONCE) };
}

describe('the commitment', () => {
  test('is a SHA-256 in hex', async () => {
    expect(await commitmentFor('share', NONCE, 'game-1', 'greg')).toMatch(/^[0-9a-f]{64}$/);
  });

  test('is the same every time for the same pick', async () => {
    expect(await commitmentFor('shaft', NONCE, 'game-1', 'greg')).toBe(
      await commitmentFor('shaft', NONCE, 'game-1', 'greg'),
    );
  });

  test('changes with every input, so none of them can be swapped', async () => {
    const base = await commitmentFor('share', NONCE, 'game-1', 'greg');
    expect(await commitmentFor('shaft', NONCE, 'game-1', 'greg')).not.toBe(base);
    expect(await commitmentFor('share', freshNonce(), 'game-1', 'greg')).not.toBe(base);
    expect(await commitmentFor('share', NONCE, 'game-2', 'greg')).not.toBe(base);
    expect(await commitmentFor('share', NONCE, 'game-1', 'rach')).not.toBe(base);
  });

  /*
    Acceptance criterion 6. Every client can read every document in the room, so
    what a finalist writes on tapping must not hold the pick in any form a
    spectator — or the other finalist — could read back.
  */
  test('what is written on tapping holds no pick', async () => {
    for (const pick of ['share', 'shaft'] as const) {
      const written = await commitmentDoc(pick, NONCE, 'game-1', 'greg');
      expect(Object.keys(written).sort()).toEqual(['commit', 'gameId']);
      expect(JSON.stringify(written)).not.toMatch(/share|shaft/i);
    }
  });
});

describe('freshNonce', () => {
  test('is 128 random bits in hex, and never repeats', () => {
    const nonces = new Set(Array.from({ length: 200 }, () => freshNonce()));
    expect(nonces.size).toBe(200);
    for (const nonce of nonces) expect(nonce).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('openedPick', () => {
  test('opens an honest reveal', async () => {
    expect(await openedPick(await sealed('shaft', 'greg'), 'game-1', 'greg')).toBe('shaft');
    expect(await openedPick(await sealed('share', 'greg'), 'game-1', 'greg')).toBe('share');
  });

  test('is nothing before the reveal', async () => {
    const committed = await commitmentDoc('shaft', NONCE, 'game-1', 'greg');
    expect(await openedPick(committed, 'game-1', 'greg')).toBeNull();
  });

  test('refuses a pick that is not the one committed to', async () => {
    const honest = await sealed('share', 'greg');
    expect(await openedPick({ ...honest, pick: 'shaft' }, 'game-1', 'greg')).toBeNull();
  });

  test('refuses a nonce that is not the one committed to', async () => {
    const honest = await sealed('shaft', 'greg');
    expect(await openedPick({ ...honest, nonce: freshNonce() }, 'game-1', 'greg')).toBeNull();
  });

  /*
    Copying the other finalist's commitment and waiting for their reveal would
    otherwise let somebody mirror a pick they had already seen.
  */
  test('refuses a commitment copied from the other finalist', async () => {
    const theirs = await sealed('shaft', 'rach');
    expect(await openedPick(theirs, 'game-1', 'greg')).toBeNull();
  });

  test('refuses a commitment carried over from another round', async () => {
    const lastRound = await sealed('shaft', 'greg', 'game-0');
    expect(await openedPick(lastRound, 'game-1', 'greg')).toBeNull();
  });

  test('refuses a third word', async () => {
    const doc: SealedPickDoc = {
      ...(await commitmentDoc('share', NONCE, 'game-1', 'greg')),
      pick: 'split',
      nonce: NONCE,
    };
    expect(await openedPick(doc, 'game-1', 'greg')).toBeNull();
  });

  test('a missing document is no pick', async () => {
    expect(await openedPick(undefined, 'game-1', 'greg')).toBeNull();
  });
});

describe('hasCommitted', () => {
  test('is true only for a commitment to this round', async () => {
    const committed = await commitmentDoc('share', NONCE, 'game-1', 'greg');
    expect(hasCommitted(committed, 'game-1')).toBe(true);
    expect(hasCommitted(committed, 'game-2')).toBe(false);
    expect(hasCommitted(undefined, 'game-1')).toBe(false);
    expect(hasCommitted({ gameId: 'game-1', commit: 'short' }, 'game-1')).toBe(false);
  });
});

describe('sealedPickDocFrom', () => {
  test('keeps the four fields and nothing else', () => {
    expect(
      sealedPickDocFrom({ gameId: 'g', commit: 'c', pick: 'share', nonce: 'n', extra: 1 }),
    ).toEqual({ gameId: 'g', commit: 'c', pick: 'share', nonce: 'n' });
  });

  test('a commitment alone is a commitment', () => {
    expect(sealedPickDocFrom({ gameId: 'g', commit: 'c' })).toEqual({ gameId: 'g', commit: 'c' });
  });

  test('anything without a round and a commitment is not a pick at all', () => {
    expect(sealedPickDocFrom({ commit: 'c' })).toBeNull();
    expect(sealedPickDocFrom({ gameId: 'g' })).toBeNull();
    expect(sealedPickDocFrom({ gameId: 7, commit: 'c' })).toBeNull();
    expect(sealedPickDocFrom(null)).toBeNull();
  });
});
