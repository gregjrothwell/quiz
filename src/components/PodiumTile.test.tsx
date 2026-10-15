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

  test('the screen reader still gets the whole name', () => {
    // #given a long name, which the chip on screen will cut short
    // #when it lands
    const { container } = show([arrival(), arrival({ uid: 'greg', name: 'Greg', elapsedMs: 4_100 })]);

    // #then the sentence a screen reader reads names everybody in full
    expect(container.querySelector('.sr-only')).toHaveTextContent(`Picked by ${LONG} and Greg`);
  });
});
