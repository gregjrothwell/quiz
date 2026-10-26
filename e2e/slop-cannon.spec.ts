import { expect, test, type Browser, type Page } from '@playwright/test';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import {
  addDoc,
  collection,
  doc as liteDoc,
  getDoc as liteGet,
  serverTimestamp as liteServerTimestamp,
  Timestamp as LiteTimestamp,
} from 'firebase/firestore/lite';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';

import { errorDoc, NO_ROOM } from '../src/engine/clientError';
import { reduce } from '../src/engine/reducer';
import { randomRoomCode } from '../src/engine/roomCode';
import { createRoom } from '../src/engine/state';
import { isNewMode, todayIso } from '../src/questions/newRounds';
import { readCannonKillSwitch, verdictRef, writeCannonVerdict } from '../src/lib/cannon';
import { writeClientError } from '../src/lib/clientErrors';
import { toPersisted } from '../src/lib/roomDoc';
import { setEmulatorFlag } from './emulators';
import { isolateFiles } from './isolate';
import { admin, player, seedVault, until } from './nodeClient';

isolateFiles();

/**
 * The Slop Cannon and the error beacon (docs/decisions/slop-cannon.md), both
 * directions, against the repo's rules in the emulator — then one round through
 * the app with the test shot loaded.
 *
 * Each rule block has an allow case that writes what the client's own code
 * writes, through the client's own functions, and comes before its denies: a
 * suite of deny cases alone is satisfied by `allow write: if false`
 * (docs/decisions/postmortem-the-pin-that-refused-the-reveal.md).
 */

test.setTimeout(60_000);

async function denied(attempt: Promise<unknown>): Promise<boolean> {
  try {
    await attempt;
    return false;
  } catch (cause) {
    const text = String((cause as { code?: unknown }).code ?? cause).toLowerCase();
    return text.includes('permission');
  }
}

test('A4 allow: a player files a beacon row, as the client builds it', async () => {
  const p = await player();
  const row = errorDoc(
    'Missing or insufficient permissions.',
    'notice',
    { room: 'B498', phase: 'finished', gameId: 'g-allow' },
    'index-e2e',
    'linux',
  );
  await writeClientError(p.lite, row);

  const kept = (await admin().collection('clientErrors').where('gameId', '==', 'g-allow').get()).docs;
  expect(kept).toHaveLength(1);
  expect(kept[0]?.data()).toMatchObject({ ...row });
  expect(kept[0]?.data()['at']).toBeInstanceOf(AdminTimestamp);
  expect(Object.keys(kept[0]?.data() ?? {})).not.toContain('uid');
  await p.close();
});

test('A4 deny: no uid riding along, nothing unbounded, no client time, no read, update or delete', async () => {
  const p = await player();
  const row = errorDoc('m', 'error', NO_ROOM, 'index-e2e', 'linux');
  const rows = collection(p.lite, 'clientErrors');

  expect(await denied(addDoc(rows, { ...row, uid: p.uid, at: liteServerTimestamp() }))).toBe(true);
  expect(await denied(addDoc(rows, { ...row, message: 'x'.repeat(301), at: liteServerTimestamp() }))).toBe(true);
  expect(await denied(addDoc(rows, { ...row, source: 'console', at: liteServerTimestamp() }))).toBe(true);
  expect(await denied(addDoc(rows, { ...row, room: 'rules-check-room', at: liteServerTimestamp() }))).toBe(true);
  expect(await denied(addDoc(rows, { ...row, at: LiteTimestamp.fromMillis(0) }))).toBe(true);

  await writeClientError(p.lite, { ...row, gameId: 'g-deny' });
  const [kept] = (await admin().collection('clientErrors').where('gameId', '==', 'g-deny').get()).docs;
  if (!kept) throw new Error('the allow write in the deny case did not land');
  expect(await denied(liteGet(liteDoc(p.lite, 'clientErrors', kept.id)))).toBe(true);
  expect(await denied(updateDoc(doc(p.db, 'clientErrors', kept.id), { message: 'rewritten' }))).toBe(true);
  expect(await denied(deleteDoc(doc(p.db, 'clientErrors', kept.id)))).toBe(true);
  await p.close();
});

test('C2: a signed-in client reads the kill switch; nobody writes it; nothing else under config is readable', async () => {
  const p = await player();
  // Absent: nothing pulled.
  expect(await readCannonKillSwitch(p.lite)).toEqual({ off: [] });
  await admin().doc('config/cannon').set({ off: ['test-shot'] });
  await admin().doc('config/other').set({ secret: true });
  expect(await readCannonKillSwitch(p.lite)).toEqual({ off: ['test-shot'] });

  expect(await denied(setDoc(doc(p.db, 'config', 'cannon'), { off: [] }))).toBe(true);
  expect(await denied(getDoc(doc(p.db, 'config', 'other')))).toBe(true);
  await admin().doc('config/cannon').delete();
  await admin().doc('config/other').delete();
  await p.close();
});

