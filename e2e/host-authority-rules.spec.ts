import { expect, test } from '@playwright/test';
import { ref as rtdbRef, get as rtdbGet, set as rtdbSet } from 'firebase/database';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';

import { planJoin } from '../src/engine/join';
import { reduce, type Action } from '../src/engine/reducer';
import { randomRoomCode } from '../src/engine/roomCode';
import { createRoom, type QuizQuestion, type RoomState } from '../src/engine/state';
import { toPersisted, toRoomState, toUpdate } from '../src/lib/roomDoc';
import { admin, player, seedVault, type Player } from './nodeClient';

/**
 * W3, host authority: the rules, both directions, through the client SDK and
 * the client's own `reduce` + `toUpdate`, against the repo's rules in the
 * emulator. docs/decisions/host-authority.md has the twelve criteria; the AC
 * numbers below are those.
 *
 * Every rule function this work touches has an allow case here that exercises
 * what the client does, because a suite of deny cases alone is satisfied by
 * `allow write: if false` — docs/decisions/postmortem-the-pin-that-refused-the-reveal.md.
 */

test.setTimeout(60_000);

const QUESTIONS: QuizQuestion[] = Array.from({ length: 3 }, (_, i) => ({
  id: `w3e2e-${i}`,
  prompt: `Question ${i + 1}`,
  options: ['First', 'Second', 'Third', 'Fourth'],
  correctIndex: null,
  category: 'General Knowledge',
  difficulty: 'easy',
}));

async function denied(attempt: Promise<unknown>): Promise<boolean> {
  try {
    await attempt;
    return false;
  } catch (cause) {
    const text = String((cause as { code?: unknown }).code ?? cause).toLowerCase();
    return text.includes('permission');
  }
}

function roomRef(db: Firestore, code: string) {
  return doc(db, 'rooms', code);
}

/** The room as the client would hold it, read through this player's rules. */
async function state(as: Player, code: string): Promise<RoomState> {
  const snapshot = await getDoc(roomRef(as.db, code));
  const data = snapshot.data();
  if (!data) throw new Error(`room ${code} is not readable`);
  return toRoomState(code, data, {});
}

/** A dispatch, the way `useRoom.dispatch` writes one. */
async function dispatch(as: Player, code: string, actions: Action[]): Promise<RoomState> {
  const current = await state(as, code);
  const next = actions.reduce(reduce, current);
  await updateDoc(roomRef(as.db, code), toUpdate(next, current));
  return next;
}

/** A room made the way `createAndJoin` makes one: the creator is the host and beats at once. */
async function hostedRoom(host: Player, code = randomRoomCode()): Promise<string> {
  const fresh = reduce(createRoom(code), { type: 'join', uid: host.uid, name: 'Host', at: Date.now() });
  await setDoc(roomRef(host.db, code), {
    ...toPersisted(fresh),
    hostUid: host.uid,
    expiresAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
  });
  await setDoc(doc(host.db, 'rooms', code, 'host', 'beat'), { at: serverTimestamp() });
  return code;
}

/** A room as every client before W3 made one: no `hostUid`. */
async function legacyRoom(host: Player, code = randomRoomCode()): Promise<string> {
  const fresh = reduce(createRoom(code), { type: 'join', uid: host.uid, name: 'Host', at: Date.now() });
  await setDoc(roomRef(host.db, code), {
    ...toPersisted(fresh),
    expiresAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
  });
  return code;
}

/** `writeSelfIntoRoom`: one field path for the seat, one for the score. */
async function join(as: Player, code: string, name: string): Promise<void> {
  const room = await state(as, code);
  const { entry, score } = planJoin({
    players: room.players,
    scores: room.scores,
    phase: room.phase,
    uid: as.uid,
    name,
    playerId: as.uid,
    squad: '',
    restored: null,
    now: Date.now(),
  });
  await updateDoc(roomRef(as.db, code), {
    [`players.${as.uid}`]: entry,
    ...(score === null ? {} : { [`scores.${as.uid}`]: score }),
  });
}

async function start(host: Player, code: string, durationSecs = 5): Promise<void> {
  await dispatch(host, code, [
    {
      type: 'selectPack',
      packId: 'general-knowledge',
      packTitle: 'General Knowledge',
      questions: QUESTIONS,
      wagerEnabled: false,
      stealEnabled: false,
    },
    { type: 'start', at: Date.now(), gameId: `e2e-${Date.now()}`, durationSecs },
  ]);
}

