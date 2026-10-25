import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * CI runs the Playwright specs as parallel jobs, one per group in
 * `e2e/shards.json`, each against its own emulators. A spec in no group never
 * runs in CI and nothing else would say so; a group the workflow's matrix does
 * not list is the same failure one level up. See docs/decisions/emulators.md.
 */

const ROOT = resolve(import.meta.dirname, '..');
const SPECS = readdirSync(resolve(ROOT, 'e2e')).filter((name) => name.endsWith('.spec.ts'));
const SHARDS = JSON.parse(readFileSync(resolve(ROOT, 'e2e/shards.json'), 'utf8')) as string[][];
const WORKFLOW = readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf8');

/** The `shard:` list of the e2e matrix, or null when the workflow has none. */
function matrixShards(workflow: string): number[] | null {
  const match = /^\s+shard: \[([\d, ]+)\]$/m.exec(workflow);
  if (!match?.[1]) return null;
  return match[1].split(',').map((entry) => Number(entry.trim()));
}

describe('e2e shards', () => {
  test('there are specs to share out, so a rename cannot quietly empty this suite', () => {
    expect(SPECS.length).toBeGreaterThan(4);
  });

  test('every spec is in exactly one shard', () => {
    const named = SHARDS.flat().map((path) => path.replace(/^e2e\//, ''));
    expect([...named].sort()).toEqual([...SPECS].sort());
  });

  test('every entry is a path under e2e/', () => {
    for (const path of SHARDS.flat()) expect(path).toMatch(/^e2e\/[\w-]+\.spec\.ts$/);
  });

  test('the workflow matrix runs every shard, and only those', () => {
    expect(matrixShards(WORKFLOW)).toEqual(SHARDS.map((_, index) => index));
  });

  test('the matrix reader finds a list, and finds nothing without one', () => {
    expect(matrixShards('    strategy:\n      matrix:\n        shard: [0, 1, 2]\n')).toEqual([0, 1, 2]);
    expect(matrixShards('jobs:\n  e2e:\n')).toBeNull();
  });
});
