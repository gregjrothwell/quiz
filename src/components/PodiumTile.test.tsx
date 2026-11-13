import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { PodiumTile, type TileArrival } from './PodiumTile';

/**
 * The chip's shape, which is what lets the stylesheet cut a long name.
 *
 * jsdom does no layout, so nothing here can see a name being cut — the widths
 * were measured in a real browser on "Reveal · long names" in the gallery,
 * 15 October 2026. What this pins is the structure the cut depends on: the
 * name in an element of its own, so `text-overflow` can take the name without
 * taking the time, and the whole name kept where a screen reader gets it.
 */

afterEach(cleanup);

const noop = () => {};

const LONG = 'Wolfgang Amadeus Montgomery-Featherstone';

function arrival(overrides: Partial<TileArrival> = {}): TileArrival {
  return { uid: 'wolf', name: LONG, elapsedMs: 5_200, isYou: false, firstMs: 5_200, snap: false, ...overrides };
}

function show(arrivals: TileArrival[]) {
  return render(
    <PodiumTile index={0} text="Metropolitan Line" state="correct" disabled onPick={noop} order={0} arrivals={arrivals} />,
  );
}

describe('PodiumTile name chips', () => {
  test('the name sits apart from the time', () => {
    // #given a player with a name far longer than a chip has room for
    // #when their chip lands
    const { container } = show([arrival()]);

    // #then the name is its own element and the time is not inside it, so
    // cutting the one leaves the other whole
    expect(container.querySelector('.tile__pick .tile__name')?.textContent).toBe(LONG);
    expect(container.querySelector('.tile__pick > i')).toHaveTextContent('5.2s');
  });

  test('a snap chip keeps both times outside the name', () => {
    // #given the chip with the most in it: a long name and two times
    // #when it lands
    const { container } = show([arrival({ firstMs: 80, snap: true })]);

    // #then both times are in the time element, none in the name
    expect(container.querySelector('.tile__name')?.textContent).toBe(LONG);
    expect(container.querySelector('.tile__pick > i')).toHaveTextContent('0.1s → 5.2s');
  });

  test('a pick that was never locked says so instead of a time', () => {
    // #given an answer locked for them at the buzzer (docs/decisions/lock-in.md)
    // #when its chip lands
    const { container } = show([arrival({ elapsedMs: 10_000, unlocked: true })]);

    // #then it reads as what happened, not as a ten-second answer
    expect(container.querySelector('.tile__pick > i')).toHaveTextContent('not locked');
    expect(container.querySelector('.tile__pick > i')).not.toHaveTextContent('10.0s');
  });

  test('the screen reader still gets the whole name', () => {
    // #given a long name, which the chip on screen will cut short
    // #when it lands
    const { container } = show([arrival(), arrival({ uid: 'greg', name: 'Greg', elapsedMs: 4_100 })]);

    // #then the sentence a screen reader reads names everybody in full
    expect(container.querySelector('.tile__crowd .sr-only')).toHaveTextContent(`Picked by ${LONG} and Greg`);
  });
});

/**
 * The reveal said which answer was right in green and nothing else, so a screen
 * reader was never told (PROJ-178, docs/decisions/ui-ux-review.md).
 */
describe('PodiumTile at the reveal', () => {
  test('the right answer is named in words', () => {
    // #given the lectern the reveal lit green
    const { container } = render(
      <PodiumTile index={0} text="Metropolitan Line" state="correct" disabled onPick={noop} order={0} />,
    );

    // #then its name starts by saying so, ahead of the answer itself
    expect(container.querySelector('button')).toHaveTextContent(/Right answer:\s*Metropolitan Line/);
    expect(container.querySelector('.tile__text .sr-only')).toHaveTextContent('Right answer:');
  });

  test('no other lectern claims it', () => {
    // #given every state a lectern can be in that is not the right answer
    for (const state of ['idle', 'held', 'picked', 'wrong', 'hushed', 'gone'] as const) {
      const { container, unmount } = render(
        <PodiumTile index={1} text="Jubilee Line" state={state} disabled onPick={noop} order={1} />,
      );

      // #then
      expect(container.querySelector('button')).not.toHaveTextContent('Right answer');
      unmount();
    }
  });
});

/**
 * The answers arrive after the picture and the prompt, one at a time (PROJ-178).
 * They used to start at once, 70ms apart, and the whole entrance was nine-tenths
 * done in a third of a second. The picture's and the prompt's share of it is in
 * the stylesheet, and `global.test.ts` reads it there.
 */
describe('PodiumTile entrance', () => {
  test('each answer waits its turn behind the prompt', () => {
    // #given the four lecterns of one question
    const delays = [0, 1, 2, 3].map((order) => {
      const { container, unmount } = render(
        <PodiumTile index={order} text="An answer" state="idle" disabled={false} onPick={noop} order={order} />,
      );
      const delay = container.querySelector('button')?.style.animationDelay;
      unmount();
      return delay;
    });

    // #then the first starts once the prompt is up, and the last 270ms after it
    expect(delays).toEqual(['300ms', '390ms', '480ms', '570ms']);
  });
});
