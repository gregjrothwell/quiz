import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { isItunesPreviewUrl } from './apple-media';
import { SOUND_CHECK, SOUND_CHECK_SECONDS } from './soundCheck';

const PACKS = resolve(import.meta.dirname, '../../public/packs');

interface PackQuestion {
  options?: string[];
  previewUrl?: string;
}

function packQuestions(file: string): PackQuestion[] {
  const parsed: unknown = JSON.parse(readFileSync(resolve(PACKS, file), 'utf8'));
  if (Array.isArray(parsed)) return parsed as PackQuestion[];
  const { questions } = parsed as { questions?: PackQuestion[] };
  return questions ?? [];
}

const packFiles = readdirSync(PACKS).filter((file) => file.endsWith('.json') && file !== 'index.json');

describe('the sound check clip', () => {
  test('is an Apple preview, so it plays through the path a tune does', () => {
    // playPreview refuses any other host, and the level only matches if the
    // same element path plays it — docs/decisions/sound-check.md, criterion 2
    expect(isItunesPreviewUrl(SOUND_CHECK.previewUrl)).toBe(true);
  });

  test('runs for as long as a Name that Tune question', () => {
    expect(SOUND_CHECK_SECONDS).toBe(10);
  });

  test('is no question in any pack, so the lobby never plays an answer', () => {
    // #given every published pack — the instrument checked first: the packs
    // read here do hold previews, so an empty match is not an empty read
    const previews = packFiles.flatMap((file) =>
      packQuestions(file).flatMap((question) => (question.previewUrl ? [question.previewUrl] : [])),
    );
    expect(previews.length).toBeGreaterThan(300);

    // #then the check's clip is none of them
    expect(previews).not.toContain(SOUND_CHECK.previewUrl);
  });

  test('is no Name that Tune option, so a harvest cannot make it one unseen', () => {
    const options = packQuestions('tunes.json').flatMap((question) => question.options ?? []);
    expect(options.length).toBeGreaterThan(1000);
    expect(options).not.toContain(SOUND_CHECK.title);
  });
});
