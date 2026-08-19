/**
 * Checks that the published security rules match what the app needs — and, since
 * the security review, that they still refuse what they are supposed to refuse.
 * Run with:
 *
 *   npm run check-rules
 *
 * Both rulesets are published by hand in the Firebase console, and an
 * unpublished one has now broken the game twice — first Firestore, then the
 * Realtime Database, where every presence write was rejected and the room
 * quietly filled with ghosts.
 *
 * The deny checks matter for a different reason. A hand-paste can fail in two
 * directions, and the permissive direction is silent: everything works, and
 * nobody finds out that `list` is still allowed until a room full of colleagues
 * has been enumerated. Every tightening in firestore.rules therefore has a check
 * here that fails loudly if the console is still serving the old ruleset.
 *
 * Nothing here writes to a real room or the live season. The season checks use a
 * throwaway season id and tidy up after themselves; the Realtime Database checks
 * do the same.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { attachDebugAppCheck } from './appCheck';
import { weekId } from '../src/engine/week';
import { get, getDatabase, ref, remove, set } from 'firebase/database';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';

/**
 * The rule is `match /seasons/{season}/players/{uid}`, so any season id
 * exercises the same path. Using a literal keeps this script out of the app's
 * module graph — importing the real constant drags in src/firebase.ts, which
 * reads `import.meta.env` and only exists under Vite. It also means the write
 * checks below cannot touch the season anybody is actually playing.
 */
const ANY_SEASON = 'rules-check';

/**
 * A week bucket, which is a season id and nothing more — the rule matches
 * `{season}` as an unconstrained wildcard, so a weekly board needs no rules of
 * its own. That is load-bearing rather than incidental: it is the whole reason
 * the weekly leaderboard shipped without a hand-paste in the console, and if a
 * future ruleset ever constrains the season segment, banking would start
 * failing on the week half of every game while the season half kept working.
 * This check is what would name that.
 *
 * Dated in 1999 so it is genuinely week-shaped and can never be a bucket
 * anybody is playing in.
 */
const PROBE_WEEK = weekId(new Date(1999, 0, 15));

/**
 * Outside the room-code alphabet, so a stray document can never be joined from
 * the UI. Not wrapped in double underscores — Firestore reserves those and
 * rejects the write before the rules are ever consulted, which reads as an
 * inconclusive check rather than a passing one.
 */
const PROBE_ROOM = 'rules-check-room';

/**
 * A second probe room, this one owned by the checker, because the vault's time
 * gate can only be exercised against a room with a genuinely open question.
 *
 * Rooms cannot be deleted — deliberately, see firestore.rules — so this is a
 * fixed code reused on every run rather than a fresh room each time, which
 * would litter the project with one document per preflight. It is outside the
 * room-code alphabet, so nobody can reach it from the app.
 */
const LIVE_ROOM = 'rules-check-live';

/** Seeded by `npm run seed-vault`. Its answer is 'The right one'. */
const PROBE_QUESTION = 'rules-check-q';

/**
 * The gate is no longer a fixed twenty seconds — it is `durationSecs` on the
 * room — so the probe picks its own, and the two windows exist for opposite
 * reasons.
 *
 * The deny checks need a window long enough to still be open when they run:
 * roughly a dozen network round-trips separate them from the write that opened
 * the question, and a reveal refused because the gate had already *closed*
 * would look exactly like one refused because the gate works.
 *
 * The allow check is the one that has to sit and wait, and this is where the
 * minute goes. It re-opens the question with the shortest window the rules
 * accept, which is also what proves the gate is being read from the document
 * rather than assumed — against the old ruleset this check waits five seconds
 * and is then refused for the remaining fifteen, which is exactly the failure
 * that should be loud.
 */
const LONG_WINDOW_SECS = 120;
const SHORT_WINDOW_SECS = 5;

/** The server measures the gate on its own clock, so leave it a moment. */
const GATE_SLACK_MS = 1_500;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Puts a real question in front of a room owned by this client, so the reveal
 * checks have something legitimate to ask about. Returns when the server has
 * stamped `openedAt`, which is the moment the gate starts.
 */
