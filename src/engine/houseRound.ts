/**
 * The house round (PROJ-183, docs/decisions/house-round.md): what a quizmaster's
 * device remembers about their last round, what a lobby therefore starts from,
 * the round Start will really send, and the one line that says it.
 *
 * Three shapes, and the difference between the first two is the point:
 *
 * - {@link RoundSettings} is what was **picked**. It is all that is remembered.
 * - {@link RoundPlan} is what will be **played**: the picks after the pack has had
 *   its say (Theme Tunes is always ten seconds, Survey Says takes no stakes).
 * - {@link roundLine} is the plan in words, and has nothing else to read from.
 *   The lobby hands the same plan to Start, so the line cannot disagree with the
 *   round. Share or Shaft was once promised and silently never played
 *   (round-end.md); this is the guard against the next one.
 */

import { fixedDurationFor, type PackId, type PackSummary } from '../questions/types';
import { toLoaded, type Loaded, type Shot } from './cannon';
import { answeringSecs } from './leadIn';
import { DEFAULT_DURATION_SECS, DURATION_CHOICES, LEVELS, type Level, type RoomState } from './state';
import { SURVEY_PROMPTS_PER_ROUND } from './survey';

export const ROUND_LENGTHS = [10, 15, 20, 25] as const;

/** How a round is decided. Stakes and Share or Shaft are the same decision to the office. */
export const ENDINGS = ['top', 'stakes', 'standoff'] as const;
export type Ending = (typeof ENDINGS)[number];

/** Each level by the name on its button, which is also its name in the line. */
export const LEVEL_TITLE: Record<Level, string> = {
  mixed: 'As it comes',
  easy: 'Gentle',
  medium: 'Standard',
  hard: 'Fiendish',
  ramp: 'The Ladder',
};

/**
 * What the quizmaster picked, and everything a device remembers.
 *
 * Not the pack (the vote is about the next one), not The Double (Another round
 * after one is an ordinary round; morning-double.md, rule 10), not the jigsaw and
 * not the Slop Cannon, which are each a choice about one round.
 */
export interface RoundSettings {
  count: number;
  level: Level;
  durationSecs: number;
  ending: Ending;
  steal: boolean;
  chaser: boolean;
}

/** A brand-new device, and any setting a device cannot supply. */
export const HOUSE_DEFAULTS: RoundSettings = {
  count: 15,
  level: 'ramp',
  durationSecs: DEFAULT_DURATION_SECS,
  ending: 'top',
  steal: false,
  chaser: false,
};

function offered<Choice>(choices: readonly Choice[], value: unknown): value is Choice {
  return (choices as readonly unknown[]).includes(value);
}

/**
 * Settings off this device's storage, or null for nothing remembered.
 *
 * Setting by setting: a level the picker has since withdrawn falls back to the
 * default, and costs nothing else that was remembered. Built field by field, so
 * anything else in there — a pack, a double — is dropped.
 */
export function readRoundSettings(value: unknown): RoundSettings | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { count, level, durationSecs, ending, steal, chaser } = value as Record<string, unknown>;
  return {
    count: offered(ROUND_LENGTHS, count) ? count : HOUSE_DEFAULTS.count,
    level: offered(LEVELS, level) ? level : HOUSE_DEFAULTS.level,
    durationSecs: offered(DURATION_CHOICES, durationSecs) ? durationSecs : HOUSE_DEFAULTS.durationSecs,
    ending: offered(ENDINGS, ending) ? ending : HOUSE_DEFAULTS.ending,
    steal: typeof steal === 'boolean' ? steal : HOUSE_DEFAULTS.steal,
    chaser: typeof chaser === 'boolean' ? chaser : HOUSE_DEFAULTS.chaser,
  };
}

type LastRound = Pick<
  RoomState,
  'standoffEnabled' | 'wagerEnabled' | 'stealEnabled' | 'chaserEnabled' | 'durationSecs' | 'leadInSecs'
>;

/**
 * What a lobby starts from.
 *
 * **A room's own last round beats the device**, for the second half and for
 * Another round: the modes and the clock are on the room, so they survive a
 * reload and a change of host (round-end.md). A room nobody has played in says
 * nothing, and the device does. `played` has to be told rather than read off the
 * modes: a last round with everything off looks exactly like no round at all.
 *
 * The length and the level are never on the room, so they are always the device's.
 */
export function startingSettings(room: LastRound, played: boolean, remembered: RoundSettings | null): RoundSettings {
  if (!played && remembered !== null) return remembered;
  const house = remembered ?? HOUSE_DEFAULTS;
  const clock = answeringSecs(room);
  return {
    count: house.count,
    level: house.level,
    durationSecs: offered(DURATION_CHOICES, clock) ? clock : house.durationSecs,
    // Both on is a room from before the two were one picker.
    ending: room.standoffEnabled ? 'standoff' : room.wagerEnabled ? 'stakes' : 'top',
    steal: room.stealEnabled,
    chaser: room.chaserEnabled,
  };
}

