import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { createRoom, type QuizQuestion, type RoomState } from '../engine/state';
import type { PackId } from '../questions/types';
import type { QuestionClock } from '../lib/useQuestionClock';
import { QuestionScreen } from './QuestionScreen';

/**
 * Bonus Catchphrase: every fifth question, the picture opens under a 3×3 of
 * squares that lift one every tenth of the clock. Story approved by Greg,
 * 5 October 2026 — docs/decisions/catchphrase-difficulty.md.
 */

afterEach(cleanup);

const noop = () => {};

const PUZZLES: QuizQuestion[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `cp-${n}`,
  prompt: 'Say what you see',
  options: ['Option one', 'Option two', 'Option three', 'Option four'],
  correctIndex: null,
  category: 'Catchphrase',
  difficulty: 'easy',
  image: String(n).repeat(64) + '.jpg',
  imageWidth: 1024,
  imageHeight: 768,
}));

/** A 15 s room, so a square lifts every 1.5 s and the options land at 7.5 s. */
function roomAt(index: number, packId: PackId): RoomState {
  return {
    ...createRoom('HKQ7'),
    phase: 'question',
    packId,
    packTitle: 'Catchphrase',
    durationSecs: 15,
    gameId: 'game-1',
    players: { greg: { name: 'Greg', joinedAt: 100 } },
    questions: PUZZLES,
    index,
  };
}

function at(elapsedMs: number): QuestionClock {
  const remainingMs = Math.max(0, 15_000 - elapsedMs);
  return {
    elapsedMs,
    remainingMs,
    secondsLeft: Math.ceil(remainingMs / 1000),
    expired: remainingMs === 0,
  };
}

function screen(
  clock: QuestionClock,
  options: { index?: number; packId?: PackId; revealed?: boolean; joinedMidQuestion?: boolean } = {},
) {
  return (
    <QuestionScreen
      room={roomAt(options.index ?? 4, options.packId ?? 'catchphrase')}
      youUid="greg"
      isQuizmaster={false}
      clock={clock}
      revealed={options.revealed ?? false}
      joinedMidQuestion={options.joinedMidQuestion ?? false}
      onAnswer={noop}
      onReveal={noop}
      onNext={noop}
      onVote={noop}
    />
  );
}

const squares = (container: HTMLElement): Element[] => [
  ...container.querySelectorAll('.bonus-squares__square'),
];
const covering = (container: HTMLElement): number =>
  squares(container).filter((square) => !square.classList.contains('bonus-squares__square--lifted'))
    .length;
const prompt = (container: HTMLElement): string =>
  container.querySelector('h1.prompt')?.textContent ?? '';

describe('the fifth question of a Catchphrase round', () => {
  test('reads Bonus Catchphrase in place of Say what you see', () => {
    const { container } = render(screen(at(0)));
    expect(prompt(container)).toBe('Bonus Catchphrase');
  });

  test('opens with the whole picture under nine squares', () => {
    const { container } = render(screen(at(0)));
    expect(squares(container)).toHaveLength(9);
    expect(covering(container)).toBe(9);
    // The picture is there in full, at its own shape, under the squares —
    // not cropped square like the jigsaw.
    const img = container.querySelector('img.still__img');
    expect(img?.getAttribute('width')).toBe('1024');
    expect(img?.getAttribute('height')).toBe('768');
    expect(container.querySelector('.still--square')).toBeNull();
  });

  test('lifts a square every tenth of the clock — counted at three moments', () => {
    const { container, rerender } = render(screen(at(1_500)));
    expect(covering(container)).toBe(8);

    // The options land at half the clock, and by then five have lifted.
    rerender(screen(at(7_500)));
    expect(covering(container)).toBe(4);
    expect(container.textContent).toContain('Option one');

    // Whole for the last tenth.
    rerender(screen(at(13_500)));
    expect(covering(container)).toBe(0);
  });

  test('lifts the same squares on every screen', () => {
    const lifted = (container: HTMLElement): number[] =>
      squares(container).flatMap((square, cell) =>
        square.classList.contains('bonus-squares__square--lifted') ? [cell] : [],
      );
    const first = render(screen(at(4_500)));
    const one = lifted(first.container);
    first.unmount();
    const second = render(screen(at(4_500)));
    expect(lifted(second.container)).toEqual(one);
    expect(one).toHaveLength(3);
  });

  test('has every square gone at the reveal', () => {
    const { container } = render(screen(at(9_000), { revealed: true }));
    expect(squares(container)).toHaveLength(9);
    expect(covering(container)).toBe(0);
    expect(prompt(container)).toBe('Bonus Catchphrase');
  });

  test('says it is worth double while the picture plays alone', () => {
    const { container } = render(screen(at(1_000)));
    expect(container.textContent).toMatch(/double points/i);
  });

  test('a late joiner sees the options at once and counts squares from their own arrival', () => {
    // Their clock reads from when they walked in, as the jigsaw's tiles do.
    const { container } = render(screen(at(0), { joinedMidQuestion: true }));
    expect(container.textContent).toContain('Option one');
    expect(covering(container)).toBe(9);
  });
});

describe('every other question', () => {
  test('the first four of a Catchphrase round are as they were', () => {
    for (const index of [0, 1, 2, 3]) {
      const { container, unmount } = render(screen(at(0), { index }));
      expect(prompt(container)).toBe('Say what you see');
      expect(squares(container)).toHaveLength(0);
      unmount();
    }
  });

  test('the fifth of another picture pack has no squares', () => {
    const { container } = render(screen(at(0), { packId: 'screens' }));
    expect(prompt(container)).toBe('Say what you see');
    expect(squares(container)).toHaveLength(0);
  });
});
