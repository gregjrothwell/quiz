import { useState } from 'react';
import { VERDICTS, type Verdict } from '../engine/questionVote';

/**
 * What the room thought of the question, asked once the answer is out.
 *
 * **It sits where the answer lamps were.** That slot empties at the reveal —
 * `{revealed ? null : <AnswerLamps …/>}` — and the strip it belongs to is
 * already described as the one carrying your own state, which is exactly what a
 * verdict is. Nothing moves on the screen to make room for it.
 *
 * Asked at the reveal rather than on the standings, because the reveal is where
 * the reaction is. "That was a rubbish question" is a thing people say the
 * moment they see the answer, not a minute later looking at a table.
 *
 * The choice is held here rather than lifted, and the parent resets it by
 * remounting on the question index. Nothing else needs to know: the write is
 * fire-and-forget, and no other screen shows a tally.
 */
const LABELS: Record<Verdict, string> = {
  good: 'Good one',
  bad: 'Rubbish',
};

interface QuestionVoteProps {
  onVote: (verdict: Verdict) => void;
}

export function QuestionVote({ onVote }: QuestionVoteProps) {
  const [chosen, setChosen] = useState<Verdict | null>(null);

  return (
    <div className="lamps">
      <span className="lamp lamp--label">{chosen ? 'Noted' : 'That question?'}</span>

      {VERDICTS.map((verdict) => (
        <button
          key={verdict}
          type="button"
          /*
            Still live after a choice, and deliberately: the security rules
            grant `update` as well as `create` precisely so somebody can change
            their mind, which is the same courtesy the lecterns extend while the
            clock is running.
          */
          className={chosen === verdict ? 'lamp lamp--vote lamp--in' : 'lamp lamp--vote'}
          aria-pressed={chosen === verdict}
          onClick={() => {
            setChosen(verdict);
            onVote(verdict);
          }}
        >
          {LABELS[verdict]}
        </button>
      ))}
    </div>
  );
}