/** `submitAnswer`. */
async function answer(as: Player, code: string, optionIndex: number): Promise<void> {
  await setDoc(doc(as.db, 'rooms', code, 'answers', as.uid), {
    optionIndex,
    elapsedMs: 1200,
    questionIndex: 0,
    at: serverTimestamp(),
  });
}

/** `writeOwnVote`: the vote and the tap, one field path each, in one write. */
function vote(as: Player, code: string, packId: string | null): Promise<void> {
  return updateDoc(roomRef(as.db, code), {
    [`packVotes.${as.uid}`]: packId ?? deleteField(),
    [`voteTaps.${as.uid}`]: increment(1),
  });
}

/** The beat, aged on the server by the Admin SDK so a claim does not wait 75 s. */
async function ageBeat(code: string, ageMs: number): Promise<void> {
  await admin()
    .doc(`rooms/${code}/host/beat`)
    .set({ at: AdminTimestamp.fromMillis(Date.now() - ageMs) });
}

/** The claim: `hostUid` and a fresh beat, in one batch. */
function claim(as: Player, code: string): Promise<void> {
  const batch = writeBatch(as.db);
  batch.update(roomRef(as.db, code), { hostUid: as.uid });
  batch.set(doc(as.db, 'rooms', code, 'host', 'beat'), { at: serverTimestamp() });
  return batch.commit();
}

let host: Player;
let ann: Player;
let bob: Player;

test.beforeAll(async () => {
  host = await player();
  ann = await player();
  bob = await player();
});

test.afterAll(async () => {
  await Promise.all([host, ann, bob].map((each) => each.close()));
});

test('canary: the RTDB emulator is running the repo rules on this namespace', async () => {
  // A presence write for somebody else is refused by database.rules.json. If
  // this passes as written, the namespace is unruled and every RTDB case below
  // means nothing.
  expect(await denied(rtdbSet(rtdbRef(ann.rtdb, `presence/CANARY/${bob.uid}`), { at: 1 }))).toBe(true);
  await rtdbSet(rtdbRef(ann.rtdb, `presence/CANARY/${ann.uid}`), { at: 1 });
});

test('AC2/AC3 allow: the host creates, beats and drives; members seat, vote, squad and answer', async () => {
  const code = await hostedRoom(host);
  await join(ann, code, 'Ann');
  await join(bob, code, 'Bob');

  // The beat, every 15 s from the host.
  await setDoc(doc(host.db, 'rooms', code, 'host', 'beat'), { at: serverTimestamp() });

  // A member's lobby writes: a vote, and their own squad.
  await updateDoc(roomRef(ann.db, code), {
    [`packVotes.${ann.uid}`]: 'sleeves',
    [`voteTaps.${ann.uid}`]: increment(1),
  });
  await updateDoc(roomRef(ann.db, code), { [`players.${ann.uid}.squad`]: 'Reds' });

  // The host's lobby writes: browsing, then the titles and clearing them.
  await updateDoc(roomRef(host.db, code), { browsing: 'flags' });
  await dispatch(host, code, [
    {
      type: 'selectPack',
      packId: 'general-knowledge',
      packTitle: 'General Knowledge',
      questions: QUESTIONS,
      wagerEnabled: false,
      stealEnabled: false,
    },
    { type: 'titles', at: Date.now(), facts: [{ id: 'newcomers', uids: [ann.uid] }], durationSecs: 5 },
  ]);
  await dispatch(host, code, [{ type: 'clearTitles' }]);

  await dispatch(host, code, [{ type: 'start', at: Date.now(), gameId: `e2e-${Date.now()}`, durationSecs: 5 }]);
  await answer(ann, code, 0);
  await answer(bob, code, 1);

  // AC4 allow: a player reads their own answer, the host reads them all.
  expect((await getDoc(doc(ann.db, 'rooms', code, 'answers', ann.uid))).exists()).toBe(true);
  const all = await getDocs(collection(host.db, 'rooms', code, 'answers'));
  expect(all.size).toBe(2);

  // The reveal doc and the reveal, once the window has closed.
  await seedVault(code);
  await new Promise((resolve) => setTimeout(resolve, 6_000));
  await setDoc(doc(host.db, 'rooms', code, 'reveal', QUESTIONS[0]!.id), { answer: 'First' });
  await dispatch(host, code, [{ type: 'reveal', correctIndex: 0, questionId: QUESTIONS[0]!.id }]);
  await dispatch(host, code, [{ type: 'next', at: Date.now() }]);
  await dispatch(host, code, [{ type: 'next', at: Date.now() }]);
  await dispatch(host, code, [{ type: 'skip' }]);
  await dispatch(host, code, [{ type: 'reset' }]);

  // The reaper: the host removes somebody else's seat.
  await updateDoc(roomRef(host.db, code), { [`players.${bob.uid}`]: deleteField() });

  // A member leaves.
  await updateDoc(roomRef(ann.db, code), { [`players.${ann.uid}`]: deleteField() });

  const after = (await admin().doc(`rooms/${code}`).get()).data();
  expect(after?.phase).toBe('lobby');
  expect(after?.hostUid).toBe(host.uid);
});

