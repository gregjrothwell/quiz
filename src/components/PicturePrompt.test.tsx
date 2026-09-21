import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { PicturePrompt, frameRatio } from './PicturePrompt';

/**
 * The picture round's box, and what it says while the picture is late.
 *
 * Written from Bret's report of 18 September 2026: the stills "weren't
 * loading". They were — the files are 29–134KB and serve 200 from Pages — but
 * an `<img>` at `width:100%; height:auto` with no intrinsic size resolves to
 * **zero height**, and `alt=""` leaves nothing in the gap. There was no box for
 * the picture to arrive into and nothing to say one was coming.
 *
 * jsdom does no layout, so nothing here can measure a height. What it can pin
 * is the mechanism the browser needs — the width and height attributes, or an
 * explicit ratio where there is no `<img>` to carry them. The height itself was
 * measured in a real browser; see `docs/decisions/picture-loading.md`.
 */

interface FakeImage {
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
}

let probes: FakeImage[] = [];

beforeEach(() => {
  probes = [];
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        probes.push(this as unknown as FakeImage);
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  cleanup();
});

const BASE = {
  jigsaw: false,
  questionId: 'q1',
  gameId: 'g1',
  elapsedMs: 0,
  durationMs: 10000,
  revealed: false,
};

/** Every probe outstanding *now* reports success. */
function arrive(): void {
  const outstanding = [...probes];
  act(() => {
    for (const probe of outstanding) probe.onload?.();
  });
}

/**
 * Every probe outstanding *now* fails.
 *
 * Snapshotted first, deliberately. A failing probe raises its retry
 * synchronously and pushes it onto the same array, so iterating the live one
 * fails both attempts in a single call — which made the silent retry look like
 * it was not happening when it was.
 */
function fail(): void {
  const outstanding = [...probes];
  act(() => {
    for (const probe of outstanding) probe.onerror?.();
  });
}

describe('frameRatio', () => {
  test('hands the box to the <img> when the pack knows the size', () => {
    // #given a still whose dimensions were read at build time
    // #when the frame is asked what ratio to hold
    // #then nothing: width and height attributes on an image are what a browser
    // uses to work the box out, and two mechanisms both claiming it is how they
    // end up disagreeing
    expect(frameRatio(false, 780, 439)).toBeNull();
  });

  test('holds the box itself when there is no <img> to carry the numbers', () => {
    // #given a jigsaw or a square sleeve, drawn without an <img>
    expect(frameRatio(true, undefined, undefined)).toBe('1 / 1');
    expect(frameRatio(true, 600, 600)).toBe('1 / 1');
  });

  test('falls back rather than leaving the box at nothing', () => {
    // #given a pack old enough to predate the sizes — a phone holding a cached
    // copy of the file, which Pages serves independently of the app
    // #when the frame is asked
    // #then a guess, which costs one reflow. Zero height costs the question.
    expect(frameRatio(false, undefined, undefined)).toBe('16 / 9');
    expect(frameRatio(false, 780, undefined)).toBe('16 / 9');
  });
});

describe('PicturePrompt', () => {
  test('a still reserves its box before a byte of it has arrived', () => {
    // #given an On the box still, not yet loaded
    const { container } = render(
      <PicturePrompt {...BASE} image="abc.jpg" imageWidth={780} imageHeight={439} />,
    );

    // #when the DOM is read while the probe is still outstanding
    const img = container.querySelector('img');

    // #then the browser has what it needs to work the height out. This is the
    // regression: without these attributes the element is 0px tall and the
    // question looks like it has no picture.
    expect(img).toHaveAttribute('width', '780');
    expect(img).toHaveAttribute('height', '439');
  });

  test('Apple artwork is square without the pack saying so', () => {
    // #given a sleeve, whose artwork the builder always fetches at 600×600
    const { container } = render(
      <PicturePrompt
        {...BASE}
        artworkUrl="https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg"
      />,
    );

    // #when the frame is read
    const frame = container.querySelector('.still__frame');

    // #then it holds a square open itself — there are no attributes on the
    // <img> to do it, and nothing in the pack records the size
    expect(frame).toHaveStyle({ aspectRatio: '1 / 1' });
  });

  test('a jigsaw holds its square open too, drawn from background tiles', () => {
    // #given a picture-round jigsaw, which has no <img> at all
    const { container } = render(<PicturePrompt {...BASE} image="abc.jpg" jigsaw />);

    // #when the frame is read
    // #then the square is explicit rather than left to the tiles
    expect(container.querySelector('.still__frame')).toHaveStyle({ aspectRatio: '1 / 1' });
    expect(container.querySelectorAll('.jigsaw__tile')).toHaveLength(9);
  });

  test('says nothing at all when the picture arrives promptly', () => {
    // #given a still that loads inside the grace period
    vi.useFakeTimers();
    render(<PicturePrompt {...BASE} image="abc.jpg" imageWidth={780} imageHeight={439} />);
    arrive();

    // #when the grace period passes
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // #then no placeholder ever showed. One that appears and vanishes inside a
    // frame reads as a rendering fault, which is why it waits.
    expect(screen.queryByText(/picture loading/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/didn’t load/i)).not.toBeInTheDocument();
  });

  test('admits it is waiting once the picture is late', () => {
    // #given a still that has not arrived
    vi.useFakeTimers();
    const { container } = render(
      <PicturePrompt {...BASE} image="abc.jpg" imageWidth={780} imageHeight={439} />,
    );

    // #when the grace period passes with no picture
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // #then the box says so, rather than sitting there looking like a question
    // with no picture — which is what made nobody think to wait
    expect(screen.getByText(/picture loading/i)).toBeInTheDocument();
    expect(container.querySelector('.still__frame--waiting')).not.toBeNull();
  });

  test('retries once in silence before it gives up', () => {
    // #given a still whose first request fails
    render(<PicturePrompt {...BASE} image="abc.jpg" imageWidth={780} imageHeight={439} />);
    expect(probes).toHaveLength(1);
    fail();

    // #when that failure lands
    // #then a second request went out and nothing has been said yet. A blip on
    // a bad connection is the case this is for, and a ten-second window has no
    // room for somebody to read a message and press a button.
    expect(probes).toHaveLength(2);
    expect(screen.queryByText(/didn’t load/i)).not.toBeInTheDocument();
  });

  test('offers the button only once the automatic attempt has failed too', () => {
    // #given both attempts failing
    render(<PicturePrompt {...BASE} image="abc.jpg" imageWidth={780} imageHeight={439} />);
    fail();
    fail();

    // #when the screen is read
    // #then it says what happened and offers a way out, instead of leaving a
    // silent gap that never resolves
    expect(screen.getByText(/didn’t load/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  test('a question with no picture renders nothing', () => {
    // #given a text question
    const { container } = render(<PicturePrompt {...BASE} />);

    // #then there is no empty figure sitting in the layout
    expect(container.querySelector('.still')).toBeNull();
  });
});
