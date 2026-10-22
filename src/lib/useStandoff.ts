import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import {
  commitmentDoc,
  freshNonce,
  hasCommitted,
  openedPick,
  revealDoc,
  sealedPickDocFrom,
  type SealedPickDoc,
} from '../engine/sealedPick';
import {
  PICK_MS,
  REVEAL_GRACE_MS,
  TALK_MS,
  type StandoffPick,
} from '../engine/standoff';
import type { RoomState } from '../engine/state';
import { rememberPick, rememberedPick, type RememberedPick } from './rememberedPick';

/**
 * Share or Shaft, wired to Firestore: the sealed picks, the two clocks, and the
 * quizmaster's three moves — end the talk, blow the whistle, settle.
 *
 * The rules of the final are the engine's (`standoff.ts`, `sealedPick.ts`); this
 * is only the plumbing that gets documents to and from it. The picks live in
 * `rooms/{code}/standoff/{uid}`, one per player, listened to only while a final
 * is on — every other round pays nothing for them.
 *
 * The clocks count on each screen from when it saw the stage open, the fallback
 * the question clock uses where it cannot measure itself against the server.
 * Nothing is scored on them: they pace the room, and the quizmaster's device —
 * the one that moves the stages — is the only clock that decides anything.
 */

interface StageClock {
  elapsedMs: number;
  remainingMs: number;
  secondsLeft: number;
  expired: boolean;
}

/**
 * Keyed by a string rather than the question clock's number, so that every
 * stage of every game is a fresh count. With a reused key the previous count
 * survives into the next final for the frame before the first tick — which on
 * the quizmaster's device reads as "time is up" and ends the talk before
 * anybody has said a word.
 */
function useStageClock(key: string | null, durationMs: number): StageClock {
  const [reading, setReading] = useState<{ key: string | null; elapsedMs: number }>({
    key: null,
    elapsedMs: 0,
  });

  useEffect(() => {
    if (key === null) return;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      setReading({ key, elapsedMs: Date.now() - startedAt });
    }, 100);
    return () => clearInterval(interval);
  }, [key]);

  const elapsedMs = key !== null && reading.key === key ? reading.elapsedMs : 0;
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  return {
    elapsedMs,
    remainingMs,
    secondsLeft: Math.ceil(remainingMs / 1000),
    expired: key !== null && remainingMs === 0,
  };
}

export interface StandoffView {
  /** Which finalists have locked in. Every screen shows this; none shows a pick. */
  lockedIn: Record<string, boolean>;
  /** This device's own pick once locked, and only ever on the device that made it. */
  myPick: StandoffPick | null;
  /** Whole seconds left on the talk or the pick, as this screen counts them. */
  secondsLeft: number;
  /** The same, unrounded, for the sweep around the clock. */
  remainingMs: number;
  pick: (choice: StandoffPick) => void;
}

/** The screen's view, plus what `useHost` needs to move the final on. */
export interface StandoffState extends StandoffView {
  /** Finalists with a commitment for this game, in finalist order. */
  committed: readonly string[];
  /** The sealed picks, opened; null while checking, and always on a device that is not the host. */
  opened: Readonly<Record<string, StandoffPick | null>> | null;
}

interface Options {
  code: string | null;
  uid: string | null;
  room: RoomState | null;
  isQuizmaster: boolean;
  onError: (cause: unknown) => void;
}

const NO_DOCS: Record<string, SealedPickDoc> = {};
const NO_ONE: string[] = [];

