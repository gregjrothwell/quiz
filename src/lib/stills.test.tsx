import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { stillSrc, useStillPreload, type StillSource } from './stills';

/**
 * The preload, which is the half of the fix that matters on a slow connection.
 *
 * Reserving a box stops a late picture looking like a missing one. It does not
 * make it arrive. Before this, the first request for a still went out when the
 * question rendered — the same frame the countdown starts in — so the download
 * and the answer window were racing. Every device holds all fifteen questions
 * from the moment the round is built, and the lobby then sits open while people
 * join, so that window was there to be used and nothing was using it.
 */

interface FakeImage {
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
}

let requested: FakeImage[] = [];

beforeEach(() => {
  requested = [];
  vi.stubGlobal(
    'Image',
    class {
      _src = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        this._src = value;
        requested.push(this as unknown as FakeImage);
      }
      get src(): string {
        return this._src;
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

function Harness({ questions }: { questions: readonly StillSource[] | undefined }) {
  useStillPreload(questions);
  return null;
}

/** Let the n-th request through, so the queue moves on. */
function settle(index: number): void {
  act(() => {
    requested[index]?.onload?.();
  });
}

describe('stillSrc', () => {
  test('prefers Apple artwork, which is never hashed onto Pages', () => {
    const url = 'https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg';
    expect(stillSrc(undefined, url)).toBe(url);
  });

  test('refuses artwork from anywhere but Apple', () => {
    // #given a pack claiming artwork on some other host — the shape a poisoned
    // pack would take to make every device fetch an arbitrary URL
    // #when asked for the source
    // #then nothing, and the hashed still is used if there is one
    expect(stillSrc(undefined, 'https://example.invalid/cover.jpg')).toBeNull();
    expect(stillSrc('abc.jpg', 'https://example.invalid/cover.jpg')).toContain('abc.jpg');
  });

  test('a question with neither has no still', () => {
    expect(stillSrc(undefined, undefined)).toBeNull();
  });
});

describe('useStillPreload', () => {
  test('starts pulling the round’s stills without waiting for a question', () => {
    // #given a round of picture questions, as the lobby holds them
    const questions: StillSource[] = [
      { image: 'one.jpg' },
      { image: 'two.jpg' },
      { image: 'three.jpg' },
      { image: 'four.jpg' },
    ];

    // #when the room is on screen — the lobby, not the question
    render(<Harness questions={questions} />);

    // #then downloads are already in flight, before anybody has seen question
    // one. This is the fix: by the time a still is shown it is a cache hit.
    expect(requested.map((image) => image.src.split('/').pop())).toEqual([
      'one.jpg',
      'two.jpg',
      'three.jpg',
    ]);
  });

  test('keeps to three at a time, in the order the questions are asked', () => {
    // #given more stills than the concurrency limit
    const questions: StillSource[] = Array.from({ length: 6 }, (_, i) => ({
      image: `${i}.jpg`,
    }));
    render(<Harness questions={questions} />);
    expect(requested).toHaveLength(3);

    // #when the first one lands
    settle(0);

    // #then the fourth starts, and not the sixth. A slow link is exactly the
    // case this exists for, and firing all fifteen at once would put question
    // fifteen's still in contention with question one's.
    expect(requested).toHaveLength(4);
    expect(requested[3]?.src).toContain('3.jpg');
  });

  test('one still that 404s does not stall the ones behind it', () => {
    // #given a round where an image is missing
    const questions: StillSource[] = Array.from({ length: 5 }, (_, i) => ({
      image: `${i}.jpg`,
    }));
    render(<Harness questions={questions} />);

    // #when it fails rather than loads
    act(() => {
      requested[0]?.onerror?.();
    });

    // #then the queue moved on regardless — the question that 404s is not the
    // question the player is about to be shown
    expect(requested).toHaveLength(4);
  });

  test('asks for each still once however many questions share it', () => {
    // #given a round where a still is repeated
    const questions: StillSource[] = [
      { image: 'same.jpg' },
      { image: 'same.jpg' },
      { image: 'other.jpg' },
    ];
    render(<Harness questions={questions} />);

    // #then two requests, not three
    expect(requested).toHaveLength(2);
  });

  test('does not restart every time the room snapshot changes', () => {
    // #given a round already preloading
    const questions: StillSource[] = [{ image: 'one.jpg' }, { image: 'two.jpg' }];
    const { rerender } = render(<Harness questions={questions} />);
    const first = requested.length;

    // #when a new snapshot arrives carrying the same questions in a new array —
    // which is every presence write, several times a second on a busy lobby
    rerender(<Harness questions={questions.map((question) => ({ ...question }))} />);

    // #then nothing was asked for again
    expect(requested).toHaveLength(first);
  });

  test('a text round asks for nothing', () => {
    // #given fifteen questions with no pictures
    render(<Harness questions={Array.from({ length: 15 }, () => ({}))} />);

    // #then eleven of the sixteen packs cost this nothing at all
    expect(requested).toHaveLength(0);
  });

  test('no room yet is not an error', () => {
    render(<Harness questions={undefined} />);
    expect(requested).toHaveLength(0);
  });
});
