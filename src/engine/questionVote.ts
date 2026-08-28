/**
 * What the room thinks of a question, and what that eventually does to the pack.
 *
 * The corpus is 14,176 imported questions and **nothing has ever let a player
 * say one was rubbish.** `docs/decisions/questions.md` records the difficulty
 * rating that is not there; this is the other half of the same problem, and the
 * cheaper one, because play already generates the opinion.
 *
 * There is a live precedent for why this shape and not the obvious one. Skip is
 * deliberately not exposed in `QuestionScreen` — the rules cannot restrict a
 * write to the quizmaster without storing their uid, so a Skip button is a
 * button anyone with the console open can press, and one player who dislikes a
 * question must not be able to void it for the room. **A vote is the safe half
 * of that**: it changes nothing about the round being played, and everything
 * about which questions the packs serve next month.
 *
 * The arithmetic lives here rather than in the fold script so `npm test` covers
 * it, the same reasoning that pulled `liveAnswers` out of `useRoom` — this is
 * the rule that decides what leaves the corpus permanently, and a second copy
 * of it would not look like a bug when it drifted.
 */

export const VERDICTS = ['good', 'bad'] as const;

export type Verdict = (typeof VERDICTS)[number];

/**
 * Whether a value is one of the two the security rules accept.
 *
 * The rule pins `verdict` to these by name, so a third value is refused at the
 * server. This exists so the client cannot offer one in the first place, and so
 * the fold script can ignore anything odd that predates a rule.
 */
export function isVerdict(value: unknown): value is Verdict {
  return typeof value === 'string' && (VERDICTS as readonly string[]).includes(value);
}

export interface VoteTally {
  good: number;
  bad: number;
}

export function tally(verdicts: Verdict[]): VoteTally {
  return {
    good: verdicts.filter((verdict) => verdict === 'good').length,
    bad: verdicts.filter((verdict) => verdict === 'bad').length,
  };
}

/**
 * How many verdicts a question needs before any of them count.
 *
 * **This is the only thing blunting a single loud voter.** The vote is
 * self-reported like every other value in this game — nothing stops somebody
 * writing fifteen `bad` verdicts from the console — and one document per uid
 * means the cheapest attack is simply a second browser. A unanimous four is
 * what one determined person looks like; five needs most of a room.
 */
export const MIN_VOTES_TO_RETIRE = 5;

/** How much of the room has to be against a question before it goes. */
export const BAD_SHARE_TO_RETIRE = 0.6;

/**
 * Whether a question should stop being served.
 *
 * Deliberately conservative in every direction, because **retiring a good
 * question is a silent loss** — nothing would ever surface it again, where a
 * bad question left in the pack merely annoys a room that can vote on it a
 * second time.
 *
 * The nonsense guard is not defensive clutter: these counts decide what leaves
 * the corpus for good, and a fractional or negative count means the caller has
 * misunderstood something, which is not a moment to start deleting questions.
 */
export function shouldRetire({ good, bad }: VoteTally): boolean {
  if (!Number.isInteger(good) || !Number.isInteger(bad)) return false;
  if (good < 0 || bad < 0) return false;

  const total = good + bad;
  if (total < MIN_VOTES_TO_RETIRE) return false;

  return bad / total >= BAD_SHARE_TO_RETIRE;
}
