import { expect, test } from '@playwright/test';

import { answersLanded } from './answers';
import { readRoom, startRound, twoSeats, uidOf } from './cannonRounds';
import { isolateFiles } from './isolate';
import { admin, until } from './nodeClient';

isolateFiles();

/**
 * Your own line on the reveal, and the table at the breaks (PROJ-182), through
 * the app and the rules as published. One press opens the next question straight
 * from the reveal; the table comes when somebody asks for it and after question
 * five, and nowhere else; what the line says is what the table then says. And the
 * two things that only a real browser can lose now the screen stays up: the
 * keyboard after a mouse press on Next, and a phone's place on the page.
 * docs/decisions/reveal-line.md.
 */

test('the next question opens from the reveal, and the table comes at the break', async ({ browser }) => {
  test.setTimeout(300_000);

  const { host, other: bea, code } = await twoSeats(browser);
  await bea.setViewportSize({ width: 375, height: 812 });
  const started = await startRound(host, code, []);
  const hostUid = uidOf(started, 'Ada');

  // Every phase the room passes through, as the server has it.
  const walked: string[] = [];
  const stop = admin()
    .doc(`rooms/${code}`)
    .onSnapshot((snapshot) => {
      const step = `${String(snapshot.get('phase'))} ${String(Number(snapshot.get('index')) + 1)}`;
      if (walked.at(-1) !== step) walked.push(step);
    });

  const lineOn = (page: typeof host) => page.locator('.ownline--in');
  const reveals = (number: number) =>
    until(() => readRoom(code), (room) => room.phase === 'reveal' && room.index === number - 1, 60_000);
  const opens = (number: number) =>
    until(() => readRoom(code), (room) => room.phase === 'question' && room.index === number - 1, 20_000);

  try {
    // #given question one, which Bea gets and Ada does not
    await opens(1);
    await Promise.all([answersLanded(host), answersLanded(bea)]);
    await bea.keyboard.press('a');
    await bea.keyboard.press('Enter');
    await host.keyboard.press('b');
    await host.keyboard.press('Enter');

    // #then the reveal places each of them, and moves nobody: there was no table before it
    await reveals(1);
    await expect(lineOn(bea)).toHaveText('1st', { timeout: 20_000 });
    await expect(lineOn(host)).toHaveText('2nd', { timeout: 20_000 });

    // #when the phone has scrolled to the lecterns, and Ada clicks Next with the mouse
    await bea.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await host.getByRole('button', { name: 'Next question' }).click();
    await opens(2);

    // #then the phone is at the top of the new question
    await expect.poll(() => bea.evaluate(() => window.scrollY)).toBe(0);

    // #and Ada's keyboard still answers: focus did not stay on a button that went dead
    await Promise.all([answersLanded(host), answersLanded(bea)]);
    await host.keyboard.press('a');
    await host.keyboard.press('Enter');
    await until(
      () => admin().doc(`rooms/${code}/answers/${hostUid}`).get(),
      (snapshot) => snapshot.get('questionIndex') === 1,
      10_000,
    );

    // #then Ada has drawn level
    await reveals(2);
    await expect(lineOn(host)).toHaveText('joint 1st, up one', { timeout: 20_000 });
    await expect(lineOn(bea)).toHaveText('still joint 1st', { timeout: 20_000 });

    // #when the room asks for the table, it says what the lines said
    await host.getByRole('button', { name: 'Show the table' }).click();
    await expect(bea.getByRole('heading', { name: 'Standings' })).toBeVisible();
    await expect(bea.locator('.standing__pos')).toHaveText(['1', '1']);
    await host.getByRole('button', { name: 'Next question' }).click();

    // #and three more go by, one press each
    for (const number of [3, 4]) {
      await opens(number);
      await reveals(number);
      await host.getByRole('button', { name: 'Next question' }).click();
    }

    // #then question five is a break: the press is the table, for everybody
    await opens(5);
    await reveals(5);
    await expect(host.getByRole('button', { name: 'Show the table' })).toHaveCount(0);
    await expect(bea.getByText('Waiting for the quizmaster to show the standings…')).toBeVisible();
    await host.getByRole('button', { name: 'Standings' }).click();
    await expect(bea.getByRole('heading', { name: 'Question Six' })).toBeVisible();
    await host.getByRole('button', { name: 'Next question' }).click();
    await opens(6);

    // #and those two tables are the only ones there were
    await expect.poll(() => walked.filter((step) => step.startsWith('scoreboard'))).toEqual(['scoreboard 2', 'scoreboard 5']);
  } finally {
    stop();
  }
});
