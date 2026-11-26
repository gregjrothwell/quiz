import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { setEmulatorFlag } from './emulators';
import { isolateFiles } from './isolate';
import { changeButton, houseLine, openPickers, packCard, setRound } from './lobby';
import { admin, until } from './nodeClient';

isolateFiles();

/**
 * The house round, through a real browser's storage: how this device ran its
 * last round is what its next room starts from, said in one line, and the round
 * that starts is the one the line said. docs/decisions/house-round.md.
 */

interface RoomDoc {
  phase: string;
  durationSecs: number;
  wagerEnabled: boolean;
  standoffEnabled: boolean;
  stealEnabled: boolean;
  doubleEnabled?: boolean;
  questions: unknown[];
}

async function readRoom(code: string): Promise<RoomDoc> {
  return (await admin().doc(`rooms/${code}`).get()).data() as RoomDoc;
}

/** Another visit by the same device: local storage is kept, and the tab is new. */
async function visit(device: BrowserContext): Promise<Page> {
  const page = await device.newPage();
  await setEmulatorFlag(page);
  await page.goto('./');
  return page;
}

async function newRoom(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Start a new room' }).click();
  const label = await page.getByLabel(/Room code [A-Z0-9]{4}/).getAttribute('aria-label');
  return (label ?? '').replace('Room code ', '');
}

async function start(host: Page, code: string): Promise<RoomDoc> {
  await packCard(host, 'General Knowledge').click();
  await host.getByRole('button', { name: 'Start the show' }).click();
  const titles = host.getByRole('button', { name: 'Start the round' });
  if (await titles.waitFor({ timeout: 5_000 }).then(() => true, () => false)) await titles.click();
  return until(() => readRoom(code), (room) => room.phase === 'question', 30_000);
}

async function device(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ viewport: { width: 1366, height: 768 } });
}

test('tomorrow’s room starts from today’s round, and plays what its line says', async ({ browser }) => {
  test.setTimeout(120_000);
  const laptop = await device(browser);

  // #given a brand-new device: the defaults, said before anything is chosen
  const today = await visit(laptop);
  await today.getByPlaceholder('e.g. Greg').fill('Host');
  const first = await newRoom(today);
  await expect(houseLine(today)).toHaveText('15 questions · 10 seconds · The Ladder · ends on the last answer');

  // #when the quizmaster changes four things and runs a round
  await setRound(today, { questions: 20, picks: ['15 seconds', 'Share or Shaft', 'The Double', 'First right answer steals'] });
  await expect(houseLine(today)).toHaveText(
    '20 questions this half · 15 seconds · The Ladder · The Double · ends on a final · first right answer steals',
  );
  const ran = await start(today, first);
  expect(ran).toMatchObject({ durationSecs: 17, standoffEnabled: true, stealEnabled: true, doubleEnabled: true });
  expect(ran.questions).toHaveLength(20);
  await today.close();

  // #then the next visit's room says the same again, with no pack chosen and no Double
  const tomorrow = await visit(laptop);
  const second = await newRoom(tomorrow);
  await expect(houseLine(tomorrow)).toHaveText(
    '20 questions · 15 seconds · The Ladder · ends on a final · first right answer steals',
  );
  await expect(tomorrow.locator('button.pack[aria-pressed="true"]')).toHaveCount(0);
  await expect(tomorrow.getByRole('button', { name: 'Start the show' })).toBeDisabled();
  await expect(changeButton(tomorrow)).toHaveAttribute('aria-expanded', 'false');

  // #and none of it is on the room until Start: a room is created as it always was
  expect(await readRoom(second)).toMatchObject({
    durationSecs: 10,
    wagerEnabled: false,
    standoffEnabled: false,
    stealEnabled: false,
  });

  // #and a player in it sees the vote, and no line and no Change
  const phone = await visit(await browser.newContext());
  await phone.getByPlaceholder('e.g. Greg').fill('Guest');
  await phone.getByPlaceholder('––––').fill(second);
  await phone.getByRole('button', { name: 'Join the round' }).click();
  await expect(phone.getByText('Vote for a set')).toBeVisible();
  await expect(houseLine(phone)).toHaveCount(0);
  await expect(changeButton(phone)).toHaveCount(0);

  // #when a pack is picked and Start pressed, and nothing else
  const again = await start(tomorrow, second);

  // #then the round is the one the line said
  expect(again).toMatchObject({ durationSecs: 17, standoffEnabled: true, wagerEnabled: false, stealEnabled: true });
  expect(again.doubleEnabled ?? false).toBe(false);
  expect(again.questions).toHaveLength(20);
});

test('a browser that keeps nothing, or keeps something stale, still opens on a lobby', async ({ browser }) => {
  // #given storage that throws, as a private window's can
  const locked = await device(browser);
  await locked.addInitScript(() => {
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = function getItem(key: string) {
      if (key === 'vibequiz.houseRound') throw new Error('access denied');
      return real.call(this, key);
    };
  });
  const page = await visit(locked);
  await page.getByPlaceholder('e.g. Greg').fill('Host');
  await newRoom(page);
  await expect(houseLine(page)).toHaveText('15 questions · 10 seconds · The Ladder · ends on the last answer');

  // #and a store from a build that offered other things, with a pack in it
  const stale = await device(browser);
  await stale.addInitScript(() => {
    localStorage.setItem(
      'vibequiz.houseRound',
      JSON.stringify({ count: 30, level: 'hard', durationSecs: 45, ending: 'stakes', packId: 'science', double: true }),
    );
  });
  const other = await visit(stale);
  await other.getByPlaceholder('e.g. Greg').fill('Host');
  await newRoom(other);

  // #then what is still offered is kept, and the rest is ignored
  await expect(houseLine(other)).toHaveText('15 questions · 10 seconds · The Ladder · ends on stakes');
  await expect(other.locator('button.pack[aria-pressed="true"]')).toHaveCount(0);
});

test('Change is a disclosure, and nothing moves under the pointer', async ({ browser }) => {
  const page = await visit(await device(browser));
  await page.getByPlaceholder('e.g. Greg').fill('Host');
  await newRoom(page);
  const change = changeButton(page);

  // #when it is opened and shut from the keyboard, it keeps the focus
  await change.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Set the level')).toBeVisible();
  await expect(change).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Set the level')).toBeHidden();
  await expect(change).toBeFocused();

  // #and by the mouse, it is still under the mouse
  const top = async (of: typeof change): Promise<number> =>
    of.evaluate((element) => element.getBoundingClientRect().top);
  await change.hover();
  await page.waitForTimeout(300);
  const shut = await top(change);
  const at = await change.boundingBox();
  if (!at) throw new Error('no Change on screen');
  await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
  await expect(page.getByText('Set the level')).toBeVisible();
  expect(Math.abs((await top(change)) - shut)).toBeLessThanOrEqual(1);

  // #and with the pickers open, the set that is pressed stays where it was pressed:
  // Survey Says takes four pickers out from above it, and Science puts them back
  await openPickers(page);
  for (const title of ['Science', 'Survey Says', 'Science', 'Fine Art', 'Theme Tunes']) {
    const card = packCard(page, title);
    await card.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 300));
    await card.hover();
    await page.waitForTimeout(300);
    const before = await top(card);
    const box = await card.boundingBox();
    if (!box) throw new Error(`no ${title} on screen`);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(Math.abs((await top(card)) - before), title).toBeLessThanOrEqual(1);
  }
});
