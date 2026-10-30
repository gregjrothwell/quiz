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
      [...rule.body.matchAll(/font-size:\s*([\d.]+)rem/g)]
        .filter((m) => Number(m[1]) < 0.72)
        .map((m) => `${rule.selector} ${m[1]}rem`),
    );
    expect(tiny).toEqual([]);
  });

  it('writes breakpoints in rem, so they move with the reader’s font size', () => {
    expect(css.match(/@media[^{]*\d+px/g) ?? []).toEqual([]);
  });
});