test('B4: the host loads up to eight shots, all true; nine, or a non-true, is refused', async () => {
  const host = await player();
  const code = randomRoomCode();
  const fresh = reduce(createRoom(code), { type: 'join', uid: host.uid, name: 'Host', at: Date.now() });
  const room = doc(host.db, 'rooms', code);
  const base = { ...toPersisted(fresh), hostUid: host.uid, expiresAt: Timestamp.fromMillis(Date.now() + 3_600_000) };

  // Allow: the shape `toPersisted` writes for a loaded round.
  const loaded = reduce(fresh, {
    type: 'selectPack',
    packId: 'science',
    packTitle: 'Science',
    questions: [],
    wagerEnabled: false,
    stealEnabled: false,
    cannon: { 'test-shot': true },
  });
  await setDoc(room, { ...base, ...toPersisted(loaded) });
  expect((await admin().doc(`rooms/${code}`).get()).data()?.['cannon']).toEqual({ 'test-shot': true });

  const nine = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`shot-${String(i)}`, true]));
  expect(await denied(updateDoc(room, { cannon: nine }))).toBe(true);
  expect(await denied(updateDoc(room, { cannon: { 'test-shot': 'x'.repeat(1000) } }))).toBe(true);
  expect(await denied(updateDoc(room, { cannon: ['test-shot'] }))).toBe(true);
  await host.close();
});

test('D3 allow, then deny: one Keep or Bin per player per shot per round, as yourself, once', async () => {
  const p = await player();
  const other = await player();
  await writeCannonVerdict(p.lite, 'g-1', 'test-shot', p.uid, 'keep');
  const kept = (await admin().doc(`cannonVerdicts/g-1_test-shot_${p.uid}`).get()).data();
  expect(kept).toMatchObject({ gameId: 'g-1', shot: 'test-shot', verdict: 'keep', uid: p.uid });
  expect(kept?.['at']).toBeInstanceOf(AdminTimestamp);

  // No change of mind.
  expect(await denied(writeCannonVerdict(p.lite, 'g-1', 'test-shot', p.uid, 'bin'))).toBe(true);
  // Not as somebody else.
  expect(await denied(writeCannonVerdict(p.lite, 'g-1', 'test-shot', other.uid, 'bin'))).toBe(true);
  // Not under an id that is not this round, shot and uid.
  expect(
    await denied(setDoc(doc(p.db, 'cannonVerdicts', 'g-2_test-shot_someone'), {
      gameId: 'g-2', shot: 'test-shot', verdict: 'keep', uid: p.uid, at: serverTimestamp(),
    })),
  ).toBe(true);
  // Only Keep or Bin.
  expect(
    await denied(setDoc(doc(p.db, 'cannonVerdicts', `g-3_test-shot_${p.uid}`), {
      gameId: 'g-3', shot: 'test-shot', verdict: 'not sure', uid: p.uid, at: serverTimestamp(),
    })),
  ).toBe(true);
  // Nobody reads them.
  expect(await denied(liteGet(verdictRef(p.lite, 'g-1', 'test-shot', p.uid)))).toBe(true);
  // Your own to sweep: what lets `check-rules` leave no litter.
  await deleteDoc(doc(p.db, 'cannonVerdicts', `g-1_test-shot_${p.uid}`));
  expect((await admin().doc(`cannonVerdicts/g-1_test-shot_${p.uid}`).get()).exists).toBe(false);
  await p.close();
  await other.close();
});

interface RoomDoc {
  phase: string;
  index: number;
  gameId: string;
  cannon?: Record<string, true>;
  double?: unknown;
  players: Record<string, { name: string }>;
}

async function readRoom(code: string): Promise<RoomDoc> {
  return (await admin().doc(`rooms/${code}`).get()).data() as RoomDoc;
}

async function seat(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await setEmulatorFlag(page);
  await page.goto('./');
  await page.getByPlaceholder('e.g. Greg').fill(name);
  return page;
}

