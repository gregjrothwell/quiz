import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createRoom, type Answer, type RoomState } from '../engine/state';
import { QuestionScreen } from './QuestionScreen';

/**
 * The reveal, where the clock was (PROJ-178).
 *
 * The clock used to leave the header at the reveal and take its cell with it,
 * so everything under the header jumped up 58px in one frame (measured at
 * 1366×768). The cell now stays and holds your verdict: the points large, the
 * word under.
 *
 * jsdom does no layout, so nothing here can see a jump. The heights were
 * measured in a real browser and are in docs/decisions/question-screen.md.
 * What this pins is what the stylesheet holds the height with: one cell, there
 * before the reveal and after it.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const noop = () => {};

const OPEN = { elapsedMs: 4_000, remainingMs: 6_000, secondsLeft: 6, expired: false };
const SHUT = { elapsedMs: 10_000, remainingMs: 0, secondsLeft: 0, expired: true };

function room(overrides: Partial<RoomState> = {}): RoomState {
  return {
    ...createRoom('RV78'),
    phase: 'reveal',
    packId: 'general-knowledge',
    packTitle: 'General Knowledge',
    durationSecs: 10,
    players: {
      sam: { name: 'Sam', joinedAt: 1 },
      priya: { name: 'Priya', joinedAt: 2 },
    },
    questions: [
      {
        id: 'q1',
        prompt: 'Which one is it?',
        options: ['The right one', 'The wrong one', 'Another', 'The last'],
        correctIndex: 0,
        category: 'General Knowledge',
        difficulty: 'easy',
      },
    ],
    ...overrides,
  };
}

/** Sam's answer, already scored: the reveal as the room holds it. */
function scored(sam: Answer, delta: number): Partial<RoomState> {
  return { answers: { sam }, lastPicks: { sam }, lastDeltas: { sam: delta } };
}

