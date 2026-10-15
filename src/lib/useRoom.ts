import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import {
  onDisconnect,
  onValue,
  ref as rtdbRef,
  remove as rtdbRemove,
  set as rtdbSet,
} from 'firebase/database';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
// The beat and the claim go over Lite, as the vault's candidates do: a write the
// rules refuse is a 403 on its own request there, and does not close the main
// SDK's write stream under the answers. See `resolveAnswer` in vault.ts.
import {
  doc as liteDoc,
  serverTimestamp as liteServerTimestamp,
  setDoc as liteSetDoc,
  writeBatch as liteWriteBatch,
} from 'firebase/firestore/lite';
import { firebaseAuth, firestore, realtimeDb, vaultFirestore } from '../firebase';
import {
  BEAT_EVERY_MS,
  CLAIM_RETRY_MS,
  planClaim,
  resolveHost,
  successorOnLeave,
} from '../engine/host';
import { reduce, type Action } from '../engine/reducer';
import { carryFirstMs, firstTouchOf, liveAnswers, type AnswerDoc } from '../engine/answers';
import {
  answerDocFrom,
  openedAtMillis,
  toPersisted,
  toRoomState,
  toUpdate,
  type PersistedRoom,
} from './roomDoc';
import { forgetRoom, rememberRoom, rememberedRoom } from './rememberedRoom';
import { rememberedPlayingWith, rememberedSquad } from './rememberedSquad';
import { sideFor } from '../engine/squadScore';
import {
  estimateSkew,
  questionOriginMs,
  rememberDelta,
  type ClockDeltas,
} from '../engine/roomClock';
import { planJoin, planSeatSquad } from '../engine/join';
import { reapAbsent } from '../engine/presence';
import {
  createRoom,
  isWagerQuestion,
  questionDurationMs,
  type Phase,
  type Player,
  type RoomState,
} from '../engine/state';
import { randomRoomCode } from '../engine/roomCode';
import type { PackId } from '../questions/types';
import { playerIdFor } from './identity';
import { rememberName, rememberedName } from './rememberedName';

/**
 * What this device knows about the question in play: when it first heard about
 * it, and when the server says it opened.
 *
 * `openedAtMs` is null on any snapshot that has not carried the server's stamp
 * yet, which is every pending write and the first delivery on the device that
 * opened the question.
 */
interface QuestionConfirmation {
  key: string;
  at: number;
  openedAtMs: number | null;
}

export type ConnectionState = 'connecting' | 'ready' | 'error';

export interface UseRoom {
  uid: string | null;
  room: RoomState | null;
  /**
   * The room this tab is in, which is set a beat before {@link room} is — it is
   * restored from storage on the first render, where `room` waits for a
   * snapshot.
   *
   * Exposed for exactly one caller: the auto-join in `App` must not fire a stale
   * join link at a tab that is already restoring a different room, and `room`
   * alone leaves a window in which it would.
   */
  code: string | null;
  connection: ConnectionState;
  error: string | null;
  isQuizmaster: boolean;
  /**
   * Who has answered the question in play, as uids: the RTDB lamps (W3), plus
   * every answer this device can read. Since W3 a player reads only their own
   * answer before the reveal, so the lamps are how they see the room commit.
   */
  lamps: ReadonlySet<string>;
  /**
   * Whether this device holds every answer to the question in play, read from
   * the server. Always true where it never reads them all; false for a host
   * whose listener has not delivered yet — a player who has just claimed the
   * chair mid-question, above all — so the reveal cannot score an empty room.
   */
  answersReady: boolean;
  /**
   * False when this device cannot write its presence entry, which means players
   * who close a tab will linger in the lobby. The game itself is unaffected.
   */
  presenceWorking: boolean;
  /**
   * When this device received the first **server-confirmed** snapshot of the
   * question now in play, on its own clock. Null until one arrives.
   *
   * This is not the same as when the question appeared on screen, and the
   * difference is the whole reason it exists. Firestore's latency compensation
   * delivers a write back as a local snapshot before the server has seen it, so
   * the device that *opened* the question — always the quizmaster, always the
   * one that reveals — sees it a round trip before `openedAt` is stamped. Its
   * countdown therefore expires marginally *before* the vault's gate opens, and
   * the reveal is refused. See `src/engine/revealGate.ts` for the ordering
   * argument and the live measurements behind it.
   */
  questionConfirmedAt: number | null;
  /**
   * When the question in play opened, translated onto **this device's clock** —
   * so every screen in the room counts the same window from the same moment
   * however late its own snapshot arrived.
   *
   * Null whenever that cannot be worked out, and the caller then counts from its
   * own arrival exactly as it always did. See `src/engine/roomClock.ts`.
   */
  questionOriginAt: number | null;
  createAndJoin: (name: string) => Promise<string>;
  join: (code: string, name: string) => Promise<void>;
  leave: () => Promise<void>;
  dispatch: (action: Action | Action[]) => Promise<void>;
  submitAnswer: (optionIndex: number, elapsedMs: number, wager?: number) => Promise<void>;
  writeOwnSquad: (squad: string) => Promise<void>;
  /** This player's lobby vote, or null to take it back. */
  writeOwnVote: (packId: PackId | null) => Promise<void>;
  /** The quizmaster's highlighted pack, shown to the room. */
  writeBrowsing: (packId: PackId | null) => Promise<void>;
}

