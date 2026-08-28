import { describe, expect, test } from 'vitest';
import { shouldAutoJoin, type AutoJoinContext } from './autoJoin';

/**
 * A browser that has played before, arriving on a join link, signed in and
 * sitting on the landing screen. Every test below spoils exactly one thing
 * about it, so a failure names the condition that broke rather than the
 * arrangement.
 */
function arriving(overrides: Partial<AutoJoinContext> = {}): AutoJoinContext {
  return {
    linkedCode: '6JA5',
    name: 'Greg',
    squad: 'Hermes',
    playingWith: '',
    uid: 'uid-greg',
    connected: true,
    consumed: false,
    inRoom: false,
    ...overrides,
  };
}

describe('shouldAutoJoin', () => {
  test('joins a returning player who arrived on a link', () => {
    // #given a browser that knows who it is and was handed a room code
    const context = arriving();

    // #when the landing screen is about to render
    // #then it goes straight into the room instead
    expect(shouldAutoJoin(context)).toBe(true);
  });

  test('refuses without a code, which is somebody opening the app directly', () => {
    expect(shouldAutoJoin(arriving({ linkedCode: null }))).toBe(false);
  });

  test('refuses a browser that has never played, so a first visit is unchanged', () => {
    // #given no remembered name — the case the landing screen exists for
    const context = arriving({ name: '' });

    // #then it falls back to asking, which is today's behaviour
    expect(shouldAutoJoin(context)).toBe(false);
  });

  test('refuses a name that is only whitespace', () => {
    // Storage holds whatever an older build or a bored player put there, and
    // joining as "   " puts a nameless plate on the board.
    expect(shouldAutoJoin(arriving({ name: '   ' }))).toBe(false);
  });

  test('refuses before anonymous sign-in has landed', () => {
    // `join` throws "Not signed in yet" without a uid, and a rejected promise
    // on arrival would show an error nobody asked for.
    expect(shouldAutoJoin(arriving({ uid: null }))).toBe(false);
  });

  test('refuses while the connection is not ready', () => {
    // A uid outlives a connection going bad — the room listener can fail long
    // after sign-in succeeded — so this is not implied by the uid being set.
    expect(shouldAutoJoin(arriving({ connected: false }))).toBe(false);
  });

  test('refuses a link that has already been acted on', () => {
    // The whole guard against a loop: a join that failed, or a player who
    // deliberately left, must not be pulled straight back in.
    expect(shouldAutoJoin(arriving({ consumed: true }))).toBe(false);
  });

  test('refuses when this device is already in a room', () => {
    expect(shouldAutoJoin(arriving({ inRoom: false, consumed: false }))).toBe(true);
    expect(shouldAutoJoin(arriving({ inRoom: true }))).toBe(false);
  });

  describe('the Lurker who has not said who they are sitting with', () => {
    test('refuses, because auto-joining would bank their week to Lurkers', () => {
      // #given a Lurker on a fresh session: their squad survives in local
      // storage, but `playingWith` is session storage and does not
      const context = arriving({ squad: 'Lurkers', playingWith: '' });

      // #then they get the landing screen, which asks — silently banking a
      // week's points to the wrong squad is worse than one extra press
      expect(shouldAutoJoin(context)).toBe(false);
    });

    test('joins once they have picked a side', () => {
      const context = arriving({ squad: 'Lurkers', playingWith: 'Bundae' });

      expect(shouldAutoJoin(context)).toBe(true);
    });
  });

  test('joins somebody with no squad at all, which is not the Lurker case', () => {
    // #given a player who has never chosen a squad
    const context = arriving({ squad: '', playingWith: '' });

    // #then they join: an empty squad banks as "keep whatever the record says"
    // and changes nothing, where a Lurker's empty side changes which board
    // their points land on
    expect(shouldAutoJoin(context)).toBe(true);
  });
});
