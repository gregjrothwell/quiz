import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test, type Browser, type Page } from '@playwright/test';

import { setEmulatorFlag } from './emulators';
import { admin, seedVault, until } from './nodeClient';

/**
 * Same writes (host-loop.md, B2): one hosted room, three players, a whole round
 * of ten questions and a Share or Shaft final, recorded as the sequence of
 * changes to `rooms/{code}` from the first question to the podium, plus what the
 * host kept in `games/` and its beat.
 *
 * The recording in `host-writes.golden.json` was taken on the code before the
 * host moved into `src/host/` (step 1). Step 2 moves it, and this test must still
 * match: nothing moved but the code.
 *
 * What is compared, and what is not. Each entry is one change the Admin SDK saw,
 * as the phase, question, stage of the final, and the fields that changed, with
 * their values made stable: timestamps, answer times (`elapsedMs`), the game id
 * and question ids are replaced by placeholders, uids by the player's name. Scores are kept: everyone
 * answers A, which the seeded vault calls right, in a fixed order a beat apart,
 * so the rank ladder pays the same every run. Which questions are dealt is
 * random, so their text and categories are not compared — the count is.
 *
 * The players are Hal, Ivy and Jo, not the Host, Ann and Bob other specs use:
 * this round banks season rows, and `survey-says` counts rows by those names.
 * In CI the files run one after another, and it found six.
 *
 * `RECORD_HOST_WRITES=1 npm run e2e -- host-writes` writes the recording afresh.
 * Only do that on code whose host is known good, and say so in the commit.
 */

const GOLDEN = resolve(import.meta.dirname, 'host-writes.golden.json');

interface Recording {
  writes: Entry[];
  game: { keys: string[]; questions: number; finished: boolean } | null;
  beat: boolean;
}

interface Entry {
  phase: string;
  index: number;
  stage: string | null;
  changed: Record<string, unknown>;
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

/**
 * A value with everything that differs between honest runs replaced: Firestore
 * timestamps and epoch-millisecond numbers, the game id, question ids, and uids.
 */
function stable(value: unknown, names: ReadonlyMap<string, string>, ids: ReadonlyMap<string, string>): unknown {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 1_000_000_000_000 ? '<time>' : value;
  if (typeof value === 'string') return names.get(value) ?? ids.get(value) ?? value;
  if (Array.isArray(value)) return value.map((each) => stable(each, names, ids));
  if (typeof value === 'object') {
    if ('toMillis' in value && typeof value.toMillis === 'function') return '<time>';
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      // How fast each player answered, measured on their own device and only
      // copied by the host. It moves by a few milliseconds between honest runs;
      // the scores it ranks are compared, and did not.
      out[names.get(key) ?? ids.get(key) ?? key] =
        key === 'elapsedMs' ? '<ms>' : stable((value as Record<string, unknown>)[key], names, ids);
    }
    return out;
  }
  return String(value);
}

/** The questions, reduced to what a run deals the same every time. */
function questionsShape(questions: unknown): unknown {
  if (!Array.isArray(questions)) return questions;
  return { count: questions.length, revealed: questions.filter((each) => (each as { correctIndex?: unknown }).correctIndex != null).length };
}

