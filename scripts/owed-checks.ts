import { askedSeason } from '../src/engine/askedHistory';
import type { GameRecord } from '../src/engine/gameRecord';
import { DIFFICULTIES, type Difficulty } from '../src/questions/types';
import { summariseQuestion } from './game-report';

/**
 * The print behind `npm run read-owed`. Pure, so `npm test` covers it.
 * `read-owed.ts` only fetches and prints what this says.
 *
 * The five sections are the live checks still owed in `docs/HANDOVER.md`:
 * The Double's pair, Theme Tunes by level, Higher or Lower's % right,
 * Cass's question-one traces, and whether Geekend's asked doc exists.
 *
 * Hit rate is correct over seats, which is what `read-games` prints. Higher
 * or Lower's "% right" is correct over answers, which is the 55–85 band.
 */

/** The season the office is on. `SEASON` in `src/lib/season.ts` — that module imports `src/firebase.ts`, which a script must not. */
export const OWED_SEASON = 'season-2';

export const GEEKEND_SEASON = askedSeason(OWED_SEASON, 'geekend');
export const OFFICE_SEASON = askedSeason(OWED_SEASON, 'office');

/** Hard hit rate at or above this is the Theme Tunes warning in `tv-themes.md`. */
const HARD_SINGS_AT = 0.9;

/** The band the first Higher or Lower round is read against. Outside it, re-band. */
const HIGHER_LOW = 0.55;
const HIGHER_HIGH = 0.85;

export interface KeptRound {
  gameId: string;
  record: GameRecord;
  finishedAt: Date | null;
}

export interface GeekendAsked {
  packId: string;
  /** Null when the document exists but `ids` is not a list. */
  ids: number | null;
}

export interface OwedInput {
  last: number;
  games: readonly KeptRound[];
  gamesUnreadable: number;
  /** `formatTrace` lines for Cass, newest first. Empty when she has none. */
  cassLines: readonly string[];
  tracesRead: number;
  geekendAsked: readonly GeekendAsked[];
  /** Office id counts for the Geekend packs. Null means that office doc is absent. */
  officeAsked: Readonly<Record<string, number | null>>;
}

interface LevelLine {
  difficulty: Difficulty;
  questions: number;
  correct: number;
  seats: number;
  answered: number;
  hitRate: number | null;
}

function when(date: Date | null): string {
  return date ? date.toISOString().slice(0, 16).replace('T', ' ') : 'unstamped';
}

function pct(rate: number | null): string {
  return rate === null ? '—' : `${String(Math.round(rate * 100))}%`;
}

function levels(records: readonly GameRecord[]): LevelLine[] {
  return DIFFICULTIES.map((difficulty) => {
    const rows = records.flatMap((record) => {
      const seatCount = Object.keys(record.players).length;
      return record.questions
        .filter((question) => question.difficulty === difficulty && !question.skipped)
        .map((question) => summariseQuestion(question, seatCount));
    });
    const seats = rows.reduce((sum, row) => sum + row.seats, 0);
    const correct = rows.reduce((sum, row) => sum + row.correct, 0);
    return {
      difficulty,
      questions: rows.length,
      correct,
      seats,
      answered: rows.reduce((sum, row) => sum + row.answered, 0),
      hitRate: seats === 0 ? null : correct / seats,
    };
  });
}

function totals(records: readonly GameRecord[]): { correct: number; seats: number; answered: number } {
  return levels(records).reduce(
    (sum, level) => ({
      correct: sum.correct + level.correct,
      seats: sum.seats + level.seats,
      answered: sum.answered + level.answered,
    }),
    { correct: 0, seats: 0, answered: 0 },
  );
}

export function formatDouble(games: readonly KeptRound[]): string {
  const byId = new Map(games.map((game) => [game.gameId, game]));
  const seconds = games.filter((game) => game.record.doubleOf !== undefined);
  const lines = ['The Double'];
  if (seconds.length === 0) {
    lines.push('  No round in this window names another via doubleOf.');
    return lines.join('\n');
  }
  for (const second of seconds) {
    const oneId = second.record.doubleOf ?? '';
    const first = byId.get(oneId);
    lines.push(
      `  ${second.record.roomCode}  ${when(second.finishedAt)}  round two ${second.gameId}`
        + ` (${second.record.packTitle}) names ${oneId}`,
    );
    lines.push(
      first
        ? `    round one ${first.gameId} is in this window: ${first.record.packTitle}, ${when(first.finishedAt)}`
        : `    round one ${oneId} is not in this window`,
    );
  }
  return lines.join('\n');
}

