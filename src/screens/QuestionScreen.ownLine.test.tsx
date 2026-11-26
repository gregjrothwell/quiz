import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRoom, type QuizQuestion, type RoomState } from '../engine/state';
import { QuestionScreen } from './QuestionScreen';

/**
 * Your own line on the reveal, and the one press that leaves it (PROJ-182).
 *
 * The table no longer follows every question, so the reveal is where a player
 * finds out where they are, and the quizmaster's press opens the next question
 * rather than a table. docs/decisions/reveal-line.md.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const noop = () => {};
const OPEN = { elapsedMs: 4_000, remainingMs: 6_000, secondsLeft: 6, expired: false };
const SHUT = { elapsedMs: 10_000, remainingMs: 0, secondsLeft: 0, expired: true };

/** Longer than any replay: the verdict has landed. */
const SETTLED_MS = 10_000;

const question = (id: string, overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id,
  prompt: `Which is ${id}?`,
  options: ['The right one', 'The wrong one', 'Another', 'The last'],
  correctIndex: 0,
  category: 'Film',
  difficulty: 'easy',
  ...overrides,
});

function room(overrides: Partial<RoomState> = {}): RoomState {
  const sam = { optionIndex: 0, elapsedMs: 1_200 };
  const priya = { optionIndex: 1, elapsedMs: 2_400 };
  return {
    ...createRoom('RV82'),
    phase: 'reveal',
    gameId: 'g1',
    index: 1,
    packId: 'screens',
    packTitle: 'On the box',
    durationSecs: 10,
    players: {
      sam: { name: 'Sam', joinedAt: 1 },
      priya: { name: 'Priya', joinedAt: 2 },
    },
    questions: Array.from({ length: 10 }, (_, i) => question(`q${i + 1}`)),
    // Priya led on 900 and Sam passed her on this one.
    scores: { sam: 1_000, priya: 900 },
    answers: { sam, priya },
    lastPicks: { sam, priya },
    lastDeltas: { sam: 1_000, priya: 0 },
    ...overrides,
  };
}

interface Shown {
  you?: string;
  host?: boolean;
  revealed?: boolean;
  onNext?: () => void;
  onTable?: () => void;
}

function element(state: RoomState, { you = 'sam', host = false, revealed = true, onNext = noop, onTable = noop }: Shown = {}) {
  return (
    <QuestionScreen
      room={state}
      youUid={you}
      isQuizmaster={host}
      clock={revealed ? SHUT : OPEN}
      revealed={revealed}
      onAnswer={noop}
      onReveal={noop}
      onNext={onNext}
      onTable={onTable}
      onVote={noop}
    />
  );
}

const settle = (): void => act(() => void vi.advanceTimersByTime(SETTLED_MS));

describe('your own line', () => {
  test('is your place, your movement and your points, on one desk line each', () => {
    const { container } = render(element(room()));
    settle();
    expect(container.querySelector('.verdict')?.textContent).toMatch(/^Correct · \+/);
    expect(container.querySelector('.ownline')?.textContent).toBe('1st, up one');
    expect(container.querySelector('.ownline')?.getAttribute('data-dir')).toBe('up');
  });

  test('is each player’s own', () => {
    const { container } = render(element(room(), { you: 'priya' }));
    settle();
    expect(container.querySelector('.ownline')?.textContent).toBe('2nd, down one');
    expect(container.querySelector('.ownline')?.getAttribute('data-dir')).toBe('down');
  });

  test('is the quizmaster’s too', () => {
    const { container } = render(element(room(), { host: true }));
    settle();
    expect(container.querySelector('.ownline')?.textContent).toBe('1st, up one');
  });

  test('waits for the verdict, and holds its place until it lands', () => {
    const { container } = render(element(room()));
    const line = container.querySelector('.ownline');
    expect(line).not.toBeNull();
    expect(line?.classList.contains('ownline--in')).toBe(false);
    settle();
    expect(container.querySelector('.ownline')?.classList.contains('ownline--in')).toBe(true);
  });

  test('is not there while the question is open', () => {
    const { container } = render(element(room({ phase: 'question', lastDeltas: {} }), { revealed: false }));
    expect(container.querySelector('.ownline')).toBeNull();
  });

  test('is not there after a tell, which scores nobody', () => {
    const questions = room().questions.map((each) => ({ ...each, survey: { part: 'tell' as const, promptId: 'p' } }));
    const { container } = render(element(room({ questions, lastDeltas: {} })));
    settle();
    expect(container.querySelector('.ownline')).toBeNull();
  });
});

