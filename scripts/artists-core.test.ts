import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { sealQuestion, type Difficulty } from '../src/questions/types';
import {
  ARTIST_PROMPT,
  ARTISTS_MAX_PER_NAME,
  artistPackStats,
  artistSlug,
  buildArtistDrafts,
  isUsableClip,
  type ClipRef,
} from './artists-core';
import { TUNE_SPECS, type TuneSpec } from './hand-tunes-data';
import { stableId } from './write-hand-packs';
import { buildArtistsPack, clipsFromTunes } from './write-artists-pack';

const PREVIEW = 'https://audio-ssl.itunes.apple.com/itunes-assets/x.m4a';
const STORE = 'https://music.apple.com/gb/album/1?i=2';

function spec(
  slug: string,
  artist: string,
  difficulty: Difficulty,
  correct: string,
  incorrect: string[] = ['Other', 'Songs', 'Here'],
): TuneSpec {
  return { slug, prompt: 'Name this tune.', correct, incorrect, difficulty, artist, term: slug };
}

function clip(slug: string, trackId: number, extra: Partial<ClipRef> = {}): ClipRef {
  return {
    id: stableId(slug),
    previewUrl: `${PREVIEW}?${slug}`,
    storeUrl: STORE,
    trackId,
    ...extra,
  };
}

describe('buildArtistDrafts', () => {
  test('one question per artist, using the easiest clip and ignoring title-gate cuts', () => {
    const hit = spec('hit', 'Alpha', 'easy', 'The Hit', ['Beta Song', 'Gamma Song', 'Delta Song']);
    hit.previewStart = 8;
    hit.previewSeconds = 9;
    const specs = [
      spec('late', 'Alpha', 'hard', 'Deep Cut', ['Beta Song', 'Gamma Song', 'Delta Song']),
      hit,
      spec('mid', 'Alpha', 'easy', 'Also Easy', ['Beta Song', 'Gamma Song', 'Delta Song']),
      spec('beta', 'Beta', 'medium', 'Beta Song'),
      spec('gamma', 'Gamma', 'hard', 'Gamma Song'),
      spec('delta', 'Delta', 'easy', 'Delta Song'),
      spec('epsilon', 'Epsilon', 'medium', 'Epsilon Song'),
    ];
    const clips = [
      clip('late', 1),
      clip('hit', 2, { previewUrl: `${PREVIEW}?hit` }),
      clip('mid', 3),
      clip('beta', 4),
      clip('gamma', 5),
      clip('delta', 6),
      clip('epsilon', 7),
    ];

    const { drafts } = buildArtistDrafts(specs, clips);
    const alpha = drafts.find((draft) => draft.artist === 'Alpha');
    if (!alpha) throw new Error('missing Alpha');
    expect(alpha.sourceSlug).toBe('hit');
    expect(alpha.difficulty).toBe('easy');
    expect(alpha.id).toBe(stableId(artistSlug('hit')));
    expect(alpha.id).not.toBe(stableId('hit'));
    expect(drafts.filter((draft) => draft.artist === 'Alpha')).toHaveLength(ARTISTS_MAX_PER_NAME);

    const sealed = sealQuestion({
      id: alpha.id,
      source: 'hand',
      question: ARTIST_PROMPT,
      correct: 'Alpha',
      incorrect: [...alpha.incorrect],
      category: 'Name the Artist',
      difficulty: 'easy',
      previewUrl: alpha.previewUrl,
      storeUrl: alpha.storeUrl,
      trackId: alpha.trackId,
    });
    expect(sealed.previewStart).toBeUndefined();
    expect(sealed.previewSeconds).toBeUndefined();
    expect(sealed.question).toBe('Name the artist.');
    expect(sealed.options).not.toContain('The Hit');
  });

  test('prefers catalogue neighbours, then spreads the rest', () => {
    // Alpha names Beta twice and Gamma, Delta, Epsilon once. Zeta is unused.
    const specs = [
      spec('a', 'Alpha', 'easy', 'Alpha Song', ['Beta One', 'Beta Two', 'Gamma Song']),
      spec('b1', 'Beta', 'easy', 'Beta One', ['Nope', 'Nada', 'Nil']),
      spec('b2', 'Beta', 'medium', 'Beta Two', ['Nope', 'Nada', 'Nil']),
      spec('g', 'Gamma', 'easy', 'Gamma Song', ['Nope', 'Nada', 'Nil']),
      spec('d', 'Delta', 'easy', 'Delta Song', ['Alpha Song', 'Nope', 'Nada']),
      spec('e', 'Epsilon', 'easy', 'Epsilon Song', ['Alpha Song', 'Nope', 'Nada']),
      spec('z', 'Zeta', 'easy', 'Zeta Song', ['Nope', 'Nada', 'Nil']),
    ];
    const clips = specs.map((row, index) => clip(row.slug, index + 1));
    const { drafts } = buildArtistDrafts(specs, clips);
    const alpha = drafts.find((draft) => draft.artist === 'Alpha');
    expect(alpha?.neighbourCount).toBe(3);
    expect(alpha?.incorrect).toContain('Beta');
    expect(alpha?.incorrect).not.toContain('Zeta');

    const zeta = drafts.find((draft) => draft.artist === 'Zeta');
    const epsilon = drafts.find((draft) => draft.artist === 'Epsilon');
    expect(zeta?.incorrect).not.toEqual(epsilon?.incorrect);
  });

  test('does not offer the song title as if it were an artist', () => {
    const specs = [
      spec('played', 'Alpha', 'easy', 'Beta', ['Gamma Song', 'Delta Song', 'Epsilon Song']),
      spec('beta', 'Beta', 'easy', 'Beta Song'),
      spec('gamma', 'Gamma', 'easy', 'Gamma Song'),
      spec('delta', 'Delta', 'easy', 'Delta Song'),
      spec('epsilon', 'Epsilon', 'easy', 'Epsilon Song'),
    ];
    const clips = specs.map((row, index) => clip(row.slug, index + 1));
    const { drafts } = buildArtistDrafts(specs, clips);
    const alpha = drafts.find((draft) => draft.artist === 'Alpha');
    expect(alpha?.incorrect).not.toContain('Beta');
  });

  test('skips a tune with no published clip and still asks the artist once', () => {
    const specs = [
      spec('missing', 'Alpha', 'easy', 'Gone'),
      spec('kept', 'Alpha', 'hard', 'Kept'),
      spec('beta', 'Beta', 'easy', 'Beta Song'),
      spec('gamma', 'Gamma', 'easy', 'Gamma Song'),
      spec('delta', 'Delta', 'easy', 'Delta Song'),
    ];
    const clips = [clip('kept', 1), clip('beta', 2), clip('gamma', 3), clip('delta', 4)];
    const { drafts, unresolved } = buildArtistDrafts(specs, clips);
    expect(unresolved).toBe(1);
    expect(drafts.find((draft) => draft.artist === 'Alpha')?.sourceSlug).toBe('kept');
    expect(drafts.map((draft) => draft.artist).sort()).toEqual(['Alpha', 'Beta', 'Delta', 'Gamma']);
  });
});