async function openProbeQuestion(
  db: Firestore,
  uid: string,
  durationSecs: number,
): Promise<void> {
  const room = doc(db, 'rooms', LIVE_ROOM);
  const player = { name: 'Rules check', joinedAt: Date.now() };

  const base = {
    code: LIVE_ROOM,
    players: { [uid]: player },
    packId: null,
    packTitle: null,
    questions: [
      {
        id: PROBE_QUESTION,
        prompt: 'Does the vault open on time?',
        options: ['The right one', 'A wrong one', 'Another wrong one', 'A third wrong one'],
        correctIndex: null,
        category: 'General Knowledge',
        difficulty: 'easy',
      },
    ],
    index: 0,
    questionOpenedAt: null,
    scores: { [uid]: 0 },
    lastDeltas: {},
    skipped: [],
    gameId: 'rules-check',
  };

  const existing = await getDoc(room);
  if (!existing.exists()) {
    await setDoc(room, { ...base, phase: 'lobby', questions: [] });
  }

  // Back to the lobby first, so `openedAt` is genuinely being written by a
  // transition *into* a question — the only shape the rules will stamp.
  //
  // `durationSecs` is deliberately absent from this write and present on the
  // next one. The rules refuse to let it move except on a write that opens a
  // question, and this reset is not one — setting it here fails the very
  // invariant these checks exist to prove, which is exactly what happened the
  // first time the new ruleset went live. Left out of `base` rather than
  // deleted afterwards, so it cannot drift back in.
  await updateDoc(room, { ...base, phase: 'lobby', questions: [] });
  await updateDoc(room, {
    ...base,
    phase: 'question',
    durationSecs,
    openedAt: serverTimestamp(),
  });
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — run with --env-file=.env.local`);
  return value;
}

const config = {
  apiKey: required('VITE_FIREBASE_API_KEY'),
  authDomain: required('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: required('VITE_FIREBASE_PROJECT_ID'),
  appId: required('VITE_FIREBASE_APP_ID'),
  databaseURL: required('VITE_FIREBASE_DATABASE_URL'),
};

/**
 * A denial has to be recognised as a denial. Treating *any* rejection as proof
 * that the rules are working would turn a flaky network into a clean bill of
 * health, which is the one result this script must never invent.
 */
function isPermissionDenied(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
  const message = error instanceof Error ? error.message : String(error);
  // Firestore says `permission-denied`, the Realtime Database says
  // `PERMISSION_DENIED` on the code and a bare "Permission denied" in the
  // message. Flattening the separators matches all three.
  const haystack = `${code} ${message}`.toLowerCase().replace(/[-_]/g, ' ');
  return haystack.includes('permission denied');
}

interface Check {
  label: string;
  /** Whether the rules are supposed to let this through. */
  expect: 'allow' | 'deny';
  hint: string;
  run: () => Promise<unknown>;
}

async function main(): Promise<void> {
  const app = initializeApp(config, 'check-rules');
  await attachDebugAppCheck(app);
  const credential = await signInAnonymously(getAuth(app));
  const uid = credential.user.uid;
  const db = getFirestore(app);
  const rtdb = getDatabase(app);

  /**
   * A second, genuinely separate anonymous client.
   *
   * Nothing else here needs one, and this does: the whole point of a recovery
   * code is that a *different browser* takes on an identity, and the rule branch
   * that permits it — a `claims` lookup rather than `playerId == uid` — cannot
   * be reached from the client that owns the identity already, because the first
   * branch short-circuits before it. Signed in as one user and merely reasoned
   * about, that branch would be exactly as proven as the season transaction is,
   * which is to say not at all.
   */
  const appB = initializeApp(config, 'check-rules-claimer');
  await attachDebugAppCheck(appB);
  const credentialB = await signInAnonymously(getAuth(appB));
  const uidB = credentialB.user.uid;
  const dbB = getFirestore(appB);

  console.log(
    `Project ${config.projectId}, signed in anonymously as ${uid.slice(0, 8)}… `
      + `and ${uidB.slice(0, 8)}…`,
  );
  console.log(`The last check waits out a real ${SHORT_WINDOW_SECS}-second gate.\n`);

  // Opened up front so the deny checks below have a genuinely live question to
  // ask about — a reveal refused because nothing is in play would look exactly
  // like a reveal refused by the time gate, and prove nothing. On a long window,
  // because a dozen round-trips happen before the last of them runs.
  await openProbeQuestion(db, uid, LONG_WINDOW_SECS);

  /**
   * Fresh per run, because a `recovery` document cannot be updated — a fixed
   * code would exist from the second run onwards and the mint check would then
   * be failing for the wrong reason. Deleted at the end, which the rules permit
   * for whoever owns it.
   */
  const probeCode = `RC${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const presence = ref(rtdb, `presence/${PROBE_ROOM}/${uid}`);
  const ownSeasonRow = doc(db, 'seasons', ANY_SEASON, 'players', uid);
  const ownWeekRow = doc(db, 'seasons', PROBE_WEEK, 'players', uid);

  const validSeasonRow = {
    name: 'Rules check',
    played: 1,
    wins: 1,
    points: 1000,
    best: 1000,
    lastGame: 'rules-check',
    lastPlayed: Date.now(),
  };

  const checks: Check[] = [
    {
      label: 'Firestore   · read a room',
      expect: 'allow',
      hint: 'publish firestore.rules',
      run: () => getDoc(doc(db, 'rooms', 'ZZZZ')),
    },
    {
      label: 'Firestore   · list every room',
      expect: 'deny',
      hint: 'firestore.rules still grants `list` on /rooms — anyone signed in can '
        + 'enumerate every live room, its players and its questions. Republish.',
      run: () => getDocs(query(collection(db, 'rooms'), limit(1))),
    },
    {
      label: 'Firestore   · create a room owned by someone else',
      expect: 'deny',
      hint: 'firestore.rules lets a room be created without its creator in it',
      run: () =>
        setDoc(doc(db, 'rooms', PROBE_ROOM), {
          code: PROBE_ROOM,
          phase: 'lobby',
          players: { 'not-my-uid': { name: 'Probe', joinedAt: Date.now() } },
          packId: null,
          packTitle: null,
          questions: [],
          index: 0,
          questionOpenedAt: null,
          scores: {},
          lastDeltas: {},
          skipped: [],
          gameId: null,
        }),
    },
    {
      label: "Firestore   · write another player's answer",
      expect: 'deny',
      hint: 'firestore.rules lets one player overwrite another player’s answer',
      run: () =>
        setDoc(doc(db, 'rooms', 'ZZZZ', 'answers', 'not-my-uid'), {
          optionIndex: 0,
          elapsedMs: 0,
          questionIndex: 0,
        }),
    },
    {
      label: 'Firestore   · read the season table',
      expect: 'allow',
      hint: 'firestore.rules is missing the seasons/{season}/players block',
      run: () => getDocs(query(collection(db, 'seasons', ANY_SEASON, 'players'), limit(1))),
    },
    {
      // The one path recordGame depends on, exercised end to end. It had never
      // run against a real project before the security review.
      label: 'Firestore   · write your own season row',
      expect: 'allow',
      hint: 'firestore.rules is missing the seasons/{season}/players block — '
        + 'the final screen will fail to bank anybody’s result',
      run: () => setDoc(ownSeasonRow, validSeasonRow),
    },
    {
      // Banking writes two documents in one transaction — the season and the
      // week — so half of every game depends on this path.
      label: 'Firestore   · write a row into a weekly bucket',
      expect: 'allow',
      hint: 'the season rule no longer accepts an arbitrary {season} segment — '
        + 'every game will bank its season half and lose its week half',
      run: () => setDoc(ownWeekRow, validSeasonRow),
    },
    {
      label: 'Firestore   · write an impossible season row (wins > played)',
      expect: 'deny',
      hint: 'firestore.rules is missing the season range checks',
      run: () => setDoc(ownSeasonRow, { ...validSeasonRow, played: 1, wins: 99 }),
    },
    {
      label: "Firestore   · write someone else's season row",
      expect: 'deny',
      hint: 'firestore.rules lets anyone rewrite another player’s standings',
      run: () =>
        setDoc(doc(db, 'seasons', ANY_SEASON, 'players', 'not-my-uid'), validSeasonRow),
    },
    {
      // The bound was published ahead of the feature. This is the check that it
      // was published *correctly* — a row that cannot carry a team is a league
      // table nobody can join, and the failure would only appear at bank time.
      label: 'Firestore   · write a season row carrying a team',
      expect: 'allow',
      hint: 'firestore.rules does not list `team` in the season row keys — '
        + 'nobody can be put in a league',
      run: () => setDoc(ownSeasonRow, { ...validSeasonRow, team: 'Engineering' }),
    },
    {
      label: 'Firestore   · write a season row with an oversized team',
      expect: 'deny',
      hint: 'firestore.rules is missing the length bound on `team` — a field on '
        + 'a document the whole office reads can be inflated without limit',
      run: () => setDoc(ownSeasonRow, { ...validSeasonRow, team: 'E'.repeat(200) }),
    },
    {
      label: 'Firestore   · write a season row with a fantasy rosette count',
      expect: 'deny',
      hint: 'firestore.rules is missing the honour bounds on the season row — a '
        + 'trophy shelf can hold more rosettes than there were rounds to win them',
      run: () => setDoc(ownSeasonRow, { ...validSeasonRow, played: 1, fastest: 99 }),
    },
    {
      // The whole identity mechanism in one check. `recovery` documents are
      // create-only and only for an identity the writer already holds, which is
      // what stops somebody reading a playerId off the season table — they are
      // the document ids of a readable collection — and minting a way into it.
      label: 'Firestore   · mint a recovery code for your own identity',
      expect: 'allow',
      hint: 'firestore.rules is missing the /recovery block — nobody can move '
        + 'their season record to a second device',
      run: () => setDoc(doc(db, 'recovery', probeCode), { playerId: uid }),
    },
    {
      label: "Firestore   · mint a recovery code for someone else's identity",
      expect: 'deny',
      hint: 'firestore.rules is missing ownsPlayer() on /recovery create — '
        + 'anyone can read a playerId off the season table, mint a code for it, '
        + 'claim it, and then write that person’s row',
      run: () =>
        setDoc(doc(db, 'recovery', `${probeCode}X`), { playerId: 'not-my-uid' }),
    },
    {
      label: 'Firestore   · repoint an existing recovery code',
      expect: 'deny',
      hint: 'firestore.rules allows update on /recovery — a code handed out '
        + 'once can be aimed at a different identity afterwards',
      run: () => updateDoc(doc(db, 'recovery', probeCode), { playerId: 'not-my-uid' }),
    },
    {
      label: 'Firestore   · list the recovery collection',
      expect: 'deny',
      hint: 'firestore.rules grants list on /recovery — the codes are the whole '
        + 'security of this mechanism and they could be harvested in one query',
      run: () => getDocs(query(collection(db, 'recovery'), limit(1))),
    },
    {
      label: 'Firestore   · claim an identity with a code that does not exist',
      expect: 'deny',
      hint: 'firestore.rules does not check the claim against /recovery — a '
        + 'browser can simply assert somebody else’s playerId',
      run: () =>
        setDoc(doc(dbB, 'claims', uidB), { playerId: uid, code: 'NOSUCHCD' }),
    },
    {
      label: "Firestore   · write another player's season row without claiming it",
      expect: 'deny',
      hint: 'firestore.rules is not gating the season row on ownsPlayer() — a '
        + 'second browser can write a record it has no code for',
      run: () =>
        setDoc(doc(dbB, 'seasons', ANY_SEASON, 'players', uid), validSeasonRow),
    },
    {
      // The allow half of the pair above, from a genuinely separate client. This
      // is the check that would otherwise leave everybody stranded on one
      // browser, and it is the only one that reaches the `claims` branch of
      // ownsPlayer() — the uid branch short-circuits before it everywhere else.
      label: 'Firestore   · claim an identity with a live code, on a second client',
      expect: 'allow',
      hint: 'firestore.rules is missing the /claims block, or its lookup into '
        + '/recovery is wrong — the recovery code will be refused on every device',
      run: () => setDoc(doc(dbB, 'claims', uidB), { playerId: uid, code: probeCode }),
    },
    {
      // And now the same write that was denied two checks ago must succeed,
      // which is the entire mechanism proved end to end rather than assumed.
      label: 'Firestore   · write the claimed identity’s season row',
      expect: 'allow',
      hint: 'ownsPlayer() is not consulting /claims, or exists() is missing '
        + 'before get() — a player who moved device cannot bank a game',
      run: () =>
        setDoc(doc(dbB, 'seasons', ANY_SEASON, 'players', uid), validSeasonRow),
    },
    {
      label: 'Firestore   · read the vault',
      expect: 'deny',
      hint: 'firestore.rules is missing the /vault block — every answer in the '
        + 'game is readable, and the packs no longer carry them precisely so '
        + 'that this document is the only copy',
      run: () => getDoc(doc(db, 'vault', PROBE_QUESTION)),
    },
    {
      label: 'Firestore   · write the vault',
      expect: 'deny',
      hint: 'firestore.seed.rules is still published. Publish firestore.rules — '
        + 'until you do, anybody can overwrite the answers',
      run: () => setDoc(doc(db, 'vault', PROBE_QUESTION), { a: 'tampered' }),
    },
    {
      label: 'Firestore   · list the vault',
      expect: 'deny',
      hint: 'firestore.rules grants `list` on /vault — one query returns every '
        + 'answer in the game',
      run: () => getDocs(query(collection(db, 'vault'), limit(1))),
    },
    {
      label: 'Firestore   · reveal an answer while the clock is running',
      expect: 'deny',
      hint: 'firestore.rules is missing the reveal time gate — the answer can be '
        + 'had before anybody has finished answering, which is the whole point '
        + 'of the vault',
      run: () =>
        setDoc(doc(db, 'rooms', LIVE_ROOM, 'reveal', PROBE_QUESTION), {
          answer: 'The right one',
        }),
    },
    {
      label: 'Firestore   · backdate a question to open the gate early',
      expect: 'deny',
      hint: 'firestore.rules is missing `openedAt == request.time` — a member '
        + 'can claim a question opened ten minutes ago and unlock it at once',
      run: () =>
        updateDoc(doc(db, 'rooms', LIVE_ROOM), {
          index: 1,
          openedAt: Timestamp.fromMillis(Date.now() - 600_000),
        }),
    },
    {
      // The hole the configurable window opens, and the reason `timingOk`
      // covers two fields instead of one. Lowering the duration under a live
      // question would open the vault early while every other screen in the
      // room still showed the time they were promised — silent, which is the
      // one property that separates a cheat from vandalism.
      label: 'Firestore   · shorten the window while a question is open',
      expect: 'deny',
      hint: 'firestore.rules does not pin `durationSecs` while a question is '
        + 'open — any member can drop it and take the answer out of the vault '
        + 'before anybody else has finished answering',
      run: () => updateDoc(doc(db, 'rooms', LIVE_ROOM), { durationSecs: SHORT_WINDOW_SECS }),
    },
    {
      // The floor. Restarting a question has always been possible — writing the
      // room out of `question` and back in restamps `openedAt` — and was
      // harmless while the gate was fixed, because it could only ever delay the
      // vault. Reading the window from the document makes that same move a way
      // to shorten the gate, and this bound is what stops it going to zero.
      label: 'Firestore   · open a question with a one-second window',
      expect: 'deny',
      hint: 'firestore.rules is missing the bounds on `durationSecs` — a member '
        + 'can restart a question with a window short enough to have the answer '
        + 'out of the vault before anyone notices the timer moved',
      run: () =>
        updateDoc(doc(db, 'rooms', LIVE_ROOM), {
          index: 1,
          durationSecs: 1,
          openedAt: serverTimestamp(),
        }),
    },
    {
      label: 'Firestore   · ask about a question that is not in play',
      expect: 'deny',
      hint: 'firestore.rules does not pin the reveal to the current question — '
        + 'one open question leaks the answers to all the others',
      run: () =>
        setDoc(doc(db, 'rooms', LIVE_ROOM, 'reveal', 'some-other-question'), {
          answer: 'The right one',
        }),
    },
    {
      // The path a round reads before it picks its questions. If this is
      // denied, every round silently falls back to repeating whatever it likes.
      label: 'Firestore   · read and write a pack’s question history',
      expect: 'allow',
      hint: 'firestore.rules is missing the seasons/{season}/asked block — '
        + 'rounds will stop avoiding questions the season has already served',
      run: async () => {
        const reference = doc(db, 'seasons', ANY_SEASON, 'asked', 'rules-check-pack');
        await setDoc(reference, { ids: ['a', 'b'], at: Date.now() });
        return deleteDoc(reference);
      },
    },
    {
      label: 'Firestore   · write an unbounded question history',
      expect: 'deny',
      hint: 'firestore.rules is missing the size cap on seasons/{season}/asked — '
        + 'a document every round reads can be inflated without limit',
      run: () =>
        setDoc(doc(db, 'seasons', ANY_SEASON, 'asked', 'rules-check-pack'), {
          ids: Array.from({ length: 1_200 }, (_, i) => `q${i}`),
          at: Date.now(),
        }),
    },
    {
      label: 'Realtime DB · write presence',
      expect: 'allow',
      hint: 'publish database.rules.json — closed tabs will never be cleaned up',
      run: () => set(presence, { name: 'Rules check', at: Date.now() }),
    },
    {
      label: 'Realtime DB · read presence',
      expect: 'allow',
      hint: 'publish database.rules.json',
      run: () => get(ref(rtdb, `presence/${PROBE_ROOM}`)),
    },
    {
      label: "Realtime DB · write another player's presence",
      expect: 'deny',
      hint: 'database.rules.json lets anyone write presence as somebody else',
      run: () => set(ref(rtdb, `presence/${PROBE_ROOM}/not-my-uid`), { name: 'X', at: Date.now() }),
    },
    {
      label: 'Realtime DB · attach an unexpected field to your presence',
      expect: 'deny',
      hint: 'database.rules.json is missing the `$other` validate — presence '
        + 'entries can carry arbitrary payloads',
      run: () => set(presence, { name: 'Rules check', at: Date.now(), junk: 'x'.repeat(64) }),
    },
    {
      label: 'Realtime DB · read the whole database',
      expect: 'deny',
      hint: 'database.rules.json is missing its root deny',
      run: () => get(ref(rtdb, '/')),
    },
    {
      // Last, because it waits out a real gate. This is the direction that
      // ruins a quiz night rather than merely leaking one: if the vault never
      // opens, no question can be scored and the round stops dead at the first
      // reveal.
      //
      // It is also what proves the window is read from the room rather than
      // hardcoded. Re-opened on the *short* window, so against a ruleset that
      // still assumes twenty seconds this waits five and is then refused —
      // which is the whole point of running it.
      label: 'Firestore   · reveal an answer once the clock has run out',
      expect: 'allow',
      hint: 'the reveal cannot complete — check the /vault block is published, '
        + 'that `npm run seed-vault` has been run, and that the reveal gate '
        + 'reads `durationSecs` off the room rather than a fixed twenty seconds',
      run: async () => {
        // Re-opened rather than reusing the question the deny checks poked at,
        // so this proves the gate opens on its own terms.
        await openProbeQuestion(db, uid, SHORT_WINDOW_SECS);
        await sleep(SHORT_WINDOW_SECS * 1000 + GATE_SLACK_MS);
        const reveal = doc(db, 'rooms', LIVE_ROOM, 'reveal', PROBE_QUESTION);
        await setDoc(reveal, { answer: 'The right one' });
        // Deletable by design, so the next run can prove this again.
        return deleteDoc(reveal);
      },
    },
  ];

  let failed = 0;

  for (const check of checks) {
    let outcome: 'allowed' | 'denied' | 'errored' = 'allowed';
    let detail = '';

    try {
      await check.run();
    } catch (error) {
      outcome = isPermissionDenied(error) ? 'denied' : 'errored';
      detail = (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '';
    }

    const expected = check.expect === 'allow' ? 'allowed' : 'denied';

    if (outcome === expected) {
      console.log(`  PASS  ${check.label}`);
      continue;
    }

    failed += 1;
    console.log(`  FAIL  ${check.label}`);
    if (outcome === 'errored') {
      console.log('        did not complete, so nothing was proved either way');
      console.log(`        ${detail}`);
    } else {
      console.log(`        expected to be ${expected}, was ${outcome}`);
      if (detail) console.log(`        ${detail}`);
      console.log(`        → ${check.hint}`);
    }
  }

  // Best effort. A leftover under the throwaway season id or the probe room is
  // never read by the app, and only exists at all if a check already failed.
  //
  // The claim goes first: while it stands, uidB owns this row, and the delete
  // below is only permitted to somebody who owns it. Revoking the recovery code
  // is what stops these accumulating a document per run — `recovery` is the one
  // collection here whose contents cannot simply be overwritten next time.
  await deleteDoc(doc(dbB, 'claims', uidB)).catch(() => undefined);
  await deleteDoc(ownSeasonRow).catch(() => undefined);
  await deleteDoc(ownWeekRow).catch(() => undefined);
  await deleteDoc(doc(db, 'recovery', probeCode)).catch(() => undefined);
  await remove(presence).catch(() => undefined);

  console.log(
    failed === 0
      ? '\nBoth rulesets are live, and still refusing what they should.'
      : `\n${failed} check(s) failed — republish the rules before playing.`,
  );

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('check-rules failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
