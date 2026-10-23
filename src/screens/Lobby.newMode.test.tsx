import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test } from 'vitest';
import { createRoom } from '../engine/state';
import type { PackId, PackSummary } from '../questions/types';
import { Lobby } from './Lobby';

/**
 * A new lobby mode wears the same sticker as a new round, on the button the
 * quizmaster presses. Players vote for a pack, not a mode, so their lobby has
 * nowhere to put one.
 */

afterEach(cleanup);

const noop = () => {};

function pack(id: PackId, title: string): PackSummary {
  return {
    id,
    title,
    blurb: 'A round',
    count: 40,
    counts: { easy: 10, medium: 20, hard: 10 },
    ...(id === 'picture' ? { jigsawCount: 30 } : {}),
  };
}

function show(today: string, isQuizmaster: boolean) {
  return render(
    <Lobby
      room={{
        ...createRoom('HKQ7'),
        players: {
          greg: { name: 'Greg', joinedAt: 1 },
          priya: { name: 'Priya', joinedAt: 2 },
        },
      }}
      youUid={isQuizmaster ? 'greg' : 'priya'}
      isQuizmaster={isQuizmaster}
      packs={[pack('sleeves', 'Sleeves'), pack('picture', 'Fine Art')]}
      busy={false}
      onVote={noop}
      onStart={noop}
      onLeave={noop}
      notice={{ unseen: false, teaser: null }}
      today={today}
    />,
  );
}

describe('lobby mode stickers', () => {
  test('stickers a mode that is still inside its fortnight', () => {
    show('2026-10-23', true);
    expect(screen.getByRole('button', { name: /Against Mr Fries/ })).toHaveTextContent('New');
    expect(screen.getByRole('button', { name: /The Ladder/ })).not.toHaveTextContent('New');
    expect(screen.getByRole('button', { name: /Share or Shaft/ })).not.toHaveTextContent('New');
  });

  test('stickers the September modes, and the jigsaw once that pack is open', async () => {
    show('2026-09-04', true);
    expect(screen.getByRole('button', { name: /The Ladder/ })).not.toHaveTextContent('New');
    expect(screen.getByRole('button', { name: /Played for stakes/ })).toHaveTextContent('New');
    expect(screen.getByRole('button', { name: /First right answer steals/ })).toHaveTextContent('New');

    await userEvent.click(screen.getByRole('button', { name: /Fine Art/ }));
    expect(screen.getByRole('button', { name: /As a 3×3 jigsaw/ })).toHaveTextContent('New');
  });

  test('stickers The Ladder through 15 Aug and not the day after', () => {
    show('2026-08-15', true);
    expect(screen.getByRole('button', { name: /The Ladder/ })).toHaveTextContent('New');
    cleanup();
    show('2026-08-16', true);
    expect(screen.getByRole('button', { name: /The Ladder/ })).not.toHaveTextContent('New');
  });

  test('the vote does not list modes, so a player sees no mode sticker', () => {
    show('2026-10-23', false);
    expect(screen.queryByRole('button', { name: /Against Mr Fries/ })).toBeNull();
    expect(screen.queryByText('New')).toBeNull();
  });
});
