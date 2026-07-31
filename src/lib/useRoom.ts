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
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { firebaseAuth, firestore, realtimeDb } from '../firebase';
import { reduce, type Action } from '../engine/reducer';
import {
  createRoom,
  resolveQuizmaster,
  type Answer,
  type Player,
  type RoomState,
} from '../engine/state';
import { randomRoomCode } from '../engine/roomCode';

/**
 * How long a player must be continuously absent from presence before anyone
 * removes them. Absorbs brief reconnects — without it, a dropped WiFi packet
 * ejects someone mid-question and, worse, can hand the quizmaster role away and
 * back again.
 */
const STALE_GRACE_MS = 8_000;

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
  return { ...persisted, code, answers };
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
    questionOpenedAt: state.questionOpenedAt,
    scores: state.scores,
    lastDeltas: state.lastDeltas,
    skipped: state.skipped,
  };
}

export function useRoom(): UseRoom {
  const [uid, setUid] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<PersistedRoom | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [code, setCode] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [error, setError] = useState<string | null>(null);

  const nameRef = useRef<string>('');
  const absentSinceRef = useRef<Record<string, number>>({});

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
      void rtdbSet(own, { name: nameRef.current, at: Date.now() });
    });

    return () => {
      unsubscribe();
      void onDisconnect(own).cancel();
      void rtdbRemove(own);
    };
  }, [code, uid]);

  const room = useMemo<RoomState | null>(() => {
    if (!code || !persisted) return null;
    // Only answers for the question in play count, so a document left over from
    // the previous question is ignored rather than scored again.
    const live: Record<string, Answer> = {};
    for (const [answerUid, answer] of Object.entries(answers as Record<string, AnswerDoc>)) {
      if (answer.questionIndex === persisted.index) {
        live[answerUid] = { optionIndex: answer.optionIndex, elapsedMs: answer.elapsedMs };
      }
    }
    return toRoomState(code, persisted, live);
  }, [code, persisted, answers]);

  const quizmasterUid = room ? resolveQuizmaster(room.players) : null;
  const isQuizmaster = Boolean(uid && quizmasterUid === uid);

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

      await updateDoc(roomDoc(code), toPersisted(next) as Partial<DocumentData>);
    },
    [room, code],
  );

  const writeSelfIntoRoom = useCallback(
    async (targetCode: string, targetUid: string, name: string): Promise<void> => {
      const player: Player = { name, joinedAt: Date.now() };
      const snapshot = await getDoc(roomDoc(targetCode));
      if (!snapshot.exists()) throw new Error(`Room ${targetCode} does not exist`);

      const existing = (snapshot.data() as PersistedRoom).players[targetUid];
      // Preserve the original joinedAt on a reconnect, or a returning quizmaster
      // would drop to the back of the queue and lose the role.
      await updateDoc(roomDoc(targetCode), {
        [`players.${targetUid}`]: existing ?? player,
        [`scores.${targetUid}`]: (snapshot.data() as PersistedRoom).scores[targetUid] ?? 0,
      });
    },
    [],
  );

  const createAndJoin = useCallback(
    async (name: string): Promise<string> => {
      if (!uid) throw new Error('Not signed in yet');
      nameRef.current = name;

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
    [uid],
  );

  const join = useCallback(
    async (targetCode: string, name: string): Promise<void> => {
      if (!uid) throw new Error('Not signed in yet');
      nameRef.current = name;
      await writeSelfIntoRoom(targetCode, uid, name);
      setCode(targetCode);
    },
    [uid, writeSelfIntoRoom],
  );

  const leave = useCallback(async (): Promise<void> => {
    if (!code || !uid) return;
    await rtdbRemove(presenceRef(code, uid));
    await updateDoc(roomDoc(code), { [`players.${uid}`]: deleteField() });
    setCode(null);
    setPersisted(null);
    setAnswers({});
  }, [code, uid]);

  const submitAnswer = useCallback(
    async (optionIndex: number, elapsedMs: number): Promise<void> => {
      if (!code || !uid || !room) return;
      if (room.phase !== 'question') return;
      if (room.answers[uid]) return;

      const answer: AnswerDoc = { optionIndex, elapsedMs, questionIndex: room.index };
      await setDoc(doc(answersCollection(code), uid), answer);
    },
    [code, uid, room],
  );

  // Reap players whose presence has been gone longer than the grace window. Only
  // the quizmaster does this, so several clients cannot race the same removal.
  useEffect(() => {
    if (!code || !room || !isQuizmaster) return;

    const presence = rtdbRef(realtimeDb(), `presence/${code}`);

    return onValue(presence, (snapshot) => {
      const present = new Set(Object.keys((snapshot.val() as Record<string, unknown>) ?? {}));
      const now = Date.now();
      const absentSince = absentSinceRef.current;

      for (const playerUid of Object.keys(room.players)) {
        if (present.has(playerUid)) {
          delete absentSince[playerUid];
          continue;
        }

        const since = absentSince[playerUid];
        if (since === undefined) {
          absentSince[playerUid] = now;
          continue;
        }
        if (now - since < STALE_GRACE_MS) continue;

        delete absentSince[playerUid];
        void updateDoc(roomDoc(code), { [`players.${playerUid}`]: deleteField() });
      }
    });
  }, [code, room, isQuizmaster]);

  return {
    uid,
    room,
    connection,
    error,
    isQuizmaster,
    createAndJoin,
    join,
    leave,
    dispatch,
    submitAnswer,
  };
}
