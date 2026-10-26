import { expect, type Browser, type Page } from '@playwright/test';

import { isNewMode, todayIso } from '../src/questions/newRounds';
import { setEmulatorFlag } from './emulators';
import { admin, seedVault, until } from './nodeClient';

/**
 * Whole rounds in the browser for the Slop Cannon specs
 * (docs/decisions/slop-cannon.md): two seats, a ten-question General Knowledge
 * round, everybody pressing A. Shared by `slop-cannon.spec.ts` and
 * `slop-cannon-double.spec.ts`, which are on separate CI shards because each
 * plays whole rounds (docs/decisions/emulators.md, 26 Oct).
 */

export interface RoomDoc {
  phase: string;
  index: number;
  gameId: string;
  cannon?: Record<string, true>;
  double?: unknown;
  players: Record<string, { name: string }>;
}

export async function readRoom(code: string): Promise<RoomDoc> {
  return (await admin().doc(`rooms/${code}`).get()).data() as RoomDoc;
}

export async function seat(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await setEmulatorFlag(page);
  await page.goto('./');
  await page.getByPlaceholder('e.g. Greg').fill(name);
  return page;
}

/** A room with a host and one player, both in the lobby. */
export async function twoSeats(browser: Browser): Promise<{ host: Page; other: Page; code: string }> {
  const host = await seat(browser, 'Ada');
  await host.getByRole('button', { name: 'Start a new room' }).click();
  const code = ((await host.getByLabel(/Room code [A-Z0-9]{4}/).getAttribute('aria-label')) ?? '').replace('Room code ', '');
  const other = await seat(browser, 'Bea');
  await other.getByPlaceholder('––––').fill(code);
  await other.getByRole('button', { name: 'Join the round' }).click();
  await until(() => readRoom(code), (room) => Object.keys(room.players).length === 2);
  return { host, other, code };
}

/** General Knowledge, ten questions, ten seconds, with the picks given, started. */
export async function startRound(host: Page, code: string, picks: readonly string[]): Promise<RoomDoc> {
  await host.locator('button.pack', { has: host.locator('.pack__title', { hasText: 'General Knowledge' }) }).click();
  await host.getByRole('button', { name: '10', exact: true }).click();
  await host.locator('button.pick', { hasText: '10 seconds' }).click();
  for (const pick of picks) await host.locator('button.pick', { hasText: pick }).click();
  await host.getByRole('button', { name: 'Start the show' }).click();
  const start = host.getByRole('button', { name: 'Start the round' });
  if (await start.waitFor({ timeout: 5_000 }).then(() => true, () => false)) await start.click();
  const room = await until(() => readRoom(code), (r) => r.phase === 'question', 30_000);
  await seedVault(code);
  return room;
}

/** Everybody presses A on every question; the host moves it on. Returns the finished room and what `watch` saw. */
export async function playToFinal(
  host: Page,
  pages: readonly Page[],
  code: string,
  watch: (room: RoomDoc) => Promise<void> = async () => undefined,
): Promise<RoomDoc> {
  let answered = '';
  for (let tick = 0; tick < 900; tick += 1) {
    const room = await readRoom(code);
    if (room.phase === 'finished') break;
    const key = `${room.gameId}:${String(room.index)}`;
    if (room.phase === 'question' && answered !== key) {
      for (const page of pages) {
        await expect(page.locator('.podium')).toBeVisible();
        await page.keyboard.press('a');
      }
      answered = key;
    }
    await watch(room);
    const next = host.getByRole('button', { name: /Next question|Standings|Final results/ });
    if ((room.phase === 'reveal' || room.phase === 'scoreboard') && (await next.count()) > 0) {
      await next.first().click().catch(() => undefined);
    }
    await host.waitForTimeout(300);
  }
  return until(() => readRoom(code), (room) => room.phase === 'finished', 30_000);
}

export function uidOf(room: RoomDoc, name: string): string {
  return Object.entries(room.players).find(([, seat]) => seat.name === name)?.[0] ?? '';
}

/*
  E1 depends on the date: Mr Fries wears his sticker to 5 November 2026 and
  the Double to 8 November. These cases assert what today should do, so after
  those dates they prove the other direction — nothing asked — and the unit
  tests in `src/engine/cannon.test.ts` hold the boundary itself.
*/
export const today = todayIso();
export const chaserNew = isNewMode('chaser', today);
export const doubleNew = isNewMode('double', today);
