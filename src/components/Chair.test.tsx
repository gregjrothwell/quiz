import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { Chair } from './Chair';

afterEach(cleanup);

describe('Chair', () => {
  test('shows a single occupant by name', () => {
    // #given one person in last place
    // #when the chair is drawn
    const { container } = render(<Chair names={['Alex']} score={0} />);

    // #then the label is just the name — not the animated score, which ticks
    // from 0 via rAF and is not what this test is for
    expect(container.querySelector('.seat__name')).toHaveTextContent('Alex');
  });

  test('a two-person tie keeps the ampersand', () => {
    // #given two people level at the bottom
    // #when the chair is drawn
    const { container } = render(<Chair names={['Alex', 'Sam']} score={0} />);

    // #then the label is what seatLabel does for a pair
    expect(container.querySelector('.seat__name')).toHaveTextContent('Alex & Sam');
  });

  test('a four-person tie counts the tail instead of drawing a fourth name', () => {
    // #given more names than SEAT_DRAWN_MAX (3)
    // #when the chair is drawn
    const { container } = render(
      <Chair names={['Jo', 'Rach', 'Dev', 'Priya']} score={0} />,
    );

    // #then the fourth name is not in the label — it would wrap `.seat__name`
    // into a paragraph and push the chair down the podium
    expect(container.querySelector('.seat__name')).toHaveTextContent('Jo, Rach & 2 more');
  });
});
