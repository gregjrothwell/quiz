import { expect, test, type Page } from '@playwright/test';

import { readRoom, startRound, twoSeats } from './cannonRounds';
import { isolateFiles } from './isolate';
import { admin, until } from './nodeClient';

isolateFiles();

/**
 * The end of a round, the way a quizmaster and a player meet it
 * (docs/decisions/round-end.md): the lobby's own buttons, no room written by
 * hand. `double.spec.ts` writes the room directly, which is how Share or Shaft
 * going missing at half-time stayed hidden. Two whole halves and a final, so it
 * has a shard to itself. An ordinary round's way to the podium is every other
 * spec that plays to `finished`, and the unit cases in `src/engine/roundEnd.test.ts`.
 */

interface RoomExtras {
  standoff?: { stage?: string; finalists?: string[] } | null;
  standoffEnabled?: boolean;
  stealEnabled?: boolean;
}

/** Everybody presses A; the host moves it on, until `stop` says so. Records the phases the last question passed through. */
async function play(host: Page, pages: readonly Page[], code: string, stop: (phase: string) => boolean): Promise<string[]> {
  const lastQuestion: string[] = [];
  let answered = '';
  for (let tick = 0; tick < 900; tick += 1) {
    const room = await readRoom(code);
    if (stop(room.phase)) break;
    if (room.index === 9 && lastQuestion.at(-1) !== room.phase) lastQuestion.push(room.phase);
    const key = `${room.gameId}:${String(room.index)}`;
    if (room.phase === 'question' && answered !== key) {
      for (const page of pages) {
        await expect(page.locator('.podium')).toBeVisible();
        await page.keyboard.press('a');
        await page.keyboard.press('Enter');
      }
      answered = key;
    }
    const next = host.getByRole('button', { name: /Next question|Standings|Final results|Half-time|To Share or Shaft/ });
    if ((room.phase === 'reveal' || room.phase === 'scoreboard') && (await next.count()) > 0) {
      await next.first().click().catch(() => undefined);
    }
    await host.waitForTimeout(300);
  }
  return lastQuestion;
}

test('a double through the lobby: half-time is plain, the final is not lost, the ending is told once', async ({ browser }) => {
  test.setTimeout(600_000);

  const { host, other, code } = await twoSeats(browser);

  // #given the host picks Share or Shaft and The Double on the lobby's own buttons
  await startRound(host, code, ['The Double', 'Share or Shaft', 'First right answer steals']);

  // #when the first half is played
  const firstHalf = await play(host, [host, other], code, (phase) => phase === 'finished');

  // #then the last reveal goes straight to half-time, with no table before it
  expect(firstHalf).not.toContain('scoreboard');
  await expect(other.getByRole('heading', { name: /at half-time/ })).toBeVisible({ timeout: 30_000 });

  // #and half-time is the table and the way on, with the button on screen
  await expect(host.locator('.finale')).toHaveCount(0);
  await expect(host.getByRole('button', { name: 'Share the result' })).toHaveCount(0);
  await expect(host.getByRole('button', { name: 'Second half' })).toBeInViewport();

  // #when the second half's lobby opens, and nobody touches an option
  await host.getByRole('button', { name: 'Second half' }).click();
  await until(() => readRoom(code), (room) => room.phase === 'lobby' && room.double != null);

  // #then everything picked for the first half is still picked
  await expect(host.locator('button.pick', { hasText: 'Share or Shaft' })).toHaveAttribute('aria-pressed', 'true');
  await expect(host.locator('button.pick', { hasText: 'First right answer steals' })).toHaveAttribute('aria-pressed', 'true');
  await expect(host.locator('button.pick', { hasText: 'The Double' })).toBeDisabled();

  await startRound(host, code, []);
  const started = (await readRoom(code)) as unknown as RoomExtras;
  expect(started.standoffEnabled).toBe(true);
  expect(started.stealEnabled).toBe(true);

  // #when the second half is played
  const secondHalf = await play(host, [host, other], code, (phase) => phase === 'standoff' || phase === 'finished');

  // #then the table stands before the final, because that is who is about to play, and the final plays
  expect(secondHalf).toContain('scoreboard');
  expect((await readRoom(code)).phase).toBe('standoff');

  // #when both finalists share
  await host.getByRole('button', { name: 'Time to choose' }).click();
  await until(() => readRoom(code), (room) => (room as unknown as RoomExtras).standoff?.stage === 'pick');
  for (const page of [host, other]) await page.getByRole('button', { name: /^Share/ }).click();
  await until(
    () => readRoom(code),
    (room) => (room as unknown as RoomExtras).standoff?.stage === 'revealed',
    60_000,
  );
  await host.getByRole('button', { name: 'Final results' }).click();
  await until(() => readRoom(code), (room) => room.phase === 'finished');

  // #then the podium has already landed: no drum roll to wait out, the button is on screen at once
  await expect(host.getByRole('button', { name: 'Another round' })).toBeInViewport({ timeout: 2_000 });

  // #and there is one table, and it says what is in the second column
  await expect(other.locator('.double-table')).toHaveCount(1);
  await expect(other.getByRole('columnheader', { name: 'Second half + final' })).toBeVisible();

  // #and both halves were kept: half-time still banks, though it no longer looks like an ending
  const finished = await readRoom(code);
  await until(() => admin().doc(`games/${finished.gameId}`).get(), (kept) => kept.exists);

  // #when a player is reading the season table and the host starts the next round
  await other.getByRole('button', { name: 'Season table' }).click();
  await expect(other.getByRole('button', { name: /back/i }).first()).toBeVisible();
  await host.getByRole('button', { name: 'Another round' }).click();

  // #then the table gets out of the way: the player is back in the room to vote
  await expect(other.getByText('Vote for a set')).toBeVisible({ timeout: 15_000 });

  // #and the options carry into an ordinary round, with The Double off
  await expect(host.locator('button.pick', { hasText: 'Share or Shaft' })).toHaveAttribute('aria-pressed', 'true');
  await expect(host.locator('button.pick', { hasText: 'The Double' })).toHaveAttribute('aria-pressed', 'false');
});