test('AC2 allow: the host runs the final (openPicks, closePicks, settle); a member cannot', async () => {
  const code = await hostedRoom(host);
  await join(ann, code, 'Ann');
  await join(bob, code, 'Bob');
  await dispatch(host, code, [
    {
      type: 'selectPack',
      packId: 'general-knowledge',
      packTitle: 'General Knowledge',
      questions: [QUESTIONS[0]!],
      wagerEnabled: false,
      stealEnabled: false,
      standoffEnabled: true,
    },
    { type: 'start', at: Date.now(), gameId: `e2e-final-${Date.now()}`, durationSecs: 5 },
  ]);
  await answer(ann, code, 0);
  await answer(bob, code, 0);

  // Reveal with both picks, so Ann and Bob lead the host and reach the final.
  await seedVault(code);
  await new Promise((resolve) => setTimeout(resolve, 6_000));
  await setDoc(doc(host.db, 'rooms', code, 'reveal', QUESTIONS[0]!.id), { answer: 'First' });
  const all = await getDocs(collection(host.db, 'rooms', code, 'answers'));
  const picks = Object.fromEntries(
    all.docs.map((d) => [d.id, { optionIndex: d.data().optionIndex as number, elapsedMs: 1200 }]),
  );
  const current = await state(host, code);
  const revealed = reduce({ ...current, answers: picks }, { type: 'reveal', correctIndex: 0, questionId: QUESTIONS[0]!.id });
  await updateDoc(roomRef(host.db, code), toUpdate(revealed, current));
  await dispatch(host, code, [{ type: 'next', at: Date.now() }]);
  const final = await dispatch(host, code, [{ type: 'next', at: Date.now() }]);
  expect(final.phase).toBe('standoff');
  expect([...(final.standoff?.finalists ?? [])].sort()).toEqual([ann.uid, bob.uid].sort());

  // A member cannot move the final on for the host.
  expect(await denied(updateDoc(roomRef(ann.db, code), { 'standoff.stage': 'pick' })), 'openPicks as a member').toBe(true);

  await dispatch(host, code, [{ type: 'openPicks' }]);
  await dispatch(host, code, [{ type: 'closePicks', sealed: [ann.uid, bob.uid] }]);
  const settled = await dispatch(host, code, [{ type: 'settle', picks: { [ann.uid]: 'share', [bob.uid]: 'share' } }]);
  expect(settled.standoff?.stage).toBe('revealed');

  const after = (await admin().doc(`rooms/${code}`).get()).data();
  expect(after?.standoff?.stage).toBe('revealed');
});

test('AC1 deny: a member cannot write what is the host’s', async () => {
  const code = await hostedRoom(host);
  await join(ann, code, 'Ann');
  await join(bob, code, 'Bob');
  await start(host, code, 60);
  const as = roomRef(ann.db, code);

  expect(await denied(updateDoc(as, { phase: 'reveal' })), 'phase').toBe(true);
  expect(await denied(updateDoc(as, { index: 1 })), 'index').toBe(true);
  expect(await denied(updateDoc(as, { questions: [] })), 'questions').toBe(true);
  expect(await denied(updateDoc(as, { [`scores.${bob.uid}`]: 5000 })), 'another score').toBe(true);
  expect(await denied(updateDoc(as, { [`scores.${ann.uid}`]: 5000 })), 'own score, not zero').toBe(true);
  expect(await denied(updateDoc(as, { wagerEnabled: true })), 'settings').toBe(true);
  expect(await denied(updateDoc(as, { browsing: 'flags' })), 'browsing').toBe(true);
  expect(await denied(updateDoc(as, { hostUid: ann.uid })), 'hostUid while the beat is fresh').toBe(true);
  expect(await denied(updateDoc(as, { [`players.${bob.uid}`]: deleteField() })), 'another seat').toBe(true);
  expect(
    await denied(setDoc(doc(ann.db, 'rooms', code, 'host', 'beat'), { at: serverTimestamp() })),
    'the beat',
  ).toBe(true);
});

