import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRoom, type Player, type RoomState } from '../engine/state';
import type * as Sound from '../lib/sound';
import type { PackId, PackSummary } from '../questions/types';
import { Lobby } from './Lobby';

/**
 * Somebody walking into the lobby pings the quizmaster's device, and only that
 * one, and only for an arrival this lobby saw happen.
 */

const play = vi.hoisted(() => vi.fn());
vi.mock('../lib/sound', async (original) => ({
  ...(await original<typeof Sound>()),
  play,
}));

afterEach(cleanup);
beforeEach(() => play.mockClear());

const noop = () => {};

function pack(id: PackId, title: string): PackSummary {
  return { id, title, blurb: '', count: 100, counts: { easy: 30, medium: 40, hard: 30 } };
}

const PACKS = [pack('sleeves', 'Sleeves')];

function roomWith(players: Record<string, Player>): RoomState {
  return { ...createRoom('HKQ7'), players };
}

const GREG = { name: 'Greg', joinedAt: 1 };
const PRIYA = { name: 'Priya', joinedAt: 2 };
const SAM = { name: 'Sam', joinedAt: 3 };

function lobby(room: RoomState, isQuizmaster: boolean) {
  return (
    <Lobby
      room={room}
      youUid="greg"
      isQuizmaster={isQuizmaster}
      packs={PACKS}
      busy={false}
      onVote={noop}
      onStart={noop}
      onLeave={noop}
    />
  );
}

const joins = (): number => play.mock.calls.filter(([cue]) => cue === 'join').length;

describe('an arrival in the lobby', () => {
  test('pings the quizmaster when somebody walks in', () => {
    // #given the quizmaster's lobby with two in it
    const { rerender } = render(lobby(roomWith({ greg: GREG, priya: PRIYA }), true));

    // #when Sam joins
    rerender(lobby(roomWith({ greg: GREG, priya: PRIYA, sam: SAM }), true));

    // #then the quizmaster hears it, once
    expect(joins()).toBe(1);
  });

  test('opening the lobby on a room that is already full is not an arrival', () => {
    render(lobby(roomWith({ greg: GREG, priya: PRIYA, sam: SAM }), true));
    expect(joins()).toBe(0);
  });

  test('somebody leaving is not an arrival', () => {
    const { rerender } = render(lobby(roomWith({ greg: GREG, priya: PRIYA, sam: SAM }), true));
    rerender(lobby(roomWith({ greg: GREG, priya: PRIYA }), true));
    expect(joins()).toBe(0);
  });

  test('stays silent on everybody else’s device', () => {
    // #given a player's lobby, not the quizmaster's
    const { rerender } = render(lobby(roomWith({ greg: GREG, priya: PRIYA }), false));

    // #when Sam joins
    rerender(lobby(roomWith({ greg: GREG, priya: PRIYA, sam: SAM }), false));

    // #then nothing plays: ten devices on one call would be ten pings
    expect(joins()).toBe(0);
  });
});
