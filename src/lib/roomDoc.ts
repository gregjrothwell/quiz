import { serverTimestamp, Timestamp, type DocumentData } from 'firebase/firestore';
import type { AnswerDoc } from '../engine/answers';
import { readBrowsing, readPackVotes, readVoteTaps, writesTheVote } from '../engine/packVote';
import { LEGACY_DURATION_SECS, type Answer, type RoomState } from '../engine/state';

/**
 * The room document and the room state, translated both ways.
 *
 * Moved out of `useRoom.ts` on 15 October 2026 so that something other than the
 * app can write a room the way the app does. `useRoom` imports `src/firebase.ts`,
 * which reads `import.meta.env` and so cannot load under Node (AGENTS.md, What
 * bites 1); the e2e rules cases and the harnesses can load this. The text below
 * moved verbatim.
 */

/**
 * Fields the engine owns but that are not persisted on the room document.
 * `answers` lives in a subcollection so that a player answering does not push a
 * room-document update to every other client — that fan-out is what burns the
 * Firestore free tier.
 */
export type PersistedRoom = Omit<RoomState, 'answers'>;

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
export function openedAtMillis(data: DocumentData | undefined): number | null {
  const value: unknown = data?.['openedAt'];
  return value instanceof Timestamp ? value.toMillis() : null;
}

/**
 * `at` off an answer document. A resolved Timestamp becomes milliseconds; a
 * pending `serverTimestamp()` write, or a document that predates the field,
 * is absent so `liveAnswers` keeps the shape every earlier round produced.
 */
function stampMillis(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Timestamp) return value.toMillis();
  return undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function answerDocFrom(data: DocumentData): AnswerDoc | null {
  const optionIndex = asFiniteNumber(data.optionIndex);
  const elapsedMs = asFiniteNumber(data.elapsedMs);
  const questionIndex = asFiniteNumber(data.questionIndex);
  if (optionIndex === undefined || elapsedMs === undefined || questionIndex === undefined) {
    return null;
  }
  const at = stampMillis(data.at);
  return {
    optionIndex,
    elapsedMs,
    questionIndex,
    ...(typeof data.firstMs === 'number' ? { firstMs: data.firstMs } : {}),
    ...(typeof data.wager === 'number' ? { wager: data.wager } : {}),
    ...(at === undefined ? {} : { at }),
  };
}

/** Answer documents carry the question index so a stale answer never scores. */
export function toRoomState(code: string, data: DocumentData, answers: Record<string, Answer>): RoomState {
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
    // Absent in every room created before the wager, and `undefined` is not
    // `false` — `isWagerQuestion` would read as neither on nor off. Defaulted
    // here for the same reason `durationSecs` and `form` are.
    wagerEnabled: persisted.wagerEnabled ?? false,
    // Absent in every room created before the steal, and defaulted for the
    // same reason as the line above.
    stealEnabled: persisted.stealEnabled ?? false,
    jigsawEnabled: persisted.jigsawEnabled ?? false,
    // `null` rather than undefined: Firestore rejects undefined outright, and
    // every room from before the steal has no field at all.
    lastSteal: persisted.lastSteal ?? null,
    // Absent in every room from before Share or Shaft, defaulted for the reason
    // the wager's flag is.
    standoffEnabled: persisted.standoffEnabled ?? false,
    history: persisted.history ?? {},
    standoff: persisted.standoff ?? null,
    // Absent in every room from before the vote, and writable by any member,
    // so read through the guards rather than trusted.
    packVotes: readPackVotes(data['packVotes']),
    voteTaps: readVoteTaps(data['voteTaps']),
    browsing: readBrowsing(data['browsing']),
    // Absent in every room made before W3, which is what makes it one: such a
    // room keeps the derived quizmaster. See `resolveHost`.
    hostUid: typeof data['hostUid'] === 'string' ? data['hostUid'] : null,
    lastPicks: readPicks(data['lastPicks']),
  };
}

/**
 * The published picks, read through the same guard as an answer document: the
 * host writes them, but the rules cannot walk a map, so what arrives is checked
 * here rather than trusted.
 */
function readPicks(value: unknown): Record<string, Answer> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const picks: Record<string, Answer> = {};
  for (const [uid, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const parsed = answerDocFrom({ ...(entry as DocumentData), questionIndex: 0 });
    if (!parsed) continue;
    const { optionIndex, elapsedMs, firstMs, wager, at } = parsed;
    picks[uid] = {
      optionIndex,
      elapsedMs,
      ...(firstMs === undefined ? {} : { firstMs }),
      ...(wager === undefined ? {} : { wager }),
      ...(at === undefined ? {} : { at }),
    };
  }
  return picks;
}

/**
 * Strips the subcollection-backed `answers` before writing. Listed field by
 * field on purpose: adding a field to RoomState without deciding how it
 * persists then fails to compile here rather than silently going missing.
 */
export function toPersisted(state: RoomState): PersistedRoom {
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
    wagerEnabled: state.wagerEnabled,
    stealEnabled: state.stealEnabled,
    jigsawEnabled: state.jigsawEnabled,
    lastSteal: state.lastSteal,
    standoffEnabled: state.standoffEnabled,
    history: state.history,
    standoff: state.standoff,
    packVotes: state.packVotes,
    voteTaps: state.voteTaps,
    browsing: state.browsing,
    hostUid: state.hostUid,
    lastPicks: state.lastPicks,
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
export function toUpdate(state: RoomState, previous: RoomState | null): Record<string, unknown> {
  const persisted = toPersisted(state);
  const update: Record<string, unknown> = { ...persisted };

  delete update.players;
  delete update.scores;
  // The chair moves only by Leave or a claim, each its own write. A dispatch is
  // folded over this device's snapshot, so writing it here could hand the chair
  // back to whoever this device last saw holding it.
  delete update.hostUid;

  // The lobby vote travels as `packVotes.{uid}` field writes, for the reason
  // `players` does. Written whole only when crossing the lobby, to clear it.
  if (!writesTheVote(previous?.phase ?? null, state.phase)) {
    delete update.packVotes;
    delete update.voteTaps;
    delete update.browsing;
  }

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
export function opensAQuestion(next: RoomState, previous: RoomState | null): boolean {
  if (next.phase !== 'question') return false;
  if (!previous || previous.phase !== 'question') return true;
  return previous.index !== next.index;
}

/**
 * Which question a lamp belongs to (W3): `lamps/{code}/{lampKey}/{uid}` in the
 * Realtime Database. `gameId` because "Another round" reuses the room.
 *
 * Here rather than in `useRoom.ts` so the harnesses light their seats' lamps
 * under the same key the app reads (`scripts/lamp.ts`).
 */
export function lampKey(gameId: string | null, index: number): string {
  return `${gameId ?? 'none'}:${index}`;
}