test('AC1 deny: a member cannot write the vault reveal doc', async () => {
  const code = await hostedRoom(host);
  await join(ann, code, 'Ann');
  await start(host, code, 5);
  await seedVault(code);
  await new Promise((resolve) => setTimeout(resolve, 6_000));
  expect(
    await denied(setDoc(doc(ann.db, 'rooms', code, 'reveal', QUESTIONS[0]!.id), { answer: 'First' })),
  ).toBe(true);
  // The allow beside it: the host can, on the same question, at the same moment.
  await setDoc(doc(host.db, 'rooms', code, 'reveal', QUESTIONS[0]!.id), { answer: 'First' });
});

test('AC4 deny: before the reveal a player reads only their own answer', async () => {
  const code = await hostedRoom(host);
  await join(ann, code, 'Ann');
  await join(bob, code, 'Bob');
  await start(host, code, 60);
  await answer(ann, code, 0);
  await answer(bob, code, 1);

  expect(await denied(getDocs(collection(ann.db, 'rooms', code, 'answers'))), 'list').toBe(true);
  expect(await denied(getDoc(doc(ann.db, 'rooms', code, 'answers', bob.uid))), 'get').toBe(true);
  expect((await getDoc(doc(ann.db, 'rooms', code, 'answers', ann.uid))).data()?.optionIndex).toBe(0);
});

test('AC6: lamps on the RTDB, writable only as yourself, readable by the room', async () => {
  const key = `LAMP/e2e-${Date.now()}:0`;
  await rtdbSet(rtdbRef(ann.rtdb, `lamps/${key}/${ann.uid}`), true);
  expect(await denied(rtdbSet(rtdbRef(ann.rtdb, `lamps/${key}/${bob.uid}`), true)), 'another lamp').toBe(true);
  expect(await denied(rtdbSet(rtdbRef(ann.rtdb, `lamps/${key}/${ann.uid}`), 'B')), 'not a boolean').toBe(true);
  const seen = await rtdbGet(rtdbRef(bob.rtdb, `lamps/${key}`));
  expect(Object.keys((seen.val() as Record<string, boolean> | null) ?? {})).toEqual([ann.uid]);
});

test('AC7: the host leaves and hands the chair over in the same write', async () => {
  const code = await hostedRoom(host);
  await join(ann, code, 'Ann');
  await join(bob, code, 'Bob');
  await start(host, code, 60);

  // A member cannot do the host's handover for them.
  expect(
    await denied(updateDoc(roomRef(bob.db, code), { [`players.${host.uid}`]: deleteField(), hostUid: bob.uid })),
  ).toBe(true);
  // Nor can the host drop `hostUid`, which would turn the room back into one
  // any member may write.
  expect(await denied(updateDoc(roomRef(host.db, code), { hostUid: deleteField() }))).toBe(true);

  await updateDoc(roomRef(host.db, code), { [`players.${host.uid}`]: deleteField(), hostUid: ann.uid });
  const after = (await admin().doc(`rooms/${code}`).get()).data();
  expect(after?.hostUid).toBe(ann.uid);
  // And the new host can beat and drive.
  await setDoc(doc(ann.db, 'rooms', code, 'host', 'beat'), { at: serverTimestamp() });
  await dispatch(ann, code, [{ type: 'skip' }]);
});

