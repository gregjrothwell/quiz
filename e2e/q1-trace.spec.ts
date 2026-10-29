import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  connectFirestoreEmulator,
  deleteDoc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Firestore,
} from 'firebase/firestore/lite';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';

import { createQ1Tracer, type Q1TraceDoc } from '../src/engine/q1Trace';
import { EMULATOR_HOST, EMULATOR_PORTS } from '../src/lib/emulators';
import { traceRef, writeQ1Trace } from '../src/lib/q1Trace';
import { setEmulatorFlag } from './emulators';
import { isolateFiles } from './isolate';
import { admin, player, seedVault, until, type Player } from './nodeClient';

isolateFiles();

/**
 * The question-one trace, both directions (docs/decisions/cass-q1.md, AC7), and
 * then through the app itself: a real round's question one leaves a trace for
 * each device (AC1–AC4).
 *
 * The allow case comes first and writes what the client's own tracer builds,
 * over Lite as the client does — a suite of deny cases alone is satisfied by
 * `allow write: if false`, and every deny below means something only once that
 * allow passes (docs/decisions/postmortem-the-pin-that-refused-the-reveal.md).
 */

test.setTimeout(60_000);

/** A Lite instance on the player's app: the SDK `recordQ1Trace` uses. */
function lite(as: Player): Firestore {
  const db = getFirestore(as.app);
  try {
    connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORTS.firestore);
  } catch (cause) {
    // Connecting twice throws; the instance is already pointed at the emulator.
    if (!String(cause).includes('already')) throw cause;
  }
  return db;
}

async function denied(attempt: Promise<unknown>): Promise<boolean> {
  try {
    await attempt;
    return false;
  } catch (cause) {
    const text = String((cause as { code?: unknown }).code ?? cause).toLowerCase();
    return text.includes('permission');
  }
}

/** A trace as the client's tracer builds it: answered at 4s, acknowledged, counted. */
function builtTrace(uid: string, gameId: string): Q1TraceDoc {
  let clock = 1_000_000;
  const written: Q1TraceDoc[] = [];
  const tracer = createQ1Tracer({ now: () => clock, write: (trace) => written.push(trace) });
  tracer.sawQuestion({
    gameId,
    roomCode: 'E2E1',
    uid,
    index: 0,
    durationMs: 10_000,
    openedAtMs: 999_600,
    arrivedAt: 1_000_000,
    serverOffsetMs: -120,
    priorDeltas: {},
    visibleSince: 990_000,
    device: 'linux',
    network: '4g',
  });
  clock = 1_004_000;
  const token = tracer.tapped({ gameId, index: 0, elapsedMs: 4_000 });
  clock = 1_004_250;
  if (token !== null) tracer.settled(token);
  clock = 1_010_300;
  tracer.sawRoom({ gameId, phase: 'reveal', index: 0, scoredUids: [uid] });
  const [trace] = written;
  if (!trace) throw new Error('the tracer wrote nothing');
  return trace;
}

test('AC7 allow: a player files their own question-one trace, as the client builds it', async () => {
  const cass = await player();
  const db = lite(cass);
  const trace = builtTrace(cass.uid, `allow-${Date.now()}`);

  await writeQ1Trace(db, trace);

  const kept = (await admin().doc(`q1Traces/${trace.gameId}_${cass.uid}`).get()).data();
  expect(kept).toMatchObject({ ...trace });
  expect(kept?.['at']).toBeInstanceOf(AdminTimestamp);

  // Their own, to sweep: what lets `check-rules` leave no litter.
  await deleteDoc(traceRef(db, trace.gameId, cass.uid));
  expect((await admin().doc(`q1Traces/${trace.gameId}_${cass.uid}`).get()).exists).toBe(false);
  await cass.close();
});

