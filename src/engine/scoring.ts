import type { Answer } from './state';

/** Awarded for any correct answer, however slow. */
export const BASE_POINTS = 500;

/**
 * What being first is worth, then second, third and fourth.
 *
 * **This replaced a linear decay across the answer window on 20 August 2026**, and
 * the reason is arithmetic rather than taste. The old curve paid
 * `BASE_POINTS + 500 * (1 - elapsed/window)`, so on a ten-second question a
 * player answering at 0.4s — about as fast as reaction, render and network
 * allow — scored 980, and one at a full second scored 950. Thirty points
 * separated the fastest possible answer from an ordinary one, and nobody in a
 * year of rounds ever remarked on it. Nobody ever scored 1,000 either, because
 * that needed a zero-latency answer at the instant of render.
 *
 * The rank bonus makes the same gap 100 points and makes it legible: you are not
 * racing a decay curve you cannot see, you are racing the people in the room.
 *
 * See docs/decisions/scoring.md.
 */
export const RANK_BONUSES = [500, 400, 300, 200] as const;

/**
 * What fifth place and everything after it is worth.
 *
 * A floor rather than a tail to nothing, because a correct answer in a big room
 * should not be worth barely more than a wrong one — the base is doing that job
 * already, and the bonus is only meant to separate the front of the field.
 */
export const RANK_FLOOR = 100;

/**
 * The bonus for finishing in a given 1-based position among the correct
 * answers. Positions past {@link RANK_BONUSES} take {@link RANK_FLOOR}.
 */
export function rankBonus(position: number): number {
  return RANK_BONUSES[Math.max(0, position - 1)] ?? RANK_FLOOR;
}

/**
 * Points each player earned on one question.
 *
 * Correct answers are ranked against each other by `elapsedMs` and paid
 * {@link BASE_POINTS} plus {@link rankBonus}; wrong answers score nothing. The
 * answer window is deliberately not a parameter — the bonus ranks answers
 * against each other rather than against the clock, so a fifteen-second question
 * and a ten-second one pay identically.
 *
 * Two properties the rest of the app depends on:
 *
 * - **Everyone who answered is in the result**, including a zero for everyone
 *   who got it wrong. `verdictFor` tells `lost` from `wrong` by whether the key
 *   exists at all, so dropping the zeros would tell an honest wrong answer that
 *   the room never scored it. Players who did not answer are absent, which is
 *   what keeps "got it wrong" apart from "ran out of time".
 * - **Ties share a rank and the next distinct time resumes at the count already
 *   awarded**, which is the convention {@link standings} uses. Two players level
 *   on the fastest correct answer are both first and both take 1000; the next is
 *   third and takes 800. One tie rule in the game rather than two.
 *
 * The sort breaks a tie on uid so every device orders the field identically.
 * It cannot change anybody's score — tied answers take the same bonus — but the
 * reveal is re-derived on every client from the same log, and an ordering that
 * differed between devices is the kind of thing that shows up later somewhere
 * else.
 */
export function tallyQuestion(params: {
  /**
   * Passed in rather than read off the question. Until the reveal, no device
   * holds it — the answer comes back from the vault at the moment the question
   * closes, and scoring is the first thing that gets to see it.
   */
  correctIndex: number;
  answers: Record<string, Answer>;
}): Record<string, number> {
  const { correctIndex, answers } = params;
  const deltas: Record<string, number> = {};

  const correct = Object.entries(answers)
    .filter(([, answer]) => answer.optionIndex === correctIndex)
    .sort(([aUid, a], [bUid, b]) => (a.elapsedMs - b.elapsedMs) || aUid.localeCompare(bUid));

  let position = 0;
  let previousElapsed: number | null = null;

  correct.forEach(([uid, answer], i) => {
    if (previousElapsed === null || answer.elapsedMs !== previousElapsed) {
      position = i + 1;
      previousElapsed = answer.elapsedMs;
    }
    deltas[uid] = BASE_POINTS + rankBonus(position);
  });

  for (const [uid, answer] of Object.entries(answers)) {
    if (answer.optionIndex !== correctIndex) deltas[uid] = 0;
  }

  return deltas;
}

