import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

/**
 * Every way the app opens a round goes through `openRound`, which is what puts
 * the lead-in on it. A `start` built by hand opens a round without one, and
 * nothing on screen would say so until somebody noticed the answers were early.
 */
const SRC = resolve(import.meta.dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

test('only openRound builds a start', () => {
  const builders = sources(SRC)
    .filter((path) => /type:\s*'start'(?:\s+as const)?\s*,/.test(readFileSync(path, 'utf8')))
    .map((path) => path.slice(SRC.length + 1));
  expect(builders).toEqual(['engine/leadIn.ts']);
});