function roomDoc(code: string) {
  return doc(firestore(), 'rooms', code);
}

function answersCollection(code: string) {
  return collection(firestore(), 'rooms', code, 'answers');
}

function presenceRef(code: string, uid: string) {
  return rtdbRef(realtimeDb(), `presence/${code}/${uid}`);
}

/** Which question a lamp belongs to. `gameId` because "Another round" reuses the room. */
function lampKey(gameId: string | null, index: number): string {
  return `${gameId ?? 'none'}:${index}`;
}

function lampsRef(code: string, key: string) {
  return rtdbRef(realtimeDb(), `lamps/${code}/${key}`);
}

/**
 * Takes the chair: `hostUid` and a fresh beat, in one batch, so a second
 * claimant finds the beat fresh and is refused. The rules allow it only once
 * the old beat is 75 s old (`claim()` in firestore.rules).
 */
async function claimChair(code: string, uid: string): Promise<void> {
  const db = vaultFirestore();
  const batch = liteWriteBatch(db);
  batch.update(liteDoc(db, 'rooms', code), { hostUid: uid });
  batch.set(liteDoc(db, 'rooms', code, 'host', 'beat'), { at: liteServerTimestamp() });
  await batch.commit();
}

/** What the answers listener last delivered, and for which feed. */
interface AnswersFeed {
  key: string;
  docs: Record<string, AnswerDoc>;
  /** Delivered from the server rather than the local cache. */
  fromServer: boolean;
}

interface LampsFeed {
  key: string;
  lit: ReadonlySet<string>;
}

const NO_LAMPS: ReadonlySet<string> = new Set();
const NO_ANSWERS: Record<string, AnswerDoc> = {};

/**
 * How long a finished room is kept before a TTL policy may remove it.
 *
 * The room is disposable the moment its game ends — the season row is what
 * outlives it, and that lives somewhere else entirely. What the retention buys
 * is being able to look back at what a room actually did after somebody
 * complains about it, which is a question that has come up more than once.
 *
 * A month is long enough for that and short enough that colleagues' names are
 * not sitting on a public project indefinitely. Change it here; the policy in
 * the Google Cloud console names the field, never a duration.
 */
const ROOM_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;


