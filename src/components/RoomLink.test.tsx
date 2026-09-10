import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { RoomLink } from './RoomLink';

const LINK = 'https://gregjrothwell.github.io/quiz/#/j/XS4A';

const originalClipboard = navigator.clipboard;

afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: originalClipboard,
  });
});

function mockWriteText(writeText: () => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: { writeText },
  });
}

describe('RoomLink', () => {
  test('shows the join link in the textbox', () => {
    // #given a room link
    // #when the share row is drawn
    render(<RoomLink link={LINK} />);

    // #then the box holds the link, so a blocked clipboard still leaves
    // something to copy by hand
    expect(screen.getByRole('textbox', { name: 'Join link for this room' })).toHaveValue(LINK);
  });

  test('announces a successful copy in the live region', async () => {
    // #given a clipboard that accepts the write.
    // userEvent.setup() installs its own stub that always succeeds, so the
    // mock has to land after that — otherwise this test cannot fail.
    const user = userEvent.setup();
    mockWriteText(vi.fn().mockResolvedValue(undefined));
    render(<RoomLink link={LINK} />);

    // #when Copy link is clicked
    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    // #then the live region confirms it
    expect(await screen.findByText('Copied. Paste it into the chat.')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  test('falls back to selecting the box when the clipboard refuses', async () => {
    // #given a clipboard that rejects the write
    const user = userEvent.setup();
    mockWriteText(vi.fn().mockRejectedValue(new Error('denied')));
    render(<RoomLink link={LINK} />);

    // #when Copy link is clicked
    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    // #then the live region tells them to take it from the box
    expect(
      await screen.findByText(
        'Your browser wouldn’t let us copy — the link is selected, so take it from the box.',
      ),
    ).toHaveAttribute('aria-live', 'polite');
  });
});
