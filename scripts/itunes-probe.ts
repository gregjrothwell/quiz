/**
 * Live check that the GB iTunes Search API still returns a preview.
 * Out of `npm test` on purpose — it needs the network.
 *
 * Run: `npx tsx scripts/itunes-probe.ts`
 */

import { defaultItunesGet, resolveSong } from './itunes';

async function main(): Promise<void> {
  const song = await resolveSong('mr brightside killers', 'The Killers', defaultItunesGet);
  console.log(`${song.artistName} — ${song.trackName}`);
  console.log(song.previewUrl);
  console.log(song.storeUrl);
  if (!song.previewUrl.includes('audio-ssl.itunes.apple.com')) {
    throw new Error('previewUrl was not on Apple’s audio CDN');
  }
}

main().catch((error: unknown) => {
  console.error('itunes-probe failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
