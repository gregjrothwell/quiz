/**
 * Shared write-out for a sealed hand pack: JSON, vault fragment, index row.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  HAND_VAULT_CACHE,
  mergeHandVault,
  OUT_DIR,
  readHandVault,
  summaryFor,
  upsertPackSummary,
} from './write-hand-packs';
import type { Pack, PackSummary } from '../src/questions/types';

const CACHE_DIR = join(import.meta.dirname, '..', '.cache');

export async function writeSealedPack(
  pack: Pack,
  answers: Record<string, string>,
  filename: string,
): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, filename), `${JSON.stringify(pack)}\n`);

  const merged = mergeHandVault(await readHandVault(), answers);
  await writeFile(HAND_VAULT_CACHE, `${JSON.stringify(merged)}\n`);

  const raw = await readFile(join(OUT_DIR, 'index.json'), 'utf8');
  const index = JSON.parse(raw) as PackSummary[];
  const next = upsertPackSummary(index, summaryFor(pack));
  await writeFile(join(OUT_DIR, 'index.json'), `${JSON.stringify(next, null, 2)}\n`);

  console.log(`${pack.title}: ${pack.questions.length} → public/packs/${filename}`);
  console.log(`Vault fragment: ${Object.keys(merged).length} answers → ${HAND_VAULT_CACHE}`);
}
