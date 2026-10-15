import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createRoom, type RoomState } from '../engine/state';
import type { PackId, PackSummary } from '../questions/types';
import { Lobby } from './Lobby';

/**
 * Two taps on the lobby vote, then it locks (docs/decisions/lobby-vote.md).
 *
 * The harness plays the room's part: a vote written through `onVote` comes back
 * on `room.packVotes`, with `room.voteTaps` counted up in the same write, as it
 * does live, so the card under test reads the vote it just cast rather than a
 * fixture that never moves. `held` starts the room part-way, which is what a
 * reload looks like from the lobby's side.
 */

afterEach(cleanup);

const noop = () => {};

function pack(id: PackId, title: string): PackSummary {
  return { id, title, blurb: '', count: 100, counts: { easy: 30, medium: 40, hard: 30 } };
}

const PACKS = [pack('sleeves', 'Sleeves'), pack('flags', 'Flags'), pack('screens', 'On the box')];

function Room({
  onVote,
  held = {},
}: {
  onVote: (packId: PackId | null) => void;
  held?: Partial<Pick<RoomState, 'packVotes' | 'voteTaps'>>;
}) {
  const [room, setRoom] = useState<RoomState>({
    ...createRoom('HKQ7'),
    players: {
      greg: { name: 'Greg', joinedAt: 1 },
      priya: { name: 'Priya', joinedAt: 2 },
    },
    ...held,
  });
  return (
    <Lobby
      room={room}
      youUid="priya"
      isQuizmaster={false}
      packs={PACKS}
      busy={false}
      onVote={(packId) => {
        onVote(packId);
        setRoom((held) => {
          const packVotes = { ...held.packVotes };
          if (packId === null) delete packVotes['priya'];
          else packVotes['priya'] = packId;
          const voteTaps = { ...held.voteTaps, priya: (held.voteTaps['priya'] ?? 0) + 1 };
          return { ...held, packVotes, voteTaps };
        });
      }}
      onStart={noop}
      onLeave={noop}
    />
  );
}

function card(title: string): HTMLElement {
  const found = screen.getAllByRole('button').find((button) => button.textContent?.includes(title));
  if (!found) throw new Error(`no card for ${title}`);
  return found;
}

describe('the lobby vote limit', () => {
  test('two taps land, and the third writes nothing', async () => {
    // #given a player in the lobby
    const onVote = vi.fn();
    render(<Room onVote={onVote} />);
    const user = userEvent.setup();

    // #when they cast, then change their mind
    await user.click(card('Sleeves'));
    await user.click(card('Flags'));

    // #then both are written and the change stands
    expect(onVote.mock.calls).toEqual([['sleeves'], ['flags']]);
    expect(card('Flags')).toHaveAttribute('aria-pressed', 'true');

    // #when they keep clicking
    await user.click(card('On the box'));
    await user.click(card('Flags'));

    // #then nothing more is written and the vote has not moved
    expect(onVote).toHaveBeenCalledTimes(2);
    expect(card('Flags')).toHaveAttribute('aria-pressed', 'true');
    expect(card('On the box')).toBeDisabled();
  });

  test('taking it back is one of the two', async () => {
    const onVote = vi.fn();
    render(<Room onVote={onVote} />);
    const user = userEvent.setup();

    await user.click(card('Sleeves'));
    await user.click(card('Sleeves'));
    await user.click(card('Flags'));

    expect(onVote.mock.calls).toEqual([['sleeves'], [null]]);
    expect(card('Flags')).toHaveAttribute('aria-pressed', 'false');
  });

  test('the hint says one change is left, then that it is locked', async () => {
    render(<Room onVote={noop} />);
    const user = userEvent.setup();

    expect(screen.getByText(/Tap the one you.d like to play/)).toBeInTheDocument();

    await user.click(card('Sleeves'));
    expect(screen.getByText(/1 change left/)).toBeInTheDocument();

    await user.click(card('Flags'));
    expect(screen.getByText(/Your vote is locked in/)).toBeInTheDocument();
  });

  test('locked with no vote standing says so rather than claiming one', async () => {
    render(<Room onVote={noop} />);
    const user = userEvent.setup();

    await user.click(card('Sleeves'));
    await user.click(card('Sleeves'));

    expect(screen.getByText(/You’ve used your taps/)).toBeInTheDocument();
  });

  test('a reload after both taps comes back locked', async () => {
    // #given a player who used both taps, then reloaded: the lobby is new, the room is not
    const onVote = vi.fn();
    render(<Room onVote={onVote} held={{ packVotes: { priya: 'flags' }, voteTaps: { priya: 2 } }} />);
    const user = userEvent.setup();

    // #then the vote they cast is still theirs and still locked
    expect(screen.getByText(/Your vote is locked in/)).toBeInTheDocument();
    expect(card('Sleeves')).toBeDisabled();

    // #when they try again anyway
    await user.click(card('Sleeves'));

    // #then nothing is written
    expect(onVote).not.toHaveBeenCalled();
    expect(card('Flags')).toHaveAttribute('aria-pressed', 'true');
  });

  test('a reload after one tap leaves one change, not two', async () => {
    const onVote = vi.fn();
    render(<Room onVote={onVote} held={{ packVotes: { priya: 'sleeves' }, voteTaps: { priya: 1 } }} />);
    const user = userEvent.setup();

    expect(screen.getByText(/1 change left/)).toBeInTheDocument();

    await user.click(card('Flags'));
    await user.click(card('On the box'));

    expect(onVote.mock.calls).toEqual([['flags']]);
    expect(screen.getByText(/Your vote is locked in/)).toBeInTheDocument();
  });

  test('the counts stay readable on a locked card', async () => {
    render(<Room onVote={noop} />);
    const user = userEvent.setup();

    await user.click(card('Sleeves'));
    await user.click(card('Flags'));

    expect(card('Flags')).toHaveTextContent('1 vote · top');
  });
});
