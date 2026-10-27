import { expect, test, type Browser, type Page } from '@playwright/test';

import { setEmulatorFlag } from './emulators';
import { isolateFiles } from './isolate';
import { admin, seedVault, until } from './nodeClient';

isolateFiles();

/**
 * The Commentator through the app (docs/decisions/commentator.md, M3–M4):
 * the same caption on every screen, and no voice anywhere — speech came out on
 * 22 October 2026.
 *
 * Speech is recorded rather than heard. Each tab's `speechSynthesis` is the
 * stuck queue from room 5SVU (PROJ-59, `createStuckQueue`): a finished line
 * stays paused, `cancel()` does nothing while it is, and the next `speak()`
 * plays that line again before the new one. What was heard is kept on the
 * page as `__spoken`. The voice stays off unless `window.__commentarySpeech`
 * is set before load — this spec does not set it, so no tab speaks.
 *
 * The seeded vault calls A right. Question one nobody gets; question two
 * only Fen gets; the rest everybody gets. Fen, Gil and Hux have no season row
 * yet, so the winner's line is a debut.
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
  await page.addInitScript(() => {
    // Same queue as `createStuckQueue` in src/lib/commentarySpeech.ts. Kept
    // inline because an init script cannot import the module. A finished line
    // stays paused; cancel is a no-op while it is; the next speak hears it again.
    const heard: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = heard;
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    let paused = false;
    let queued: string[] = [];
    const speak = (utterance: SpeechSynthesisUtterance): void => {
      if (paused && queued.length > 0) {
        paused = false;
        for (const line of queued) heard.push(line);
        queued = [];
      }
      heard.push(utterance.text);
      queued = [utterance.text];
      paused = true;
    };
    synth.speak = speak;
    try {
      synth.cancel = () => {
        if (paused) return;
        queued = [];
      };
    } catch {
      // A locked cancel leaves the native one. Speech is off in this spec.
    }
    try {
      synth.resume = () => {
        paused = false;
      };
    } catch {
      // As for cancel.
    }
    try {
      Object.defineProperty(synth, 'paused', { configurable: true, get: () => paused });
    } catch {
      // Native `paused` stays. The unit test is what fails if the flush goes.
    }
  });
  await setEmulatorFlag(page);
  await page.goto('./');
  await page.getByPlaceholder('e.g. Greg').fill(name);
  return page;
}

const spokenOn = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);

test('the Commentator: one caption on every screen, and no voice', async ({ browser }) => {
  test.setTimeout(420_000);

  const host = await seat(browser, 'Fen');
  await host.getByRole('button', { name: 'Start a new room' }).click();
  const code = ((await host.getByLabel(/Room code [A-Z0-9]{4}/).getAttribute('aria-label')) ?? '').replace('Room code ', '');
  const gil = await seat(browser, 'Gil');
  const hux = await seat(browser, 'Hux');
  for (const page of [gil, hux]) {
    await page.getByPlaceholder('––––').fill(code);
    await page.getByRole('button', { name: 'Join the round' }).click();
  }
  await until(() => readRoom(code), (room) => Object.keys(room.players).length === 3);

  await host.locator('button.pack', { has: host.locator('.pack__title', { hasText: 'General Knowledge' }) }).click();
  await host.getByRole('button', { name: '10', exact: true }).click();
  await host.locator('button.pick', { hasText: '10 seconds' }).click();
  await host.getByRole('button', { name: 'Start the show' }).click();
  await host.getByRole('button', { name: 'Start the round' }).click();
  await until(() => readRoom(code), (room) => room.phase === 'question');
  await seedVault(code);

  const captions = { host: new Set<string>(), gil: new Set<string>() };
  let answered = '';
  for (let tick = 0; tick < 900; tick += 1) {
    const room = await readRoom(code);
    if (room.phase === 'finished') break;
    const key = `${room.gameId}:${String(room.index)}`;
    if (room.phase === 'question' && answered !== key) {
      const keys = room.index === 0 ? ['b', 'c', 'd'] : room.index === 1 ? ['a', 'b', 'c'] : ['a', 'a', 'a'];
      for (const [i, page] of [host, gil, hux].entries()) {
        await expect(page.locator('.podium')).toBeVisible();
        await page.keyboard.press(keys[i] ?? 'a');
      }
      answered = key;
    }
    if (room.phase === 'reveal' || room.phase === 'scoreboard') {
      for (const [who, page] of [['host', host], ['gil', gil]] as const) {
        const line = page.locator('.commentary');
        if (await line.first().waitFor({ timeout: 6_000 }).then(() => true, () => false)) {
          captions[who].add(`${room.phase}:${(await line.first().textContent()) ?? ''}`);
        }
      }
    }
    const next = host.getByRole('button', { name: /Next question|Standings|Final results/ });
    if ((room.phase === 'reveal' || room.phase === 'scoreboard') && (await next.count()) > 0) {
      await next.first().click().catch(() => undefined);
    }
    await host.waitForTimeout(300);
  }
  await until(() => readRoom(code), (room) => room.phase === 'finished', 30_000);

  // M1/M4: the facts, as captions on a member's screen.
  const seen = [...captions.gil].join('\n');
  expect(seen).toMatch(/reveal:(Nobody got that|A clean sweep|Silence in the studio|That one beat)/);
  expect(seen).toMatch(/reveal:.*Fen/);
  expect(seen).toMatch(/reveal:(Everybody got that|Full marks|A clean sheet)/);

  // M3: the host's screen said the same as the member's, moment for moment.
  expect([...captions.host].sort()).toEqual([...captions.gil].sort());

  // The podium: three newcomers, so the winner's is a debut.
  await expect(gil.locator('.commentary')).toHaveText(/First round, first win|one round played, one round won/, { timeout: 20_000 });

  // No voice: captions only since 22 October, so no tab spoke, the host's
  // included.
  expect(await spokenOn(host)).toEqual([]);
  expect(await spokenOn(gil)).toEqual([]);
  expect(await spokenOn(hux)).toEqual([]);
});
