import { expect, test } from '@playwright/test';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';

import { mergeAsked } from '../src/engine/askedHistory';
import { isolateFiles } from './isolate';
import { player } from './nodeClient';

isolateFiles();

/**
 * A pack's question history, written as `recordAsked` writes it: the stored ids
 * merged with this round's (`mergeAsked`), capped at 500. Until 22 October 2026
 * any signed-in visitor could delete it, or overwrite it with an empty list.
 */

test('allow: rounds add to a pack’s history, including at the cap', async () => {
  const you = await player();
  const reference = doc(you.db, 'seasons', 'season-e2e', 'asked', 'allow-pack');

  const first = mergeAsked(['q1', 'q2'], new Set());
  await setDoc(reference, { ids: first, at: Date.now() });

  const second = mergeAsked(['q3'], new Set(first));
  await setDoc(reference, { ids: second, at: Date.now() });
  expect((await getDoc(reference)).data()?.ids).toEqual(['q3', 'q1', 'q2']);

  // At the cap the list stays the same length, newest first.
  const full = Array.from({ length: 500 }, (_, i) => `f${i}`);
  await setDoc(reference, { ids: full, at: Date.now() });
  await setDoc(reference, { ids: mergeAsked(['new'], new Set(full)), at: Date.now() });
  expect((await getDoc(reference)).data()?.ids).toHaveLength(500);
  await you.close();
});

test('deny: nobody can shorten or delete a pack’s history', async () => {
  const you = await player();
  const reference = doc(you.db, 'seasons', 'season-e2e', 'asked', 'deny-pack');
  await setDoc(reference, { ids: ['q1', 'q2'], at: Date.now() });

  await expect(setDoc(reference, { ids: [], at: Date.now() })).rejects.toThrow(/permission/i);
  await expect(deleteDoc(reference)).rejects.toThrow(/permission/i);
  expect((await getDoc(reference)).data()?.ids).toEqual(['q1', 'q2']);
  await you.close();
});
