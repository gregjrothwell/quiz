import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AnswerLamps } from './AnswerLamps';

describe('AnswerLamps (W3, AC6)', () => {
  it('lights whoever the lamps say has answered, with no answer in hand', () => {
    const players = {
      ann: { name: 'Ann', joinedAt: 1 },
      bob: { name: 'Bob', joinedAt: 2 },
      cat: { name: 'Cat', joinedAt: 3 },
    };
    const { container } = render(
      <AnswerLamps players={players} lit={new Set(['bob', 'cat'])} youUid="ann" />,
    );
    const lit = [...container.querySelectorAll('.lamp--in')].map((lamp) => lamp.textContent);
    expect(lit).toEqual(['Bob', 'Cat']);
    expect(screen.getByText('2 of 3 answered')).toBeInTheDocument();
  });
});
