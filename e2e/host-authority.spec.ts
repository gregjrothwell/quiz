import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { setEmulatorFlag } from './emulators';
import { isolateFiles } from './isolate';
import { admin, seedVault, until } from './nodeClient';

isolateFiles();

/**
 * W3 through the app itself: the creator runs the round (AC12), every device
 * sees who has answered (AC6), and when the host's tab closes mid-question the
 * longest-seated present player takes the chair, reveals the open question with
 * every answer counted, and moves on (AC8). Then every device shows every pick
 * (AC5). docs/decisions/host-authority.md.
 *
 * AC8 waits out the real 75 s claim threshold in `firestore.rules`, so this is
 * the slow test in the suite.
 */

async function seat(browser: Browser, name: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  // Each player's console errors land in the CI log, so a stall names its cause.
  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.log(`[${name}:${message.type()}] ${message.text()}`);
    }
  });
  await setEmulatorFlag(page);
  await page.goto('./');
  await page.getByPlaceholder('e.g. Greg').fill(name);
  return { context, page };
}

function packCard(page: Page, title: string) {
  return page.locator('button.pack', { has: page.locator('.pack__title', { hasText: title }) });
}

function lit(page: Page, name: string) {
  return page.locator('.lamp.lamp--in', { hasText: name });
}

interface RoomDoc {
  phase: string;
  index: number;
  hostUid?: string;
  players: Record<string, { name: string }>;
  scores: Record<string, number>;
}

async function readRoom(code: string): Promise<RoomDoc> {
  return (await admin().doc(`rooms/${code}`).get()).data() as RoomDoc;
}

function uidOf(room: RoomDoc, name: string): string {
  const found = Object.entries(room.players).find(([, player]) => player.name === name);
  if (!found) throw new Error(`${name} is not in the room`);
  return found[0];
}

