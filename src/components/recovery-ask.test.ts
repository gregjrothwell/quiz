import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { RecoveryAsk } from './RecoveryAsk';

describe('RecoveryAsk', () => {
  test('renders one line and a button for a first banked win', () => {
    // #given the first-win ask, not a dialog
    const html = renderToStaticMarkup(
      createElement(RecoveryAsk, { kind: 'save', uid: 'greg', onClaimed: () => undefined }),
    );

    // #then the podium is not covered: one sentence, one button, no modal
    expect(html).toContain('That win is tied to this browser');
    expect(html).toContain('Save a recovery code');
    expect(html).not.toContain('dialog');
    expect(html).not.toContain('Get a recovery code');
  });

  test('renders a restore button for a stored code that would not write', () => {
    // #given a claimed playerId and code in storage, no claims/{uid}
    const html = renderToStaticMarkup(
      createElement(RecoveryAsk, { kind: 'reclaim', uid: 'new-anon', onClaimed: () => undefined }),
    );

    // #then they are asked to restore with the code already here, not to type it
    expect(html).toContain('This browser can no longer update that record');
    expect(html).toContain('Restore it');
    expect(html).not.toContain('Already have a code?');
  });
});