test('AC7 deny: no second write, nobody else’s, no extra field, no reading, server time only', async () => {
  const cass = await player();
  const other = await player();
  const db = lite(cass);
  const gameId = `deny-${Date.now()}`;
  const trace = builtTrace(cass.uid, gameId);

  // As somebody else, under their id.
  expect(await denied(writeQ1Trace(db, { ...builtTrace(other.uid, gameId) }))).toBe(true);
  // Under an id that is not this round and this uid — the server's stamp, so the id is the only fault.
  expect(
    await denied(setDoc(traceRef(db, 'another-game', cass.uid), { ...trace, at: serverTimestamp() })),
  ).toBe(true);
  // An option index smuggled alongside — the one thing that would leak an answer.
  expect(await denied(writeQ1Trace(db, { ...trace, optionIndex: 2 } as Q1TraceDoc))).toBe(true);
  // Out of bounds.
  expect(await denied(writeQ1Trace(db, { ...trace, ackMs: 900_000 }))).toBe(true);
  // A client clock in place of the server's.
  expect(
    await denied(setDoc(traceRef(db, gameId, cass.uid), { ...trace, at: Timestamp.fromMillis(1) })),
  ).toBe(true);

  // The real one lands; a second write of it is an update, refused.
  await writeQ1Trace(db, trace);
  expect(await denied(writeQ1Trace(db, { ...trace, writes: 5 }))).toBe(true);
  // Nobody reads a trace, not even its author.
  expect(await denied(getDoc(traceRef(db, gameId, cass.uid)))).toBe(true);
  // Nor deletes somebody else's.
  expect(await denied(deleteDoc(traceRef(lite(other), gameId, cass.uid)))).toBe(true);

  await deleteDoc(traceRef(db, gameId, cass.uid));
  await cass.close();
  await other.close();
});

async function seat(browser: Browser, name: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') console.log(`[${name}:error] ${message.text()}`);
  });
  await setEmulatorFlag(page);
  await page.goto('./');
  await page.getByPlaceholder('e.g. Greg').fill(name);
  return { context, page };
}

interface RoomDoc {
  phase: string;
  gameId?: string;
  players: Record<string, { name: string }>;
}

async function readRoom(code: string): Promise<RoomDoc> {
  return (await admin().doc(`rooms/${code}`).get()).data() as RoomDoc;
}

function uidOf(room: RoomDoc, name: string): string {
  const found = Object.entries(room.players).find(([, seated]) => seated.name === name);
  if (!found) throw new Error(`${name} is not in the room`);
  return found[0];
}

async function traceOf(gameId: string, uid: string): Promise<Record<string, unknown> | undefined> {
  return (await admin().doc(`q1Traces/${gameId}_${uid}`).get()).data();
}

test('AC1–AC4 through the app: question one leaves one trace per device', async ({ browser }) => {
  test.setTimeout(120_000);

  const host = await seat(browser, 'Host');
  await host.page.getByRole('button', { name: 'Start a new room' }).click();
  const label = await host.page.getByLabel(/Room code [A-Z0-9]{4}/).getAttribute('aria-label');
  const code = label?.replace('Room code ', '') ?? '';

  const ann = await seat(browser, 'Ann');
  await ann.page.getByPlaceholder('––––').fill(code);
  await ann.page.getByRole('button', { name: 'Join the round' }).click();
  await expect(ann.page.getByText('Vote for a set')).toBeVisible();

  await until(() => readRoom(code), (room) => Object.keys(room.players).length === 2);
  await host.page
    .locator('button.pack', { has: host.page.locator('.pack__title', { hasText: 'General Knowledge' }) })
    .click();
  await host.page.getByRole('button', { name: 'Start the show' }).click();
  await host.page.getByRole('button', { name: 'Start the round' }).click();
  const opened = await until(() => readRoom(code), (room) => room.phase === 'question');
  await seedVault(code);

  // #when Ann answers question one and the host's device reveals it
  await expect(ann.page.locator('.podium')).toBeVisible();
  await ann.page.keyboard.press('a');
  await ann.page.keyboard.press('Enter');
  await expect(ann.page.getByText(/^Correct · \+/)).toBeVisible({ timeout: 60_000 });

  const gameId = opened.gameId ?? '';
  expect(gameId).not.toBe('');

  // #then Ann's device filed what it saw: a tap, acknowledged, counted
  const annTrace = await until(() => traceOf(gameId, uidOf(opened, 'Ann')), (kept) => kept !== undefined);
  expect(annTrace).toMatchObject({ roomCode: code, writes: 1, counted: true, priorSamples: 0 });
  for (const key of ['seenAfterOpenMs', 'serverOffsetMs', 'tapMs', 'tapElapsedMs', 'ackMs', 'revealMs']) {
    expect(typeof annTrace?.[key], key).toBe('number');
  }
  expect(annTrace).not.toHaveProperty('optionIndex');
  // Locked by Enter, not by the auto-lock near the buzzer, which stamps the
  // whole window (docs/decisions/lock-in.md). That would read 10,000 here.
  expect(annTrace?.['tapElapsedMs']).toBeLessThan(8_000);

  // #and so did the host's, which never answered
  const hostTrace = await until(() => traceOf(gameId, uidOf(opened, 'Host')), (kept) => kept !== undefined);
  expect(hostTrace).toMatchObject({ writes: 0, counted: false });
  expect(hostTrace).not.toHaveProperty('ackMs');

  await host.context.close();
  await ann.context.close();
});
