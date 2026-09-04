import { describe, expect, test } from 'vitest';
import { PILE_ONS, pileOns, seatLabel, SEAT_DRAWN_MAX } from './seat';

describe('pileOns', () => {
  test('a clear last place gets no pile-ons, so the chair is unchanged', () => {
    // #given one person seated
    // #when the extra figures are worked out
    // #then there are none. This is the regression guard on much the commonest
    // case: the single-occupant chair must draw exactly what it always drew.
    expect(pileOns(1)).toEqual([]);
  });

  test('nobody seated is also no pile-ons', () => {
    expect(pileOns(0)).toEqual([]);
    expect(pileOns(-1)).toEqual([]);
  });

  test('a two-way tie adds one, and it is the first of the pair', () => {
    // #given two people level at the bottom
    // #when the extra figures are worked out
    // #then one is added — and it is the same one a three-way tie starts with,
    // so the chair does not rearrange itself as the tie grows
    expect(pileOns(2)).toEqual([PILE_ONS[0]]);
    expect(pileOns(3).slice(0, 1)).toEqual(pileOns(2));
  });

  test('a three-way tie fills the chair', () => {
    expect(pileOns(3)).toEqual([PILE_ONS[0], PILE_ONS[1]]);
  });

  test('past three, no more figures are drawn', () => {
    // #given more people than the chair can hold
    // #when the extra figures are worked out
    // #then it caps rather than drawing a fourth. A fourth at this size is not a
    // smaller figure, it is a smudge — the count goes in the label instead.
    expect(pileOns(4)).toHaveLength(SEAT_DRAWN_MAX - 1);
    expect(pileOns(9)).toHaveLength(SEAT_DRAWN_MAX - 1);
  });

  test('every pile-on stays inside the chair’s viewBox', () => {
    /*
      #given a pile-on's own extents, stroke widths included, transcribed from
      the three paths `Chair.tsx` and `drawCard.ts` both draw it from:

        head   circle (34, 18) r 4.5      → x 29.5–38.5, y 13.5–22.5
        torso  M35 24 33 34, width 4.5    → x 30.75–37.25, y 21.75–36.25
        arm    M34 27 27 30, width 3.5    → x 25.25–35.75, y 25.25–31.75

      A pile-on is head, torso stub and arm — it has no legs, so it is a much
      narrower figure than the sitter and reaches nothing like as far left. The
      first version of this test used the *sitter's* extents by mistake and
      failed a perfectly good offset.

      #then no offset pushes one out of `viewBox="6 2 50 72"`. That is the check
      keeping the box from having to grow, which matters more than it sounds:
      `.seat__chair` is sized by `max-width`, so a wider box renders the chair
      *shorter*, and the height is the entire joke.
    */
    const LEFT = 25.25;
    const RIGHT = 38.5;
    const TOP = 13.5;

    for (const { dx, dy } of PILE_ONS) {
      expect(LEFT + dx).toBeGreaterThanOrEqual(6);
      expect(RIGHT + dx).toBeLessThanOrEqual(56);
      expect(TOP + dy).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('seatLabel', () => {
  test('one name is just the name', () => {
    expect(seatLabel(['Alex'])).toBe('Alex');
  });

  test('two names keep the ampersand they have always had', () => {
    expect(seatLabel(['Alex', 'Sam'])).toBe('Alex & Sam');
  });

  test('three read as a list rather than a chain of ampersands', () => {
    // #then "Jo, Rach & Dev" — which is what live room XS4A finished as
    expect(seatLabel(['Jo', 'Rach', 'Dev'])).toBe('Jo, Rach & Dev');
  });

  test('past three the tail becomes a count', () => {
    /*
      #given more names than the label can carry

      #then it counts them. `.seat__name` is capped at 7rem over a column barely
      wider than the chair, so a fourth name does not fail to fit — it wraps the
      label into a paragraph and pushes the chair down the podium, which is the
      one thing `.finale`'s floor alignment cannot take.
    */
    expect(seatLabel(['Jo', 'Rach', 'Dev', 'Priya'])).toBe('Jo, Rach & 2 more');
    expect(seatLabel(['Jo', 'Rach', 'Dev', 'Priya', 'Sam'])).toBe('Jo, Rach & 3 more');
  });

  test('nobody seated is an empty label, not the word "nobody"', () => {
    // The screen tests `seatedNames.length` to decide whether there is a chair
    // at all, so this only ever renders if something upstream is already wrong.
    expect(seatLabel([])).toBe('');
  });
});
