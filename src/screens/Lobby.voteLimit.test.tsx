import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createRoom, type RoomState } from '../engine/state';
import type { PackId, PackSummary } from '../questions/types';
import { Lobby } from './Lobby';

/**
 * Three taps on the lobby vote, then it locks (docs/decisions/lobby-vote.md).
 *
 * The harness plays the room's part: a vote written through `onVote` comes back
 * on `room.packVotes`, as it does live, so the card under test reads the vote
 * it just cast rather than a fixture that never moves.
 */

afterEach(cleanup);

const noop = () => {};

function pack(id: PackId, title: string): PackSummary {
  return { id, title, blurb: '', count: 100, counts: { easy: 30, medium: 40, hard: 30 } };
}

const PACKS = [pack('sleeves', 'Sleeves'), pack('flags', 'Flags'), pack('screens', 'On the box')];

function Room({ onVote }: { onVote: (packId: PackId | null) => void }) {
  const [room, setRoom] = useState<RoomState>({
    ...createRoom('HKQ7'),
    players: {
      greg: { name: 'Greg', joinedAt: 1 },
      priya: { name: 'Priya', joinedAt: 2 },
    },
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
          return { ...held, packVotes };
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
  test('three taps land, and the fourth writes nothing', async () => {
    // #given a player in the lobby
    const onVote = vi.fn();
    render(<Room onVote={onVote} />);
    const user = userEvent.setup();

    // #when they cast, change, and change again
    await user.click(card('Sleeves'));
    await user.click(card('Flags'));
    await user.click(card('On the box'));

    // #then all three are written and the last one stands
    expect(onVote.mock.calls).toEqual([['sleeves'], ['flags'], ['screens']]);
    expect(card('On the box')).toHaveAttribute('aria-pressed', 'true');

    // #when they keep clicking
    await user.click(card('Sleeves'));
    await user.click(card('On the box'));

    // #then nothing more is written and the vote has not moved
    expect(onVote).toHaveBeenCalledTimes(3);
    expect(card('On the box')).toHaveAttribute('aria-pressed', 'true');
    expect(card('Sleeves')).toBeDisabled();
  });

  test('taking it back is one of the three', async () => {
    const onVote = vi.fn();
    render(<Room onVote={onVote} />);
    const user = userEvent.setup();

    await user.click(card('Sleeves'));
    await user.click(card('Sleeves'));
    await user.click(card('Flags'));
    await user.click(card('Sleeves'));

    expect(onVote.mock.calls).toEqual([['sleeves'], [null], ['flags']]);
    expect(card('Flags')).toHaveAttribute('aria-pressed', 'true');
  });

  test('the hint counts down the changes, then says it is locked', async () => {
    render(<Room onVote={noop} />);
    const user = userEvent.setup();

    expect(screen.getByText(/Tap the one you.d like to play/)).toBeInTheDocument();

    await user.click(card('Sleeves'));
    expect(screen.getByText(/2 changes left/)).toBeInTheDocument();

    await user.click(card('Flags'));
    expect(screen.getByText(/1 change left/)).toBeInTheDocument();

    await user.click(card('On the box'));
    expect(screen.getByText(/Your vote is locked in/)).toBeInTheDocument();
  });

  test('locked with no vote standing says so rather than claiming one', async () => {
    render(<Room onVote={noop} />);
    const user = userEvent.setup();

    await user.click(card('Sleeves'));
    await user.click(card('Flags'));
    await user.click(card('Flags'));

    expect(screen.getByText(/You’ve used your taps/)).toBeInTheDocument();
  });

  test('the counts stay readable on a locked card', async () => {
    render(<Room onVote={noop} />);
    const user = userEvent.setup();

    await user.click(card('Sleeves'));
    await user.click(card('Flags'));
    await user.click(card('Sleeves'));

    expect(card('Sleeves')).toHaveTextContent('1 vote · top');
  });
});
