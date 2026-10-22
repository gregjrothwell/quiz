import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { SURVEY_PROMPTS_PER_ROUND } from '../src/engine/survey';
import { SURVEY_PROMPTS } from './survey-prompts';
import { surveyPack } from './write-survey-pack';

describe('the Survey Says prompts (P2)', () => {
  test('enough for a round, with room to avoid repeats', () => {
    expect(SURVEY_PROMPTS.length).toBeGreaterThanOrEqual(SURVEY_PROMPTS_PER_ROUND * 3);
  });

  test('ids are unique and never renumbered', () => {
    const ids = SURVEY_PROMPTS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^survey-\d{3}$/);
  });

  test('four distinct, non-empty options each', () => {
    for (const entry of SURVEY_PROMPTS) {
      expect(entry.options.every((option) => option.trim().length > 0)).toBe(true);
      expect(new Set(entry.options.map((option) => option.toLowerCase())).size).toBe(4);
    }
  });

  test('the published pack is what the data file says', () => {
    const published: unknown = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', 'public', 'packs', 'survey.json'), 'utf8'),
    );
    expect(published).toEqual(surveyPack());
  });
});
