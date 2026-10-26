/**
 * The Slop Cannon (docs/decisions/slop-cannon.md): unfinished features, loaded
 * into one round by the quizmaster, with a Keep / Bin from the room at the end.
 *
 * A trial is a **shot**. A shot is an entry in {@link SHOTS} and nothing else:
 * the lobby lists it, the room carries which were loaded, the kept round
 * records them, and Final asks about each. What a shot actually *does* is the
 * shot's own code, which asks {@link isLoaded} whether to run.
 *
 * Pure. The kill switch is read by `src/lib/cannon.ts`.
 */

export interface Shot {
  /** ≤ {@link MAX_SHOT_ID} characters, `a-z0-9-`. It is a key on the room and in a verdict's id. */
  id: string;
  title: string;
  /** One line of what it does, under the toggle. */
  blurb: string;
}

/**
 * Everything the cannon can fire. **Empty in v1**: it shipped dark on
 * 26 October 2026 with nothing to load, and the lobby section does not render
 * until something is here (B6).
 */
export const SHOTS: readonly Shot[] = [];

/**
 * Registered under the emulators only, so e2e can drive the whole path —
 * toggle, room, kept round, verdict — while the live cannon is empty. It does
 * nothing but be loaded.
 */
export const TEST_SHOT: Shot = {
  id: 'test-shot',
  title: 'Test shot',
  blurb: 'Does nothing. Only here under the emulators, so the cannon can be tested.',
};

/** The room rule's ceiling. Rules cannot walk a map, so the count is what they bound. */
export const MAX_LOADED = 8;
export const MAX_SHOT_ID = 32;

/** What the room carries: `{ [shotId]: true }`, and absent when nothing is loaded. */
export type Loaded = Readonly<Record<string, true>>;

/**
 * The kill switch, `config/cannon` (C1–C3). `off` lists shots pulled without a
 * deploy. `'all'` when the read failed: a broken switch fails safe.
 */
export type KillSwitch = { off: readonly string[] } | 'all';

export const NOTHING_KILLED: KillSwitch = { off: [] };

const SHOT_ID = /^[a-z0-9-]+$/;

function validId(id: string): boolean {
  return id.length > 0 && id.length <= MAX_SHOT_ID && SHOT_ID.test(id);
}

function killed(kill: KillSwitch, id: string): boolean {
  return kill === 'all' || kill.off.includes(id);
}

/** What the lobby offers: every registered shot the kill switch has not pulled (B2, C1). */
export function available(shots: readonly Shot[], kill: KillSwitch): Shot[] {
  return shots.filter((shot) => validId(shot.id) && !killed(kill, shot.id));
}

/** The room's map from the quizmaster's choice, bounded as the rules bound it (B3, B4). */
export function toLoaded(ids: Iterable<string>): Loaded {
  const loaded: Record<string, true> = {};
  for (const id of ids) {
    if (Object.keys(loaded).length >= MAX_LOADED) break;
    if (validId(id)) loaded[id] = true;
  }
  return loaded;
}

/** The room's `cannon` field, read through the bounds rather than trusted. */
export function readLoaded(value: unknown): Loaded {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return toLoaded(Object.entries(value).filter(([, on]) => on === true).map(([id]) => id));
}

/** `config/cannon`, read: a missing document is nothing killed. Anything malformed is everything killed. */
export function readKillSwitch(value: unknown): KillSwitch {
  if (value === undefined) return NOTHING_KILLED;
  if (typeof value !== 'object' || value === null) return 'all';
  const off: unknown = Reflect.get(value, 'off');
  if (off === undefined) return NOTHING_KILLED;
  if (!Array.isArray(off) || !off.every((id) => typeof id === 'string')) return 'all';
  return { off: off as string[] };
}

/**
 * Whether this device runs a shot in this round: loaded on the room, still
 * registered, and not pulled by the kill switch — mid-round included (C1).
 */
export function isLoaded(loaded: Loaded, shots: readonly Shot[], kill: KillSwitch, id: string): boolean {
  return loaded[id] === true && shots.some((shot) => shot.id === id) && !killed(kill, id);
}

/**
 * The shots loaded into this round that this device knows about, in registry
 * order — what the standings name and Final asks about. The kill switch does
 * not hide a shot here: a shot pulled mid-round was still in the round, and
 * the room still gets to say what it made of it.
 */
export function loadedShots(loaded: Loaded, shots: readonly Shot[]): Shot[] {
  return shots.filter((shot) => loaded[shot.id] === true);
}

/** Keep / Bin (D1). Two, deliberately: a "not sure" is a vote nobody can act on. */
export const CANNON_VERDICTS = ['keep', 'bin'] as const;
export type CannonVerdict = (typeof CANNON_VERDICTS)[number];

/** The verdict's document id: one per player per shot per round (D3). */
export function verdictId(gameId: string, shot: string, uid: string): string {
  return `${gameId}_${shot}_${uid}`;
}
