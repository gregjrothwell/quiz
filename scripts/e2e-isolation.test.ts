import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { emulatorClearRequests } from '../e2e/clearEmulator';

/**
 * Every Playwright spec has to wipe the emulators before it registers a test.
 * A new file that forgets `isolateFiles()` is how the 22 Oct collision comes
 * back: CI runs the files one after another on one emulator.
 */

const SPECS = resolve(import.meta.dirname, '../e2e');

/** Why this file is not isolated, or null when the call lands in time. */
function isolationGap(text: string): string | null {
  const lines = text.split('\n');
  const call = lines.findIndex((line) => line === 'isolateFiles();');
  const registration = lines.findIndex((line) =>
    /^\s*test(\.(beforeAll|beforeEach|afterAll|afterEach|describe|skip|only|fixme))?\(/.test(line),
  );
  if (call === -1) return 'does not call isolateFiles()';
  if (registration !== -1 && call > registration) return 'isolateFiles() is registered after a test';
  return null;
}

describe('e2e specs start from an empty emulator', () => {
  const specs = readdirSync(SPECS).filter((name) => name.endsWith('.spec.ts'));

  test('there are specs to check, so a rename cannot quietly empty this suite', () => {
    expect(specs.length).toBeGreaterThan(4);
  });

  test.each(specs)('%s calls isolateFiles() before it registers a test', (name) => {
    const gap = isolationGap(readFileSync(resolve(SPECS, name), 'utf8'));
    expect(gap, name).toBeNull();
  });

  test('a spec that registers a test first is a gap, so this is not passing by accident', () => {
    expect(isolationGap("test('plays a round', () => {});\nisolateFiles();")).toBe(
      'isolateFiles() is registered after a test',
    );
    expect(isolationGap("test.beforeAll(() => {});\nisolateFiles();")).toBe(
      'isolateFiles() is registered after a test',
    );
    expect(isolationGap('// no call\n')).toBe('does not call isolateFiles()');
    expect(isolationGap("isolateFiles();\ntest.beforeAll(() => {});\ntest('plays', () => {});")).toBeNull();
  });

  test('the wipe covers Auth, Firestore and the RTDB namespace the clients use', () => {
    const requests = emulatorClearRequests();
    expect(requests.map((request) => new URL(request.url).port).sort()).toEqual(['8080', '9000', '9099']);
    expect(requests.some((request) => request.url.includes('/emulator/v1/projects/quiz-d686e/databases/(default)/documents'))).toBe(true);
    expect(requests.some((request) => request.url.includes('/emulator/v1/projects/quiz-d686e/accounts'))).toBe(true);
    const rtdb = requests.find((request) => request.url.endsWith('/.json?ns=quiz-d686e-default-rtdb'));
    expect(rtdb?.headers).toEqual({ Authorization: 'Bearer owner' });
  });
});
