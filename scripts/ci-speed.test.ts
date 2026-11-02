import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * The PR-speed pieces from PROJ-93 (docs/decisions/ci-speed.md). Each one
 * fails quietly when it drifts: a cache key that differs between the job that
 * saves and the job that restores fills a cache nobody reads, and a hook that
 * is not executable or not installed simply never runs.
 */

const ROOT = resolve(import.meta.dirname, '..');
const WORKFLOW = readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf8');
const HOOK = resolve(ROOT, '.githooks/pre-push');

function keys(prefix: string): string[] {
  return [...WORKFLOW.matchAll(new RegExp(`^\\s+key: (${prefix}-.+)$`, 'gm'))].map((m) => m[1] ?? '');
}

describe('install caches', () => {
  test('build, checks and warm restore and save the same node_modules key', () => {
    const found = keys('modules');
    expect(found).toHaveLength(3);
    expect(new Set(found).size).toBe(1);
  });

  test('the shards and warm share one Playwright key', () => {
    const found = keys('e2e');
    expect(found).toHaveLength(2);
    expect(new Set(found).size).toBe(1);
  });

  test('the keys follow the lockfile and the Node version', () => {
    for (const key of [...keys('modules'), ...keys('e2e')]) {
      expect(key).toContain("hashFiles('.nvmrc', 'package-lock.json')");
    }
  });
});

describe('pre-push hook', () => {
  test('is executable and installed by prepare', () => {
    expect(statSync(HOOK).mode & 0o111).not.toBe(0);
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.prepare).toContain('core.hooksPath .githooks');
  });

  /**
   * The environment minus git's own variables. A hook exports GIT_DIR, and from
   * a linked worktree it is absolute, so it would point every git call here at
   * the real repository rather than the scratch one (PROJ-97).
   */
  function withoutGit(): NodeJS.ProcessEnv {
    return Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
  }

  /** Runs the hook in a scratch repo with an npm that records instead of checking. */
  function push(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'quiz-hook-'));
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: dir, env: withoutGit(), encoding: 'utf8' }).trim();
    git('init', '-q', '-b', 'master');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'base');
    const base = git('rev-parse', 'HEAD');
    for (const [name, body] of Object.entries(files)) {
      execFileSync('mkdir', ['-p', join(dir, name, '..')]);
      writeFileSync(join(dir, name), body);
    }
    git('add', '-A');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'change');
    const head = git('rev-parse', 'HEAD');
    const bin = join(dir, 'bin');
    execFileSync('mkdir', ['-p', bin]);
    for (const tool of ['npm', 'npx']) {
      writeFileSync(join(bin, tool), `#!/bin/sh\necho ran >> "${join(dir, 'ran')}"\n`, { mode: 0o755 });
    }
    execFileSync('sh', [HOOK, 'origin', 'url'], {
      cwd: dir,
      env: { ...withoutGit(), PATH: `${bin}:${process.env.PATH ?? ''}`, SKIP_PREPUSH: '' },
      input: `refs/heads/x ${head} refs/heads/x ${base}\n`,
      encoding: 'utf8',
    });
    try {
      return readFileSync(join(dir, 'ran'), 'utf8');
    } catch {
      return '';
    }
  }

  test('a code change runs the checks', () => {
    expect(push({ 'src/a.ts': 'x' })).toContain('ran');
  });

  test('a docs-only change skips them', () => {
    expect(push({ 'docs/a.md': 'x', 'README.md': 'y' })).toBe('');
  });

  /*
    PROJ-97, 2 November 2026: a push from a linked worktree runs this file with
    the hook's absolute GIT_DIR in the environment. The scratch repo's `git init`
    followed it to the real repository and set core.bare, and every git command
    in the main checkout then refused. A repo of its own, with a linked worktree,
    stands in for the real one; the worktree's git dir is what the hook exports.
  */
  test('a GIT_DIR inherited from a worktree hook leaves the real repo alone', () => {
    const real = mkdtempSync(join(tmpdir(), 'quiz-real-'));
    const inReal = (...args: string[]) =>
      execFileSync('git', args, { cwd: real, env: withoutGit(), encoding: 'utf8' }).trim();
    inReal('init', '-q', '-b', 'master');
    inReal('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'real');
    inReal('worktree', 'add', '-q', join(real, 'wt'), '-b', 'side');
    const before = inReal('rev-parse', 'master');

    const held = process.env.GIT_DIR;
    process.env.GIT_DIR = join(real, '.git', 'worktrees', 'wt');
    try {
      expect(push({ 'src/a.ts': 'x' })).toContain('ran');
    } finally {
      if (held === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = held;
    }

    expect(inReal('config', 'core.bare')).toBe('false');
    expect(inReal('rev-parse', 'master')).toBe(before);
  });
});
