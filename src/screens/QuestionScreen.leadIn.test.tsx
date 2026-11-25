import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRoom, type QuizQuestion, type RoomState } from '../engine/state';
import type * as SoundModule from '../lib/sound';
import type { QuestionClock } from '../lib/useQuestionClock';
import type { PackId } from '../questions/types';
import { QuestionScreen } from './QuestionScreen';

/**
 * A question arrives before its answers do (PROJ-179).
 *
 * Two seconds on the room's shared clock, added to the window rather than taken
 * out of it. Until they are up nothing can be answered by any route — a tap, a
 * key, or a tune's replay — and the ring stands still.
 * See docs/decisions/question-lead-in.md.
 */

const sound = vi.hoisted(() => ({
  play: vi.fn(),
  playPreview: vi.fn(),
  playSequence: vi.fn(),
  primePreview: vi.fn(),
  startClock: vi.fn(),
}));

vi.mock('../lib/sound', async (importOriginal) => {
  const actual = await importOriginal<typeof SoundModule>();
  return {
    ...actual,
    playPreview: sound.playPreview,
    playSequence: sound.playSequence,
    primePreview: sound.primePreview,
    startClock: sound.startClock,
    useCue: (cue: string, key: string | number, enabled = true) => {
      if (enabled) sound.play(cue, key);
    },
  };
});

beforeEach(() => {
  for (const fn of Object.values(sound)) fn.mockClear();
});
afterEach(cleanup);

const noop = () => {};

const QUESTION: QuizQuestion = {
  id: 'q1',
  prompt: 'Which river runs through Rossendale?',
  options: ['Irwell', 'Ribble', 'Mersey', 'Lune'],
  correctIndex: null,
  category: 'Geography',
  difficulty: 'easy',
};

const TUNE: QuizQuestion = { ...QUESTION, previewUrl: 'https://audio-ssl.itunes.apple.com/x.m4a' };
const MELODY: QuizQuestion = {
  ...QUESTION,
  voices: [{ type: 'sine', from: 440, start: 0, duration: 0.2, gain: 0.1 }],
};
const PUZZLE: QuizQuestion = { ...QUESTION, image: `${'a'.repeat(64)}.jpg`, imageWidth: 1024, imageHeight: 768 };

/** Ten seconds of answering after a two-second lead-in, unless told otherwise. */
function roomWith(over: Partial<RoomState> = {}, question: QuizQuestion = QUESTION): RoomState {
  return {
    ...createRoom('HKQ7'),
    phase: 'question',
    packId: 'geography' as PackId,
    packTitle: 'Geography',
    durationSecs: 12,
    leadInSecs: 2,
    gameId: 'g1',
    players: { greg: { name: 'Greg', joinedAt: 100 } },
    questions: [question],
    ...over,
  };
}

function at(elapsedMs: number, windowMs = 12_000): QuestionClock {
  const remainingMs = Math.max(0, windowMs - elapsedMs);
  return { elapsedMs, remainingMs, secondsLeft: Math.ceil(remainingMs / 1000), expired: remainingMs === 0 };
}

function screen(clock: QuestionClock, room: RoomState = roomWith(), over: Record<string, unknown> = {}) {
  return (
    <QuestionScreen
      room={room}
      youUid="greg"
      isQuizmaster={false}
      clock={clock}
      revealed={false}
      onAnswer={noop}
      onReveal={noop}
      onNext={noop}
      onVote={noop}
      {...over}
    />
  );
}

const tiles = (container: HTMLElement): HTMLButtonElement[] => [
  ...container.querySelectorAll<HTMLButtonElement>('button.tile'),
];
const ring = (container: HTMLElement): string | null =>
  container.querySelector('.timer__sweep')?.getAttribute('stroke-dashoffset') ?? null;

