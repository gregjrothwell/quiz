import type { QuestionRecord } from './awards';
import type { Difficulty, PackId } from '../questions/types';
import type { Answer, Player, QuizQuestion, RoomState } from './state';

/**
 * How a question was put to the room. Derived from what the question already
 * carries, so a pack needs nothing new written into it for a record to say so.
 */
export type QuestionKind = 'text' | 'melody' | 'picture';

/** One player's response to one question, as the reveal scored it. */
export interface RecordedAnswer {
  optionIndex: number;
  elapsedMs: number;
  firstMs?: number;
  wager?: number;
}

/**
 * What the reveal of one question actually cost, on the device that revealed it.
 *
 * Added 11 September 2026, after round `CUC4` had "a couple of very large delays
 * on revealing the answer" and nothing kept could say which reveals, or which
 * part of one. A developer's suggestion was OpenTelemetry; the honest answer for
 * a static site with no backend is that the payload is four integers on one
 * device, and this document is already being written.
 *
 * **It rides inside `questions` deliberately.** The ruleset bounds the game
 * document at the top level only — it cannot walk a list, so what is inside a
 * question is trusted — which means this needs no rules change and therefore no
 * deploy ordering to get right. A new top-level key would have needed both, and
 * a client that ran ahead of the console would have had every record refused in
 * silence (`keepGameRecord` swallows a refusal on purpose).
 *
 * Every field is milliseconds on the quizmaster's own clock except `attempts`,
 * and all are whole numbers. Absent on a record written by a client that predates
 * this, and on a question that was skipped.
 */
export interface RevealTiming {
  /** Local clock expiring → the gate being provably open. Slow means the server's acknowledgement was late. */
  gateMs: number;
  /** The vault round trip: four candidate writes, three refused. Healthy is under 300ms. */
  resolveMs: number;
  /** The room update that puts the answer on everybody else's screen. */
  dispatchMs: number;
  /** 1 unless the vault refused or the connection stalled. */
  attempts: number;
}

export interface RecordedQuestion {
  id: string;
  index: number;
  category: string;
  difficulty: Difficulty;
  kind: QuestionKind;
  /** Null only when the quizmaster threw the question out before the vault opened. */
  correctIndex: number | null;
  /**
   * Whether the quizmaster threw it out. A question skipped *after* its reveal
   * keeps its answers and the deltas the reveal awarded, because those are what
   * actually happened — but the reducer took the points back, so anything
   * summing `deltas` into a score has to leave a skipped question out.
   */
  skipped: boolean;
  answers: Record<string, RecordedAnswer>;
  deltas: Record<string, number>;
  /** Absent when this device did not reveal the question, or it was skipped. */
  reveal?: RevealTiming;
}

export interface RecordedPlayer {
  name: string;
  squad?: string;
}

/**
 * A finished round, kept.
 *
 * Nothing else keeps one. `rooms/{code}/answers/{uid}` is one document per
 * player, overwritten every question, so by the final screen the room holds the
 * questions and the right answers and not one response — which is why every
 * "did that feature play well?" since the rank bonus has ended on "hard to say".
 *
 * Written once, by one device, into a global `games/{gameId}` collection that no
 * client reads. Not a room subcollection: every client holds an unfiltered
 * listener on those, so an in-room copy would add a second `Q·N²` term to the
 * read cost of every game for data nobody in the room needs.
 */
export interface GameRecord {
  roomCode: string;
  packId: PackId;
  packTitle: string;
  durationSecs: number;
  wagerEnabled: boolean;
  stealEnabled: boolean;
  jigsawEnabled: boolean;
  players: Record<string, RecordedPlayer>;
  scores: Record<string, number>;
  questions: RecordedQuestion[];
  /** The uid whose device wrote it — the only uid the rules let delete it. */
  writtenBy: string;
}

/**
 * Every key the fold produces, so the ruleset's `hasOnly` list can be tested
 * against this rather than kept in step by hand. The write adds one more —
 * `finishedAt`, a server timestamp — which is in {@link GAME_DOCUMENT_KEYS}.
 */
export const GAME_RECORD_KEYS = [
  'roomCode',
  'packId',
  'packTitle',
  'durationSecs',
  'wagerEnabled',
  'stealEnabled',
  'jigsawEnabled',
  'players',
  'scores',
  'questions',
  'writtenBy',
] as const satisfies readonly (keyof GameRecord)[];

/** What the stored document carries, which is the fold plus the server's stamp. */
export const GAME_DOCUMENT_KEYS = [...GAME_RECORD_KEYS, 'finishedAt'] as const;

export function kindOf(
  question: Pick<QuizQuestion, 'voices' | 'image' | 'previewUrl' | 'artworkUrl'>,
): QuestionKind {
  if (question.voices && question.voices.length > 0) return 'melody';
  if (question.previewUrl) return 'melody';
  if (question.image) return 'picture';
  if (question.artworkUrl) return 'picture';
  return 'text';
}