describe('the published Name the Artist pack', () => {
  const tunesRaw = readFileSync(join(import.meta.dirname, '..', 'public', 'packs', 'tunes.json'), 'utf8');
  const clips = clipsFromTunes(tunesRaw);
  const { drafts, unresolved } = buildArtistDrafts(TUNE_SPECS, clips);
  const { pack, answers } = buildArtistsPack(clips);

  test('is one question for each distinct artist that already has a clip', () => {
    const expected = new Set<string>();
    for (const row of TUNE_SPECS) {
      const published = clips.find((item) => item.id === stableId(row.slug));
      if (isUsableClip(published)) expected.add(row.artist);
    }
    expect(drafts.map((draft) => draft.artist).sort()).toEqual([...expected].sort());
    expect(new Set(drafts.map((draft) => draft.artist)).size).toBe(drafts.length);
    expect(drafts.length).toBeGreaterThanOrEqual(45);
    expect(ARTISTS_MAX_PER_NAME).toBe(1);
    const missing = TUNE_SPECS.filter(
      (row) => !isUsableClip(clips.find((item) => item.id === stableId(row.slug))),
    );
    expect(unresolved).toBe(missing.length);
  });

  test('copies the published preview and not the title-gate cut', () => {
    for (const draft of drafts) {
      const source = TUNE_SPECS.find((row) => row.slug === draft.sourceSlug);
      const published = clips.find((item) => item.id === stableId(draft.sourceSlug));
      expect(source).toBeDefined();
      expect(draft.previewUrl).toBe(published?.previewUrl);
      expect(draft.storeUrl).toBe(published?.storeUrl);
      expect(draft.trackId).toBe(published?.trackId);
      expect(draft.incorrect).toHaveLength(3);
      expect(new Set([draft.artist, ...draft.incorrect]).size).toBe(4);
      expect(draft.incorrect).not.toContain(source?.correct);
      const songs = TUNE_SPECS.filter(
        (row) => row.artist === draft.artist && isUsableClip(clips.find((item) => item.id === stableId(row.slug))),
      );
      const easiest = songs.reduce((best, row) => {
        const rank = { easy: 0, medium: 1, hard: 2 };
        return rank[row.difficulty] < rank[best.difficulty] ? row : best;
      });
      expect(draft.difficulty).toBe(easiest.difficulty);
    }
  });

  test('matches the sealed file, which holds no answer', () => {
    const published = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', 'public', 'packs', 'artists.json'), 'utf8'),
    ) as { id: string; questions: { id: string; previewStart?: number; previewSeconds?: number }[] };
    expect(published.id).toBe('artists');
    expect(published.questions).toEqual(pack.questions);
    for (const question of pack.questions) {
      expect(question.options).toContain(answers[question.id]);
      expect(question.previewStart).toBeUndefined();
      expect(question.previewSeconds).toBeUndefined();
    }
    const index = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', 'public', 'packs', 'index.json'), 'utf8'),
    ) as { id: string; count: number; counts: { easy: number; medium: number; hard: number } }[];
    const stats = artistPackStats(drafts);
    expect(index.find((row) => row.id === 'artists')).toMatchObject({
      count: stats.questions,
      counts: { easy: stats.easy, medium: stats.medium, hard: stats.hard },
    });
  });
});