/**
 * How many questions a pack can supply at a given level. `mixed` and `ramp`
 * draw on everything; a flat level is capped by its own bucket, which is what
 * stops "Fiendish, 20" quietly turning into a six-question round.
 */
export function availableFor(pack: PackSummary, level: Level, jigsaw = false): number {
  if (jigsaw && (level === 'mixed' || level === 'ramp') && pack.jigsawCount != null) {
    return pack.jigsawCount;
  }
  if (level === 'mixed' || level === 'ramp') return pack.count;
  return pack.counts[level];
}

/** The round Start sends: every setting a round has, except which pack it is on. */
export interface RoundPlan {
  count: number;
  level: Level;
  /** The answering time. The lead-in is added when the round opens (`openRound`). */
  durationSecs: number;
  wagerEnabled: boolean;
  stealEnabled: boolean;
  jigsawEnabled: boolean;
  standoffEnabled: boolean;
  chaserEnabled: boolean;
  doubleEnabled: boolean;
  cannon: Loaded;
}

/** The choices about this round alone, which nothing remembers. */
export interface Tonight {
  pack: PackSummary | null;
  jigsaw: boolean;
  double: boolean;
  /** The Slop Cannon's shots that are loaded and still on offer. */
  shots: readonly Shot[];
}

/**
 * The picks, after the pack has had its say. Nothing is forgotten by this: the
 * picks are left as they were, so the next pack gets them back.
 *
 * Survey Says deals its own ten at no level and plays without stakes, steals or
 * Mr Fries (v1). A pack that fixes its own clock overrides the picker. A level
 * the pack has none of is played as it comes: the pickers are shut, and a dead
 * Start would have nothing on screen to say why.
 */
export function planRound(settings: RoundSettings, { pack, jigsaw, double, shots }: Tonight): RoundPlan {
  const survey = pack?.id === 'survey';
  const jigsawEnabled = jigsaw && pack?.id === 'picture';
  const level =
    survey || (pack !== null && availableFor(pack, settings.level, jigsawEnabled) === 0) ? 'mixed' : settings.level;
  const available = pack === null ? settings.count : availableFor(pack, level, jigsawEnabled);
  const wanted = survey ? SURVEY_PROMPTS_PER_ROUND * 2 : settings.count;
  return {
    count: Math.min(wanted, available),
    level,
    durationSecs: (pack === null ? null : fixedDurationFor(pack.id)) ?? settings.durationSecs,
    wagerEnabled: settings.ending === 'stakes' && !survey,
    stealEnabled: settings.steal && !survey,
    jigsawEnabled,
    standoffEnabled: settings.ending === 'standoff',
    chaserEnabled: settings.chaser && !survey,
    doubleEnabled: double,
    cannon: toLoaded(shots.map((shot) => shot.id)),
  };
}

type Says = (plan: RoundPlan, packId: PackId | null, shots: readonly Shot[]) => string | null;

/**
 * What the line says for each setting, in the order it says it.
 *
 * Keyed by the plan itself, so a setting added to the round without words here
 * does not compile. The wording has to tell any two rounds apart, which
 * `houseRound.test.ts` checks over every combination.
 */
const SAYS: { [Setting in keyof RoundPlan]: Says } = {
  // Two halves of ten is twenty, so the count says which of the two it means.
  count: ({ count, doubleEnabled }) =>
    `${count} ${count === 1 ? 'question' : 'questions'}${doubleEnabled ? ' this half' : ''}`,
  durationSecs: ({ durationSecs }) => `${durationSecs} seconds`,
  level: ({ level }, packId) => (packId === 'survey' ? null : LEVEL_TITLE[level]),
  doubleEnabled: ({ doubleEnabled }) => (doubleEnabled ? 'The Double' : null),
  // The three endings share one slot: this one speaks for the two that are not a final.
  wagerEnabled: ({ wagerEnabled, standoffEnabled }) =>
    wagerEnabled ? 'ends on stakes' : standoffEnabled ? null : 'ends on the last answer',
  standoffEnabled: ({ standoffEnabled }) => (standoffEnabled ? 'ends on a final' : null),
  stealEnabled: ({ stealEnabled }) => (stealEnabled ? 'first right answer steals' : null),
  chaserEnabled: ({ chaserEnabled }) => (chaserEnabled ? 'against Mr Fries' : null),
  jigsawEnabled: ({ jigsawEnabled }) => (jigsawEnabled ? 'as a jigsaw' : null),
  cannon: ({ cannon }, _, shots) => {
    const loaded = Object.keys(cannon);
    if (loaded.length === 0) return null;
    return `Slop Cannon: ${loaded.map((id) => shots.find((shot) => shot.id === id)?.title ?? id).join(', ')}`;
  },
};

/** How this round will be run, a part per setting. The lobby joins them with a dot. */
export function roundLine(packId: PackId | null, plan: RoundPlan, shots: readonly Shot[]): string[] {
  return Object.values(SAYS)
    .map((says) => says(plan, packId, shots))
    .filter((part): part is string => part !== null);
}
