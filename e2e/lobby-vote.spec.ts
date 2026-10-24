import { expect, test, type Browser, type Page } from '@playwright/test';

import { setEmulatorFlag } from './emulators';
import { isolateFiles } from './isolate';

isolateFiles();

/**
 * The lobby vote, through the client's own path, against the repo's rules in
 * the emulator. This is the allow case: a vote written by somebody who is not
 * the quizmaster has to land on the room document and be counted on the
 * quizmaster's screen. See docs/decisions/lobby-vote.md.
 */

async function freshPlayer(browser: Browser, name: string): Promise<Page> {
  // A context each, so each is its own anonymous user.
  const page = await (await browser.newContext()).newPage();
  await setEmulatorFlag(page);
  await page.goto('./');
  await page.getByPlaceholder('e.g. Greg').fill(name);
  return page;
}

function packCard(page: Page, title: string) {
  return page.locator('button.pack', { has: page.locator('.pack__title', { hasText: title }) });
}

test('a player votes, the quizmaster sees it counted, and the room sees the highlight', async ({
  browser,
}) => {
  // #given a quizmaster with a room open
  const host = await freshPlayer(browser, 'Host');
  await host.getByRole('button', { name: 'Start a new room' }).click();
  const codeLabel = await host.getByLabel(/Room code [A-Z0-9]{4}/).getAttribute('aria-label');
  const code = codeLabel?.replace('Room code ', '') ?? '';
  expect(code).toMatch(/^[A-Z0-9]{4}$/);

  // #and a second player in it
  const guest = await freshPlayer(browser, 'Guest');
  await guest.getByPlaceholder('––––').fill(code);
  await guest.getByRole('button', { name: 'Join the round' }).click();
  await expect(guest.getByText('Vote for a set')).toBeVisible();

  // #when the guest votes for Sleeves
  await packCard(guest, 'Sleeves').click();

  // #then it is pressed on their screen and counted on the quizmaster's
  await expect(packCard(guest, 'Sleeves')).toHaveAttribute('aria-pressed', 'true');
  await expect(packCard(host, 'Sleeves')).toContainText('1 vote · top');

  // #when they change their mind
  await packCard(guest, 'Flags').click();

  // #then the vote moves rather than doubling
  await expect(packCard(host, 'Flags')).toContainText('1 vote · top');
  await expect(packCard(host, 'Sleeves')).not.toContainText('vote');

  // #then that was their second tap: the vote is locked and the cards stop taking more
  await expect(guest.getByText('Your vote is locked in.')).toBeVisible();
  await expect(packCard(guest, 'Sleeves')).toBeDisabled();

  // #when they reload, which used to hand out two more taps
  await guest.reload();

  // #then they are back in the lobby with the count read off the room: still locked
  await expect(guest.getByText('Vote for a set')).toBeVisible();
  await expect(guest.getByText('Your vote is locked in.')).toBeVisible();
  await expect(packCard(guest, 'Flags')).toHaveAttribute('aria-pressed', 'true');
  await expect(packCard(guest, 'Sleeves')).toBeDisabled();

  // #when the quizmaster highlights a pack
  await packCard(host, 'On the box').click();

  // #then the room is shown what is being considered
  await expect(packCard(guest, 'On the box')).toContainText('Quizmaster’s looking');
});