/**
 * The reveal timing for a question, rebuilt field by field for the same reason
 * `recordedAnswers` is: a stray key would ride into a document the rules only
 * bound at the top level, and a partial timing is worse than none — a reveal
 * that was still in flight when the round ended has no honest `dispatchMs`.
 */
function timingFor(
  timings: ReadonlyMap<string, RevealTiming>,
  questionId: string,
): { reveal: RevealTiming } | Record<string, never> {
  const timing = timings.get(questionId);
  if (!timing) return {};

  const whole = (value: number): number => Math.max(0, Math.round(value));
  return {
    reveal: {
      gateMs: whole(timing.gateMs),
      resolveMs: whole(timing.resolveMs),
      dispatchMs: whole(timing.dispatchMs),
      attempts: whole(timing.attempts),
    },
  };
}

/**
 * Rebuilt field by field, as `liveAnswers` does, so a stray field on an answer
 * cannot ride into a document the rules only bound at the top level — and so an
 * answer without a `firstMs` or `wager` carries no key for it rather than an
 * `undefined`, which Firestore refuses to write.
 */
function recordedAnswers(answers: Record<string, Answer>): Record<string, RecordedAnswer> {
  const recorded: Record<string, RecordedAnswer> = {};
  for (const [uid, answer] of Object.entries(answers)) {
    recorded[uid] = {
      optionIndex: answer.optionIndex,
      elapsedMs: answer.elapsedMs,
      ...(answer.firstMs === undefined ? {} : { firstMs: answer.firstMs }),
      ...(answer.wager === undefined ? {} : { wager: answer.wager }),
    };
  }
  return recorded;
}

/**
 * Name and side only. `joinedAt` describes the room, not the round, and
 * `playerId` is an identity claim the season rules verify and this document
 * never could — so neither belongs in a record kept for analysis.
 */
function recordedPlayers(players: Record<string, Player>): Record<string, RecordedPlayer> {
  const recorded: Record<string, RecordedPlayer> = {};
  for (const [uid, player] of Object.entries(players)) {
    recorded[uid] = {
      name: player.name,
      ...(player.squad === undefined ? {} : { squad: player.squad }),
    };
  }
  return recorded;
}

/**
 * Folds a finished round into a {@link GameRecord}, or returns null when this
 * device cannot stand behind one.
 *
 * **Complete means every question was either revealed or thrown out**, which is
 * a weaker test than `sawWholeGame` and deliberately so. Honours must not be
 * computed from a partial log, because a fastest finger over some of the
 * questions is simply wrong. A *record* of a round with a skipped question is
 * not partial: the question was asked, nobody was scored on it, and saying so
 * is the truth of the round. Gating on `sawWholeGame` would throw away every
 * round in which the quizmaster used the skip — the tool that exists precisely
 * for a bad question, and the one most likely to be reached for on a tune
 * nobody recognised, which is the round this exists to explain.
 *
 * Null when a question is missing from the log and was not skipped: this device
 * joined late, or missed a reveal, and a record with a hole in it would be read
 * later as a question nobody answered.
 */
export function foldGameRecord(
  room: RoomState,
  log: QuestionRecord[],
  writtenBy: string,
  /** Keyed by question id. Empty on any device that did not do the revealing. */
  timings: ReadonlyMap<string, RevealTiming> = new Map(),
): GameRecord | null {
  if (room.packId === null || room.packTitle === null) return null;
  if (room.questions.length === 0) return null;

  const byIndex = new Map(log.map((record) => [record.index, record]));
  const skipped = new Set(room.skipped);
  const questions: RecordedQuestion[] = [];

  for (let index = 0; index < room.questions.length; index += 1) {
    const question = room.questions[index];
    if (!question) return null;

    const record = byIndex.get(index);
    const wasSkipped = skipped.has(question.id);
    if (!record && !wasSkipped) return null;

    questions.push({
      id: question.id,
      index,
      category: question.category,
      difficulty: question.difficulty,
      kind: kindOf(question),
      correctIndex: record?.correctIndex ?? null,
      skipped: wasSkipped,
      answers: record ? recordedAnswers(record.answers) : {},
      deltas: record ? { ...record.deltas } : {},
      // Omitted rather than written empty, like `firstMs` and `wager` above:
      // Firestore refuses an `undefined`, and "this client did not reveal it"
      // and "it revealed instantly" must not look the same in the data.
      ...(wasSkipped ? {} : timingFor(timings, question.id)),
    });
  }

  return {
    roomCode: room.code,
    packId: room.packId,
    packTitle: room.packTitle,
    durationSecs: room.durationSecs,
    wagerEnabled: room.wagerEnabled,
    stealEnabled: room.stealEnabled,
    jigsawEnabled: room.jigsawEnabled,
    players: recordedPlayers(room.players),
    scores: { ...room.scores },
    questions,
    writtenBy,
  };
}