/** Reduced motion settles the reveal on the first render, with no timers to run. */
function reducedMotion(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('reduce'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

function show(state: RoomState, revealed: boolean) {
  return render(
    <QuestionScreen
      room={state}
      youUid="sam"
      isQuizmaster={false}
      clock={revealed ? SHUT : OPEN}
      revealed={revealed}
      onAnswer={noop}
      onReveal={noop}
      onNext={noop}
      onVote={noop}
    />,
  );
}

describe('the clock’s cell in the header', () => {
  test('holds the clock while the question is open', () => {
    // #given a question still running
    // #when it is on screen
    const { container } = show(room({ phase: 'question' }), false);

    // #then the clock sits inside the cell, and there is no verdict yet
    expect(container.querySelector('.qhead__clock .timer')).not.toBeNull();
    expect(container.querySelector('.qhead__verdict')).toBeNull();
  });

  test('is still there at the reveal, with the verdict in it', () => {
    // #given the same question, revealed
    reducedMotion();
    const { container } = show(room(scored({ optionIndex: 0, elapsedMs: 2_300 }, 1_000)), true);

    // #then the cell has not left with the clock: that was the 58px jump
    expect(container.querySelector('.qhead .qhead__clock')).not.toBeNull();
    expect(container.querySelector('.timer')).toBeNull();
    expect(container.querySelector('.qhead__clock .qhead__verdict')).not.toBeNull();
  });

  test('keeps the cell for somebody who walked in mid-question', () => {
    // #given a player with no clock of their own to show
    const { container } = render(
      <QuestionScreen
        room={room({ phase: 'question' })}
        youUid="sam"
        isQuizmaster={false}
        clock={OPEN}
        joinedMidQuestion
        revealed={false}
        onAnswer={noop}
        onReveal={noop}
        onNext={noop}
        onVote={noop}
      />,
    );

    // #then what they are told sits in the same cell
    expect(container.querySelector('.qhead__clock')).toHaveTextContent('You joined mid-question');
  });
});

describe('the verdict where the clock was', () => {
  test('a right answer shows its points, and says Correct', () => {
    // #given Sam got it right for 1,000
    reducedMotion();
    const { container } = show(room(scored({ optionIndex: 0, elapsedMs: 2_300 }, 1_000)), true);

    // #then the points and the word are both in the stamp, and it has landed
    const stamp = container.querySelector('.qhead__verdict');
    expect(stamp).toHaveClass('qhead__verdict--in');
    expect(stamp).toHaveAttribute('data-tone', 'correct');
    expect(stamp?.querySelector('.qhead__points')).toHaveTextContent('+1,000');
    expect(stamp?.querySelector('.qhead__word')).toHaveTextContent('Correct');
  });

  test('a wrong answer says so, with no number to read', () => {
    // #given Sam picked the wrong one, for nothing
    reducedMotion();
    const { container } = show(room(scored({ optionIndex: 1, elapsedMs: 2_300 }, 0)), true);

    // #then the word is there and a "+0" is not
    const stamp = container.querySelector('.qhead__verdict');
    expect(stamp).toHaveAttribute('data-tone', 'wrong');
    expect(stamp?.querySelector('.qhead__word')).toHaveTextContent('Not this time');
    expect(stamp?.querySelector('.qhead__points')).toBeNull();
  });

  test('a lost stake shows what it cost', () => {
    // #given Sam staked 500 on the wrong one
    reducedMotion();
    const { container } = show(room(scored({ optionIndex: 1, elapsedMs: 2_300, wager: 500 }, -500)), true);

    // #then the largest swing in the game is the number in the stamp
    expect(container.querySelector('.qhead__points')).toHaveTextContent('−500');
    expect(container.querySelector('.qhead__word')).toHaveTextContent('Not this time');
  });

  test('nobody answering says that', () => {
    // #given Sam sat this one out
    reducedMotion();
    const { container } = show(room(), true);

    // #then
    const stamp = container.querySelector('.qhead__verdict');
    expect(stamp).toHaveAttribute('data-tone', 'silent');
    expect(stamp?.querySelector('.qhead__word')).toHaveTextContent('You didn’t answer');
  });

  test('an answer the room never scored is amber, not wrong', () => {
    // #given Sam holds an answer the reveal has no entry for
    reducedMotion();
    const sam = { optionIndex: 0, elapsedMs: 2_300 };
    const { container } = show(room({ answers: { sam }, lastDeltas: { priya: 0 } }), true);

    // #then it is not called wrong, and it claims no points
    const stamp = container.querySelector('.qhead__verdict');
    expect(stamp).toHaveAttribute('data-tone', 'lost');
    expect(stamp?.querySelector('.qhead__word')).toHaveTextContent('Didn’t arrive');
    expect(stamp?.querySelector('.qhead__points')).toBeNull();
  });

  test('waits for the replay before it lands', () => {
    // #given ordinary motion, and a room whose answers are about to be replayed
    const { container } = show(room(scored({ optionIndex: 0, elapsedMs: 2_300 }, 1_000)), true);

    // #then the cell is held but the verdict has not landed in it yet
    const stamp = container.querySelector('.qhead__clock .qhead__verdict');
    expect(stamp).not.toBeNull();
    expect(stamp).not.toHaveClass('qhead__verdict--in');
  });

  test('is for the eye: the desk line is the one a screen reader gets', () => {
    // #given a settled right answer
    reducedMotion();
    const { container } = show(room(scored({ optionIndex: 0, elapsedMs: 2_300 }, 1_000)), true);

    // #then the stamp is hidden from it, and the desk still says the verdict once
    expect(container.querySelector('.qhead__verdict')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.tally .verdict')).toHaveTextContent('Correct');
  });
});

describe('the points on a right answer', () => {
  test('are never drawn over the answer', () => {
    // #given a settled right answer, which used to pop "+1,000" across its own text
    reducedMotion();
    const { container } = show(room(scored({ optionIndex: 0, elapsedMs: 2_300 }, 1_000)), true);

    // #then nothing is laid over a lectern, and the right one is still readable
    expect(container.querySelector('.tile__pop')).toBeNull();
    expect(container.querySelector('.tile--correct .tile__text')).toHaveTextContent('The right one');
  });
});
