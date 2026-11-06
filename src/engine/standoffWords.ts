import { outcomeOf, type CutTie, type Standoff } from './standoff';

/**
 * What the reveal says, to whoever is looking at it.
 *
 * The wager's fifth trap is the reason this is its own function: the biggest
 * swing on the screen must never be the one it stays quiet about. A finalist
 * who was shafted is told so in words, by name, with what they lost — not left
 * to work it out from a number that went to zero.
 */

export interface StandoffWords {
  headline: string;
  /** A pick that never arrived, which counted as share. Null when both did. */
  note: string | null;
}

interface WordsInput {
  standoff: Standoff;
  nameOf: (uid: string) => string;
  youUid: string | null;
  /** Who tops the board after the settle, for the one outcome that hands it on. */
  leaderAfter: string | null;
}

const points = (value: number): string => value.toLocaleString('en-GB');

export function standoffWords({ standoff, nameOf, youUid, leaderAfter }: WordsInput): StandoffWords | null {
  const outcome = outcomeOf(standoff);
  if (!outcome || !standoff.picks) return null;

  const inFinal = youUid !== null && standoff.finalists.includes(youUid);

  let headline: string;
  switch (outcome.kind) {
    case 'shared':
      headline = `${inFinal ? 'You both' : 'They'} shared — ${points(outcome.each)} each, joint winners.`;
      break;
    case 'shafted':
      headline =
        outcome.by === youUid
          ? `You shafted ${nameOf(outcome.from)}. All ${points(outcome.pot)} is yours.`
          : outcome.from === youUid
            ? `${nameOf(outcome.by)} shafted you. You leave with nothing.`
            : `${nameOf(outcome.by)} shafted ${nameOf(outcome.from)} and takes all ${points(outcome.pot)}.`;
      break;
    case 'bothShafted': {
      const opener = inFinal ? 'You both shafted' : 'Both shafted';
      const handedOn = leaderAfter ? ` — ${leaderAfter === youUid ? 'you win' : `${nameOf(leaderAfter)} wins`} it` : '';
      headline = `${opener}. ${points(outcome.pot)} gone${handedOn}.`;
      break;
    }
  }

  const silent = standoff.finalists.filter((uid) => standoff.picks?.[uid] === null);
  const note =
    silent.length === 0
      ? null
      : silent
          .map((uid) => `${uid === youUid ? 'You' : nameOf(uid)} never picked, which counts as share.`)
          .join(' ');

  return { headline, note };
}

function listed(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Says how a tie for a place in the final was settled. The board cannot: it shows
 * a tie as one shared position, in uid order, which can put the one who missed
 * out first.
 */
export function tieWords({
  tie,
  nameOf,
  youUid,
}: {
  tie: CutTie | null;
  nameOf: (uid: string) => string;
  youUid: string | null;
}): string | null {
  if (!tie) return null;
  const youFirst = (uids: readonly string[]): string[] => [
    ...uids.filter((uid) => uid === youUid),
    ...uids.filter((uid) => uid !== youUid),
  ];
  const named = (uids: readonly string[], you: string): string =>
    listed(youFirst(uids).map((uid) => (uid === youUid ? you : nameOf(uid))));

  const tied = named(tie.tied, 'You');
  const picked = named(tie.picked, 'You');
  const onePair = tie.tied.length === 2;
  const lead = `${tied} tied on ${points(tie.score)}`;

  if (tie.decidedBy === 'coin') {
    return `${lead}. Level on right answers and speed too, so a coin picked ${named(tie.picked, 'you')}.`;
  }
  if (tie.decidedBy === 'right') {
    if (!onePair) return `${lead}. ${picked} got the most right.`;
    const winner = tie.picked[0] ?? '';
    const loser = tie.tied.find((uid) => uid !== winner) ?? '';
    return `${lead}. ${picked} got more right, ${tie.rightOf[winner] ?? 0} to ${tie.rightOf[loser] ?? 0}.`;
  }
  if (!onePair) return `${lead}. ${picked} got the most right, then the fastest.`;
  const each = tie.rightOf[tie.tied[0] ?? ''] ?? 0;
  return `${lead}, with ${each} right each. ${picked} ${tie.picked[0] === youUid ? 'were' : 'was'} faster.`;
}