export function formatThemes(games: readonly KeptRound[]): string {
  const records = games.filter((game) => game.record.packId === 'themes').map((game) => game.record);
  const lines = ['Theme Tunes, hit rate by level'];
  if (records.length === 0) {
    lines.push('  No Theme Tunes round in this window.');
    return lines.join('\n');
  }
  const byLevel = levels(records);
  const rounds = records.length === 1 ? '1 round' : `${String(records.length)} rounds`;
  lines.push(`  ${rounds}. Hit rate is correct over seats, as read-games prints it.`);
  for (const level of byLevel) {
    lines.push(
      `  ${level.difficulty.padEnd(6)}  ${String(level.questions).padStart(2)} Q`
        + `  ${pct(level.hitRate).padStart(4)}`
        + `  (${String(level.correct)}/${String(level.seats)} seats, ${String(level.answered)} answered)`,
    );
  }
  const hard = byLevel.find((level) => level.difficulty === 'hard');
  if (hard && hard.questions > 0 && hard.hitRate !== null && hard.hitRate >= HARD_SINGS_AT) {
    lines.push('  Hard is near 100%. A clip may be singing its title.');
  }
  return lines.join('\n');
}

export function formatHigher(games: readonly KeptRound[]): string {
  const records = games.filter((game) => game.record.packId === 'higher').map((game) => game.record);
  const lines = ['Higher or Lower'];
  if (records.length === 0) {
    lines.push('  No Higher or Lower round in this window.');
    return lines.join('\n');
  }
  const all = totals(records);
  if (all.answered === 0) {
    lines.push(`  ${records.length === 1 ? '1 round' : `${String(records.length)} rounds`}, no answers.`);
    return lines.join('\n');
  }
  const right = all.correct / all.answered;
  const band = right >= HIGHER_LOW && right <= HIGHER_HIGH ? 'Inside 55–85.' : 'Outside 55–85 — re-band.';
  const seatRate = all.seats === 0 ? null : all.correct / all.seats;
  lines.push(
    `  ${pct(right)} right (${String(all.correct)}/${String(all.answered)} answers).`
      + ` Seat hit rate ${pct(seatRate)} (${String(all.correct)}/${String(all.seats)}). ${band}`,
  );
  return lines.join('\n');
}

export function formatCass(cassLines: readonly string[], last: number): string {
  const lines = ['Cass, question one'];
  if (cassLines.length === 0) {
    lines.push(`  No trace of hers in the last ${String(last)}.`);
    return lines.join('\n');
  }
  for (const line of cassLines) lines.push(`  ${line}`);
  return lines.join('\n');
}

export function formatGeekend(
  geekend: readonly GeekendAsked[],
  office: Readonly<Record<string, number | null>>,
): string {
  const lines = ['Geekend asked'];
  if (geekend.length === 0) {
    lines.push(`  No Geekend asked doc. seasons/${GEEKEND_SEASON}/asked is empty.`);
    return lines.join('\n');
  }
  const sorted = [...geekend].sort((a, b) => a.packId.localeCompare(b.packId));
  for (const doc of sorted) {
    const count = doc.ids === null ? 'ids unreadable' : `${String(doc.ids)} ids`;
    const officeCount = office[doc.packId];
    const officeLine = officeCount === undefined || officeCount === null
      ? `Office seasons/${OFFICE_SEASON}/asked/${doc.packId} is absent.`
      : `Office seasons/${OFFICE_SEASON}/asked/${doc.packId} has ${String(officeCount)} ids.`;
    lines.push(`  ${doc.packId}: Geekend doc exists, ${count}. ${officeLine}`);
  }
  lines.push('  This read cannot show that the office document was left unchanged.');
  return lines.join('\n');
}

export function formatOwedChecks(input: OwedInput): string {
  const unreadable = input.gamesUnreadable > 0 ? `, ${String(input.gamesUnreadable)} unreadable` : '';
  const header = `Owed live checks — last ${String(input.last)} kept rounds${unreadable},`
    + ` last ${String(input.last)} question-one traces (${String(input.cassLines.length)} of ${String(input.tracesRead)} are Cass).`;
  return [
    header,
    '',
    formatDouble(input.games),
    '',
    formatThemes(input.games),
    '',
    formatHigher(input.games),
    '',
    formatCass(input.cassLines, input.last),
    '',
    formatGeekend(input.geekendAsked, input.officeAsked),
    '',
  ].join('\n');
}
