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
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { firebaseAuth, firestore, realtimeDb } from '../firebase';
import { reduce, type Action } from '../engine/reducer';
import { liveAnswers, type AnswerDoc } from '../engine/answers';
import { forgetRoom, rememberRoom, rememberedRoom } from './rememberedRoom';
import {
  estimateSkew,
  questionOriginMs,
  rememberDelta,
  type ClockDeltas,
} from '../engine/roomClock';
import { planJoin } from '../engine/join';
import { reapAbsent } from '../engine/presence';
import {
  LEGACY_DURATION_SECS,
  createRoom,
  questionDurationMs,
  resolveQuizmaster,
  type Answer,
  type Phase,
  type Player,
  type RoomState,
} from '../engine/state';
import { randomRoomCode } from '../engine/roomCode';
import { playerIdFor } from './identity';
import { rememberName, rememberedName } from './rememberedName';

/**
 * Fields the engine owns but that are not persisted on the room document.
 * `answers` lives in a subcollection so that a player answering does not push a
 * room-document update to every other client — that fan-out is what burns the
 * Firestore free tier.
 */
type PersistedRoom = Omit<RoomState, 'answers'>;

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

/**
 * `openedAt` off a raw snapshot, in milliseconds.
 *
 * Read here rather than through `toRoomState` because it is not part of
 * `RoomState` and should not become part of it: no screen renders it, and the
 * one thing that needs it needs the *server's* value rather than anything a
 * client could have written. Anything that is not a resolved `Timestamp` — a
 * pending write, an older room, a field that never landed — reads as null, and
 * the clock falls back to counting locally.
 */
