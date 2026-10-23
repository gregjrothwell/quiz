import { expect, test, type Browser, type Page } from '@playwright/test';

import { chaserResult, chaserScore, friesPick } from '../src/engine/chaser';
import { isNewMode, todayIso } from '../src/questions/newRounds';
import type { QuizQuestion } from '../src/engine/state';
import { setEmulatorFlag } from './emulators';
import { admin, seedVault, until } from './nodeClient';

/**
 * Beat the Chaser through the app (docs/decisions/beat-the-chaser.md, C6–C7):
 * a whole round against Mr Fries, under the repo's own rules. Two of three
 * answer A, which the seeded vault calls right, so the room takes every
 * question; Mr Fries's every pick must match a recomputation from the game,
 * the question and the rate dealt with it.
 *
 * Off (C5) is `host-writes.spec.ts`: its recording must still match.
 * Players are Cora, Dev and Eli, names no other spec banks.
 */

interface RoomDoc {
  phase: string;
  index: number;
  gameId: string;
  chaserEnabled: boolean;
  chaserIntro?: { at: number; durationSecs: number } | null;
  /** The host's clock when it opened the question. Same clock as `chaserIntro.at`. */
  questionOpenedAt?: number | null;
  players: Record<string, { name: string }>;
  questions: QuizQuestion[];
}

async function readRoom(code: string): Promise<RoomDoc> {
  return (await admin().doc(`rooms/${code}`).get()).data() as RoomDoc;
}

async function seat(
  browser: Browser,
  name: string,
  viewport?: { width: number; height: number },
): Promise<Page> {
  const page = await (await browser.newContext(viewport ? { viewport } : {})).newPage();
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('403')) console.log(`[${name}] ${message.text()}`);
  });
  await setEmulatorFlag(page);
  await page.goto('./');
  await page.getByPlaceholder('e.g. Greg').fill(name);
  return page;
}

