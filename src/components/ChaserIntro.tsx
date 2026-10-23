import { NewSticker } from './NewSticker';
import { useCue } from '../lib/sound';
import { isNewMode, todayIso } from '../questions/newRounds';

interface ChaserIntroProps {
  isQuizmaster: boolean;
  onStart: () => void;
  /** Office date, `YYYY-MM-DD`. Defaults to today in London. */
  today?: string;
}

/**
 * Mr Fries's title card, before question one.
 *
 * It lives here rather than over the question, the same way the next round's
 * card lives on the standings and Share or Shaft's lives on its own screen.
 * There is no answering clock yet, so the beat costs nobody any thinking time.
 * The quizmaster taps to open the question; everyone else waits. Nothing clears
 * the card on a timer — the opening titles lost the start of the quiz that way.
 */
export function ChaserIntro({ isQuizmaster, onStart, today = todayIso() }: ChaserIntroProps) {
  useCue('sting', 'chaser-intro', true);

  return (
    <>
      <div className="card card--intro">
        <span className="card__ghost" aria-hidden="true">
          VS
        </span>
        <div className="chrome-wrap">
          <h1 className="display chrome card__round">
            Against Mr Fries <span className="card__chip">🍟</span>
          </h1>
        </div>
        <p className="card__topic">The whole office vs the house</p>
        {isNewMode('chaser', today) ? <NewSticker /> : null}
      </div>

      {isQuizmaster ? (
        <div className="transport">
          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={onStart}>
              Next question
            </button>
          </div>
        </div>
      ) : (
        <p className="muted">Waiting for the quizmaster…</p>
      )}
    </>
  );
}
