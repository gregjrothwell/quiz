import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createRoom, type QuizQuestion, type RoomState } from '../engine/state';
import type { PackId } from '../questions/types';
import type { QuestionClock } from '../lib/useQuestionClock';
import { QuestionScreen } from './QuestionScreen';

/**
 * A Catchphrase picture plays alone for the first half of the clock.
 *
 * Greg, 2 October 2026: four options on screen from the first frame let anybody
 * solve the picture by matching rather than by saying what they see. So the
 * lecterns stay dark and empty until halfway, then light up with their options.
 * **Any route to an option before then gives the point of the round away**, and
 * the tiles, the `A`–`D` keys and the text in the page are all routes. See
 * docs/decisions/catchphrase.md.
 */

afterEach(cleanup);

const noop = () => {};

const PUZZLE: QuizQuestion = {
  id: 'q1',
  prompt: 'Say what you see',
  options: ['Option one', 'Option two', 'Option three', 'Option four'],
  correctIndex: null,
  category: 'Catchphrase',
  difficulty: 'easy',
  image: 'a'.repeat(64) + '.jpg',
  imageWidth: 1024,
  imageHeight: 768,
};

/**
 * A 10s room, so the options land at 5s. `index` 4 is the fifth question, a
 * Bonus Catchphrase; the puzzle is repeated so the room has one there.
 */
function roomWith(packId: PackId, index = 0): RoomState {
  return {
    ...createRoom('HKQ7'),
    phase: 'question',
    packId,
    packTitle: 'Catchphrase',
    durationSecs: 10,
    index,
    players: { greg: { name: 'Greg', joinedAt: 100 } },
    questions: Array.from({ length: index + 1 }, (_, i) => ({ ...PUZZLE, id: `q${i + 1}` })),
  };
}

function at(elapsedMs: number): QuestionClock {
  const remainingMs = Math.max(0, 10_000 - elapsedMs);
  return {
    elapsedMs,
    remainingMs,
    secondsLeft: Math.ceil(remainingMs / 1000),
    expired: remainingMs === 0,
  };
}

function screen(
  clock: QuestionClock,
  options: {
    packId?: PackId;
    index?: number;
    revealed?: boolean;
    joinedMidQuestion?: boolean;
    onAnswer?: (i: number) => void;
  } = {},
) {
  return (
    <QuestionScreen
      room={roomWith(options.packId ?? 'catchphrase', options.index)}
      youUid="greg"
      isQuizmaster={false}
      clock={clock}
      revealed={options.revealed ?? false}
      joinedMidQuestion={options.joinedMidQuestion ?? false}
      onAnswer={options.onAnswer ?? noop}
      onReveal={noop}
      onNext={noop}
      onVote={noop}
    />
  );
}

const tiles = (container: HTMLElement): HTMLButtonElement[] => [
  ...container.querySelectorAll<HTMLButtonElement>('button.tile'),
];

describe('a Catchphrase picture before halfway', () => {
  test('shows no option anywhere in the page', () => {
    // #given 4.9s into a 10s question
    const { container } = render(screen(at(4_900)));

    // #then not one option's words are in the DOM — dark lecterns only
    for (const option of PUZZLE.options) expect(container.textContent).not.toContain(option);
    expect(tiles(container)).toHaveLength(4);
    expect(tiles(container).every((tile) => tile.disabled)).toBe(true);
  });

  test('says when the options are coming', () => {
    const { container } = render(screen(at(1_000)));
    expect(container.textContent).toMatch(/options arrive at halfway/i);
  });

  test('ignores the answer keys', () => {
    // #given a player who has worked it out and reaches for `a`
    const onAnswer = vi.fn();
    render(screen(at(2_000), { onAnswer }));

    // #when they press it, and `1`, before halfway
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: '1' });

    // #then nothing is written: there is nothing on screen to have picked
    expect(onAnswer).not.toHaveBeenCalled();
  });
});

describe('a Bonus Catchphrase', () => {
  test('shows its options from the first frame and takes an answer', () => {
    // #given the fifth question, 0.5s in, with every square still down
    const onAnswer = vi.fn();
    const { container } = render(screen(at(500), { index: 4, onAnswer }));

    // #then the lecterns are lit with their options — Greg, 6 October 2026:
    // guess as the squares come off, not after half of them already have
    for (const option of PUZZLE.options) expect(container.textContent).toContain(option);
    expect(tiles(container).every((tile) => !tile.disabled)).toBe(true);

    // #and the nudge says why, without promising options that are already here
    expect(container.textContent).toMatch(/guess as the squares come off/i);
    expect(container.textContent).not.toMatch(/options arrive at halfway/i);

    // #when somebody guesses from the first square
    fireEvent.keyDown(window, { key: 'c' });

    // #then it is written
    expect(onAnswer).toHaveBeenLastCalledWith(2, undefined);
  });
});

describe('a Catchphrase picture from halfway', () => {
  test('lights the lecterns with their options at 5s on a 10s clock', () => {
    const { container, rerender } = render(screen(at(4_999)));
    expect(container.textContent).not.toContain('Option one');

    rerender(screen(at(5_000)));
    for (const option of PUZZLE.options) expect(container.textContent).toContain(option);
    expect(tiles(container).some((tile) => tile.disabled)).toBe(false);
    expect(container.textContent).not.toMatch(/options arrive at halfway/i);
  });

  test('answers from a key and from a tap', () => {
    const onAnswer = vi.fn();
    const { container } = render(screen(at(5_500), { onAnswer }));

    fireEvent.keyDown(window, { key: 'b' });
    expect(onAnswer).toHaveBeenLastCalledWith(1, undefined);

    const third = tiles(container)[2];
    if (third) fireEvent.click(third);
    expect(onAnswer).toHaveBeenLastCalledWith(2, undefined);
  });

  test('shows them at the reveal', () => {
    const { container } = render(screen(at(10_000), { revealed: true }));
    for (const option of PUZZLE.options) expect(container.textContent).toContain(option);
  });
});

describe('the hold is Catchphrase’s alone', () => {
  test('another picture pack shows its options from the first frame', () => {
    const onAnswer = vi.fn();
    const { container } = render(screen(at(500), { packId: 'screens', onAnswer }));
    for (const option of PUZZLE.options) expect(container.textContent).toContain(option);
    fireEvent.keyDown(window, { key: 'a' });
    expect(onAnswer).toHaveBeenCalledWith(0, undefined);
  });

  test('somebody who walked in mid-question gets the options at once', () => {
    // Their clock counts from when they arrived, not from when the room's did,
    // so a hold on it could run past the room's reveal. They are ranked as
    // though they answered on the buzzer anyway, so seeing the options early
    // buys them nothing.
    const { container } = render(screen(at(500), { joinedMidQuestion: true }));
    for (const option of PUZZLE.options) expect(container.textContent).toContain(option);
  });
});
