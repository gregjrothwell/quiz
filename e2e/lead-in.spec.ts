import { expect, test, type Browser, type Page } from '@playwright/test';

import { answersLanded } from './answers';
import { setEmulatorFlag } from './emulators';
import { isolateFiles } from './isolate';
import { admin, seedVault, until } from './nodeClient';

isolateFiles();

/**
 * A question arrives before its answers do (PROJ-179), through the app and the
 * rules as published: the window on the room is the choice plus the lead-in, an
 * answer is refused by the screen until the answers land, they land on two
 * devices together, a full window's reveal opens the vault, and the time shown
 * at the end is the answering time. docs/decisions/question-lead-in.md.
 */

const LEAD_MS = 2_000;

async function seat(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await setEmulatorFlag(page);
  await page.goto('./');
  await page.getByPlaceholder('e.g. Greg').fill(name);
  return page;
}

/** When this page's first lectern became pressable, on this machine's clock. */
async function landedAt(page: Page): Promise<number> {
  await answersLanded(page);
  return page.evaluate(() => Date.now());
}

test('the answers land together, two seconds in, and the times shown leave it out', async ({ browser }) => {
  test.setTimeout(120_000);

  const host = await seat(browser, 'Host');
  await host.getByRole('button', { name: 'Start a new room' }).click();
  const label = await host.getByLabel(/Room code [A-Z0-9]{4}/).getAttribute('aria-label');
  const code = (label ?? '').replace('Room code ', '');
  const ann = await seat(browser, 'Ann');
  await ann.getByPlaceholder('––––').fill(code);
  await ann.getByRole('button', { name: 'Join the round' }).click();

  await host.locator('button.pack', { has: host.locator('.pack__title', { hasText: 'General Knowledge' }) }).click();
  await host.locator('button.pick', { hasText: '10 seconds' }).click();
  await host.getByRole('button', { name: 'Start the show' }).click();
  await host.getByRole('button', { name: 'Start the round' }).click();

  // #given question one open: the prompt is up and nothing can be pressed
  await expect(ann.locator('h1.prompt')).toBeVisible();
  await expect(ann.locator('button.tile--veiled')).toHaveCount(4);
  await expect(ann.getByRole('timer')).toHaveAttribute('aria-label', '10 seconds remaining');
  await ann.keyboard.press('a');
  await ann.keyboard.press('Enter');

  const opened = await until(() => admin().doc(`rooms/${code}`).get(), (snapshot) => snapshot.get('phase') === 'question');
  expect([opened.get('durationSecs'), opened.get('leadInSecs')]).toEqual([12, 2]);
  await seedVault(code);

  // #when the answers land, on both devices, and Ann locks one in
  const [onHost, onAnn] = await Promise.all([landedAt(host), landedAt(ann)]);
  expect(Math.abs(onHost - onAnn)).toBeLessThan(500);
  await expect(ann.locator('.tile--held')).toHaveCount(0);
  await ann.keyboard.press('a');
  await ann.keyboard.press('Enter');

  // #then it is stamped from the open, which is what the rules check
  const uid = Object.entries(opened.get('players') as Record<string, { name: string }>).find(
    ([, player]) => player.name === 'Ann',
  )?.[0];
  const answer = await until(
    () => admin().doc(`rooms/${code}/answers/${uid ?? ''}`).get(),
    (snapshot) => snapshot.exists && typeof snapshot.get('elapsedMs') === 'number',
  );
  const stamped = Number(answer.get('elapsedMs'));
  expect(stamped).toBeGreaterThanOrEqual(LEAD_MS);

  // #and the vault opens on the whole window and shows the answering time
  await expect(ann.getByText(/^Correct · \+/)).toBeVisible({ timeout: 40_000 });
  await expect(ann.locator('.tile__pick--you i')).toHaveText(`${((stamped - LEAD_MS) / 1000).toFixed(1)}s`);
});
