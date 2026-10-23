import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ChaserIntro } from './ChaserIntro';

/**
 * Mr Fries's card is the mode's intro, before question one. The whole room
 * sees it. The quizmaster taps to open the question; everyone else waits.
 * The sticker lasts as long as the lobby button's.
 */

afterEach(cleanup);

describe('the Beat the Chaser title card', () => {
  test('introduces Mr Fries, sticker and all', () => {
    render(<ChaserIntro isQuizmaster={false} onStart={() => undefined} today="2026-11-05" />);
    expect(screen.getByRole('heading', { name: /Against Mr Fries/ })).toBeInTheDocument();
    expect(screen.getByText(/whole office vs the house/i)).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText(/Waiting for the quizmaster/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next question' })).toBeNull();
  });

  test('the quizmaster sees the same card, and taps to open the question', () => {
    const onStart = vi.fn();
    render(<ChaserIntro isQuizmaster onStart={onStart} today="2026-10-23" />);
    expect(screen.getByRole('heading', { name: /Against Mr Fries/ })).toBeInTheDocument();
    expect(screen.queryByText(/Waiting for the quizmaster/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  test('drops the sticker the day after the mode’s window', () => {
    render(<ChaserIntro isQuizmaster={false} onStart={() => undefined} today="2026-11-06" />);
    expect(screen.getByRole('heading', { name: /Against Mr Fries/ })).toBeInTheDocument();
    expect(screen.queryByText('New')).toBeNull();
  });
});
