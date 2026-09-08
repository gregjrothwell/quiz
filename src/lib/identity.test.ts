import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  hasBeenAskedToSaveRecovery,
  hasClaimedIdentity,
  markAskedToSaveRecovery,
  needsReclaim,
  playerIdFor,
  shouldAskToSaveRecovery,
  storedPlayerId,
  storedRecoveryCode,
} from './identity';

/** A localStorage good enough for these tests, or one that refuses to be one. */
function stubStorage(options: { throws?: boolean; seed?: Record<string, string> } = {}) {
  const contents = new Map<string, string>(Object.entries(options.seed ?? {}));

  const storage = {
    getItem: (key: string): string | null => {
      if (options.throws) throw new Error('access denied');
      return contents.get(key) ?? null;
    },
    setItem: (key: string, value: string): void => {
      if (options.throws) throw new Error('quota exceeded');
      contents.set(key, value);
    },
  };

  vi.stubGlobal('window', { localStorage: storage });
  return contents;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('playerIdFor', () => {
  test('defaults to the auth uid when nothing has been claimed', () => {
    // #given a browser that has never touched a recovery code
    stubStorage();

    // #when the season write asks who this is
    const playerId = playerIdFor('anon-uid');

    // #then it is the uid, which is the path every existing row already uses
    expect(playerId).toBe('anon-uid');
    expect(hasClaimedIdentity('anon-uid')).toBe(false);
  });

  test('returns the claimed playerId once one is stored', () => {
    // #given a browser that has taken on another identity
    stubStorage({ seed: { 'vibequiz.playerId': 'greg-id' } });

    // #when the season write asks who this is
    // #then it is the claimed id, not this tab's uid
    expect(playerIdFor('new-uid')).toBe('greg-id');
    expect(hasClaimedIdentity('new-uid')).toBe(true);
    expect(storedPlayerId()).toBe('greg-id');
  });
});

describe('shouldAskToSaveRecovery', () => {
  test('asks the first time this browser banks a win', () => {
    // #given a first-place finish that has actually landed on the season row
    const ask = shouldAskToSaveRecovery({
      won: true,
      banked: true,
      alreadyAsked: false,
      storedCode: null,
    });

    // #then that is the moment there is a record worth keeping
    expect(ask).toBe(true);
  });

  test('does not ask after a finish that is not a win', () => {
    // #given a banked round that did not come first
    const ask = shouldAskToSaveRecovery({
      won: false,
      banked: true,
      alreadyAsked: false,
      storedCode: null,
    });

    // #then the smaller interpretation holds: a season row alone is not enough
    expect(ask).toBe(false);
  });

  test('does not ask until the win has been banked', () => {
    // #given first place whose season write has not landed
    const ask = shouldAskToSaveRecovery({
      won: true,
      banked: false,
      alreadyAsked: false,
      storedCode: null,
    });

    // #then there is not yet a record to save
    expect(ask).toBe(false);
  });

  test('does not ask again once this browser has been asked', () => {
    // #given a later win on a browser that already saw the offer
    const ask = shouldAskToSaveRecovery({
      won: true,
      banked: true,
      alreadyAsked: true,
      storedCode: null,
    });

    // #then the podium is left alone
    expect(ask).toBe(false);
  });

  test('does not ask when a recovery code is already stored', () => {
    // #given a win on a browser that already has a code
    const ask = shouldAskToSaveRecovery({
      won: true,
      banked: true,
      alreadyAsked: false,
      storedCode: 'ABCD3F7H',
    });

    // #then there is nothing to save
    expect(ask).toBe(false);
  });
});

describe('hasBeenAskedToSaveRecovery', () => {
  test('persists beside the other identity prefs', () => {
    // #given a browser that has just been asked
    const contents = stubStorage();
    markAskedToSaveRecovery();

    // #when the next win checks
    // #then the flag is the same key-shape as the name and the code
    expect(hasBeenAskedToSaveRecovery()).toBe(true);
    expect(contents.get('vibequiz.recoveryAsked')).toBe('1');
  });

  test('reads as not asked when storage refuses', () => {
    // #given a private window
    stubStorage({ throws: true });

    // #when the final screen checks
    // #then it offers rather than throwing
    expect(hasBeenAskedToSaveRecovery()).toBe(false);
    expect(() => markAskedToSaveRecovery()).not.toThrow();
  });
});

describe('needsReclaim', () => {
  test('prompts when a stored code would not write under this uid', () => {
    // #given a claimed identity and its recovery code still in localStorage,
    // and no claims/{uid} document for the uid this visit minted
    const reclaim = needsReclaim({
      uid: 'new-anon',
      storedPlayerId: 'greg-id',
      storedCode: 'ABCD3F7H',
      claimPlayerId: null,
    });

    // #then both ownsPlayer branches fail: playerId is not the new uid, and
    // there is no claim pointing at greg-id, so banking would be refused
    expect(reclaim).toBe(true);
  });

  test('does not prompt when this uid already holds the claim', () => {
    // #given the healthy claimed-browser case
    const reclaim = needsReclaim({
      uid: 'new-anon',
      storedPlayerId: 'greg-id',
      storedCode: 'ABCD3F7H',
      claimPlayerId: 'greg-id',
    });

    // #then ownsPlayer's claims branch would allow the write
    expect(reclaim).toBe(false);
  });

  test('does not prompt on the original browser that never claimed', () => {
    // #given a minted code whose playerId is still this uid
    const reclaim = needsReclaim({
      uid: 'anon-uid',
      storedPlayerId: 'anon-uid',
      storedCode: 'ABCD3F7H',
      claimPlayerId: null,
    });

    // #then the uid branch of ownsPlayer still holds, and nagging them to
    // "restore" a claim they do not need would fire on every visit
    expect(reclaim).toBe(false);
  });

  test('does not prompt without a stored code', () => {
    // #given a claimed playerId and no way to mint claims/{uid}
    const reclaim = needsReclaim({
      uid: 'new-anon',
      storedPlayerId: 'greg-id',
      storedCode: null,
      claimPlayerId: null,
    });

    // #then there is nothing to present
    expect(reclaim).toBe(false);
  });

  test('does not prompt when nothing has been claimed', () => {
    // #given an ordinary browser
    const reclaim = needsReclaim({
      uid: 'anon-uid',
      storedPlayerId: null,
      storedCode: null,
      claimPlayerId: null,
    });

    // #then there is no identity to restore
    expect(reclaim).toBe(false);
  });

  test('prompts when the claim points at a different playerId', () => {
    // #given a claims document that does not match what storage will write
    const reclaim = needsReclaim({
      uid: 'new-anon',
      storedPlayerId: 'greg-id',
      storedCode: 'ABCD3F7H',
      claimPlayerId: 'someone-else',
    });

    // #then the claims branch would not allow a write to greg-id
    expect(reclaim).toBe(true);
  });
});

describe('storedRecoveryCode', () => {
  test('returns the code sitting in storage', () => {
    // #given the re-claim case's other half
    stubStorage({ seed: { 'vibequiz.recovery': 'ABCD3F7H' } });

    // #when the restore button looks it up
    // #then it is already there — they should not have to type it again
    expect(storedRecoveryCode()).toBe('ABCD3F7H');
  });
});