function openedAtMillis(data: DocumentData | undefined): number | null {
  const value: unknown = data?.['openedAt'];
  return value instanceof Timestamp ? value.toMillis() : null;
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
  submitAnswer: (optionIndex: number, elapsedMs: number) => Promise<void>;
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

/** Answer documents carry the question index so a stale answer never scores. */
function toRoomState(code: string, data: DocumentData, answers: Record<string, Answer>): RoomState {
  const persisted = data as PersistedRoom;
  return {
    ...persisted,
    code,
    answers,
    // A room started before the window was selectable has no field, and the
    // rules fall back to the same twenty with `get('durationSecs', 20)`. Not
    // the lobby's default, which is ten and has nothing to do with this — see
    // LEGACY_DURATION_SECS. Filled in here, at the one place a document becomes
    // state, so nothing downstream has to defend against a missing number.
    durationSecs: persisted.durationSecs ?? LEGACY_DURATION_SECS,
    // Every room that predates the opening titles has no field at all, and
    // `undefined` is not `null` — `coldOpenRunning` tests against null, so
    // leaving it undefined would read as "the titles are up" in every room
    // created before this shipped. Defaulted here for the same reason
    // `durationSecs` is: so nothing downstream has to defend against it.
    form: persisted.form ?? null,
  };
}

/**
 * Strips the subcollection-backed `answers` before writing. Listed field by
 * field on purpose: adding a field to RoomState without deciding how it
 * persists then fails to compile here rather than silently going missing.
 */
function toPersisted(state: RoomState): PersistedRoom {
  return {
    code: state.code,
    phase: state.phase,
    players: state.players,
    packId: state.packId,
    packTitle: state.packTitle,
    questions: state.questions,
    index: state.index,
    durationSecs: state.durationSecs,
    questionOpenedAt: state.questionOpenedAt,
    scores: state.scores,
    lastDeltas: state.lastDeltas,
    skipped: state.skipped,
    gameId: state.gameId,
    form: state.form,
  };
}

/**
 * What a phase transition is allowed to write.
 *
 * Two things are deliberately not written wholesale:
 *
 * `players` is omitted entirely. A dispatch folds actions over the *writer's*
 * snapshot, so writing the whole map back stamps their view of who is in the
 * room over everyone else's — anybody who joined in the moment between that
 * snapshot and the write is erased. With two people it is a rare race; with ten
 * joining as the code is read out it is close to guaranteed. Membership is only
 * ever changed through single-field writes (`players.{uid}`), so no phase
 * transition needs to touch the map at all.
 *
 * `scores` is expanded into one field path per player so the write merges
 * instead of replacing. A late joiner's zero then survives a round starting.
 *
 * Derived from {@link toPersisted} by destructuring rather than listed afresh,
 * so a new field on RoomState still fails to compile until someone decides how
 * it persists.
 */
function toUpdate(state: RoomState, previous: RoomState | null): Record<string, unknown> {
  const persisted = toPersisted(state);
  const update: Record<string, unknown> = { ...persisted };

  delete update.players;
  delete update.scores;

  for (const [uid, score] of Object.entries(persisted.scores)) {
    update[`scores.${uid}`] = score;
  }

  // `openedAt` is the server's own record of when the question went live, and
  // the vault's time gate is measured from it. It is written with
  // `serverTimestamp()` and the rules require exactly that, so no client can
  // claim a question opened earlier than it did and unlock the answer early.
  // See src/lib/vault.ts.
  if (opensAQuestion(state, previous)) update.openedAt = serverTimestamp();

  return update;
}

/**
 * Whether this transition puts a *new* question in front of the room, as
 * opposed to any other write while one is open.
 *
 * The distinction matters because a player joining mid-question is also an
 * update to a room whose phase is `question`, and restamping `openedAt` for
 * that would hand everybody a fresh window — and, worse, would let a steady
 * trickle of joins hold the vault shut indefinitely.
 */
function opensAQuestion(next: RoomState, previous: RoomState | null): boolean {
  if (next.phase !== 'question') return false;
  if (!previous || previous.phase !== 'question') return true;
  return previous.index !== next.index;
}

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
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
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
   * first, which is four writes and a network round trip, and every answer that
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

  // Answers subcollection. Everyone subscribes, but documents are small and only
  // written once per player per question.
  useEffect(() => {
    if (!code) return;

    return onSnapshot(answersCollection(code), (snapshot) => {
      const next: Record<string, AnswerDoc> = {};
      for (const document of snapshot.docs) {
        next[document.id] = document.data() as AnswerDoc;
      }
      setAnswers(next);
    });
  }, [code]);

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
      rtdbSet(own, { name: nameRef.current, at: Date.now() }).then(
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
    const live = liveAnswers(persisted.players, persisted.index, answers as Record<string, AnswerDoc>);
    return toRoomState(code, persisted, live);
  }, [code, persisted, answers]);

  const quizmasterUid = room ? resolveQuizmaster(room.players) : null;
  const isQuizmaster = Boolean(uid && quizmasterUid === uid);

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
   * which is four writes and a round trip. An answer arriving in that gap is in
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

        const fresh = reduce(createRoom(candidate), {
          type: 'join',
          uid,
          name,
          at: Date.now(),
          // Creating a room does not go through `writeSelfIntoRoom`, so the
          // creator's identity has to be carried here too — otherwise the one
          // person guaranteed to be in every room is the one whose season record
          // the opening titles could not find.
          playerId: playerIdFor(uid),
        });
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

  const leave = useCallback(async (): Promise<void> => {
    if (!code || !uid) return;
    const leavingCode = code;
    const leavingUid = uid;

    // Drop out locally first, so leaving always works.
    //
    // `forgetRoom` before anything else, and it is the whole risk in restoring a
    // room at all: leave it stored and Leave becomes a button that drops you out
    // and puts you straight back on the next reload.
    forgetRoom();
    setCode(null);
    setPersisted(null);
    setAnswers({});

    // The two cleanup writes are best-effort. Once the local listeners are gone
    // the rules can stop recognising this client as a member and refuse them,
    // which used to surface as a permission error on an action that had already
    // succeeded. Nothing is leaked by a failure here: the RTDB onDisconnect
    // handler drops presence anyway, and the quizmaster reaps stale players.
    await rtdbRemove(presenceRef(leavingCode, leavingUid)).catch(() => undefined);
    await updateDoc(roomDoc(leavingCode), {
      [`players.${leavingUid}`]: deleteField(),
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
  const submitAnswer = useCallback(
    async (optionIndex: number, elapsedMs: number): Promise<void> => {
      if (!code || !uid || !room) return;
      if (room.phase !== 'question') return;
      if (elapsedMs > questionDurationMs(room)) return;

      // Pressing the lectern you already chose is not a change, and writing it
      // again would restamp `elapsedMs` to the later moment — quietly costing
      // speed points for a tap that altered nothing. Easy to do by accident: a
      // double-tap on a phone, or pressing again to confirm. It also keeps a
      // fidgety player from fanning a write out to every other client for free.
      if (room.answers[uid]?.optionIndex === optionIndex) return;

      const answer: AnswerDoc = { optionIndex, elapsedMs, questionIndex: room.index };
      await setDoc(doc(answersCollection(code), uid), answer);
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

  const questionKey = room && room.phase === 'question' ? `${room.gameId ?? ''}:${room.index}` : null;

  return {
    uid,
    room,
    code,
    connection,
    error,
    isQuizmaster,
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
  };
}
