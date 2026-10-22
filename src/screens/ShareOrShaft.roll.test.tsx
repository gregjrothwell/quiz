import { render } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createRoom, type RoomState } from '../engine/state';
import type * as Sound from '../lib/sound';
import type { StandoffView } from '../lib/useStandoff';
import { ShareOrShaft } from './ShareOrShaft';

/**
 * What the final plays between its stages. The drum roll that covered the
 * picks being opened came out on 22 October 2026: on laptop speakers it was a
 * stutter, not a roll.
 */

const useCue = vi.hoisted(() => vi.fn());
vi.mock('../lib/sound', async (original) => ({
  ...(await original<typeof Sound>()),
  useCue,
}));

beforeEach(() => {
  useCue.mockClear();
});

const VIEW: StandoffView = {
  lockedIn: { sam: true, greg: true },
  myPick: null,
  secondsLeft: 0,
  remainingMs: 0,
  pick: () => undefined,
};

function final(stage: 'talk' | 'closed'): RoomState {
  return {
    ...createRoom('HKQ7'),
    phase: 'standoff',
    gameId: 'tonight',
    standoffEnabled: true,
    players: {
      sam: { name: 'Sam', joinedAt: 1 },
      greg: { name: 'Greg', joinedAt: 2 },
      priya: { name: 'Priya', joinedAt: 3 },
    },
    scores: { sam: 3_100, greg: 2_450, priya: 1_800 },
    standoff: {
      finalists: ['sam', 'greg'],
      stakes: { sam: 3_100, greg: 2_450 },
      stage,
      sealed: stage === 'closed' ? ['sam', 'greg'] : null,
      picks: null,
    },
  };
}

function show(room: RoomState) {
  render(
    <ShareOrShaft
      room={room}
      youUid="priya"
      isQuizmaster={false}
      view={VIEW}
      records={null}
      onOpenPicks={() => undefined}
      onNext={() => undefined}
    />,
  );
}

const played = (cue: string): boolean => useCue.mock.calls.some(([name, , enabled]) => name === cue && enabled === true);

describe('the final’s cues', () => {
  test('stings as the final opens', () => {
    // #given the talk, the first stage
    show(final('talk'));

    // #then the sting plays
    expect(played('sting')).toBe(true);
  });

  test('plays no drum roll while the picks are opened', () => {
    // #given the whistle has gone and the picks are being opened
    show(final('closed'));

    // #then nothing rolls
    expect(played('roll')).toBe(false);
  });
});
