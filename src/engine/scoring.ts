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
 * The stakes the last question offers, as a percentage of the points held.
 *
 * **A share rather than a number of points, and that is the load-bearing
 * decision.** You cannot stake what you do not have, so a game total can never
 * go negative — which leaves `points >= 0` and `best <= maxBest()` in
 * `firestore.rules` exactly as they are. An absolute stake breaks both and costs
 * a second ruleset paste; this one costs a bound on a single new field.
 */
export const WAGER_SHARES = [0, 25, 50, 100] as const;

/**
 * What a player actually put on the question, in points.
 *
 * Clamped rather than trusted. `wager` rides the answer document, which the
 * player writes, and the ruleset bounds it to 0-100 — but a client one deploy
 * behind, or a crafted one, is handled here so that every device reaches the
 * same number from the same document. Rounded, because a share of an odd score
 * is not a whole number and a fractional point would show up as a total that
 * does not add up.
 */
export function stakeFor(score: number, wager: number | undefined): number {
  if (!wager || wager <= 0) return 0;
  const share = Math.min(100, wager);
  return Math.round((Math.max(0, score) * share) / 100);
}

/**
 * The share of the leader's points a steal takes.
 *
 * **A share of the victim's score, not a number of points** — the same
 * load-bearing decision the wager rests on, for the same reason: you cannot take
 * what somebody does not have, so a steal can never push anyone below zero and
 * `points >= 0` on the season row is untouched.
 *
 * Five per cent, and the number is the part most worth arguing with. It fires at
 * most once a question and only when somebody other than the leader is quickest,
 * so on a fifteen-question round it lands maybe nine times: a leader on 10,000
 * who never answers first keeps about 63% of it. Against a question worth 1,000
 * that is a real pull without being the whole game. **If it plays wrong, this is
 * the dial** — the rest of the mechanic does not need touching.
 */
export const STEAL_SHARE = 5;

/** A transfer of points from the leader to whoever got there first. */
export interface Steal {
  /** Whoever led going into the question. */
  from: string;
  /** The fastest correct answer. */
  to: string;
  points: number;
}

/**
 * What one question's steal moves, or null when it moves nothing.
 *
 * The fastest correct answer takes {@link STEAL_SHARE} per cent of whatever the
 * leader held going into the question. **Nobody steals from themselves**, which
 * is what makes the mechanic self-limiting rather than a tax: a leader who keeps
 * winning questions is never pegged back, and one who has stopped answering is.
 *
 * A pure function of `{correctIndex, answers, scores}` — the same three things
 * every device already holds at the reveal, which is `scoring.md` AC#6 and the
 * reason the reveal screen can call this itself to say what happened rather than
 * needing the transfer written into the room.
 *
 * The victim is `standings()[0]`, so a tie for the lead is broken on uid exactly
 * as everything else here breaks one. That matters more than it looks: a steal
 * that picked a different victim per device would put the room's scoreboards
 * permanently out of step, and nothing would say why.
 */
export function stealFor(params: {
  correctIndex: number;
  answers: Record<string, Answer>;
  /** What each player held going into this question. */
  scores: Record<string, number>;
}): Steal | null {
  const { correctIndex, answers, scores } = params;

  const first = Object.entries(answers)
    .filter(([, answer]) => answer.optionIndex === correctIndex)
    .sort(([aUid, a], [bUid, b]) => (a.elapsedMs - b.elapsedMs) || aUid.localeCompare(bUid))[0];

  if (!first) return null;

  const leader = standings(scores)[0];
  if (!leader || leader.uid === first[0]) return null;

  const points = Math.round((Math.max(0, leader.score) * STEAL_SHARE) / 100);
  if (points <= 0) return null;

  return { from: leader.uid, to: first[0], points };
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
  /**
   * What each player held going into this question — and, by being present at
   * all, the signal that this question is being played for stakes.
   *
   * **Absent on every question but the last, and on every round with the wager
   * switched off.** `wager` is a field the player writes, and nothing in the
   * ruleset can say which question it belongs to without a `get()` on every
   * answer write. Deciding here instead means a wager sent on question one is
   * ignored, identically, by every device that scores the round.
   */
  scores?: Record<string, number>;
  /**
   * The transfer this question carries, already resolved by {@link stealFor}.
   *
   * **Passed rather than derived here**, so `scores` keeps its single meaning:
   * its presence is what turns a `wager` on an answer document into points, and
   * a steal has nothing to do with stakes. Deriving both from the same argument
   * would make it impossible to play one without the other.
   */
  steal?: Steal | null;
}): Record<string, number> {
  const { correctIndex, answers, scores, steal } = params;
  const deltas: Record<string, number> = {};

  const stake = (uid: string, answer: Answer): number =>
    (scores ? stakeFor(scores[uid] ?? 0, answer.wager) : 0);

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
    deltas[uid] = BASE_POINTS + rankBonus(position) + stake(uid, answer);
  });

  for (const [uid, answer] of Object.entries(answers)) {
    // A wrong answer keeps an explicit entry either way. `verdictFor` tells
    // `wrong` from `lost` by whether the key is here at all, so a losing stake
    // has to be a number in the map rather than an absence — and a stake of
    // nothing has to stay `0` rather than becoming `-0`.
    if (answer.optionIndex !== correctIndex) {
      const lost = stake(uid, answer);
      deltas[uid] = lost > 0 ? -lost : 0;
    }
  }

  /*
    The transfer, applied last so it lands on top of whatever the question was
    already worth. It moves points rather than making them — the same number
    leaves one player as reaches the other, so a round's total is untouched.

    The victim can be somebody who never answered, which puts a uid into this map
    that has no answer behind it. That is safe and was checked rather than
    assumed: `verdictFor` returns `silent` on a missing answer before it ever
    looks at these keys, so the `lost`-versus-`wrong` distinction it draws from
    their presence is unaffected.
  */
  if (steal) {
    deltas[steal.to] = (deltas[steal.to] ?? 0) + steal.points;
    deltas[steal.from] = (deltas[steal.from] ?? 0) - steal.points;
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
