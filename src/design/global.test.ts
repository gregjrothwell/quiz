import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * House rules for the one stylesheet that a browser would not complain about.
 *
 * Each of these was found broken on 30 October 2026 by measuring the design
 * gallery (`#/preview`): native controls drawn light on a dark set, hover lifts
 * that stuck after a tap, keyboard focus left to the browser's default ring, and
 * player names set under 11px.
 */

const css = readFileSync(join(import.meta.dirname, 'global.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

interface Rule {
  selector: string;
  body: string;
  /** Every enclosing at-rule prelude, outermost first. */
  at: string[];
}

function parse(source: string): Rule[] {
  const rules: Rule[] = [];
  const stack: string[] = [];
  let buffer = '';
  for (const ch of source) {
    if (ch === '{') {
      stack.push(buffer.trim());
      buffer = '';
    } else if (ch === '}') {
      const prelude = stack.pop() ?? '';
      if (!prelude.startsWith('@')) {
        rules.push({ selector: prelude, body: buffer, at: stack.filter((s) => s.startsWith('@')) });
      }
      buffer = '';
    } else if (ch === ';' && (stack.at(-1) ?? '@').startsWith('@')) {
      // A statement at-rule such as `@import`, which has no block to close it.
      buffer = '';
    } else {
      buffer += ch;
    }
  }
  return rules;
}

const rules = parse(css);
const selectors = (rule: Rule) => rule.selector.split(',').map((s) => s.trim());

describe('global.css', () => {
  it('parses into rules, so the checks below are reading something', () => {
    expect(rules.length).toBeGreaterThan(500);
    expect(rules.some((r) => r.selector === '.btn')).toBe(true);
  });

  it('defines no custom property in terms of itself', () => {
    // `--ink: var(--ink)` is a cycle: every `var(--ink)` on the page goes
    // invalid and text falls back to the browser's own colour. A literal-to-
    // token sweep did exactly this on 30 October 2026.
    const cycles = [...css.matchAll(/(--[a-z0-9-]+):\s*var\(\1\b/g)].map((m) => m[1]);
    expect(cycles).toEqual([]);
  });

  it('tells the browser the set is dark, so native controls and scrollbars match', () => {
    const root = rules.find((r) => r.selector === ':root');
    expect(root?.body).toMatch(/color-scheme:\s*dark/);
  });

  it('only hovers where there is a pointer that can hover', () => {
    const ungated = rules
      .flatMap((rule) => selectors(rule).filter((s) => s.includes(':hover')).map((s) => ({ s, rule })))
      .filter(({ rule }) => !rule.at.some((a) => /\(hover:\s*hover\)/.test(a)))
      .map(({ s }) => s);
    expect(ungated).toEqual([]);
  });

  it('gives every control a visible keyboard focus ring', () => {
    const focused = new Set(
      rules
        .filter((r) => /outline:\s*\d/.test(r.body) || /box-shadow:/.test(r.body))
        .flatMap(selectors)
        .filter((s) => s.endsWith(':focus-visible'))
        .map((s) => s.replace(/:focus-visible$/, '')),
    );
    for (const control of ['.btn', '.tile', '.pick', '.pack', '.filter-chip', '.lamp--vote', '.sound']) {
      expect(focused, control).toContain(control);
    }
  });

  it('sets no text under 0.72rem (11.5px)', () => {
    const tiny = rules.flatMap((rule) =>
      [...rule.body.matchAll(/(?:font-size|--text-[a-z0-9]+):\s*([\d.]+)rem/g)]
        .filter((m) => Number(m[1]) < 0.72)
        .map((m) => `${rule.selector} ${m[1]}rem`),
    );
    expect(tiny).toEqual([]);
  });

  it('writes breakpoints in rem, so they move with the reader’s font size', () => {
    expect(css.match(/@media[^{]*\d+px/g) ?? []).toEqual([]);
  });

  it('breaks at four widths only: 30, 44, 56 and 64rem', () => {
    // Below-a-width queries use the hundredth under, so the two sides of a
    // breakpoint never both match.
    const widths = [...css.matchAll(/\((min|max)-width:\s*([\d.]+)rem\)/g)].map((m) => `${m[1]} ${m[2]}`);
    const allowed = new Set(['min 30', 'min 44', 'min 56', 'min 64', 'max 29.99', 'max 43.99', 'max 55.99', 'max 63.99']);
    expect(widths.filter((w) => !allowed.has(w))).toEqual([]);
  });

  it('sizes text from the scale, apart from the named set pieces', () => {
    // Moments that are the show rather than the page: putting them on the
    // nearest step moved each 15–79% (measured on the gallery, 30 Oct 2026).
    const setPieces = new Set([
      '.wordmark',
      '.card__ghost',
      '.card__round',
      '.card--intro .card__round',
      '.card__topic',
      '.tile__pop',
      '.standoff__pot-sum',
      '.award__who',
      '.riser__pos',
    ]);
    const offScale = rules
      .filter((r) => r.selector !== ':root' && !setPieces.has(r.selector))
      .flatMap((rule) =>
        [...rule.body.matchAll(/font-size:\s*([^;]+);/g)]
          .map((m) => (m[1] ?? '').trim())
          .filter((v) => !/^var\(--(text|display)-[a-z0-9-]+\)$/.test(v) && !/^[\d.]+em$/.test(v) && v !== 'inherit')
          .map((v) => `${rule.selector}: ${v}`),
      );
    expect(offScale).toEqual([]);
  });

  it('names its own colours instead of writing them out again as rgb()', () => {
    const tokens = new Map<string, string>();
    for (const [, name = '', hex = ''] of css.matchAll(/^\s*(--[a-z-]+):\s*#([0-9a-f]{6});/gim)) {
      const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');
      if (!tokens.has(rgb)) tokens.set(rgb, name);
    }
    const literals = [...css.matchAll(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/g)]
      .map((m) => `${m[1]} ${m[2]} ${m[3]}`)
      .filter((rgb) => tokens.has(rgb))
      .map((rgb) => `${tokens.get(rgb)} as rgb(${rgb})`);
    expect(literals).toEqual([]);
  });

  it('asks Chakra Petch only for the weights it ships', () => {
    // fonts.css ships 600 and 700. A rule that names the face and no weight
    // asks for 400 and quietly gets 600, so the stylesheet says one thing and
    // the screen shows another.
    const wrong = rules
      .filter((r) => /font-family:\s*var\(--tech\)/.test(r.body))
      .filter((r) => !/font-weight:\s*(600|700)\s*;/.test(r.body))
      .map((r) => r.selector);
    expect(wrong).toEqual([]);
  });

  it('marks a disabled button by its outline, not by fading it', () => {
    const disabled = rules.find((r) => r.selector === '.btn:disabled');
    expect(disabled?.body).toMatch(/border-style:\s*dashed/);
    expect(disabled?.body).not.toMatch(/opacity:\s*0?\.\d/);
  });

  it('lets an answer tile’s pick drop its time under the name before cutting the name', () => {
    const pick = rules.find((r) => r.selector === '.tile__pick');
    expect(pick?.body).toMatch(/flex-wrap:\s*wrap/);
  });
});