export function useRoom(): UseRoom {
  const [uid, setUid] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<PersistedRoom | null>(null);
  /**
   * Keyed by question so the moment belongs to the question it was measured for,
   * the same shape the reveal retry counter uses. A bare timestamp would survive
   * into the next question and open its gate early.
   */
  const [questionConfirmed, setQuestionConfirmed] = useState<QuestionConfirmation>({
    key: '',
    at: 0,
    openedAtMs: null,
  });
  /**
   * One reading per question of how far after `openedAt` this device saw it, for
   * working out its own clock offset from the server. See `roomClock.ts`.
   */
  const [clockDeltas, setClockDeltas] = useState<ClockDeltas>({});
  const [answersFeed, setAnswersFeed] = useState<AnswersFeed>({ key: '', docs: {}, fromServer: false });
  const [lampsFeed, setLampsFeed] = useState<LampsFeed>({ key: '', lit: NO_LAMPS });
  /*
    Restored on the first render rather than in an effect, and that ordering is
    load-bearing: the auto-join in `App` refuses while this tab is already in a
    room, and an effect would leave a window where the room was null and a stale
    join link could fire for a different room entirely.

    Session storage, so this is *this tab tonight* and not this browser — see
    `rememberedRoom`.
  */
  const [code, setCode] = useState<string | null>(() => rememberedRoom() || null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [error, setError] = useState<string | null>(null);

  const [presenceWorking, setPresenceWorking] = useState(true);

  /*
    Seeded from storage, not left empty.

    A reload restores the room but not this ref, and the rejoin effect below
    writes `nameRef.current` back into the players map when the reaper has
    removed somebody who is still playing. Empty, that puts a nameless plate on
    everybody's board — a bug the reload fix would have introduced rather than
    found.
  */
  const nameRef = useRef<string>(rememberedName());
  const absentSinceRef = useRef<Record<string, number>>({});
  const playersRef = useRef<Record<string, Player>>({});
  const phaseRef = useRef<Phase>('lobby');

  /**
   * The newest room this client has seen, for `dispatch` to fold over.
   *
   * A callback holds the room from the render that made it, which is fine for
   * an action dispatched straight away and wrong for one dispatched after an
   * await. The reveal is the case that matters: `handleReveal` asks the vault
   * first, which is up to four writes one after another, and every answer that
   * lands during it belongs to a room object that closure will never see. See
   * `dispatch`.
   */
  const roomRef = useRef<RoomState | null>(null);

  /**
   * This client's place in the queue, remembered so that coming back from a
   * reap does not cost the quizmaster their role — `resolveQuizmaster` picks
   * the longest-present player, and a fresh `joinedAt` would send them to the
   * back.
   *
   * **Stamped with the room it was earned in, and only ever restored into that
   * same room.** This ref outlives a room: it is never cleared, so a tab that
   * has been in one room carries that room's timestamp into the next one it
   * joins. Room 6JA5 on 17 August 2026 has a player whose `joinedAt` is the
   * millisecond they created an entirely different room — they made one by
   * accident, left it, and joined the real one with the number still in hand.
   * That reading is what decides the quizmaster, so a browser that had been
   * sitting in an earlier room could walk into a round already under way and
   * take the transport off the person running it.
   */
  const joinedAtRef = useRef<{ code: string; joinedAt: number } | null>(null);

  /** Guards against stacking rejoin writes while one is already in flight. */
  const rejoiningRef = useRef(false);

  // Anonymous auth gives every browser a durable uid with no sign-up, which is
  // also what makes an accountless cross-session leaderboard possible later.
  useEffect(() => {
    return onAuthStateChanged(firebaseAuth(), (user) => {
      if (user) {
        setUid(user.uid);
        setConnection('ready');
        return;
      }
      signInAnonymously(firebaseAuth()).catch((cause: unknown) => {
        setConnection('error');
        setError(cause instanceof Error ? cause.message : 'Could not sign in');
      });
    });
  }, []);

  // Room document: one listener per client, updated only on phase transitions.
  useEffect(() => {
    if (!code) return;

    return onSnapshot(
      roomDoc(code),
      // `includeMetadataChanges` is what makes `hasPendingWrites` mean anything.
      // Without it the server's acknowledgement of a write this device made is
      // never delivered, because the document did not change — and that
      // acknowledgement is precisely the moment the reveal has to wait for.
      // Metadata changes are local events, so this costs no extra reads.
      { includeMetadataChanges: true },
      (snapshot) => {
        /*
          A room that is not there any more is one to stop claiming to be in.

          It matters now that the code is restored from storage: without this a
          tab that had been in a room since pruned would hold a dead code for
          ever, which is only untidy on its own — but `code` is what tells the
          auto-join this tab is busy, so a dead one would quietly stop a
          perfectly good join link from working.
        */
        if (!snapshot.exists()) {
          forgetRoom();
          setCode(null);
          setPersisted(null);
          return;
        }

        const data = snapshot.data() as PersistedRoom;
        setPersisted(data);

        // Recorded per question, and only from a snapshot the server has
        // acknowledged. `??=` inside the guard keeps the *first* such moment
        // rather than the latest, since a later update to the same question
        // would push the reveal further out for no reason.
        if (!data || data.phase !== 'question' || snapshot.metadata.hasPendingWrites) return;
        const key = `${data.gameId ?? ''}:${data.index}`;
        // Read once: two calls a line apart would put a millisecond of nothing
        // into a measurement whose whole job is to be a millisecond reading.
        const at = Date.now();
        const openedAtMs = openedAtMillis(snapshot.data());

        setQuestionConfirmed((current) =>
          current.key === key ? current : { key, at, openedAtMs },
        );

        // `arrival − openedAt` is this device's skew plus that question's
        // latency. The minimum across a round is the skew on its own, because
        // latency is never negative.
        if (openedAtMs !== null) {
          setClockDeltas((held) => rememberDelta(held, key, at - openedAtMs));
        }
      },
      (cause) => {
        setConnection('error');
        setError(cause.message);
      },
    );
  }, [code]);

  /*
    Who this device is in the room, read straight off the document so the
    answers listener below can depend on it without depending on the answers.

    W3: the host reads every answer, everybody else reads their own, and the
    rules refuse anything more. A room made before W3 has no `hostUid`, and
    there every client reads every answer as it always did, so a round in
    flight when the deploy lands plays on unchanged (AC11).
  */
  const roomHostUid = persisted ? (persisted as { hostUid?: unknown }).hostUid : undefined;
  const hostUid = typeof roomHostUid === 'string' ? roomHostUid : null;
  // Not before the room has been read. Until then `hostUid` is unknown, not
  // absent, and a joiner took it for a pre-W3 room: it listed every answer and
  // the rules refused it. When the chair later passed to that joiner, the same
  // query listened again never came back from the server (fromCache stayed
  // true, no error), so the reveal waited forever. Seen in CI on 15 Oct; the
  // SDK's reason is not established, only that gating here cures it (AC8).
  const roomKnown = persisted !== null;
  const readsAll = roomKnown && (hostUid === null || hostUid === uid);
  const feedKey = code && uid ? `${code}:${readsAll ? '*' : uid}` : '';

  // Answers subcollection: the whole of it for whoever may read it, otherwise
  // this player's own document.
  useEffect(() => {
    if (!code || !uid || !roomKnown) return;
    const key = `${code}:${readsAll ? '*' : uid}`;

    if (readsAll) {
      return onSnapshot(answersCollection(code), { includeMetadataChanges: true }, (snapshot) => {
        const next: Record<string, AnswerDoc> = {};
        for (const document of snapshot.docs) {
          const parsed = answerDocFrom(document.data());
          if (parsed) next[document.id] = parsed;
        }
        setAnswersFeed({ key, docs: next, fromServer: !snapshot.metadata.fromCache });
      });
    }

    return onSnapshot(doc(answersCollection(code), uid), (snapshot) => {
      const parsed = snapshot.exists() ? answerDocFrom(snapshot.data()) : null;
      setAnswersFeed({ key, docs: parsed ? { [uid]: parsed } : {}, fromServer: true });
    });
  }, [code, uid, readsAll, roomKnown]);

  const answers = answersFeed.key === feedKey ? answersFeed.docs : NO_ANSWERS;
  const answersReady = !readsAll || (answersFeed.key === feedKey && answersFeed.fromServer);

  // Lamps (W3): who has answered the question in play, from the Realtime
  // Database rather than from the answers nobody else may now read.
  const phaseNow = persisted?.phase ?? null;
  const questionLampKey =
    persisted && phaseNow === 'question' ? lampKey(persisted.gameId ?? null, persisted.index) : null;

  useEffect(() => {
    if (!code || questionLampKey === null) return;
    const key = `${code}/${questionLampKey}`;
    return onValue(lampsRef(code, questionLampKey), (snapshot) => {
      setLampsFeed({ key, lit: new Set(Object.keys((snapshot.val() as Record<string, unknown>) ?? {})) });
    });
  }, [code, questionLampKey]);

  // Presence. Own entry is written with an onDisconnect cleanup so a closed tab
  // removes itself without needing a graceful sign-out.
  useEffect(() => {
    if (!code || !uid) return;

    const own = presenceRef(code, uid);
    const connected = rtdbRef(realtimeDb(), '.info/connected');

    const unsubscribe = onValue(connected, (snapshot) => {
      if (snapshot.val() !== true) return;
      void onDisconnect(own).remove();
      // Reported rather than swallowed. When the Realtime Database rules are
      // missing or unpublished this write fails for everyone, and as a bare
      // `void` it surfaced only as a console warning — presence silently stopped
      // working and the room filled with ghosts with nothing on screen to say so.
      // `name` used to ride along and was never read — the reaper takes
      // Object.keys only. Dropping it is what stops a signed-in client
      // sweeping room codes from harvesting a roster. See
      // docs/decisions/security-round-sept-2026.md.
      rtdbSet(own, { at: Date.now() }).then(
        () => setPresenceWorking(true),
        () => setPresenceWorking(false),
      );
    });

    return () => {
      unsubscribe();
      void onDisconnect(own).cancel();
      void rtdbRemove(own);
    };
  }, [code, uid]);

  const room = useMemo<RoomState | null>(() => {
    if (!code || !persisted) return null;
    // Two filters, for two different stale readings:
    //
    // Only answers for the question in play count, so a document left over from
    // the previous question is ignored rather than scored again.
    //
    // And only answers from people the room lists. Nothing checks membership on
    // the way in, so a client can write an answer to a room it is not a member
    // of — which used to leave the "how many have answered" pips reading more
    // than the number of players.
    const live = liveAnswers(persisted.players, persisted.index, answers);
    const state = toRoomState(code, persisted, live);
    // A player since W3 holds only their own answer until the reveal, which
    // publishes the room's. Their own stays alongside, so an answer that missed
    // the host's fold still reads as "didn't reach the room in time".
    if (readsAll || state.phase === 'question') return state;
    return { ...state, answers: { ...live, ...state.lastPicks } };
  }, [code, persisted, answers, readsAll]);

  const isQuizmaster = Boolean(uid && room && resolveHost(room) === uid);

  const lamps = useMemo<ReadonlySet<string>>(() => {
    if (!room || room.phase !== 'question') return NO_LAMPS;
    const key = `${room.code}/${lampKey(room.gameId, room.index)}`;
    const fromRtdb = lampsFeed.key === key ? lampsFeed.lit : NO_LAMPS;
    return new Set([...fromRtdb, ...Object.keys(room.answers)]);
  }, [room, lampsFeed]);

  // Read by the reaper's Realtime Database callback, which must not have `room`
  // in its dependencies — see the reaper effect below, and by `dispatch`, which
  // must fold over the room as it is *now* rather than as it was when the
  // callback was made.
  useEffect(() => {
    roomRef.current = room;
    playersRef.current = room?.players ?? {};
    phaseRef.current = room?.phase ?? 'lobby';

    // Remember our place in the queue every time we see ourselves in the room,
    // rather than only when we write ourselves in. Creating a room never goes
    // through `writeSelfIntoRoom`, so a creator who was reaped used to come
    // back stamped with the current time — losing the quizmaster role to
    // whoever had been there second longest.
    const mine = uid ? room?.players[uid] : undefined;
    if (mine && code) joinedAtRef.current = { code, joinedAt: mine.joinedAt };
  }, [room, uid, code]);


  /**
   * Applies an engine action and persists the result. The quizmaster drives
   * every phase transition, so the reducer runs on exactly one device and the
   * others simply render what it wrote.
   *
   * **Folded over the newest room this client has seen, not the one this
   * callback was created with.** The difference is the length of an await, and
   * the reveal spends one: `handleReveal` asks the vault before it dispatches,
   * which is up to four writes one after another. An answer arriving in that gap is in
   * a newer room object, and folding over the closure's copy dropped it — the
   * player answered inside the window, watched their lectern light up, and
   * scored nothing, while the round moved on without them. It costs whoever
   * answers latest, on whichever question they cut it finest.
   *
   * It also makes the gap work in the room's favour rather than against it. The
   * quizmaster's clock starts before anybody else's, because they wrote the
   * update they are reacting to, so they call time while everyone else still
   * has a fraction of a second showing. Counting the answers that land during
   * the vault round trip gives that fraction back.
   *
   * The ref is ignored if it belongs to a different room, which can only happen
   * mid-switch.
   */
  const dispatch = useCallback(
    async (action: Action | Action[]): Promise<void> => {
      if (!code) return;

      const latest = roomRef.current;
      const current = latest && latest.code === code ? latest : room;
      if (!current) return;

      // Actions are folded together and written once. Dispatching twice in a row
      // instead would run the second against a stale room, so e.g. `start` would
      // not see the questions `selectPack` just added and would silently do
      // nothing.
      const actions = Array.isArray(action) ? action : [action];
      const next = actions.reduce(reduce, current);
      if (next === current) return;

      await updateDoc(roomDoc(code), toUpdate(next, current) as Partial<DocumentData>);
    },
    [room, code],
  );

  const writeSelfIntoRoom = useCallback(
    async (targetCode: string, targetUid: string, name: string): Promise<void> => {
      const snapshot = await getDoc(roomDoc(targetCode));
      if (!snapshot.exists()) throw new Error(`Room ${targetCode} does not exist`);

      const data = snapshot.data() as PersistedRoom;

      // The place this device already held **in this room**. `joinedAtRef`
      // outlives a room — it is what brings a quizmaster back from a reap with
      // their seat intact — so a value earned somewhere else is discarded here
      // rather than carried in. See the ref's own note.
      const remembered = joinedAtRef.current;
      const restored = remembered?.code === targetCode ? remembered.joinedAt : null;

      // What to write, and why, lives in the engine where a test can reach it.
      const { entry, score } = planJoin({
        players: data.players,
        scores: data.scores,
        phase: data.phase,
        uid: targetUid,
        name,
        playerId: playerIdFor(targetUid),
        /*
          Read here rather than passed in, so the rejoin path gets it too — that
          runs from an effect with nothing to hand it. Storage is the source of
          truth for both halves anyway, and it is the only place a Lurker's side
          for the night exists at all.
        */
        squad: sideFor(rememberedSquad(), rememberedPlayingWith()),
        restored,
        now: Date.now(),
      });

      await updateDoc(roomDoc(targetCode), {
        [`players.${targetUid}`]: entry,
        // Omitted rather than zeroed for somebody arriving after the round is
        // over — absent from `scores` is absent from the standings, which is
        // where they belong until the next round opens one for them.
        ...(score === null ? {} : { [`scores.${targetUid}`]: score }),
      });

      joinedAtRef.current = { code: targetCode, joinedAt: entry.joinedAt };
    },
    [],
  );

  /**
   * Put ourselves back if we are missing from a room we are still in.
   *
   * Membership can be taken away from a client that is alive and playing: the
   * quizmaster's reaper removes anybody whose Realtime Database presence has
   * been gone for a few seconds, and presence runs over a different connection
   * from Firestore. A backgrounded tab, a closed lid or a brief drop is enough.
   *
   * Nothing used to bring them back, and the failure was near-silent. Answers
   * are not checked for membership, so they carried on playing and carried on
   * scoring — but `standings` filters on `players`, so they vanished from every
   * device's leaderboard, and `recordGame` skipped them, so the game never
   * reached their season row. Observed in room 6SVG: 4,300 points, answered the
   * final question, no season row.
   *
   * Leaving is unaffected: `leave` clears the code first, so this cannot fire
   * afterwards and re-add somebody who meant to go.
   */
  useEffect(() => {
    if (!code || !uid || !room) return;
    if (room.players[uid] || rejoiningRef.current) return;

    rejoiningRef.current = true;
    void writeSelfIntoRoom(code, uid, nameRef.current)
      .catch(() => undefined)
      .finally(() => {
        rejoiningRef.current = false;
      });
  }, [code, uid, room, writeSelfIntoRoom]);

  /**
   * Takes on the name this device is playing under: kept in a ref for the
   * presence writer and the rejoin path, and kept in storage so a returning
   * player finds the box already filled in.
   *
   * Both happen on the attempt rather than once the write has landed. A join
   * that fails is a failure about the room — a code typed wrong, a room already
   * gone — not about who they are, and the name they gave is the one they are
   * about to give again.
   */
  const adoptName = useCallback((name: string) => {
    nameRef.current = name;
    rememberName(name);
  }, []);

  const createAndJoin = useCallback(
    async (name: string): Promise<string> => {
      if (!uid) throw new Error('Not signed in yet');
      adoptName(name);

      // Retry on collision — 4-character codes collide occasionally.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = randomRoomCode();
        const existing = await getDoc(roomDoc(candidate));
        if (existing.exists()) continue;

        const joined = reduce(createRoom(candidate), {
          type: 'join',
          uid,
          name,
          at: Date.now(),
          // Creating a room does not go through `writeSelfIntoRoom`, so the
          // creator's identity has to be carried here too — otherwise the one
          // person guaranteed to be in every room is the one whose season record
          // the opening titles could not find.
          playerId: playerIdFor(uid),
          // See the note in `join`: this is the *only* path the room creator
          // takes, and they are in every room.
          squad: sideFor(rememberedSquad(), rememberedPlayingWith()),
        });
        // W3: the creator is the host, named on the room rather than derived.
        // The beat starts from the effect below once this lands.
        const fresh = { ...joined, hostUid: uid };
        // `expiresAt` is storage only — it is not on RoomState and nothing in
        // the app reads it. It exists so a Firestore TTL policy on `rooms` has
        // a field to expire against, because otherwise every room ever created
        // lives forever with its players' names in it and the only way to
        // remove one is the console.
        //
        // **It is an expiry, not a creation stamp.** A TTL policy deletes a
        // document once its timestamp field is in the *past*, so a bare
        // `createdAt` would mark every room eligible the instant it was
        // written. The policy form does offer an optional expiration offset,
        // which would make a `createdAt` work — but then the retention lives in
        // a console field nobody reviews, on a project whose rules have twice
        // been broken by a hand-paste. Kept here instead, where it is versioned
        // and `take-stock` can print it back.
        //
        // Written from the client clock rather than `serverTimestamp()`, which
        // cannot do arithmetic. Skew does not matter: nothing is gated on this,
        // the rules never read it, and being a few minutes out on a thirty-day
        // retention changes nothing.
        //
        // No rules change: `wellFormed()` bounds the fields it names and does
        // not `hasOnly` the document's keys, which is the same reason
        // `openedAt` can be written without being declared. Updates never write
        // it and `updateDoc` merges, so it survives every transition.
        //
        // A TTL sweep deletes the room document, not its `answers` and `reveal`
        // subcollections — those are orphaned rather than removed. That is the
        // right way round: the names are on the document, and what is left
        // behind holds an option index and an answer string.
        await setDoc(roomDoc(candidate), {
          ...toPersisted(fresh),
          expiresAt: Timestamp.fromMillis(Date.now() + ROOM_RETENTION_MS),
        });
        setCode(candidate);
        rememberRoom(candidate);
        return candidate;
      }

      throw new Error('Could not find a free room code, please try again');
    },
    [uid, adoptName],
  );

  const join = useCallback(
    async (targetCode: string, name: string): Promise<void> => {
      if (!uid) throw new Error('Not signed in yet');
      adoptName(name);
      await writeSelfIntoRoom(targetCode, uid, name);
      setCode(targetCode);
      rememberRoom(targetCode);
    },
    [uid, adoptName, writeSelfIntoRoom],
  );

  /**
   * Writes this device's squad onto its existing seat, and nowhere else.
   *
   * Auto-join seats a link-joiner before they can pick a side, so the lobby
   * picker has to stamp `players.{uid}.squad` after the fact. That is a field
   * write, not a rejoin: `planJoin` leaves an existing entry untouched so a
   * reconnect cannot restamp `joinedAt` and move the quizmaster.
   *
   * Only the lobby. Once the show starts the side is frozen.
   */
  const writeOwnSquad = useCallback(
    async (squad: string): Promise<void> => {
      if (!code || !uid || !room) return;
      const plan = planSeatSquad({
        existing: room.players[uid],
        phase: room.phase,
        squad: sideFor(squad, rememberedPlayingWith()),
      });
      if (plan.kind === 'skip') return;

      await updateDoc(roomDoc(code), {
        [`players.${uid}.squad`]: plan.kind === 'clear' ? deleteField() : plan.squad,
      });
    },
    [code, uid, room],
  );

  /**
   * This device's lobby vote, as one field path so concurrent votes merge.
   * Only the lobby: once the show starts the vote is cleared and means nothing.
   *
   * The tap is counted in the same write, so the limit costs no write of its
   * own and no read anybody was not already making. `increment` rather than a
   * value, so two taps in flight both count.
   */
  const writeOwnVote = useCallback(
    async (packId: PackId | null): Promise<void> => {
      if (!code || !uid || !room || room.phase !== 'lobby') return;
      await updateDoc(roomDoc(code), {
        [`packVotes.${uid}`]: packId ?? deleteField(),
        [`voteTaps.${uid}`]: increment(1),
      });
    },
    [code, uid, room],
  );

  /** The quizmaster's highlighted pack, so the room can see what is being considered. */
  const writeBrowsing = useCallback(
    async (packId: PackId | null): Promise<void> => {
      if (!code || !room || room.phase !== 'lobby' || !isQuizmaster) return;
      if (room.browsing === packId) return;
      await updateDoc(roomDoc(code), { browsing: packId });
    },
    [code, room, isQuizmaster],
  );

  const leave = useCallback(async (): Promise<void> => {
    if (!code || !uid) return;
    const leavingCode = code;
    const leavingUid = uid;
    // Read before the local state is dropped below. A host who leaves hands the
    // chair to the longest-seated of the people left, in the same write (AC7).
    const leavingRoom = roomRef.current;
    const handover =
      leavingRoom && leavingRoom.code === leavingCode && leavingRoom.hostUid === leavingUid
        ? successorOnLeave(leavingRoom.players, leavingUid)
        : null;

    // Drop out locally first, so leaving always works.
    //
    // `forgetRoom` before anything else, and it is the whole risk in restoring a
    // room at all: leave it stored and Leave becomes a button that drops you out
    // and puts you straight back on the next reload.
    forgetRoom();
    setCode(null);
    setPersisted(null);

    // The two cleanup writes are best-effort. Once the local listeners are gone
    // the rules can stop recognising this client as a member and refuse them,
    // which used to surface as a permission error on an action that had already
    // succeeded. Nothing is leaked by a failure here: the RTDB onDisconnect
    // handler drops presence anyway, and the quizmaster reaps stale players.
    await rtdbRemove(presenceRef(leavingCode, leavingUid)).catch(() => undefined);
    await updateDoc(roomDoc(leavingCode), {
      [`players.${leavingUid}`]: deleteField(),
      ...(handover ? { hostUid: handover } : {}),
    }).catch(() => undefined);
  }, [code, uid]);

  /**
   * Writes this device's pick, overwriting any earlier one for the same
   * question — a player may change their mind until the clock runs out.
   *
   * The security rules already allowed this: `answers/{uid}` grants `create,
   * update` with no immutability check, so nothing needed republishing. The only
   * thing that ever stopped a second write was the client refusing to make one.
   *
   * The window is enforced on the way in rather than at scoring time. The live
   * `room.answers` is built straight from the subcollection and filtered only on
   * question and membership — the reducer's own `elapsedMs` guard never runs on
   * this path — so a write that lands after the clock would otherwise be scored.
   * That gap existed before, hidden by the one-answer-only rule that happened to
   * stop anyone writing late.
   */
  /**
   * The earliest lectern this device has touched on the question in play,
   * keyed so a new question starts clean without anything having to clear it.
   *
   * Exists only because Firestore cannot be read back synchronously — see the
   * note in `submitAnswer`. Deliberately a ref and not state: nothing renders
   * from it, and a re-render per keypress during a burst is the last thing the
   * answering path needs.
   */
  const firstTouchRef = useRef<{ key: string; ms: number } | null>(null);

  const submitAnswer = useCallback(
    async (optionIndex: number, elapsedMs: number, wager?: number): Promise<void> => {
      if (!code || !uid || !room) return;
      if (room.phase !== 'question') return;
      if (elapsedMs > questionDurationMs(room)) return;

      // Only the question the room agreed to play for stakes carries one, so a
      // stake left over in the screen's state cannot ride along on any other.
      //
      // **A stake of nothing is left off the document entirely**, rather than
      // written as `wager: 0`. It scores identically either way — `stakeFor`
      // treats absent and zero alike — but it keeps the answer byte-identical to
      // every round before the wager for anybody not betting, and it narrows the
      // blast radius if this is ever deployed before the ruleset is pasted: the
      // refusal then costs the last question only for the players who actually
      // staked, instead of for everybody in the room.
      const staked = isWagerQuestion(room) && wager !== undefined && wager > 0 ? { wager } : {};

      // Pressing the lectern you already chose is not a change, and writing it
      // again would restamp `elapsedMs` to the later moment — quietly costing
      // speed points for a tap that altered nothing. Easy to do by accident: a
      // double-tap on a phone, or pressing again to confirm. It also keeps a
      // fidgety player from fanning a write out to every other client for free.
      //
      // **The stake has to be part of that comparison.** Changing only the
      // stake, on the lectern you had already picked, is a real change and used
      // to be swallowed here in silence — the player would watch their bet do
      // nothing and find out at the reveal.
      const held = room.answers[uid];
      if (held?.optionIndex === optionIndex && held.wager === staked.wager) return;

      // The earliest touch this device knows about, from **both** sources.
      //
      // The document alone is wrong: a player mashing four keys inside 200ms
      // gets no round-trip between them, so presses two, three and four would
      // each see `held` as it was before press one and write nothing — losing
      // the early touch on exactly the input this field exists to record. The
      // ref alone is wrong too: it does not survive a reload or a rejoin, and
      // it is empty on a device that has just picked the room back up.
      //
      // So: whichever is earlier, and the ref is written synchronously below
      // so the next press in a burst can see it.
      const questionKey = `${room.gameId ?? ''}:${room.index}`;
      const remembered =
        firstTouchRef.current?.key === questionKey ? firstTouchRef.current.ms : undefined;
      const knownFirst = [remembered, held && firstTouchOf(held)].filter(
        (ms): ms is number => ms !== undefined,
      );
      const earliest = knownFirst.length > 0 ? Math.min(...knownFirst) : undefined;

      // Absent until a pick is actually changed, which keeps a first answer
      // byte-for-byte what it was before this field existed — the same argument
      // the stake makes above, and the same narrow blast radius if this ever
      // ships ahead of the ruleset paste.
      const first = carryFirstMs(earliest, elapsedMs);

      firstTouchRef.current = { key: questionKey, ms: Math.min(earliest ?? elapsedMs, elapsedMs) };

      const answer: AnswerDoc = {
        optionIndex,
        elapsedMs,
        questionIndex: room.index,
        ...first,
        ...staked,
      };
      const written = setDoc(doc(answersCollection(code), uid), {
        ...answer,
        at: serverTimestamp(),
      });
      // The lamp, beside it (W3). Best-effort: a lamp that fails to light costs
      // the room a dot, never the answer.
      void rtdbSet(
        rtdbRef(realtimeDb(), `lamps/${code}/${lampKey(room.gameId, room.index)}/${uid}`),
        true,
      ).catch(() => undefined);
      await written;
    },
    [code, uid, room],
  );

  // Reap players whose presence has been gone longer than the grace window. Only
  // the quizmaster does this, so several clients cannot race the same removal.
  //
  // `playersRef` and `phaseRef` rather than `room` in the dependency list:
  // `room` is a fresh object on every snapshot, so depending on it tore down and
  // re-established this Realtime Database listener on every phase change and
  // every answer.
  useEffect(() => {
    if (!code || !isQuizmaster) return;

    const presence = rtdbRef(realtimeDb(), `presence/${code}`);

    return onValue(presence, (snapshot) => {
      // The lobby-only policy lives in `reapAbsent`, with the rest of the
      // reaping rules and its tests, rather than here.
      const { remove, absentSince } = reapAbsent({
        players: playersRef.current,
        present: new Set(Object.keys((snapshot.val() as Record<string, unknown>) ?? {})),
        absentSince: absentSinceRef.current,
        now: Date.now(),
        phase: phaseRef.current,
      });

      absentSinceRef.current = absentSince;

      for (const playerUid of remove) {
        void updateDoc(roomDoc(code), { [`players.${playerUid}`]: deleteField() });
      }
    });
  }, [code, isQuizmaster]);

  /*
    The heartbeat (W3, D2 b): while this device holds the chair of a room with
    a host, it writes `rooms/{code}/host/beat` every 15 s. Nobody listens; the
    claim rule reads it. Writes only, about 240 an hour per open room.
  */
  const beating = Boolean(code && uid && hostUid === uid);
  useEffect(() => {
    if (!code || !beating) return;
    const beat = (): void => {
      const db = vaultFirestore();
      void liteSetDoc(liteDoc(db, 'rooms', code, 'host', 'beat'), { at: liteServerTimestamp() }).catch(
        () => undefined,
      );
    };
    beat();
    const timer = window.setInterval(beat, BEAT_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [code, beating]);

  /*
    The claim (W3, AC8): every other device in a room with a host watches
    presence, and the longest-seated present player asks for the chair once the
    host has been gone from it for a while — see `planClaim`. The rules refuse
    until the beat is 75 s old, so this retries every few seconds until then.
  */
  const watchingHost = Boolean(code && uid && hostUid !== null && hostUid !== uid);
  useEffect(() => {
    if (!code || !uid || !watchingHost) return;

    let present: ReadonlySet<string> = new Set();
    let absentSince: number | null = null;
    let asking = false;

    const off = onValue(rtdbRef(realtimeDb(), `presence/${code}`), (snapshot) => {
      present = new Set(Object.keys((snapshot.val() as Record<string, unknown>) ?? {}));
    });

    const timer = window.setInterval(() => {
      const current = roomRef.current;
      if (!current || current.code !== code || asking) return;
      const plan = planClaim({
        hostUid: current.hostUid,
        players: current.players,
        present,
        absentSince,
        now: Date.now(),
        uid,
      });
      absentSince = plan.absentSince;
      if (!plan.claim) return;
      asking = true;
      void claimChair(code, uid)
        .catch(() => undefined)
        .finally(() => {
          asking = false;
        });
    }, CLAIM_RETRY_MS);

    return () => {
      off();
      window.clearInterval(timer);
    };
  }, [code, uid, watchingHost]);

  const questionKey = room && room.phase === 'question' ? `${room.gameId ?? ''}:${room.index}` : null;

  return {
    uid,
    room,
    code,
    connection,
    error,
    isQuizmaster,
    lamps,
    answersReady,
    presenceWorking,
    questionConfirmedAt:
      questionKey !== null && questionConfirmed.key === questionKey ? questionConfirmed.at : null,
    questionOriginAt:
      questionKey !== null && questionConfirmed.key === questionKey
        ? questionOriginMs({
            openedAtMs: questionConfirmed.openedAtMs,
            skewMs: estimateSkew(clockDeltas),
            arrivedAt: questionConfirmed.at,
          })
        : null,
    createAndJoin,
    join,
    leave,
    dispatch,
    submitAnswer,
    writeOwnSquad,
    writeOwnVote,
    writeBrowsing,
  };
}
