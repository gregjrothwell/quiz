import { expect, test, type Browser, type Page } from '@playwright/test';
import { get, ref, set } from 'firebase/database';

import { RIG_CUES, RIG_EVERY_MS, RIG_LEAD_MS, cueTimes, reportRig, rigRunFrom } from '../src/engine/rigProbe';
import { followRig } from '../src/lib/rigDevice';
import { setEmulatorFlag } from './emulators';
import { player, type Player } from './nodeClient';

/**
 * The rig probe (docs/decisions/rig-in-your-hand.md, P2 and P4).
 *
 * First the rules, both ways: a device may write its own paint and a run in its
 * own name, and nothing else. Then a real run on the emulator with eight Node
 * clients and three browser tabs, so that a bad number on a Friday is the
 * office's network and phones, not the probe.
 */

async function refused(write: Promise<unknown>): Promise<boolean> {
  return write.then(
    () => false,
    (cause: unknown) => /permission/i.test(String(cause)),
  );
}

test('the rig rules: your own paint and a run in your name, nothing else', async () => {
  const ann = await player();
  const bob = await player();
  const code = `R${String(Date.now()).slice(-3)}`;
  try {
    // #given allow cases first, so the denies below mean something
    await set(ref(ann.rtdb, `rig/${code}/run`), { id: 'run-1', startAt: Date.now(), by: ann.uid });
    await set(ref(ann.rtdb, `rig/${code}/paints/run-1/0/${ann.uid}`), Date.now());
    expect(rigRunFrom((await get(ref(bob.rtdb, `rig/${code}/run`))).val())?.by).toBe(ann.uid);

    // #then each of these is refused
    expect(await refused(set(ref(bob.rtdb, `rig/${code}/paints/run-1/0/${ann.uid}`), 1)), 'paint for someone else').toBe(true);
    expect(await refused(set(ref(ann.rtdb, `rig/${code}/paints/run-1/12/${ann.uid}`), 1)), 'a cue past 9').toBe(true);
    expect(await refused(set(ref(ann.rtdb, `rig/${code}/paints/run-1/0/${ann.uid}`), 'soon')), 'a paint that is not a number').toBe(true);
    expect(await refused(set(ref(bob.rtdb, `rig/${code}/run`), { id: 'x', startAt: 1, by: ann.uid })), 'a run in another name').toBe(true);
    expect(await refused(set(ref(ann.rtdb, `rig/${code}/run`), { id: 'x', startAt: 1, by: ann.uid, extra: 1 })), 'a run with extra fields').toBe(true);
  } finally {
    await ann.close();
    await bob.close();
  }
});

async function seat(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') console.log(`[${name}] ${message.text()}`);
  });
  await setEmulatorFlag(page);
  await page.goto('./');
  await page.getByPlaceholder('e.g. Greg').fill(name);
  return page;
}

test('a rig check run: eight Node clients and three browsers paint every cue', async ({ browser }) => {
  test.setTimeout(120_000);

  // #given a room in the browser, host and two players, in the lobby
  const host = await seat(browser, 'Rigger');
  await host.getByRole('button', { name: 'Start a new room' }).click();
  const code = ((await host.getByLabel(/Room code [A-Z0-9]{4}/).getAttribute('aria-label')) ?? '').replace('Room code ', '');
  const others: Page[] = [];
  for (const name of ['Wren', 'Yan']) {
    const page = await seat(browser, name);
    await page.getByPlaceholder('––––').fill(code);
    await page.getByRole('button', { name: 'Join the round' }).click();
    others.push(page);
  }
  await expect(host.getByText('Rig check', { exact: true })).toBeVisible();

  // #and eight Node devices following the room's runs, as a phone would
  const nodes: Player[] = await Promise.all(Array.from({ length: 8 }, () => player()));
  const stops = nodes.map((node) =>
    followRig(node.rtdb, code, node.uid, { onCue: () => undefined, afterPaint: (then) => setImmediate(then) }),
  );

  try {
    // #when the host runs the rig check
    await host.getByRole('button', { name: 'Run the rig check' }).click();
    await expect(others[0]!.getByText(/cue 1 of 10/)).toBeVisible({ timeout: RIG_LEAD_MS + 5_000 });
    await host.waitForTimeout(RIG_LEAD_MS + RIG_CUES * RIG_EVERY_MS + 2_000);

    // #then every cue was painted by all eleven devices
    const reader = nodes[0]!;
    const run = rigRunFrom((await get(ref(reader.rtdb, `rig/${code}/run`))).val());
    if (!run) throw new Error('no run');
    const raw = ((await get(ref(reader.rtdb, `rig/${code}/paints/${run.id}`))).val() ?? {}) as Record<string, Record<string, number>>;
    const painted = Object.fromEntries(Object.entries(raw).map(([cue, byUid]) => [Number(cue), byUid]));
    const report = reportRig(painted, cueTimes(run.startAt));
    console.log(
      report.cues.map((cue) => `cue ${String(cue.cue)}: ${String(cue.devices)} devices, spread ${String(Math.round(cue.spreadMs))} ms, late ${String(Math.round(cue.lateMs))} ms`).join('\n'),
    );
    expect(report.cues.map((cue) => cue.devices)).toEqual(Array.from({ length: RIG_CUES }, () => 11));

    // #and the host's screen says what the run came to
    await expect(host.getByText(/11 phones · \d+ of 10 cues/)).toBeVisible();
  } finally {
    for (const stop of stops) stop();
    for (const node of nodes) await node.close();
  }
});