/**
 * What to tell a player about their own answer, once the question is revealed.
 *
 * `lost` is the one worth having a name for. The other three are what the player
 * already knows; this one is the room disagreeing with what they saw on their own
 * screen, and until it existed nothing said so.
 */
export type Verdict = 'correct' | 'wrong' | 'lost' | 'silent';

export interface VerdictInput {
  /** This player's answer to the question in play, if this device has one. */
  answer: Answer | undefined;
  correctIndex: number | null;
  /** `lastDeltas` from the reveal — every player the question was scored for. */
  deltas: Record<string, number>;
  uid: string | null;
}

/**
 * Reads one player's fortunes off a reveal.
 *
 * The whole point is the `lost` case. An answer is written to a subcollection and
 * the reveal is folded on the quizmaster's device, so there is a gap in which an
 * answer can be perfectly valid — inside the window, on the right question — and
 * still not be in the room when the question is scored. The player sees their
 * lectern light up and their score not move, and nothing connects the two. In
 * room 6JA5 that would have read as **"Correct · +0"**, which is the game calling
 * itself a liar.
 *
 * The test for it is exact rather than a guess: `tallyQuestion` emits an entry
 * for *everyone* whose answer was scored, including a zero for everyone who got
 * it wrong. So a player holding an answer who has no entry at all was not in the
 * tally, and that is the only way it can happen.
 *
 * Call it only once the question is revealed. Before that the deltas belong to
 * the previous question and every answer looks lost.
 */
export function verdictFor({ answer, correctIndex, deltas, uid }: VerdictInput): Verdict {
  if (!uid || !answer) return 'silent';
  if (!Object.hasOwn(deltas, uid)) return 'lost';
  return answer.optionIndex === correctIndex ? 'correct' : 'wrong';
}

export interface Standing {
  uid: string;
  score: number;
  /** 1-based, with ties sharing a position. */
  position: number;
}

/**
 * Ranks players highest first. Tied scores share a position, and the next
 * distinct score resumes at the count already awarded — so two players on 1000
 * are both 1st and the next is 3rd.
 */
export function standings(scores: Record<string, number>): Standing[] {
  const sorted = Object.entries(scores)
    .map(([uid, score]) => ({ uid, score }))
    .sort((a, b) => (b.score - a.score) || a.uid.localeCompare(b.uid));

  let position = 0;
  let previousScore: number | null = null;

  return sorted.map((entry, i) => {
    if (previousScore === null || entry.score !== previousScore) {
      position = i + 1;
      previousScore = entry.score;
    }
    return { ...entry, position };
  });
}

/**
 * The standings, less anybody the room no longer lists.
 *
 * `scores` outlives membership on purpose — a player who leaves keeps their
 * score in the map so the numbers still add up if they come back — so ranking
 * the raw map puts people on the board who are not in the room.
 *
 * Written out three separate times before this existed: in `App.tsx`, `Final`
 * and `Standings`. Two of those paint a screen and the third feeds `recordGame`,
 * so a divergence between them would not look like a rendering bug — it would
 * bank a wrong season row and keep it.
 */
export function roomStandings(
  players: Record<string, unknown>,
  scores: Record<string, number>,
): Standing[] {
  return standings(scores).filter((entry) => players[entry.uid]);
}

/** How many the podium stands up, and so where the floor begins. */
export const PODIUM_PLACES = 3;

/**
 * Who finished on the lowest score, for the chair at the end of the podium.
 *
 * One condition does all the work: the tie for last has to *start* below the
 * podium. That is what keeps the three edge cases honest, and each of them is a
 * real office round rather than a hypothetical.
 *
 * A round where nobody scored is not a round somebody lost, so a table tied on
 * zero seats no one — the tie starts at the top. A room of three has a third
 * place already standing on a riser, and nobody should be on a riser and in the
 * chair at once. And a tie that reaches up into the podium is the same clash a
 * place lower down: last is only last when everybody above it is genuinely above
 * it.
 *
 * Returns everyone on that score, because a shared last place is still last.
 */
export function seatedLast(rows: readonly Standing[]): string[] {
  const lowest = rows[rows.length - 1]?.score;
  if (lowest === undefined) return [];

  const first = rows.findIndex((row) => row.score === lowest);
  if (first < PODIUM_PLACES) return [];

  return rows.slice(first).map((row) => row.uid);
}
