/**
 * Live check that TMDB still returns an untitled backdrop.
 * Out of `npm test` on purpose — it needs the network and TMDB_API_KEY.
 *
 * Run: `npm run tmdb-probe`
 */

import { defaultTmdbGet, requireTmdbKey, resolveUntitledBackdrop } from './tmdb';
import { SCREEN_SPECS } from './hand-screens-data';

async function main(): Promise<void> {
  requireTmdbKey();
  const jaws = SCREEN_SPECS.find((row) => row.slug === 'jaws');
  if (!jaws) throw new Error('missing jaws spec');
  const still = await resolveUntitledBackdrop(jaws, defaultTmdbGet);
  console.log(`${still.name} (${still.tmdbId})`);
  console.log(still.imageUrl);
  if (!still.imageUrl.startsWith('https://image.tmdb.org/t/p/w780/')) {
    throw new Error('backdrop was not on image.tmdb.org at w780');
  }
}

main().catch((error: unknown) => {
  console.error('tmdb-probe failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
