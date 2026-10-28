import { expect, test } from '@playwright/test';
import { doc, runTransaction } from 'firebase/firestore';

import { bankGame, type PlayerRecord } from '../src/engine/records';
import { isolateFiles } from './isolate';
import { admin, player } from './nodeClient';

isolateFiles();

/**
 * A regular's season row, banked the way `recordGame` banks it.
 *
 * On 22 October 2026 no round banked for anybody: every row a regular owns
 * holds six `recent` entries, and validating that plus the finals tallies ran
 * the season rule past Firestore's 1,000 expressions per request. Every check
 * wrote a fresh row, which costs far less, so all of them passed. This one
 * writes on top of the heaviest row the client produces — every optional
 * field present, `recent` full — so the next field added to the rule fails
 * here rather than in the office. docs/decisions/finals-history.md.
 */

const SEASON = 'season-2';

function fullRow(name: string): PlayerRecord {
  return {
    team: 'Hermes',
    name,
    played: 39,
    wins: 1,
    points: 283_600,
    best: 28_800,
    fastest: 4,
    comeback: 4,
    loneWolf: 6,
    contrarian: 9,
    recent: Array.from({ length: 6 }, (_, i) => ({
      gameId: `00000000-0000-4000-8000-00000000000${i}`,
      score: 8_000 + i,
      at: 1_792_400_200_990 + i,
    })),
    form: 32_018,
    lastGame: '00000000-0000-4000-8000-000000000005',
    lastPlayed: 1_792_400_200_995,
    finals: 7,
    shared: 5,
    shafted: 2,
    gotShafted: 2,
    // On the heavy row, so the next rules change is judged against a regular
    // rather than a fresh document. docs/decisions/rivals.md.
    rivals: {
      sam: { name: 'Sam', beaten: 4, lost: 1 },
      priya: { name: 'Priya', beaten: 1, lost: 3 },
    },
  };
}

async function bank(bucket: string, name: string, outcome: Parameters<typeof bankGame>[1]): Promise<PlayerRecord> {
  const you = await player();
  try {
    await admin().doc(`seasons/${bucket}/players/${you.uid}`).set(fullRow(name));
    const reference = doc(you.db, 'seasons', bucket, 'players', you.uid);
    await runTransaction(you.db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      transaction.set(reference, bankGame(snapshot.data() as PlayerRecord, outcome));
    });
    return (await admin().doc(`seasons/${bucket}/players/${you.uid}`).get()).data() as PlayerRecord;
  } finally {
    await you.close();
  }
}

const honours = { fastest: 1, comeback: 1, loneWolf: 1, contrarian: 1 };

test('allow: a regular with a full row banks a round, season and week', async () => {
  for (const bucket of [SEASON, 'week-2026-W43']) {
    const row = await bank(bucket, 'Kelly', {
      name: 'Kelly',
      gameId: 'e1dc274b-ba4c-4c4f-8e24-8dce2c288041',
      score: 5_900,
      won: false,
      squad: '',
      honours,
    });
    expect(row.played).toBe(40);
    expect(row.recent).toHaveLength(6);
  }
});

test('allow: a finalist with a full row banks their final', async () => {
  const row = await bank(SEASON, 'Joe', {
    name: 'Joe',
    gameId: 'b57d0cae-1bef-4ffb-a9cd-4aed9c756524',
    score: 11_100,
    won: true,
    squad: 'Hermes',
    honours,
    final: { pick: 'shaft', opponent: 'share' },
  });
  expect(row).toMatchObject({ played: 40, wins: 2, finals: 8, shafted: 3 });
});
