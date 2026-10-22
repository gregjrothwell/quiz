import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * The scripts must not reach `src/firebase.ts`.
 *
 * **This test exists because `npm run host-room` was broken for weeks and
 * nothing said so.** It imports `resolveAnswer` from `src/lib/vault.ts`, which
 * used to import `src/firebase.ts` for a one-line convenience wrapper — and
 * `src/firebase.ts` reads `import.meta.env` in its module body, which Vite
 * defines and Node does not. So the script died on its first import, long
 * before any of its own code ran.
 *
 * The damage was not one broken command. `docs/decisions/gotchas.md` names that harness
 * as the way to test three separate things — a quizmaster dropping out
 * mid-round, the keyboard shortcuts in a live game, and the vault's own gate
 * from the terminal — so all three were untestable and the file recorded them
 * as merely untested.
 *
 * Nothing else would catch this. `npm test` covers `src/` and the pure parts of
 * `scripts/`; the harnesses themselves talk to the live project and are kept
 * out on purpose, so no suite ever imports them. A static walk of the import
 * graph is offline, instant, and fails in the run that causes the breakage
 * rather than at the next preflight.
 */

const ROOT = resolve(import.meta.dirname, '..');
const SCRIPTS = resolve(ROOT, 'scripts');

/**
 * Reads a module's relative imports, resolved to absolute paths. With
 * `runtimeOnly`, `import type` / `export type` lines are skipped: they are erased
 * before anything runs, so they cannot load React into a Node process.
 */
function importsOf(file: string, runtimeOnly = false): string[] {
  const text = readFileSync(file, 'utf8');
  const source = runtimeOnly ? text.replace(/^\s*(?:import|export)\s+type\b[^;]*;/gm, '') : text;
  const found: string[] = [];

  // `from '...'` covers static imports and re-exports; `import('...')` covers
  // the dynamic form, which would bring the module in just the same.
  const patterns = [/\bfrom\s+['"](\.[^'"]+)['"]/g, /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (!specifier) continue;

      const base = resolve(dirname(file), specifier);
      // TypeScript specifiers carry no extension, and a directory import means
      // its index. Whichever exists is the one that would be loaded.
      const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        join(base, 'index.ts'),
        join(base, 'index.tsx'),
      ];
      const target = candidates.find((path) => {
        try {
          readFileSync(path, 'utf8');
          return true;
        } catch {
          return false;
        }
      });
      if (target) found.push(target);
    }
  }

  return found;
}

/** Everything a module pulls in, however indirectly. */
function reachableFrom(entry: string, runtimeOnly = false): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    queue.push(...importsOf(file, runtimeOnly));
  }

  seen.delete(entry);
  return seen;
}

const entries = readdirSync(SCRIPTS)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
  .map((name) => resolve(SCRIPTS, name));

describe('what the scripts are allowed to import', () => {
  test('there are scripts to check, so a rename cannot quietly empty this suite', () => {
    // #given the scripts directory
    // #when its entry points are listed
    // #then there are some. A test that silently checks nothing is worse than
    // no test, because it reports green either way
    expect(entries.length).toBeGreaterThan(4);
  });

  test.each(entries.map((file) => [relative(ROOT, file), file] as const))(
    '%s does not reach src/firebase.ts',
    (_name, file) => {
      // #given one script and everything it pulls in, however indirectly
      const reached = reachableFrom(file);

      // #when the graph is checked for the app's Firebase singleton
      const firebase = resolve(ROOT, 'src/firebase.ts');

      // #then it is not there. That module reads `import.meta.env` in its body,
      // which Vite defines and Node does not, so importing it at any depth kills
      // the script before a line of its own code runs
      expect([...reached].map((path) => relative(ROOT, path))).not.toContain(
        relative(ROOT, firebase),
      );
    },
  );

  test('host-room still reaches the vault, so this is not passing by accident', () => {
    // #given the harness that broke
    const reached = [...reachableFrom(resolve(SCRIPTS, 'host-room.ts'))].map((p) =>
      relative(ROOT, p),
    );

    // #then it still imports the module it needs. Deleting the import would
    // also make the test above pass, and would be the wrong fix
    expect(reached).toContain('src/lib/vault.ts');
  });
});

/*
  The host module (host-loop.md, A1–A2) is driven by the app and by Node
  harnesses alike, so it is held to the scripts' rule and one more: no React,
  however indirectly. A hook slipped in here is the first step back to the
  untestable host this module replaced.
*/
const HOST = resolve(ROOT, 'src/host');
const hostEntries = readdirSync(HOST)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
  .map((name) => resolve(HOST, name));

describe('what the host module is allowed to import', () => {
  test('there is a host module to check', () => {
    expect(hostEntries.map((file) => relative(ROOT, file))).toContain('src/host/due.ts');
  });

  test.each(hostEntries.map((file) => [relative(ROOT, file), file] as const))(
    '%s reaches neither src/firebase.ts nor react',
    (_name, file) => {
      // #given one host file and everything it pulls in
      const reached = [file, ...reachableFrom(file)];
      const loaded = [file, ...reachableFrom(file, true)];

      // #then the app's Firebase singleton is not among them, even by type
      expect(reached.map((path) => relative(ROOT, path))).not.toContain('src/firebase.ts');
      // #and nothing that runs imports React. (`questions/types.ts` takes the
      // `Voice` type from `lib/sound.ts`, a hook file; a type is erased.)
      const withReact = loaded
        .filter((path) => /\bfrom\s+['"]react(?:-dom)?(?:\/[^'"]*)?['"]/.test(readFileSync(path, 'utf8')))
        .map((path) => relative(ROOT, path));
      expect(withReact).toEqual([]);
    },
  );

  test('the runtime walk still follows value imports, so it is not passing by accident', () => {
    const loaded = [...reachableFrom(resolve(HOST, 'moves.ts'), true)].map((path) => relative(ROOT, path));
    expect(loaded).toContain('src/engine/reducer.ts');
    expect(loaded).toContain('src/lib/withTimeout.ts');
  });

  test('the React check can see a React import, so it is not passing by accident', () => {
    // #given a file that does import React
    const app = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8');
    // #then the pattern above finds it
    expect(/\bfrom\s+['"]react(?:-dom)?(?:\/[^'"]*)?['"]/.test(app)).toBe(true);
  });
});