test('a round against Mr Fries: his picks recompute, the room takes what it should', async ({ browser }) => {
  test.setTimeout(420_000);

  const host = await seat(browser, 'Cora');
  await host.getByRole('button', { name: 'Start a new room' }).click();
  const code = ((await host.getByLabel(/Room code [A-Z0-9]{4}/).getAttribute('aria-label')) ?? '').replace('Room code ', '');
  const dev = await seat(browser, 'Dev');
  const eli = await seat(browser, 'Eli', { width: 375, height: 812 });
  for (const page of [dev, eli]) {
    await page.getByPlaceholder('––––').fill(code);
    await page.getByRole('button', { name: 'Join the round' }).click();
  }
  await until(() => readRoom(code), (room) => Object.keys(room.players).length === 3);

  await host.locator('button.pack', { has: host.locator('.pack__title', { hasText: 'General Knowledge' }) }).click();
  await host.getByRole('button', { name: '10', exact: true }).click();
  await host.locator('button.pick', { hasText: '10 seconds' }).click();
  await host.locator('button.pick', { hasText: 'Against Mr Fries' }).click();
  await host.getByRole('button', { name: 'Start the show' }).click();
  await host.getByRole('button', { name: 'Start the round' }).click();

  // The card is up for the whole room, and question one has not opened.
  // Next question is still there, so the quizmaster can skip the wait.
  const holding = await until(
    () => readRoom(code),
    (room) => room.phase === 'lobby' && typeof room.chaserIntro?.at === 'number',
  );
  const cardAt = holding.chaserIntro?.at;
  if (cardAt === undefined) throw new Error('expected Mr Fries\'s card');
  await Promise.all([
    expect(host.getByRole('heading', { name: /Against Mr Fries/ })).toBeVisible(),
    expect(eli.getByRole('heading', { name: /Against Mr Fries/ })).toBeVisible(),
  ]);
  await expect(eli.getByText(/whole office vs the house/i)).toBeVisible();
  await expect(eli.getByText(/Get ready — question one is coming up/)).toBeVisible();
  await expect(eli.getByText(/Waiting for the quizmaster/)).toHaveCount(0);
  await expect(host.getByRole('button', { name: 'Next question' })).toBeVisible();
  expect(holding.chaserEnabled).toBe(true);
  if (isNewMode('chaser', todayIso())) {
    await expect(eli.locator('.card .new-sticker')).toHaveText('New');
  }
  const fitOf = async (page: Page) =>
    page.evaluate(() => {
      const overflow = (selector: string): number => {
        const el = document.querySelector(selector);
        return el ? el.scrollWidth - el.clientWidth : 999;
      };
      return {
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        title: overflow('.card__round'),
        topic: overflow('.card__topic'),
      };
    });
  const fit = await fitOf(eli);
  expect(fit.page).toBeLessThanOrEqual(1);
  expect(fit.title).toBeLessThanOrEqual(1);
  expect(fit.topic).toBeLessThanOrEqual(1);

  // The quizmaster's phone, button included. Restored afterwards so the rest
  // of the round is the viewport this spec has always used.
  await host.setViewportSize({ width: 375, height: 812 });
  const hostFit = await fitOf(host);
  expect(hostFit.page).toBeLessThanOrEqual(1);
  expect(hostFit.title).toBeLessThanOrEqual(1);
  expect(hostFit.topic).toBeLessThanOrEqual(1);
  await host.setViewportSize({ width: 1280, height: 720 });

  // Nobody taps. The host opens question one about three seconds after the card.
  const started = await until(() => readRoom(code), (room) => room.phase === 'question', 8_000);
  const openedAt = started.questionOpenedAt;
  if (typeof openedAt !== 'number') throw new Error('expected the question to carry questionOpenedAt');
  const waited = openedAt - cardAt;
  expect(waited).toBeGreaterThanOrEqual(2_500);
  expect(waited).toBeLessThan(5_000);
  expect(started.questions.every((question) => typeof question.chaserRate === 'number')).toBe(true);
  await expect(host.getByRole('heading', { name: /Against Mr Fries/ })).toHaveCount(0);
  await expect(host.getByRole('timer')).toHaveAttribute('aria-label', /^(9|10) seconds remaining$/);

  await seedVault(code);

  let answered = '';
  let sawLine = false;
  for (let tick = 0; tick < 900; tick += 1) {
    const room = await readRoom(code);
    if (room.phase === 'finished') break;
    const key = `${room.gameId}:${String(room.index)}`;
    if (room.phase === 'question' && answered !== key) {
      for (const [page, letter] of [[host, 'a'], [dev, 'a'], [eli, 'b']] as const) {
        await expect(page.locator('.podium')).toBeVisible();
        await page.keyboard.press(letter);
      }
      answered = key;
    }
    if (room.phase === 'reveal' && !sawLine) {
      sawLine = await eli.getByText(/^Mr Fries 🍟 said/).waitFor({ timeout: 8_000 }).then(() => true, () => false);
    }
    const next = host.getByRole('button', { name: /Next question|Standings|Final results/ });
    if ((room.phase === 'reveal' || room.phase === 'scoreboard') && (await next.count()) > 0) {
      await next.first().click().catch(() => undefined);
    }
    await host.waitForTimeout(400);
  }

  const ended = await until(() => readRoom(code), (room) => room.phase === 'finished', 30_000);

  // C1: every pick is the one the game, the question and its rate make.
  const revealed = ended.questions.filter((question) => question.correctIndex !== null);
  expect(revealed).toHaveLength(10);
  for (const question of revealed) {
    expect(question.chaser?.pick).toBe(
      friesPick(ended.gameId, question.id, question.chaserRate ?? -1, question.correctIndex ?? -1, question.options.length),
    );
    // C3: two of three right is more than half.
    expect(question.chaser?.roomTook).toBe(true);
  }

  // C4: on the reveal, and the result on the podium.
  expect(sawLine).toBe(true);
  const score = chaserScore(ended.questions);
  expect(score.room).toBe(10);
  await expect(host.getByText(`${chaserResult(score)} 🍟`)).toBeVisible({ timeout: 20_000 });
});
