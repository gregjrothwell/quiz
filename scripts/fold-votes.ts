/**
 * Folds the office's verdicts back into the corpus. Run with:
 *
 *   npm run fold-votes            # report only
 *   npm run fold-votes -- --go    # write the blocklist
 *
 * Players vote on a question at the reveal, and each verdict lands at
 * `questionVotes/{questionId}/votes/{uid}` — one document per person per
 * question, deduplicated by construction. Nothing reads them at runtime; this
 * is the only thing that ever does.
 *
 * **A dry run by default**, for the reason `prune-rooms` is: retiring a
 * question is permanent, nothing will ever surface it for review, and the
 * thresholds have never been tested against real data. The report prints what
 * each candidate threshold would take out, so the numbers get chosen from the
 * office's actual voting rather than from a guess written months earlier.
 *
 * **Needs a service account.** `read` is denied to every client on
 * `questionVotes` — see firestore.rules — and the Admin SDK is not subject to
 * rules at all, which is the same asymmetry the vault relies on. Point
 * `GOOGLE_APPLICATION_CREDENTIALS` at a key under `.secrets/`.
 *
 * Not part of the build or the test suite: it talks to the live project. The
 * arithmetic it depends on is `src/engine/questionVote.ts`, which is pure and
 * is covered by `npm test` — this file only counts documents and writes a JSON
 * file.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { cert, initializeApp as initAdmin, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import {
  BAD_SHARE_TO_RETIRE,
  MIN_VOTES_TO_RETIRE,
  isVerdict,
  shouldRetire,
  type VoteTally,
} from '../src/engine/questionVote';
import { loadRetired, RETIRED_PATH, type RetiredQuestion } from '../src/questions/retired';

/**
 * Thresholds the report prints alongside the live one, so the choice is made
 * against real numbers. Only {@link MIN_VOTES_TO_RETIRE} and
 * {@link BAD_SHARE_TO_RETIRE} decide anything; these are for reading.
 */
const SENSITIVITY: { minVotes: number; badShare: number }[] = [
  { minVotes: 3, badShare: 0.5 },
  { minVotes: 3, badShare: 0.6 },
  { minVotes: 5, badShare: 0.5 },
  { minVotes: MIN_VOTES_TO_RETIRE, badShare: BAD_SHARE_TO_RETIRE },
  { minVotes: 5, badShare: 0.75 },
  { minVotes: 8, badShare: 0.75 },
];

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — run with --env-file=.env.local`);
  return value;
}

function wouldRetire(tally: VoteTally, minVotes: number, badShare: number): boolean {
  const total = tally.good + tally.bad;
  if (total < minVotes) return false;
  return tally.bad / total >= badShare;
}

/**
 * Every question anybody has voted on, and what they said.
 *
 * A collection-group query on `votes`, which is why the collection is named
 * that and not something the rooms also use — `rooms/{code}/answers` is a
 * different id, so nothing else is swept up here. The parent document id is the
 * question.
 */
async function readVotes(keyPath: string): Promise<Map<string, VoteTally>> {
  const key = JSON.parse(await readFile(keyPath, 'utf8')) as ServiceAccount;
  const app = initAdmin({ credential: cert(key) }, 'fold-votes-admin');
  const db = getAdminFirestore(app);

  const snapshot = await db.collectionGroup('votes').get();
  const tallies = new Map<string, VoteTally>();

  for (const document of snapshot.docs) {
    const questionId = document.ref.parent.parent?.id;
    if (!questionId) continue;

    const { verdict } = document.data() as { verdict?: unknown };
    // Anything that is not one of the two is ignored rather than counted as a
    // vote against. The rules refuse them, so one could only predate a rule —
    // but this decides what leaves the corpus, and guessing is the wrong move.
    if (!isVerdict(verdict)) continue;

    const held = tallies.get(questionId) ?? { good: 0, bad: 0 };
    held[verdict] += 1;
    tallies.set(questionId, held);
  }

  return tallies;
}

function report(tallies: Map<string, VoteTally>, already: Set<string>): RetiredQuestion[] {
  const voted = [...tallies.entries()];
  const totalVotes = voted.reduce((sum, [, t]) => sum + t.good + t.bad, 0);

  console.log(`\n${totalVotes} verdicts across ${voted.length} questions.\n`);

  if (voted.length === 0) {
    console.log('Nothing to fold yet. Votes accumulate only while rounds are played.');
    return [];
  }

  console.log('What each threshold would retire:\n');
  for (const { minVotes, badShare } of SENSITIVITY) {
    const count = voted.filter(([, t]) => wouldRetire(t, minVotes, badShare)).length;
    const live = minVotes === MIN_VOTES_TO_RETIRE && badShare === BAD_SHARE_TO_RETIRE;
    const share = `${Math.round(badShare * 100)}%`;
    console.log(
      `  ${String(minVotes).padStart(2)} votes, ${share.padStart(4)} bad → ` +
        `${String(count).padStart(4)}${live ? '   <- the one in force' : ''}`,
    );
  }

  const going = voted
    .filter(([id, t]) => shouldRetire(t) && !already.has(id))
    .map(([id, t]): RetiredQuestion => ({
      id,
      good: t.good,
      bad: t.bad,
      at: new Date().toISOString().slice(0, 10),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  console.log(`\n${going.length} newly over the line:\n`);
  for (const entry of going) {
    console.log(`  ${entry.id}  ${entry.bad} bad / ${entry.good + entry.bad}`);
  }

  return going;
}

async function main(): Promise<void> {
  const go = process.argv.includes('--go');
  const keyPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
  const projectId = required('VITE_FIREBASE_PROJECT_ID');

  if (!keyPath) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS is not set. Reading questionVotes needs a service '
        + 'account — `allow read: if false` denies every client, and the Admin SDK is not '
        + 'subject to the rules. Point it at a key under .secrets/.',
    );
  }

  console.log(`Folding verdicts from ${projectId}.`);

  const tallies = await readVotes(keyPath);
  const existing = loadRetired();
  const going = report(tallies, new Set(existing.map((entry) => entry.id)));

  if (going.length === 0) {
    console.log('\nNothing to write.');
    return;
  }

  if (!go) {
    console.log(
      '\nDry run. Re-run with `-- --go` to write them into src/questions/retired.json, '
        + '\nthen `npm run fetch-questions -- --resort` to rebuild the packs without them.',
    );
    return;
  }

  const merged = [...existing, ...going].sort((a, b) => a.id.localeCompare(b.id));
  const file = {
    note:
      'Questions the office voted out. Written by `npm run fold-votes -- --go` and applied '
      + 'by `scripts/fetch-questions.ts`, so a re-sort cannot resurrect them. Each entry '
      + 'keeps the tally that retired it, because a retirement is permanent and the reason '
      + 'should outlive the run that decided it.',
    retired: merged,
  };
  await writeFile(RETIRED_PATH, `${JSON.stringify(file, null, 2)}\n`, 'utf8');

  console.log(`\nWrote ${merged.length} retired ids to ${RETIRED_PATH}.`);
  console.log('Now run `npm run fetch-questions -- --resort` to rebuild the packs without them.');
  console.log('Commit both — the blocklist is the record, the packs are downstream of it.');
}

main().catch((error: unknown) => {
  console.error('fold-votes failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
