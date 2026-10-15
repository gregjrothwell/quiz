import { describe, expect, test } from 'vitest';
import { exchangeAdvice } from './appCheck';

describe('exchangeAdvice', () => {
  test('a 429 is a rate limit, not an unlisted token', () => {
    expect(exchangeAdvice(429)).toMatch(/rate limit/);
    expect(exchangeAdvice(429)).toMatch(/wait a minute/i);
    expect(exchangeAdvice(429)).not.toMatch(/safelist/);
  });

  test('a 403 keeps the safelist hint', () => {
    expect(exchangeAdvice(403)).toMatch(/not safelisted/);
  });

  test('anything else claims neither', () => {
    expect(exchangeAdvice(500)).not.toMatch(/safelist|wait a minute/i);
  });
});