describe('what the quizmaster presses', () => {
  test('one press opens the next question, and the table is there to ask for', () => {
    const onNext = vi.fn();
    const onTable = vi.fn();
    render(element(room(), { host: true, onNext, onTable }));
    settle();
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show the table' }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onTable).toHaveBeenCalledTimes(1);
  });

  test('at a break the press is the standings, and nothing else is offered', () => {
    render(element(room({ index: 4 }), { host: true }));
    settle();
    expect(screen.getByRole('button', { name: 'Standings' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show the table' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next question' })).toBeNull();
  });

  test('on the last question the press is the results, and the podium is not given away', () => {
    render(element(room({ index: 9 }), { host: true }));
    settle();
    expect(screen.getByRole('button', { name: 'Final results' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show the table' })).toBeNull();
  });

  test('not before the verdict lands, by button or by key', () => {
    // Enter locks an answer in. Pressed on the buzzer as the reveal arrives, it
    // would otherwise open the next question over an answer nobody has seen.
    const onNext = vi.fn();
    render(element(room(), { host: true, onNext }));
    expect((screen.getByRole('button', { name: 'Next question' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Show the table' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: ' ' });
    expect(onNext).not.toHaveBeenCalled();

    settle();
    fireEvent.keyDown(window, { key: ' ' });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  test('reduced motion, where the verdict lands at once, still has a beat before it', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('reduce'), media: query, onchange: null,
          addEventListener: () => {}, removeEventListener: () => {},
          addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
        }) as MediaQueryList,
    );
    const onNext = vi.fn();
    render(element(room(), { host: true, onNext }));
    act(() => void vi.advanceTimersByTime(400));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onNext).not.toHaveBeenCalled();
    settle();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  test('the next reveal is held again: the last one’s beat does not carry over', () => {
    const onNext = vi.fn();
    const view = render(element(room(), { host: true, onNext }));
    settle();
    view.rerender(element(room({ phase: 'question', index: 2, answers: {}, lastDeltas: {}, lastPicks: {} }), { host: true, revealed: false, onNext }));
    // A whole question goes by, and none of that counts towards the beat.
    settle();
    view.rerender(element(room({ index: 2 }), { host: true, onNext }));
    fireEvent.keyDown(window, { key: ' ' });
    expect(onNext).not.toHaveBeenCalled();
  });

  test('a clicked Next does not leave its button holding the keyboard', () => {
    // The screen stays mounted now. One button element for both would keep the
    // focus and be disabled under it, and a disabled button swallows every key.
    const view = render(element(room(), { host: true }));
    settle();
    const next = screen.getByRole('button', { name: 'Next question' });
    next.focus();
    expect(document.activeElement).toBe(next);
    view.rerender(element(room({ phase: 'question', index: 2, answers: {}, lastDeltas: {}, lastPicks: {} }), { host: true, revealed: false }));
    expect(document.activeElement).toBe(document.body);
  });
});

describe('what everybody else reads', () => {
  test('what they are waiting for', () => {
    const { container } = render(element(room()));
    expect(container.textContent).toContain('Waiting for the quizmaster to open the next question…');
  });

  test('a break says the standings', () => {
    const { container } = render(element(room({ index: 4 })));
    expect(container.textContent).toContain('Waiting for the quizmaster to show the standings…');
  });
});

describe('the title card’s job, which the lead-in now does', () => {
  test('the pack is named beside the question number', () => {
    const { container } = render(element(room({ phase: 'question', lastDeltas: {} }), { revealed: false }));
    const chips = [...container.querySelectorAll('.qhead__tags .chip')].map((chip) => chip.textContent);
    expect(chips).toEqual(['On the box', 'Film', 'easy']);
  });

  test('once, where the category is the pack', () => {
    const questions = room().questions.map((each) => ({ ...each, category: 'On the box' }));
    const { container } = render(element(room({ phase: 'question', questions, lastDeltas: {} }), { revealed: false }));
    const chips = [...container.querySelectorAll('.qhead__tags .chip')].map((chip) => chip.textContent);
    expect(chips).toEqual(['On the box', 'easy']);
  });
});

describe('a new question on the same screen', () => {
  test('starts at the top of the page', () => {
    // Nothing unmounts between a reveal and the next question any more, so a
    // phone scrolled to the lecterns would open the next one with its prompt
    // off the top.
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const view = render(element(room()));
    Object.defineProperty(window, 'scrollY', { value: 400, configurable: true });
    view.rerender(element(room({ phase: 'question', index: 2, answers: {}, lastDeltas: {}, lastPicks: {} }), { revealed: false }));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockClear();

    // And a reveal leaves the page where the player has it.
    view.rerender(element(room({ index: 2 })));
    expect(scrollTo).not.toHaveBeenCalled();
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });
});
