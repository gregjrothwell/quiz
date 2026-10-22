/**
 * One-off: bank B498's two rounds of 22 Oct 2026, which no device could bank
 * (the season rule ran past 1,000 expressions). Replays what `recordGame`
 * would have written, from `games/`, with the app's own `bankGame` and
 * `honoursFor`. Dry run by default; `--go` writes. Run in game order.
 */
import { readFile } from 'node:fs/promises';
import { cert, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Timestamp } from 'firebase-admin/firestore';
import { honoursFor, sawWholeGame, type QuestionRecord } from '../src/engine/awards';
import type { CountedFinal } from '../src/engine/finals';
import type { GameRecord } from '../src/engine/gameRecord';
import { bankGame, type PlayerRecord } from '../src/engine/records';
import type { Answer } from '../src/engine/state';

const GAMES = ['e1dc274b-ba4c-4c4f-8e24-8dce2c288041', 'b57d0cae-1bef-4ffb-a9cd-4aed9c756524'];
const BUCKETS = ['season-2', 'week-2026-W43'] as const;
const go = process.argv.includes('--go');

const key = JSON.parse(await readFile(process.env['GOOGLE_APPLICATION_CREDENTIALS'] ?? '', 'utf8')) as ServiceAccount;
initializeApp({ credential: cert(key) });
const db = getFirestore();

for (const gameId of GAMES) {
  const snapshot = await db.doc(`games/${gameId}`).get();
  const game = snapshot.data() as GameRecord & { finishedAt: Timestamp };
  const at = game.finishedAt.toMillis();
  const log: QuestionRecord[] = game.questions.map((question) => ({
    index: question.index,
    correctIndex: question.correctIndex ?? -1,
    answers: question.answers as Record<string, Answer>,
    deltas: question.deltas,
  }));
  const uids = Object.keys(game.players);
  const whole = sawWholeGame(log, game.questions.length);
  const lead = Math.max(0, ...Object.values(game.scores));
  const finalists = uids.filter((uid) => game.players[uid]?.standoff);
  console.log(`\n${game.roomCode} ${gameId.slice(0, 8)} ${game.packTitle} · ${game.questions.length} Qs, ${game.questions.filter((q) => q.skipped).length} skipped`);

  for (const uid of uids) {
    const seat = game.players[uid];
    if (!seat) continue;
    const answered = game.questions.some((question) => uid in question.answers);
    if (!answered) {
      console.log(`  skip ${seat.name}: no answer in the record, so no device of theirs would have banked`);
      continue;
    }
    const score = game.scores[uid] ?? 0;
    const other = finalists.find((id) => id !== uid);
    const final: CountedFinal | undefined = seat.standoff && other
      ? { pick: seat.standoff.pick, opponent: game.players[other]?.standoff?.pick ?? null }
      : undefined;
    const outcome = {
      name: seat.name,
      gameId,
      score,
      won: lead > 0 && score === lead,
      squad: '',
      honours: whole ? honoursFor(log, uids, uid) : { fastest: 0, comeback: 0, loneWolf: 0, contrarian: 0 },
      ...(final ? { final } : {}),
    };

    for (const bucket of BUCKETS) {
      const reference = db.doc(`seasons/${bucket}/players/${uid}`);
      await db.runTransaction(async (transaction) => {
        const existing = (await transaction.get(reference)).data() as PlayerRecord | undefined;
        if (existing?.recent?.some((entry) => entry.gameId === gameId) || existing?.lastGame === gameId) {
          console.log(`  ${bucket} ${seat.name}: already has this game — left alone`);
          return;
        }
        // The week row files under the side they sat with, as `weekSquad` does.
        const squad = bucket === 'season-2' ? '' : (seat.squad ?? '');
        const next = bankGame(existing ?? null, { ...outcome, squad });
        // Stamped with when the round finished, not when this script ran.
        next.lastPlayed = at;
        next.recent = (next.recent ?? []).map((entry) => (entry.gameId === gameId ? { ...entry, at } : entry));
        console.log(`  ${bucket} ${seat.name}: played ${existing?.played ?? 0}→${next.played}, points +${score}, won ${outcome.won}, honours ${JSON.stringify(outcome.honours)}${final ? `, final ${final.pick} v ${final.opponent}` : ''}`);
        if (go) transaction.set(reference, next);
      });
    }
  }
}
console.log(go ? '\nWritten.' : '\nDry run. --go writes.');