test('the host vanishes mid-question and the room carries on', async ({ browser }) => {
  test.setTimeout(240_000);

  // #given a creator with a room, and two players in it, Ann seated first
  const host = await seat(browser, 'Host');
  await host.page.getByRole('button', { name: 'Start a new room' }).click();
  const label = await host.page.getByLabel(/Room code [A-Z0-9]{4}/).getAttribute('aria-label');
  const code = label?.replace('Room code ', '') ?? '';
  expect(code).toMatch(/^[A-Z0-9]{4}$/);

  const ann = await seat(browser, 'Ann');
  await ann.page.getByPlaceholder('––––').fill(code);
  await ann.page.getByRole('button', { name: 'Join the round' }).click();
  await expect(ann.page.getByText('Vote for a set')).toBeVisible();

  const bob = await seat(browser, 'Bob');
  await bob.page.getByPlaceholder('––––').fill(code);
  await bob.page.getByRole('button', { name: 'Join the round' }).click();
  await expect(bob.page.getByText('Vote for a set')).toBeVisible();

  // #then the creator is the host, on the room and on screen (AC12)
  const seated = await until(() => readRoom(code), (room) => Object.keys(room.players).length === 3);
  expect(seated.hostUid).toBe(uidOf(seated, 'Host'));
  await expect(ann.page.getByRole('button', { name: 'Start the show' })).toHaveCount(0);

  // #when the host starts a round
  // Twenty seconds rather than the default ten, so the host's own reveal cannot
  // beat the tab closing on a slow runner.
  await packCard(host.page, 'General Knowledge').click();
  await host.page.locator('button.pick', { hasText: 'Generous' }).click();
  await host.page.getByRole('button', { name: 'Start the show' }).click();
  // Nobody here has a season row, so the opening titles go up first (every
  // player a newcomer) and the round waits for the host's second press.
  await host.page.getByRole('button', { name: 'Start the round' }).click();
  await until(() => readRoom(code), (room) => room.phase === 'question');
  await seedVault(code);

  // #and both players answer the first question, A, which the seeded vault calls right
  for (const each of [ann, bob]) {
    await expect(each.page.locator('.podium')).toBeVisible();
    await each.page.keyboard.press('a');
  }

  // #then every device sees both lamps lit (AC6), Bob's included on Ann's screen
  await expect(lit(host.page, 'Ann')).toBeVisible();
  await expect(lit(host.page, 'Bob')).toBeVisible();
  await expect(lit(ann.page, 'Bob')).toBeVisible();
  await expect(lit(bob.page, 'Ann')).toBeVisible();

  // Where the room stands while the chair is empty, so a stall names its own
  // cause in the CI log beside each player's console (see `seat`).
  const closedAt = Date.now();
  const watch = setInterval(() => {
    void readRoom(code).then(
      (room) => {
        const host = room.hostUid ? (room.players[room.hostUid]?.name ?? room.hostUid) : 'none';
        console.log(`[room +${Math.round((Date.now() - closedAt) / 1000)}s] phase=${room.phase} index=${room.index} host=${host}`);
      },
      (cause: unknown) => console.log(`[room] read failed: ${String(cause)}`),
    );
  }, 5_000);

  // #when the host's tab closes before the clock runs out
  await host.context.close();

  // #then within about 90 s Ann, the longest-seated present player, has the
  // chair and the open question is revealed with both answers counted (AC8)
  try {
    await expect(ann.page.getByText(/^Correct · \+/)).toBeVisible({ timeout: 120_000 });
  } finally {
    clearInterval(watch);
  }
  const revealed = await until(() => readRoom(code), (room) => room.phase === 'reveal', 10_000);
  const annUid = uidOf(revealed, 'Ann');
  const bobUid = uidOf(revealed, 'Bob');
  expect(revealed.hostUid).toBe(annUid);
  expect(revealed.scores[annUid]).toBeGreaterThan(0);
  expect(revealed.scores[bobUid]).toBeGreaterThan(0);

  // #and every device shows every pick (AC5): Bob sees Ann's chip and his own verdict
  await expect(bob.page.getByText(/^Correct · \+/)).toBeVisible();
  await expect(bob.page.locator('.tile__name', { hasText: 'Ann' })).toBeVisible();
  await expect(ann.page.locator('.tile__name', { hasText: 'Bob' })).toBeVisible();

  // #and the round goes on under the new host
  await ann.page.keyboard.press(' ');
  await until(() => readRoom(code), (room) => room.phase === 'scoreboard', 10_000);
});

test('an ordinary hosted round: the creator reveals with every answer counted (AC12)', async ({ browser }) => {
  test.setTimeout(120_000);

  const host = await seat(browser, 'Host');
  await host.page.getByRole('button', { name: 'Start a new room' }).click();
  const label = await host.page.getByLabel(/Room code [A-Z0-9]{4}/).getAttribute('aria-label');
  const code = label?.replace('Room code ', '') ?? '';

  const ann = await seat(browser, 'Ann');
  await ann.page.getByPlaceholder('––––').fill(code);
  await ann.page.getByRole('button', { name: 'Join the round' }).click();
  await expect(ann.page.getByText('Vote for a set')).toBeVisible();

  await until(() => readRoom(code), (room) => Object.keys(room.players).length === 2);
  await packCard(host.page, 'General Knowledge').click();
  await host.page.getByRole('button', { name: 'Start the show' }).click();
  await host.page.getByRole('button', { name: 'Start the round' }).click();
  await until(() => readRoom(code), (room) => room.phase === 'question');
  await seedVault(code);

  await expect(ann.page.locator('.podium')).toBeVisible();
  await ann.page.keyboard.press('a');

  // The host's own device reveals when the clock runs out, as it does today.
  await expect(ann.page.getByText(/^Correct · \+/)).toBeVisible({ timeout: 60_000 });
  const revealed = await until(() => readRoom(code), (room) => room.phase === 'reveal', 10_000);
  expect(revealed.hostUid).toBe(uidOf(revealed, 'Host'));
  expect(revealed.scores[uidOf(revealed, 'Ann')]).toBeGreaterThan(0);
});
