import { expect, test } from '@playwright/test';

import { doubleNew, playToFinal, readRoom, startRound, twoSeats } from './cannonRounds';
import { isolateFiles } from './isolate';
import { until } from './nodeClient';

isolateFiles();

/**
 * The Slop Cannon's E4 (docs/decisions/slop-cannon.md): the Double is asked
 * about at the end of the morning, never at half-time. Its own file, and so
 * its own CI shard, because it plays two whole rounds (~4 min) — beside the
 * rest of `slop-cannon.spec.ts` it made the slowest shard 472s.
 */

test('E4: a plain half-time asks nothing; the Double is asked at the end of the morning', async ({ browser }) => {
  test.setTimeout(600_000);

  const { host, other, code } = await twoSeats(browser);

  // Round one: the Double and nothing else — so nothing is asked at half-time.
  await startRound(host, code, ['The Double']);
  expect((await readRoom(code)).cannon).toBeUndefined();
  await playToFinal(host, [host, other], code);
  await expect(other.locator('.finale')).toBeVisible({ timeout: 30_000 });
  await expect(host.getByRole('button', { name: 'Second half' })).toBeVisible({ timeout: 30_000 });
  await expect(other.locator('.cannon')).toHaveCount(0);

  // Round two: the end of the morning.
  await host.getByRole('button', { name: 'Second half' }).click();
  await until(() => readRoom(code), (room) => room.phase === 'lobby' && room.double != null);
  await startRound(host, code, []);
  expect((await readRoom(code)).cannon).toEqual(doubleNew ? { 'mode-double': true } : undefined);
  await playToFinal(host, [host, other], code);
  if (doubleNew) {
    await expect(other.locator('.cannon__row .lamp--label')).toHaveText(['The Double'], { timeout: 30_000 });
  } else {
    await expect(other.locator('.finale')).toBeVisible({ timeout: 30_000 });
    await expect(other.locator('.cannon')).toHaveCount(0);
  }
});