test('the host makes the same writes, start to podium, through a Share or Shaft final', async ({ browser }) => {
  test.setTimeout(420_000);

  const host = await seat(browser, 'Hal');
  await host.getByRole('button', { name: 'Start a new room' }).click();
  const code = ((await host.getByLabel(/Room code [A-Z0-9]{4}/).getAttribute('aria-label')) ?? '').replace('Room code ', '');
  expect(code).toMatch(/^[A-Z0-9]{4}$/);
  const ann = await seat(browser, 'Ivy');
  const bob = await seat(browser, 'Jo');
  for (const page of [ann, bob]) {
    await page.getByPlaceholder('––––').fill(code);
    await page.getByRole('button', { name: 'Join the round' }).click();
  }
  const seated = await until(
    () => admin().doc(`rooms/${code}`).get(),
    (snapshot) => Object.keys((snapshot.get('players') as Record<string, unknown> | undefined) ?? {}).length === 3,
  );
  const players = seated.get('players') as Record<string, { name: string }>;
  const names = new Map(Object.entries(players).map(([uid, player]) => [uid, `<${player.name}>`]));
  const pages = new Map<string, Page>([
    ['<Hal>', host],
    ['<Ivy>', ann],
    ['<Jo>', bob],
  ]);

  // The recorder: every change the Admin SDK sees, from here to the podium.
  const raw: Record<string, unknown>[] = [];
  const stop = admin()
    .doc(`rooms/${code}`)
    .onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (data) raw.push(data);
    });

  await host.locator('button.pack', { has: host.locator('.pack__title', { hasText: 'General Knowledge' }) }).click();
  await host.getByRole('button', { name: '10', exact: true }).click();
  await host.locator('button.pick', { hasText: '10 seconds' }).click();
  await host.locator('button.pick', { hasText: 'Share or Shaft' }).click();
  await host.getByRole('button', { name: 'Start the show' }).click();
  await host.getByRole('button', { name: 'Start the round' }).click();
  await until(() => admin().doc(`rooms/${code}`).get(), (snapshot) => snapshot.get('phase') === 'question');
  await seedVault(code);

  let answered = '';
  let picked = false;
  for (let tick = 0; tick < 900; tick += 1) {
    const room = (await admin().doc(`rooms/${code}`).get()).data() ?? {};
    const phase = String(room.phase);
    if (phase === 'finished') break;
    const key = `${String(room.gameId)}:${String(room.index)}`;

    // Everyone answers A, in the same order, a beat apart, once per question.
    if (phase === 'question' && answered !== key) {
      for (const page of [host, ann, bob]) {
        await expect(page.locator('.podium')).toBeVisible();
        await page.keyboard.press('a');
        await page.waitForTimeout(400);
      }
      answered = key;
    }

    // Both finalists share, so the whistle goes on "everyone in".
    const standoff = room.standoff as { stage?: string; finalists?: string[] } | null | undefined;
    if (phase === 'standoff' && standoff?.stage === 'pick' && !picked) {
      for (const uid of standoff.finalists ?? []) {
        const page = pages.get(names.get(uid) ?? '');
        if (!page) throw new Error(`no page for finalist ${uid}`);
        await page.getByRole('button', { name: /^Share/ }).click();
      }
      picked = true;
    }

    const next = host.getByRole('button', { name: /Next question|Standings|To Share or Shaft|Final results/ });
    if ((phase === 'reveal' || phase === 'scoreboard' || (phase === 'standoff' && standoff?.stage === 'revealed')) && (await next.count()) > 0) {
      await next.first().click().catch(() => undefined);
    }
    await host.waitForTimeout(400);
  }

  const finished = await until(() => admin().doc(`rooms/${code}`).get(), (snapshot) => snapshot.get('phase') === 'finished', 30_000);
  const gameId = String(finished.get('gameId'));
  const game = await until(() => admin().doc(`games/${gameId}`).get(), (snapshot) => snapshot.exists, 20_000);
  const beat = await admin().doc(`rooms/${code}/host/beat`).get();
  // Let the last snapshots land before the recorder stops.
  await host.waitForTimeout(1_000);
  stop();

  const questionIds = (finished.get('questions') as { id: string }[]).map((question, index) => [question.id, `<q${String(index)}>`] as const);
  const ids = new Map<string, string>([[gameId, '<game>'], ...questionIds]);

  // From the first question on: the lobby before it is the member side's.
  const start = raw.findIndex((data) => data.phase !== 'lobby');
  const writes: Entry[] = [];
  for (let at = Math.max(1, start); at < raw.length; at += 1) {
    const before = raw[at - 1] ?? {};
    const after = raw[at] ?? {};
    const changed: Record<string, unknown> = {};
    for (const field of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
      const was = field === 'questions' ? questionsShape(before[field]) : stable(before[field], names, ids);
      const now = field === 'questions' ? questionsShape(after[field]) : stable(after[field], names, ids);
      if (JSON.stringify(was) !== JSON.stringify(now)) changed[field] = now ?? '<deleted>';
    }
    if (Object.keys(changed).length === 0) continue;
    writes.push({
      phase: String(after.phase),
      index: Number(after.index),
      stage: (after.standoff as { stage?: string } | null | undefined)?.stage ?? null,
      changed,
    });
  }

  const recording: Recording = {
    writes,
    game: {
      keys: Object.keys(game.data() ?? {}).sort(),
      questions: (game.get('questions') as unknown[]).length,
      finished: true,
    },
    beat: beat.exists,
  };

  if (process.env.RECORD_HOST_WRITES === '1' || !existsSync(GOLDEN)) {
    writeFileSync(GOLDEN, `${JSON.stringify(recording, null, 2)}\n`);
    console.log(`recorded ${String(writes.length)} room writes to ${GOLDEN}`);
  }
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as Recording;
  expect(recording).toEqual(golden);
});
