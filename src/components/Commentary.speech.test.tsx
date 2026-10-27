import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRoom, type QuizQuestion, type RoomState } from '../engine/state';
import { createStuckQueue, resetSpokenLines } from '../lib/commentarySpeech';
import type * as Sound from '../lib/sound';
import { setMuted } from '../lib/sound';
import type { FinalSnapshot } from '../lib/useFinalSnapshot';
import { Commentary } from './Commentary';
import { Final } from '../screens/Final';
import { Scoreboard } from '../screens/Scoreboard';

/**
 * Room 5SVU, 22 October 2026 (PROJ-59): the standings line "…is running away
 * with it" played, then the same audio again during the podium.
 *
 * The podium's own caption is a different sentence. The repeat is the speech
 * queue still holding the standings line, paused, when the winner lands and
 * the host speaks the next one — and a remount, which used to submit the
 * same line again because the guard was a ref on the component.
 */

vi.mock('../lib/sound', async (original) => ({
  ...(await original<typeof Sound>()),
  useCue: vi.fn(),
  play: vi.fn(),
}));

const RUNAWAY = 'Ann is running away with it.';

const QUESTION: QuizQuestion = {
  id: 'q',
  prompt: 'p',
  options: ['a', 'b', 'c', 'd'],
  correctIndex: 0,
  category: 'c',
  difficulty: 'easy',
};

const ANN = { name: 'Ann', joinedAt: 1 };
const BOB = { name: 'Bob', joinedAt: 2 };

function standings(): RoomState {
  return {
    ...createRoom('5SVU'),
    phase: 'scoreboard',
    gameId: '5SVU-round',
    index: 4,
    questions: [QUESTION, QUESTION, QUESTION, QUESTION, QUESTION],
    players: { ann: ANN, bob: BOB },
    scores: { ann: 4_000, bob: 1_000 },
    history: { ann: { played: 4, wins: 0, best: 3_000 } },
  };
}

function finished(room: RoomState): RoomState {
  return { ...room, phase: 'finished', lastDeltas: {}, lastPicks: {} };
}

class Utterance {
  lang = '';
  volume = 1;
  voice: { lang: string } | null = null;
  onend: (() => void) | null = null;
  constructor(public text: string) {}
}

function install(queue: ReturnType<typeof createStuckQueue>): void {
  window.SpeechSynthesisUtterance = Utterance as unknown as typeof SpeechSynthesisUtterance;
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    writable: true,
    value: queue.synth,
  });
}

function speechOn(on: boolean): void {
  (window as unknown as { __commentarySpeech?: boolean }).__commentarySpeech = on;
}

/** Past the build, the way Final.test walks it: one beat at a time. */
function land(): void {
  for (let ms = 0; ms < 5_000; ms += 100) {
    act(() => {
      vi.advanceTimersByTime(100);
    });
  }
}

let queue = createStuckQueue();

beforeEach(() => {
  queue = createStuckQueue();
  install(queue);
  setMuted(false);
  resetSpokenLines();
  speechOn(true);
  vi.useFakeTimers();
});

afterEach(() => {
  speechOn(false);
  resetSpokenLines();
  vi.useRealTimers();
  cleanup();
});

describe('the standings line across the podium', () => {
  test('plays once when the winner lands, not again from the paused queue', () => {
    const room = standings();
    const board = render(
      <Scoreboard room={room} youUid="bob" isQuizmaster onNext={() => {}} />,
    );
    expect(queue.heard).toEqual([RUNAWAY]);
    // The line has finished, and Chrome has left it paused in the queue.
    queue.finish();
    board.unmount();

    const done = finished(room);
    const snapshot: FinalSnapshot = {
      gameId: done.gameId ?? '',
      players: done.players,
      scores: done.scores,
    };
    render(
      <Final
        room={done}
        snapshot={snapshot}
        banked={null}
        youPlayerId="bob"
        youUid="bob"
        isQuizmaster
        log={[]}
        onPlayAgain={() => {}}
        onLeave={() => {}}
        onSeason={() => {}}
      />,
    );
    land();

    expect(queue.heard.filter((line) => line.includes('running away'))).toEqual([RUNAWAY]);
    expect(queue.heard.some((line) => line.includes('first win'))).toBe(true);
  });

  test('re-rendering the standings does not say it again', () => {
    const room = standings();
    const view = render(<Commentary room={room} moment="scoreboard" speakHere />);
    expect(queue.heard).toEqual([RUNAWAY]);
    view.rerender(<Commentary room={{ ...room }} moment="scoreboard" speakHere />);
    expect(queue.heard).toEqual([RUNAWAY]);
  });

  test('changing moment says the podium line, not the standings line again', () => {
    const room = standings();
    const view = render(<Commentary room={room} moment="scoreboard" speakHere />);
    expect(queue.heard).toEqual([RUNAWAY]);
    queue.finish();
    view.rerender(<Commentary room={finished(room)} moment="podium" speakHere />);
    expect(queue.heard.filter((line) => line.includes('running away'))).toEqual([RUNAWAY]);
    expect(queue.heard.some((line) => line.includes('first win'))).toBe(true);
  });

  test('a remount does not say it again', () => {
    const room = standings();
    const first = render(<Commentary room={room} moment="scoreboard" speakHere />);
    expect(queue.heard).toEqual([RUNAWAY]);
    queue.finish();
    first.unmount();
    render(<Commentary room={room} moment="scoreboard" speakHere />);
    expect(queue.heard).toEqual([RUNAWAY]);
  });

  test('says nothing when speech is off, including on the host', () => {
    speechOn(false);
    render(
      <Scoreboard room={standings()} youUid="bob" isQuizmaster onNext={() => {}} />,
    );
    expect(queue.heard).toEqual([]);
  });

  test('a member’s device stays quiet when speech is on', () => {
    render(<Commentary room={standings()} moment="scoreboard" speakHere={false} />);
    expect(queue.heard).toEqual([]);
  });
});
