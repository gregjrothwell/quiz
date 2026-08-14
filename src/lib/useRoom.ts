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
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { firebaseAuth, firestore, realtimeDb } from '../firebase';
import { reduce, type Action } from '../engine/reducer';
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
import { rememberName } from './rememberedName';

/**
 * Fields the engine owns but that are not persisted on the room document.
 * `answers` lives in a subcollection so that a player answering does not push a
 * room-document update to every other client — that fan-out is what burns the
 * Firestore free tier.
 */
type PersistedRoom = Omit<RoomState, 'answers'>;

export type ConnectionState = 'connecting' | 'ready' | 'error';

export interface UseRoom {
  uid: string | null;
  room: RoomState | null;
  connection: ConnectionState;
  error: string | null;
  isQuizmaster: boolean;
  /**
   * False when this device cannot write its presence entry, which means players
   * who close a tab will linger in the lobby. The game itself is unaffected.
   */
  presenceWorking: boolean;
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

/** Answer documents carry the question index so a stale answer never scores. */
interface AnswerDoc extends Answer {
  questionIndex: number;
}

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
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [code, setCode] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [error, setError] = useState<string | null>(null);

  const [presenceWorking, setPresenceWorking] = useState(true);

  const nameRef = useRef<string>('');
  const absentSinceRef = useRef<Record<string, number>>({});
  const playersRef = useRef<Record<string, Player>>({});
  const phaseRef = useRef<Phase>('lobby');

  /**
   * This client's place in the queue, remembered so that coming back from a
   * reap does not cost the quizmaster their role — `resolveQuizmaster` picks
   * the longest-present player, and a fresh `joinedAt` would send them to the
   * back.
   */
  const joinedAtRef = useRef<number | null>(null);

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
      (snapshot) => {
        setPersisted(snapshot.exists() ? (snapshot.data() as PersistedRoom) : null);
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
    const live: Record<string, Answer> = {};
    for (const [answerUid, answer] of Object.entries(answers as Record<string, AnswerDoc>)) {
      if (answer.questionIndex !== persisted.index) continue;
      if (!persisted.players[answerUid]) continue;
      live[answerUid] = { optionIndex: answer.optionIndex, elapsedMs: answer.elapsedMs };
    }
    return toRoomState(code, persisted, live);
  }, [code, persisted, answers]);

  const quizmasterUid = room ? resolveQuizmaster(room.players) : null;
  const isQuizmaster = Boolean(uid && quizmasterUid === uid);

  // Read by the reaper's Realtime Database callback, which must not have `room`
  // in its dependencies — see the reaper effect below.
  useEffect(() => {
    playersRef.current = room?.players ?? {};
    phaseRef.current = room?.phase ?? 'lobby';

    // Remember our place in the queue every time we see ourselves in the room,
    // rather than only when we write ourselves in. Creating a room never goes
    // through `writeSelfIntoRoom`, so a creator who was reaped used to come
    // back stamped with the current time — losing the quizmaster role to
    // whoever had been there second longest.
    const mine = uid ? room?.players[uid] : undefined;
    if (mine) joinedAtRef.current = mine.joinedAt;
  }, [room, uid]);


  /**
   * Applies an engine action and persists the result. The quizmaster drives
   * every phase transition, so the reducer runs on exactly one device and the
   * others simply render what it wrote.
   */
  const dispatch = useCallback(
    async (action: Action | Action[]): Promise<void> => {
      if (!room || !code) return;

      // Actions are folded together and written once. Dispatching twice in a row
      // instead would run the second against this closure's stale `room`, so
      // e.g. `start` would not see the questions `selectPack` just added and
      // would silently do nothing.
      const actions = Array.isArray(action) ? action : [action];
      const next = actions.reduce(reduce, room);
      if (next === room) return;

      await updateDoc(roomDoc(code), toUpdate(next, room) as Partial<DocumentData>);
    },
    [room, code],
  );

  const writeSelfIntoRoom = useCallback(
    async (targetCode: string, targetUid: string, name: string): Promise<void> => {
      const player: Player = { name, joinedAt: Date.now() };
      const snapshot = await getDoc(roomDoc(targetCode));
      if (!snapshot.exists()) throw new Error(`Room ${targetCode} does not exist`);

      const data = snapshot.data() as PersistedRoom;
      const existing = data.players[targetUid];

      // Preserve the original joinedAt on a reconnect, or a returning
      // quizmaster would drop to the back of the queue and lose the role.
      // `joinedAtRef` covers the case where the entry is gone entirely — a
      // rejoin after being reaped — where there is nothing left to read it off.
      const restored = joinedAtRef.current;
      const entry = existing ?? (restored === null ? player : { name, joinedAt: restored });

      await updateDoc(roomDoc(targetCode), {
        [`players.${targetUid}`]: entry,
        // Never reset a score that is already on the board. Somebody rejoining
        // mid-round has been earning points all along — the reveal tallies
        // whoever answered, member or not — and zeroing them here would turn a
        // recovered player into a punished one.
        [`scores.${targetUid}`]: data.scores[targetUid] ?? 0,
      });

      joinedAtRef.current = entry.joinedAt;
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
        });
        await setDoc(roomDoc(candidate), toPersisted(fresh));
        setCode(candidate);
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
    },
    [uid, adoptName, writeSelfIntoRoom],
  );

  const leave = useCallback(async (): Promise<void> => {
    if (!code || !uid) return;
    const leavingCode = code;
    const leavingUid = uid;

    // Drop out locally first, so leaving always works.
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

  return {
    uid,
    room,
    connection,
    error,
    isQuizmaster,
    presenceWorking,
    createAndJoin,
    join,
    leave,
    dispatch,
    submitAnswer,
  };
}
