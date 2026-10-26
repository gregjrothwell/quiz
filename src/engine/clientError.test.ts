import { describe, expect, it } from 'vitest';
import {
  MAX_MESSAGE,
  MAX_PER_PAGE,
  NO_ROOM,
  buildFrom,
  createBeaconBudget,
  errorDoc,
  messageOf,
} from './clientError';

describe('errorDoc', () => {
  it('keeps what the rules take, and nothing that names a player', () => {
    const doc = errorDoc(
      'Missing or insufficient permissions.',
      'notice',
      { room: 'B498', phase: 'finished', gameId: 'g-1' },
      'index-t7PF9llL',
      'ios',
    );
    expect(doc).toEqual({
      message: 'Missing or insufficient permissions.',
      source: 'notice',
      build: 'index-t7PF9llL',
      device: 'ios',
      room: 'B498',
      phase: 'finished',
      gameId: 'g-1',
    });
    expect(Object.keys(doc)).not.toContain('uid');
  });

  it('clamps a long message rather than losing it', () => {
    expect(errorDoc('x'.repeat(1000), 'error', NO_ROOM, 'dev', 'mac').message).toHaveLength(MAX_MESSAGE);
  });

  it('leaves the room fields off on the landing, and off when they would be refused', () => {
    expect(Object.keys(errorDoc('m', 'error', NO_ROOM, 'dev', 'mac')).sort()).toEqual(['build', 'device', 'message', 'source']);
    const odd = errorDoc('m', 'error', { room: 'rules-check-room', phase: 'nowhere', gameId: null }, 'dev', 'mac');
    expect(odd.room).toBeUndefined();
    expect(odd.phase).toBeUndefined();
  });
});

describe('buildFrom', () => {
  it('reads the bundle hash off the entry script', () => {
    expect(buildFrom(['/quiz/assets/index-t7PF9llL.js'])).toBe('index-t7PF9llL');
    expect(buildFrom(['https://example.test/x.js', '/quiz/assets/index-Ab_c-9.js'])).toBe('index-Ab_c-9');
  });

  it('says dev under the dev server', () => {
    expect(buildFrom(['/quiz/src/main.tsx'])).toBe('dev');
    expect(buildFrom([])).toBe('dev');
  });
});

describe('createBeaconBudget (A3)', () => {
  it('writes one message at one step once', () => {
    const allow = createBeaconBudget();
    expect(allow('refused', 'g:0:reveal')).toBe(true);
    expect(allow('refused', 'g:0:reveal')).toBe(false);
    expect(allow('refused', 'g:1:reveal')).toBe(true);
    expect(allow('something else', 'g:1:reveal')).toBe(true);
  });

  it('stops at the page budget, so a loop is not a storm', () => {
    const allow = createBeaconBudget();
    const written = Array.from({ length: 50 }, (_, i) => allow(`m${String(i)}`, 'step')).filter(Boolean);
    expect(written).toHaveLength(MAX_PER_PAGE);
  });
});

describe('messageOf', () => {
  it('gives an error its message and names anything else', () => {
    expect(messageOf(new Error('boom'))).toBe('boom');
    expect(messageOf('plain')).toBe('plain');
    expect(messageOf({ secret: 'not dumped' })).toBe('Non-error thrown: object');
  });
});
