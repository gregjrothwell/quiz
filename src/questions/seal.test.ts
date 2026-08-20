import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { sealQuestion, type Question } from './types';

/**
 * The published packs must not contain answers.
 *
 * **This is the app's central secret, and until now nothing checked it.** The
 * whole vault design rests on it: `public/packs/*.json` is served as static
 * files from GitHub Pages, so anything in them is readable by anybody with the
 * URL, no sign-in and no room code. One leaked field and the vault, the time
 * gate and the reveal rules are all decoration.
 *
 * It held — all ten packs were clean when this was written on 20 August 2026 —
 * but it held by care rather than by anything enforcing it. `sealQuestion`
 * builds its result field by field, which is the right shape; the risk is a
 * future harvest writing packs by some other route, or a hand-edit.
 *
 * `AGENTS.md` used to state this rule as "nothing under `src/` except
 * `types.ts` may name `correct`". That is not the invariant and never was: ten
 * files under `src/` use the word, almost all of it prose, and nine name
 * `correctIndex` — which is legitimate, because it is the runtime field that
 * exists only after the vault has resolved an answer. A rule that cannot be
 * checked is not a rule. **What matters is what ships in the packs**, which is
 * exactly what this file checks.
 *
 * Offline and static, like `scripts/imports.test.ts`, so it fails in the run
 * that causes the breakage rather than at the next preflight.
 */

const PACKS = resolve(import.meta.dirname, '../../public/packs');

/**
 * Anything that looks like it names an answer, anywhere in a JSON value.
 *
 * Deliberately broader than the two field names the current code could emit.
 * The failure this guards against is a *future* shape nobody has thought of
 * yet, so matching a pattern beats listing today's keys — a false positive
 * costs one conversation, a false negative costs the whole design.
 */
const ANSWER_LIKE = /correct|answer|incorrect|solution/i;

/** Every path in `value` whose key looks answer-bearing. */
export function sealBreaches(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => sealBreaches(item, `${path}[${i}]`));
  }
  if (value === null || typeof value !== 'object') return [];

  const found: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const here = path ? `${path}.${key}` : key;
    if (ANSWER_LIKE.test(key)) found.push(here);
    found.push(...sealBreaches(child, here));
  }
  return found;
}

const packFiles = readdirSync(PACKS)
  .filter((name) => name.endsWith('.json') && name !== 'index.json')
  .sort();

describe('the published packs are sealed', () => {
  // Guards the guard. A glob that quietly matched nothing would make every
  // assertion below pass while checking not one thing.
  test('there are packs to check', () => {
    expect(packFiles.length).toBe(10);
  });

  test.each(packFiles)('%s ships no answer', (name) => {
    const pack: unknown = JSON.parse(readFileSync(join(PACKS, name), 'utf8'));
    expect(sealBreaches(pack)).toEqual([]);
  });

  test.each(packFiles)('%s ships options for every question', (name) => {
    const pack = JSON.parse(readFileSync(join(PACKS, name), 'utf8')) as {
      questions: { id: string; options?: unknown }[];
    };
    expect(pack.questions.length).toBeGreaterThan(0);

    const unplayable = pack.questions.filter(
      (q) => !Array.isArray(q.options) || q.options.length < 2,
    );
    expect(unplayable.map((q) => q.id)).toEqual([]);
  });
});

describe('the check itself refuses a broken pack', () => {
  // The half that makes the passes above mean something. A test that only ever
  // sees clean input cannot tell "sealed" from "not looking".
  test('an answer field is caught', () => {
    expect(sealBreaches({ questions: [{ id: 'q1', correct: 'Paris' }] })).toEqual([
      'questions[0].correct',
    ]);
  });

  test('a nested answer is caught', () => {
    expect(sealBreaches({ a: { b: [{ meta: { correctIndex: 2 } }] } })).toEqual([
      'a.b[0].meta.correctIndex',
    ]);
  });

  test('the harvest shape is caught, in full', () => {
    const raw: Question = {
      id: 'q1',
      question: 'Capital of France?',
      correct: 'Paris',
      incorrect: ['Lyon', 'Nice', 'Brest'],
      category: 'Geography',
      difficulty: 'easy',
      source: 'opentdb',
    };
    expect(sealBreaches(raw)).toEqual(['correct', 'incorrect']);
  });

  test('`sealQuestion` output is clean, and keeps the options', () => {
    const raw: Question = {
      id: 'q1',
      question: 'Capital of France?',
      correct: 'Paris',
      incorrect: ['Lyon', 'Nice', 'Brest'],
      category: 'Geography',
      difficulty: 'easy',
      source: 'opentdb',
    };
    const sealed = sealQuestion(raw);
    expect(sealBreaches(sealed)).toEqual([]);
    expect(sealed.options).toHaveLength(4);
    expect(sealed.options).toContain('Paris');
  });
});