describe('during the lead-in', () => {
  test('the question is up and the answers are not (AC1)', () => {
    const { container } = render(screen(at(1_900)));
    expect(container.textContent).toContain(QUESTION.prompt);
    expect(tiles(container)).toHaveLength(4);
    expect(tiles(container).every((tile) => tile.disabled && tile.classList.contains('tile--veiled'))).toBe(true);
    // The desk does not ask for what is not there yet.
    expect(container.textContent).toContain('Answers coming up');
    expect(container.textContent).not.toContain('Pick an answer');
  });

  test('a lectern takes the room it will need, so nothing moves when it lands', () => {
    const inner = (container: HTMLElement): string[] => tiles(container).map((tile) => tile.innerHTML);
    const { container, rerender } = render(screen(at(1_900)));
    const before = inner(container);
    rerender(screen(at(2_000)));
    expect(inner(container)).toEqual(before);
  });

  test('neither a tap nor a key picks a lectern (AC1)', () => {
    const onAnswer = vi.fn();
    const { container, rerender } = render(screen(at(500), roomWith(), { onAnswer }));
    fireEvent.click(tiles(container)[0] as HTMLButtonElement);
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'Enter' });

    // Nothing was held back for later either: the answers land unpicked.
    rerender(screen(at(2_100), roomWith(), { onAnswer }));
    expect(container.querySelector('.tile--held')).toBeNull();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  test('the ring and the seconds show the answering time and stand still (AC2)', () => {
    const { container, rerender } = render(screen(at(0)));
    expect(container.querySelector('.timer__count')?.textContent).toBe('10');
    expect(ring(container)).toBe('0');
    rerender(screen(at(1_900)));
    expect(container.querySelector('.timer__count')?.textContent).toBe('10');
    expect(ring(container)).toBe('0');
  });

  test('a tune waits for the answers, and is fetched while it does', () => {
    const room = roomWith({ packId: 'tunes' as PackId }, TUNE);
    const { container, rerender } = render(screen(at(1_000), room));
    expect(sound.playPreview).not.toHaveBeenCalled();
    expect(sound.primePreview).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'r' });
    expect(sound.playPreview).not.toHaveBeenCalled();
    expect(container.textContent).not.toMatch(/at halfway/i);

    rerender(screen(at(2_000), room));
    expect(sound.playPreview).toHaveBeenCalledTimes(1);
  });

  test('a synth melody waits for the answers too', () => {
    const room = roomWith({ packId: 'melody' as PackId }, MELODY);
    const { rerender } = render(screen(at(1_000), room));
    // Nor by the replay key, which a melody has from its first note.
    fireEvent.keyDown(window, { key: 'r' });
    expect(sound.playSequence).not.toHaveBeenCalled();
    rerender(screen(at(2_000), room));
    expect(sound.playSequence).toHaveBeenCalledTimes(1);
  });

  test('the clock bed does not start, even in a window shorter than its lead', () => {
    const room = roomWith({ durationSecs: 7 });
    const { rerender } = render(screen(at(1_000, 7_000), room));
    expect(sound.startClock).not.toHaveBeenCalled();
    rerender(screen(at(2_100, 7_000), room));
    expect(sound.startClock).toHaveBeenCalledWith(4_900);
  });

  test('plays one short cue as the question arrives (AC9)', () => {
    render(screen(at(0)));
    expect(sound.play.mock.calls.filter(([cue]) => cue === 'arrive')).toEqual([['arrive', 'g1:0']]);
  });
});

describe('once the answers have landed', () => {
  test('they light on every lectern and a tap picks one', () => {
    const { container } = render(screen(at(2_000)));
    expect(container.textContent).toContain('Pick an answer');
    expect(tiles(container).every((tile) => !tile.disabled && !tile.classList.contains('tile--veiled'))).toBe(true);
    fireEvent.click(tiles(container)[1] as HTMLButtonElement);
    expect(container.querySelectorAll('.tile--held')).toHaveLength(1);
  });

  test('the ring drains over the answering time alone', () => {
    const { container } = render(screen(at(7_000)));
    expect(container.querySelector('.timer__count')?.textContent).toBe('5');
    expect(Number(ring(container))).toBeCloseTo((2 * Math.PI * 44) / 2, 5);
  });

  test('they come in one after another, the first at once', () => {
    const { container } = render(screen(at(2_000)));
    expect(tiles(container).map((tile) => tile.style.animationDelay)).toEqual(['0ms', '90ms', '180ms', '270ms']);
  });
});

