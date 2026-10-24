import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createRoom } from '../engine/state';
import type { PackId, PackSummary } from '../questions/types';
import { Lobby } from './Lobby';

/**
 * Join-link players never see the landing page, so What's new has to be in
 * the lobby, and opening it must not be a way out of the room.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const noop = () => {};

function pack(id: PackId, title: string): PackSummary {
  return { id, title, blurb: 'A round', count: 40, counts: { easy: 0, medium: 40, hard: 0 } };
}

function show(extra: Partial<Parameters<typeof Lobby>[0]> = {}) {
  return render(
    <Lobby
      room={{
        ...createRoom('HKQ7'),
        players: {
          greg: { name: 'Greg', joinedAt: 1 },
          priya: { name: 'Priya', joinedAt: 2 },
        },
      }}
      youUid="priya"
      isQuizmaster={false}
      packs={[pack('survey', 'Survey Says'), pack('sleeves', 'Sleeves')]}
      busy={false}
      onVote={noop}
      onStart={noop}
      onLeave={noop}
      today="2026-10-23"
      {...extra}
    />,
  );
}

describe('What’s new in the lobby', () => {
  test('a link-joiner can open it without leaving', async () => {
    const onUpdates = vi.fn();
    const onLeave = vi.fn();
    show({
      onUpdates,
      onLeave,
      notice: { unseen: true, teaser: 'A new show round, Survey Says.' },
    });
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: /What’s new \(new\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New since you last played/ })).toHaveTextContent(
      'A new show round, Survey Says.',
    );

    await user.click(screen.getByRole('button', { name: /What’s new/ }));
    await user.click(screen.getByRole('button', { name: /New since you last played/ }));

    expect(onUpdates).toHaveBeenCalledTimes(2);
    expect(onLeave).not.toHaveBeenCalled();
  });

  test('hides the teaser and the dot once this browser has opened the page', () => {
    localStorage.setItem('vibequiz.updatesSeen', '9999-01-01');
    show();
    expect(screen.getByRole('button', { name: 'What’s new' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New since you last played/ })).toBeNull();
    expect(screen.queryByText('(new)')).toBeNull();
  });

  test('stickers a round still inside its fortnight, and not one that never was', () => {
    show();
    const survey = screen.getAllByRole('button').find((button) => button.textContent?.includes('Survey Says'));
    const sleeves = screen.getAllByRole('button').find((button) => button.textContent?.includes('Sleeves'));
    expect(survey?.textContent).toContain('New');
    expect(sleeves?.textContent).not.toContain('New');
  });

  test('drops the sticker the day after', () => {
    show({ today: '2026-11-06' });
    const survey = screen.getAllByRole('button').find((button) => button.textContent?.includes('Survey Says'));
    expect(survey?.textContent).not.toContain('New');
  });
});