test('AC8/AC9: a claim is refused while the beat is fresh and allowed once it is 75 s old', async () => {
  const code = await hostedRoom(host);
  await join(ann, code, 'Ann');
  await join(bob, code, 'Bob');
  await start(host, code, 5);
  await answer(ann, code, 0);
  await answer(bob, code, 0);

  // AC9: the host is throttled, its last beat 60 s old. Nobody may claim.
  await ageBeat(code, 60_000);
  expect(await denied(claim(ann, code)), 'claim at 60 s').toBe(true);

  // AC8: the host is gone, its last beat 80 s old.
  await ageBeat(code, 80_000);
  // Somebody who is not in the room cannot claim it, however stale the beat.
  const stranger = await player();
  expect(await denied(claim(stranger, code)), 'a stranger').toBe(true);
  await stranger.close();
  await claim(ann, code);
  expect((await admin().doc(`rooms/${code}`).get()).data()?.hostUid).toBe(ann.uid);

  // A second claimant finds the new beat fresh.
  expect(await denied(claim(bob, code)), 'second claim').toBe(true);

  // The new host carries on the open question: reads the answers written
  // before the handover, reveals, and moves on.
  const all = await getDocs(collection(ann.db, 'rooms', code, 'answers'));
  expect(all.size).toBe(2);
  await seedVault(code);
  await new Promise((resolve) => setTimeout(resolve, 6_000));
  await setDoc(doc(ann.db, 'rooms', code, 'reveal', QUESTIONS[0]!.id), { answer: 'First' });
  const current = await state(ann, code);
  const answers = Object.fromEntries(
    all.docs.map((d) => [d.id, { optionIndex: d.data().optionIndex as number, elapsedMs: 1200 }]),
  );
  const next = reduce({ ...current, answers }, { type: 'reveal', correctIndex: 0, questionId: QUESTIONS[0]!.id });
  await updateDoc(roomRef(ann.db, code), toUpdate(next, current));
  const revealed = (await admin().doc(`rooms/${code}`).get()).data();
  expect(revealed?.phase).toBe('reveal');
  expect(revealed?.scores?.[ann.uid]).toBeGreaterThan(0);
  expect(revealed?.scores?.[bob.uid]).toBeGreaterThan(0);

  // The old host, back, is a member and nothing more.
  expect(await denied(updateDoc(roomRef(host.db, code), { phase: 'scoreboard' }))).toBe(true);
});

test('AC11: a room made before the deploy plays on under the member rule', async () => {
  const code = await legacyRoom(host);
  await join(ann, code, 'Ann');
  await start(host, code, 60);
  await answer(ann, code, 0);
  // Any member may still move the game on and read every answer.
  await updateDoc(roomRef(ann.db, code), { phase: 'reveal' });
  expect((await getDocs(collection(ann.db, 'rooms', code, 'answers'))).size).toBe(1);
});

// ── S2, what goes in a lobby vote (22 October 2026) ───────────────────────
// `onlyMine` bounds whose key a member writes, not what goes under it. The
// allow case is `writeOwnVote` as the client sends it — cast, take back, move —
// by a member and by the host, whose writes take the other branch of the
// update rule; it fails if the bound refuses the game.
// docs/decisions/security-sweep-oct-2026.md.

test('S2 allow: a member and the host vote, take it back and move it, as writeOwnVote does', async () => {
  const code = await hostedRoom(host);
  await join(ann, code, 'Ann');

  // The longest pack id there is, then taken back: absent is allowed.
  await vote(ann, code, 'general-knowledge');
  await vote(ann, code, null);
  await vote(host, code, 'sleeves');
  await vote(host, code, 'flags');

  const voted = (await admin().doc(`rooms/${code}`).get()).data();
  expect(voted?.packVotes).toEqual({ [host.uid]: 'flags' });
  expect(voted?.voteTaps).toEqual({ [ann.uid]: 2, [host.uid]: 2 });

  // The host's other writes still land with their own vote on the room.
  await updateDoc(roomRef(host.db, code), { browsing: 'tunes' });
  await start(host, code, 60);
});

test('S2 deny: an oversized vote, or a tap count that is not a whole number under the ceiling', async () => {
  const code = await hostedRoom(host);
  await join(ann, code, 'Ann');
  const as = roomRef(ann.db, code);
  // One 900 kB write only: a second would be refused for the document's size
  // or the rules engine's memory, whatever the rule says, and prove nothing.
  const bloat = 'x'.repeat(900_000);

  expect.soft(await denied(updateDoc(as, { [`packVotes.${ann.uid}`]: 'x'.repeat(65) })), 'a 65-character vote').toBe(true);
  expect.soft(await denied(updateDoc(as, { [`packVotes.${ann.uid}`]: bloat })), 'a 900 kB vote').toBe(true);
  expect.soft(await denied(updateDoc(as, { [`voteTaps.${ann.uid}`]: 'two' })), 'a string tap count').toBe(true);
  expect.soft(await denied(updateDoc(as, { [`voteTaps.${ann.uid}`]: 1.5 })), 'a fractional tap count').toBe(true);
  expect.soft(await denied(updateDoc(as, { [`voteTaps.${ann.uid}`]: 1001 })), 'a tap count past 1000').toBe(true);
  expect.soft(
    await denied(updateDoc(roomRef(host.db, code), { [`packVotes.${host.uid}`]: 'x'.repeat(65) })),
    'the host, through the other branch',
  ).toBe(true);

  // The allow beside them, on the same room: the real vote still lands.
  await vote(ann, code, 'sleeves');
});