describe('who does not get one', () => {
  test('a player who walked in mid-question (AC5)', () => {
    const { container } = render(screen(at(300), roomWith(), { joinedMidQuestion: true }));
    expect(tiles(container).every((tile) => !tile.disabled)).toBe(true);
    expect(sound.play.mock.calls.some(([cue]) => cue === 'arrive')).toBe(false);
  });

  test('a room an old tab opened, which carries no lead-in', () => {
    const { container } = render(screen(at(0, 10_000), roomWith({ durationSecs: 10, leadInSecs: 0 })));
    expect(tiles(container).every((tile) => !tile.disabled)).toBe(true);
    expect(tiles(container)[0]?.style.animationDelay).toBe('300ms');
    expect(sound.play.mock.calls.some(([cue]) => cue === 'arrive')).toBe(false);
  });

  test('the reveal, however early it lands', () => {
    const room = roomWith({ phase: 'reveal', questions: [{ ...QUESTION, correctIndex: 0 }] });
    const { container } = render(screen(at(0), room, { revealed: true }));
    expect(container.querySelector('.tile--veiled')).toBeNull();
  });
});

describe('a Catchphrase inside a Random Round', () => {
  const room = (): RoomState => roomWith({ packId: 'random' as PackId }, { ...PUZZLE, sourcePack: 'catchphrase' } as QuizQuestion);

  test('keeps its dark lecterns, and its call box waits for the lead-in', () => {
    const { container, getByLabelText, rerender } = render(screen(at(1_000), room()));
    expect(container.querySelector('.tile--veiled')).toBeNull();
    expect(container.textContent).not.toContain('Irwell');
    expect((getByLabelText('Call it') as HTMLInputElement).disabled).toBe(true);

    rerender(screen(at(2_000), room()));
    expect((getByLabelText('Call it') as HTMLInputElement).disabled).toBe(false);
  });

  test('lights its options at half the answering time', () => {
    const { container, rerender } = render(screen(at(6_900), room()));
    expect(container.textContent).not.toContain('Irwell');
    rerender(screen(at(7_000), room()));
    expect(container.textContent).toContain('Irwell');
  });
});

describe('a Bonus Catchphrase inside a Random Round', () => {
  test('lifts its first square a tenth of the answering time after the answers land', () => {
    // The fifth question, on ten seconds of answering: a square every second.
    const bonus = { ...PUZZLE, sourcePack: 'catchphrase' } as QuizQuestion;
    const room = roomWith({
      packId: 'random' as PackId,
      index: 4,
      questions: Array.from({ length: 5 }, (_, i) => ({ ...bonus, id: `q${i + 1}` })),
    });
    const lifted = (container: HTMLElement): number => container.querySelectorAll('.bonus-squares__square--lifted').length;

    const { container, rerender } = render(screen(at(2_900), room));
    const covered = container.querySelectorAll('.bonus-squares__square').length;
    expect(covered).toBe(9);
    expect(lifted(container)).toBe(0);
    rerender(screen(at(3_000), room));
    expect(lifted(container)).toBe(1);
  });
});

describe('the reveal shows answering times (AC8)', () => {
  test('a tap 1.4s after the answers landed reads 1.4s, and a full-window stamp reads not locked', () => {
    const picks = {
      greg: { optionIndex: 0, elapsedMs: 3_400 },
      ann: { optionIndex: 1, elapsedMs: 12_000 },
    };
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: noop, removeEventListener: noop }));
    const { container } = render(
      screen(
        at(12_000),
        roomWith({
          phase: 'reveal',
          players: { greg: { name: 'Greg', joinedAt: 1 }, ann: { name: 'Ann', joinedAt: 2 } },
          questions: [{ ...QUESTION, correctIndex: 0 }],
          answers: picks,
          lastPicks: picks,
          lastDeltas: { greg: 1000, ann: 0 },
        }),
        { revealed: true },
      ),
    );
    vi.unstubAllGlobals();
    expect(container.textContent).toContain('1.4s');
    expect(container.textContent).not.toContain('3.4s');
    expect(container.textContent).toContain('not locked');
  });
});
