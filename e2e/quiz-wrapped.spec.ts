import { expect, test, type Browser, type Page } from '@playwright/test';

import { setEmulatorFlag } from './emulators';
import { isolateFiles } from './isolate';
import { admin } from './nodeClient';

isolateFiles();

/**
 * Quiz Wrapped through the app (docs/decisions/quiz-wrapped.md, W2, W4, W6):
 * a seeded season row, opened from the season board on 6 December, all five
 * cards stepped through, at desktop and phone width. And on a day in October
 * the button is not there at all.
 *
 * The browser is pointed at the seeded row by the stored player id the app
 * reads (`identity.ts`), the same thing a recovery code sets.
 */

const SEASON = 'season-2';

function seasonRow(name: string, squad: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    team: squad, name, played: 24, wins: 3, points: 180_000, best: 14_200,
    fastest: 1, comeback: 0, loneWolf: 4, contrarian: 2,
    recent: [], form: 900_000, lastGame: 'seed', lastPlayed: 1_792_400_200_995,
    finals: 3, shared: 2, shafted: 1, gotShafted: 1,
    ...extra,
  };
}

async function open(browser: Browser, playerId: string, at: Date, width: number): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.clock.install({ time: at });
  await page.clock.resume();
  await page.addInitScript((id) => window.localStorage.setItem('vibequiz.playerId', id), playerId);
  await setEmulatorFlag(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Season table' }).click();
  return page;
}

test('Quiz Wrapped: five cards from the season, from 5 December and not before', async ({ browser }) => {
  test.setTimeout(120_000);
  const id = `wrapped-${String(Date.now())}`;
  await admin().doc(`seasons/${SEASON}/players/${id}`).set(seasonRow('Wren Wrapped', 'Wrapsters'));
  await admin().doc(`seasons/${SEASON}/players/${id}-mate`).set(seasonRow('Mate', 'Wrapsters', { points: 120_000, form: 800_000 }));
  await admin().doc(`seasons/${SEASON}/players/${id}-rival`).set(seasonRow('Rival', 'Rivals', { points: 100_000, form: 700_000 }));

  // W4: in October the button is not there.
  const early = await open(browser, id, new Date('2026-10-23T10:00:00'), 1280);
  await expect(early.getByText('Wren Wrapped')).toBeVisible();
  await expect(early.getByRole('button', { name: 'Your Quiz Wrapped' })).toHaveCount(0);
  await early.context().close();

  for (const width of [1280, 375]) {
    const page = await open(browser, id, new Date('2026-12-06T10:00:00'), width);
    await page.getByRole('button', { name: 'Your Quiz Wrapped' }).click();

    // W1/W2: the five cards, in order, for this device's own row.
    const alts: string[] = [];
    for (let card = 1; card <= 5; card += 1) {
      await expect(page.getByText(`${String(card)} of 5`)).toBeVisible();
      const picture = page.locator('img.wrapped__card');
      await expect(picture).toHaveAttribute('alt', /.+/);
      alts.push((await picture.getAttribute('alt')) ?? '');
      await page.screenshot({ path: `test-results/quiz-wrapped-${String(width)}-${String(card)}.png`, fullPage: true });
      if (card < 5) {
        const before = alts[alts.length - 1];
        await page.getByRole('button', { name: 'Next' }).click();
        await expect(picture).not.toHaveAttribute('alt', before ?? '');
      }
    }
    expect(alts[0]).toMatch(/^Your season: 24 rounds\. 3 wins · 180,000 points · best round 14,200$/);
    expect(alts[1]).toMatch(/^Your thing: The only one who knew\. 4 times this season$/);
    expect(alts[2]).toMatch(/^Share or Shaft: 3 finals\. Shared 2 · shafted 1 · got shafted 1$/);
    expect(alts[3]).toMatch(/^Your squad: Wrapsters\. 1st of \d+ squads on average points$/);
    expect(alts[4]).toMatch(/^Where you finished: \d+(st|nd|rd|th)\. of \d+ on the season board/);
    await page.context().close();
  }
});
