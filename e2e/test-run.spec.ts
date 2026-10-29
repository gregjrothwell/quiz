import { expect, test, type Browser, type Page } from '@playwright/test';

import { weekId } from '../src/engine/week';
import { setEmulatorFlag } from './emulators';
import { isolateFiles } from './isolate';
import { admin, seedVault, until } from './nodeClient';

isolateFiles();

/**
 * A round seated only by test names stays off the season table, and is still
 * kept in `games/` (PROJ-74, docs/decisions/test-runs.md).
 *
 * The allow direction, a real table banking, is `survey-says.spec.ts`. This is
 * the other: before the fix both seats banked a row, which is how `CC test` and
 * `G TEST` reached the live board.
 */

interface RoomDoc {
  phase: string;
  index: number;
  gameId: string;
  players: Record<string, { name: string }>;
}

async function readRoom(code: string): Promise<RoomDoc> {
  return (await admin().doc(`rooms/${code}`).get()).data() as RoomDoc;
}

async function seat(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await setEmulatorFlag(page);
  await page.goto('./');
  await page.getByPlaceholder('e.g. Greg').fill(name);
  return page;
}

test('a table of test names is kept in games/, and banks nobody', async ({ browser }) => {
  test.setTimeout(300_000);

  const host = await seat(browser, 'CC test');
  await host.getByRole('button', { name: 'Start a new room' }).click();
  const code = ((await host.getByLabel(/Room code [A-Z0-9]{4}/).getAttribute('aria-label')) ?? '').replace('Room code ', '');
  const other = await seat(browser, 'Test Ann');
  await other.getByPlaceholder('––––').fill(code);
  await other.getByRole('button', { name: 'Join the round' }).click();
  await until(() => readRoom(code), (room) => Object.keys(room.players).length === 2);

  await host.locator('button.pack', { has: host.locator('.pack__title', { hasText: 'General Knowledge' }) }).click();
  await host.getByRole('button', { name: '10', exact: true }).click();
  await host.locator('button.pick', { hasText: '10 seconds' }).click();
  await host.getByRole('button', { name: 'Start the show' }).click();
  await host.getByRole('button', { name: 'Start the round' }).click();
  await until(() => readRoom(code), (room) => room.phase === 'question');
  await seedVault(code);

  let answered = '';
  for (let tick = 0; tick < 900; tick += 1) {
    const room = await readRoom(code);
    if (room.phase === 'finished') break;
    const key = `${room.gameId}:${String(room.index)}`;
    if (room.phase === 'question' && answered !== key) {
      for (const page of [host, other]) {
        await expect(page.locator('.podium')).toBeVisible();
        await page.keyboard.press('a');
      }
      answered = key;
    }
    const next = host.getByRole('button', { name: /Next question|Standings|Final results/ });
    if ((room.phase === 'reveal' || room.phase === 'scoreboard') && (await next.count()) > 0) {
      await next.first().click().catch(() => undefined);
    }
    await host.waitForTimeout(300);
  }
  const room = await until(() => readRoom(code), (state) => state.phase === 'finished', 30_000);
  await expect(host.locator('.finale')).toBeVisible({ timeout: 20_000 });

  // Kept: the host's record of the round landed.
  await until(() => admin().doc(`games/${room.gameId}`).get(), (snapshot) => snapshot.exists, 20_000);

  // Banked by nobody. The window is the one survey-says gives a real table to
  // bank in, so an empty result here is not just a slow write.
  const uids = Object.keys(room.players);
  await host.waitForTimeout(20_000);
  for (const bucket of ['season-2', weekId(new Date())]) {
    for (const uid of uids) {
      expect((await admin().doc(`seasons/${bucket}/players/${uid}`).get()).exists, `${bucket}/${uid}`).toBe(false);
    }
  }
});