export function useStandoff({
  code,
  uid,
  room,
  isQuizmaster,
  onError,
}: Options): StandoffState {
  const standoff = room?.phase === 'standoff' ? room.standoff : null;
  const stage = standoff?.stage ?? null;
  const gameId = room?.gameId ?? '';
  const finalists = standoff?.finalists ?? NO_ONE;
  const sealed = useMemo(() => standoff?.sealed ?? NO_ONE, [standoff?.sealed]);
  const amFinalist = uid !== null && finalists.includes(uid);

  // Held in a ref so a new `onError` — App's changes with the room — does not
  // tear down and re-open the listener below.
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const [held, setHeld] = useState<{ code: string; docs: Record<string, SealedPickDoc> }>({
    code: '',
    docs: NO_DOCS,
  });
  const listening = code !== null && standoff !== null;

  useEffect(() => {
    if (!code || !listening) return;
    return onSnapshot(
      collection(firestore(), 'rooms', code, 'standoff'),
      (snapshot) => {
        const next: Record<string, SealedPickDoc> = {};
        for (const document of snapshot.docs) {
          const parsed = sealedPickDocFrom(document.data());
          if (parsed) next[document.id] = parsed;
        }
        setHeld({ code, docs: next });
      },
      (cause) => onErrorRef.current(cause),
    );
  }, [code, listening]);

  const docs = held.code === code ? held.docs : NO_DOCS;

  const talk = useStageClock(stage === 'talk' ? `${gameId}:talk` : null, TALK_MS);
  const picking = useStageClock(stage === 'pick' ? `${gameId}:pick` : null, PICK_MS);
  const closing = useStageClock(stage === 'closed' ? `${gameId}:closed` : null, REVEAL_GRACE_MS);

  // ── This device's own pick ──────────────────────────────────────────────

  const [mine, setMine] = useState<{ gameId: string; remembered: RememberedPick } | null>(null);
  const myDoc = uid ? docs[uid] : undefined;
  const myCommitted = hasCommitted(myDoc, gameId);
  // After a reload the commitment is on the server and the pick is in storage.
  const remembered =
    mine?.gameId === gameId ? mine.remembered : amFinalist && myCommitted ? rememberedPick(gameId) : null;
  const rememberedChoice = remembered?.pick ?? null;
  const rememberedNonce = remembered?.nonce ?? null;
  const locked = remembered !== null || myCommitted;

  const pick = useCallback(
    (choice: StandoffPick) => {
      if (!code || !uid || !gameId || !amFinalist || stage !== 'pick' || locked) return;

      const next: RememberedPick = { pick: choice, nonce: freshNonce() };
      // Stored before the write, so a reload the instant after tapping can
      // still open the commitment that landed.
      rememberPick(gameId, next);
      setMine({ gameId, remembered: next });

      void commitmentDoc(choice, next.nonce, gameId, uid)
        .then((written) => setDoc(doc(firestore(), 'rooms', code, 'standoff', uid), written))
        .catch((cause: unknown) => {
          // Nothing reached the server, so nothing is locked: they can pick again.
          setMine(null);
          onErrorRef.current(cause);
        });
    },
    [code, uid, gameId, amFinalist, stage, locked],
  );

  // Opened once the whistle has gone, and only by a finalist who was sealed by
  // it. Before the whistle an early reveal would hand the pick to an opponent
  // still able to commit; after it, nothing new can count.
  const sealedIn = uid !== null && sealed.includes(uid);
  const myRevealed = myDoc?.pick !== undefined;
  const revealedRef = useRef<string | null>(null);
  const closeTick = Math.floor(closing.elapsedMs / 1000);

  useEffect(() => {
    if (!code || !uid || stage !== 'closed' || !sealedIn || myRevealed) return;
    if (rememberedChoice === null || rememberedNonce === null) return;
    const key = `${gameId}:${uid}`;
    if (revealedRef.current === key) return;
    revealedRef.current = key;

    updateDoc(
      doc(firestore(), 'rooms', code, 'standoff', uid),
      revealDoc(rememberedChoice, rememberedNonce),
    ).catch((cause: unknown) => {
      // Cleared so the next tick tries again.
      revealedRef.current = null;
      onErrorRef.current(cause);
    });
  }, [code, uid, stage, sealedIn, myRevealed, rememberedChoice, rememberedNonce, gameId, closeTick]);

  // ── What the host needs to move the final on ────────────────────────────
  //
  // The moves themselves — end the talk, blow the whistle, settle — are
  // `src/host/due.ts`'s, run by `useHost`. This hands it what only this hook can
  // see: who has committed, and the sealed picks opened against their commitments.

  // `sealed` at the whistle is who had committed by then, as this device saw it —
  // the engine counts nobody else's pick.
  const committedKey = finalists.filter((finalist) => hasCommitted(docs[finalist], gameId)).join(',');
  const committed = useMemo(() => (committedKey ? committedKey.split(',') : NO_ONE), [committedKey]);

  // Opening a pick is a hash, so it is async; null until the check has run for
  // these documents.
  const [opened, setOpened] = useState<{
    from: Record<string, SealedPickDoc>;
    gameId: string;
    picks: Record<string, StandoffPick | null>;
  } | null>(null);

  useEffect(() => {
    if (!isQuizmaster || stage !== 'closed') return;
    let live = true;
    void Promise.all(
      sealed.map(async (finalist) => [finalist, await openedPick(docs[finalist], gameId, finalist)] as const),
    ).then((entries) => {
      if (live) setOpened({ from: docs, gameId, picks: Object.fromEntries(entries) });
    });
    return () => {
      live = false;
    };
  }, [isQuizmaster, stage, sealed, docs, gameId]);

  const verified = opened !== null && opened.from === docs && opened.gameId === gameId ? opened.picks : null;

  const lockedIn = Object.fromEntries(
    finalists.map((finalist) => [
      finalist,
      hasCommitted(docs[finalist], gameId) || (finalist === uid && remembered !== null),
    ]),
  );

  return {
    lockedIn,
    myPick: rememberedChoice,
    secondsLeft: stage === 'pick' ? picking.secondsLeft : talk.secondsLeft,
    remainingMs: stage === 'pick' ? picking.remainingMs : talk.remainingMs,
    pick,
    committed,
    opened: verified,
  };
}
