import { expect, test, type Browser, type Page } from '@playwright/test';

import { setEmulatorFlag } from './emulators';
import { admin, until } from './nodeClient';

/**
 * A whole Survey Says round through the app (V2), and the proof that it needs
 * no rules change (R1): every reveal is the host's ordinary room write.
 *
 * Part one, Host and Ann tell A and Bob tells B, so A is the room's answer.
 * Part two, Host and Bob guess A and Ann guesses B. docs/decisions/survey-says.md.
 */

interface RoomDoc {
  phase: string;
  index: number;
  players: Record<string, { name: string }>;
  scores: Record<string, number>;
  lastPicks?: Record<string, unknown>;
  questions: { survey?: { part: 'tell' | 'guess'; top?: number[]; counts?: number[] } }[];
}

async function readRoom(code: string): Promise<RoomDoc> {
  return (await admin().doc(`rooms/${code}`).get()).data() as RoomDoc;
}

async function seat(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('403')) console.log(`[${name}] ${message.text()}`);
  });
  await setEmulatorFlag(page);
  await page.goto('./');
  await page.getByPlaceholder('e.g. Greg').fill(name);
  return page;
}

test('a Survey Says round: the room is the answer, start to podium', async ({ browser }) => {
  test.setTimeout(300_000);

  const host = await seat(browser, 'Host');
  await host.getByRole('button', { name: 'Start a new room' }).click();
  const code = ((await host.getByLabel(/Room code [A-Z0-9]{4}/).getAttribute('aria-label')) ?? '').replace('Room code ', '');
  const ann = await seat(browser, 'Ann');
  const bob = await seat(browser, 'Bob');
  for (const page of [ann, bob]) {
    await page.getByPlaceholder('––––').fill(code);
    await page.getByRole('button', { name: 'Join the round' }).click();
  }
  await until(() => readRoom(code), (room) => Object.keys(room.players).length === 3);

  await host.locator('button.pack', { has: host.locator('.pack__title', { hasText: 'Survey Says' }) }).click();
  await expect(host.getByText('Survey Says is always ten questions')).toBeVisible();
  await host.getByRole('button', { name: 'Start the show' }).click();
  await host.getByRole('button', { name: 'Start the round' }).click();
  await until(() => readRoom(code), (room) => room.phase === 'question');

  const picks = { tell: { host: 'a', ann: 'a', bob: 'b' }, guess: { host: 'a', ann: 'b', bob: 'a' } } as const;
  let sawBarsOnMember = false;
  let tellPicksPublished = false;

  for (let tick = 0; tick < 400; tick += 1) {
    const room = await readRoom(code);
    if (room.phase === 'finished') break;
    const part = room.questions[room.index]?.survey?.part;

    if (room.phase === 'question' && part) {
      await host.keyboard.press(picks[part].host);
      await ann.keyboard.press(picks[part].ann);
      await bob.keyboard.press(picks[part].bob);
    }
    if (room.phase === 'reveal' && part === 'tell' && Object.keys(room.lastPicks ?? {}).length > 0) {
      tellPicksPublished = true;
    }
    // The counts land once the reveal has settled, so wait for them on a guess
    // rather than racing the host's Next past them.
    if (room.phase === 'reveal' && part === 'guess' && !sawBarsOnMember) {
      sawBarsOnMember = await ann
        .getByText('2 said this')
        .waitFor({ timeout: 8_000 })
        .then(() => true, () => false);
    }

    const next = host.getByRole('button', { name: /Next question|Standings|To Share or Shaft|Final results/ });
    if (room.phase !== 'question' && (await next.count()) > 0) await next.first().click().catch(() => undefined);
    await host.waitForTimeout(500);
  }

  const room = await until(() => readRoom(code), (state) => state.phase === 'finished', 30_000);
  const uidOf = (name: string): string =>
    Object.entries(room.players).find(([, player]) => player.name === name)?.[0] ?? '';

  // R1: every guess was revealed with the room's answer, by the host's own write.
  const guesses = room.questions.filter((question) => question.survey?.part === 'guess');
  expect(guesses).toHaveLength(5);
  for (const guess of guesses) {
    expect(guess.survey?.top).toEqual([0]);
    expect(guess.survey?.counts).toEqual([2, 1, 0, 0]);
  }

  // T2/T3: part one scored nobody and published nobody's pick.
  expect(tellPicksPublished).toBe(false);
  // G1/G4: right guessers scored, the wrong one did not.
  expect(room.scores[uidOf('Host')]).toBeGreaterThan(0);
  expect(room.scores[uidOf('Bob')]).toBeGreaterThan(0);
  expect(room.scores[uidOf('Ann')]).toBe(0);
  // G5: a member saw what the office said, on the lecterns.
  expect(sawBarsOnMember).toBe(true);

  // The podium, and everyone's round banked.
  await expect(host.locator('.finale')).toBeVisible({ timeout: 20_000 });
  const rows = await until(
    () => admin().collection('seasons/season-2/players').get(),
    (snapshot) => snapshot.docs.filter((row) => ['Host', 'Ann', 'Bob'].includes(String(row.get('name')))).length === 3,
    20_000,
  );
  expect(rows.size).toBeGreaterThanOrEqual(3);
});
