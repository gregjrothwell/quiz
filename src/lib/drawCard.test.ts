import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The share card's colours are a copy of the stylesheet's, because canvas
 * cannot read CSS. A copy drifts: --ink-dim was raised for contrast and the
 * card kept the old value for weeks (found 30 October 2026). Read as text, so
 * this runs in node without a canvas.
 */

const css = readFileSync(join(import.meta.dirname, '..', 'design', 'global.css'), 'utf8');
const card = readFileSync(join(import.meta.dirname, 'drawCard.ts'), 'utf8');

const COPIES: Record<string, string> = {
  INK: '--ink',
  INK_SOFT: '--ink-soft',
  INK_DIM: '--ink-dim',
  NIGHT: '--night',
  PANEL: '--panel',
  EDGE: '--edge',
  CYAN: '--cyan',
  AMBER: '--amber',
};

function token(name: string): string | undefined {
  return css.match(new RegExp(`^\\s*${name}:\\s*(#[0-9a-f]{6});`, 'mi'))?.[1];
}

function constant(name: string): string | undefined {
  return card.match(new RegExp(`const ${name} = '(#[0-9a-f]{6})'`, 'i'))?.[1];
}

describe('drawCard colours', () => {
  for (const [name, variable] of Object.entries(COPIES)) {
    it(`${name} matches ${variable}`, () => {
      expect(token(variable), variable).toBeDefined();
      expect(constant(name)?.toLowerCase()).toBe(token(variable)?.toLowerCase());
    });
  }
});