/** A room with a host and one player, both in the lobby. */
async function twoSeats(browser: Browser): Promise<{ host: Page; other: Page; code: string }> {
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
async function startRound(host: Page, code: string, picks: readonly string[]): Promise<RoomDoc> {
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
async function playToFinal(
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

function uidOf(room: RoomDoc, name: string): string {
  return Object.entries(room.players).find(([, seat]) => seat.name === name)?.[0] ?? '';
}

/*
  E1 depends on the date: Mr Fries wears his sticker to 5 November 2026 and
  the Double to 8 November. These cases assert what today should do, so after
  those dates they prove the other direction — nothing asked — and the unit
  tests in `src/engine/cannon.test.ts` hold the boundary itself.
*/
const today = todayIso();
const chaserNew = isNewMode('chaser', today);
const doubleNew = isNewMode('double', today);

test('the whole path: a shot and Mr Fries, in the lobby, on the standings, kept, Keep / Bin on Final, and a beacon row', async ({ browser }) => {
  test.setTimeout(420_000);

  const { host, other: bea, code } = await twoSeats(browser);

  // B2: the quizmaster sees the section, the member does not.
  await expect(host.getByText('Slop Cannon', { exact: true })).toBeVisible();
  await expect(bea.getByText('Slop Cannon', { exact: true })).toHaveCount(0);

  await startRound(host, code, ['Against Mr Fries', 'Test shot']);
  // B3, E2: on the room, fixed for the round — the shot, then Mr Fries while he is new.
  const expected = { 'test-shot': true, ...(chaserNew ? { 'mode-chaser': true } : {}) };
  expect((await readRoom(code)).cannon).toEqual(expected);

  let named = false;
  const finished = await playToFinal(host, [host, bea], code, async (room) => {
    if (room.phase === 'scoreboard' && !named) {
      // B2, E5: the standings name the shot, and only the shot.
      named = await bea.locator('.cannon-line').textContent({ timeout: 6_000 }).then(
        (text) => text === 'Slop Cannon: Test shot',
        () => false,
      );
    }
  });
  expect(named).toBe(true);

  // D1–D2, E5: one row each, under the podium, one tap.
  await expect(bea.locator('.cannon .eyebrow')).toHaveText('New this round · keep it?', { timeout: 30_000 });
  const titles = ['Test shot', ...(chaserNew ? ['Against Mr Fries'] : [])];
  await expect(bea.locator('.cannon__row .lamp--label')).toHaveText(titles);
  for (const [page, choice] of [[host, 'Keep'], [bea, 'Bin']] as const) {
    for (const title of titles) {
      const row = page.locator('.cannon__row', { hasText: title });
      await expect(row).toBeVisible({ timeout: 30_000 });
      const podiumBottom = await page.locator('.finale').evaluate((el) => el.getBoundingClientRect().bottom);
      const rowTop = await row.evaluate((el) => el.getBoundingClientRect().top);
      expect(rowTop).toBeGreaterThanOrEqual(podiumBottom);
      await row.getByRole('button', { name: choice }).click();
      await expect(row.getByRole('button')).toHaveCount(0);
    }
  }
  const verdict = (shot: string, uid: string) =>
    admin().doc(`cannonVerdicts/${finished.gameId}_${shot}_${uid}`).get();
  for (const shot of Object.keys(expected)) {
    await until(() => verdict(shot, uidOf(finished, 'Ada')), (snapshot) => snapshot.data()?.['verdict'] === 'keep');
    await until(() => verdict(shot, uidOf(finished, 'Bea')), (snapshot) => snapshot.data()?.['verdict'] === 'bin');
  }

  // B5: the kept round says what it carried.
  const game = await until(() => admin().doc(`games/${finished.gameId}`).get(), (snapshot) => snapshot.exists);
  expect(game.data()?.['cannon']).toEqual(expected);

  // A1: an uncaught error on a player's page is written down, against the room.
  await bea.evaluate(() => {
    window.dispatchEvent(new ErrorEvent('error', { message: 'e2e: uncaught on Final' }));
  });
  const beaconed = await until(
    () => admin().collection('clientErrors').where('message', '==', 'e2e: uncaught on Final').get(),
    (snapshot) => snapshot.size === 1,
  );
  expect(beaconed.docs[0]?.data()).toMatchObject({ source: 'error', room: code, phase: 'finished', gameId: finished.gameId });
  expect(String(beaconed.docs[0]?.data()['build'])).toMatch(/^index-/);
});

test('E4: a plain half-time asks nothing; the Double is asked at the end of the morning', async ({ browser }) => {
  test.setTimeout(600_000);

  const { host, other, code } = await twoSeats(browser);

  // Round one: the Double and nothing else — so nothing is asked at half-time.
  await startRound(host, code, ['The Double']);
  expect((await readRoom(code)).cannon).toBeUndefined();
  await playToFinal(host, [host, other], code);
  await expect(other.locator('.finale')).toBeVisible({ timeout: 30_000 });
  await expect(host.getByRole('button', { name: 'Second half' })).toBeVisible({ timeout: 30_000 });
  await expect(other.locator('.cannon')).toHaveCount(0);

  // Round two: the end of the morning.
  await host.getByRole('button', { name: 'Second half' }).click();
  await until(() => readRoom(code), (room) => room.phase === 'lobby' && room.double != null);
  await startRound(host, code, []);
  expect((await readRoom(code)).cannon).toEqual(doubleNew ? { 'mode-double': true } : undefined);
  await playToFinal(host, [host, other], code);
  if (doubleNew) {
    await expect(other.locator('.cannon__row .lamp--label')).toHaveText(['The Double'], { timeout: 30_000 });
  } else {
    await expect(other.locator('.finale')).toBeVisible({ timeout: 30_000 });
    await expect(other.locator('.cannon')).toHaveCount(0);
  }
});
