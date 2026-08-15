import { useEffect, useRef, useState } from 'react';
import {
  formatRecoveryCode,
  isValidRecoveryCode,
  normaliseRecoveryCode,
} from '../engine/recoveryCode';
import {
  UnknownRecoveryCode,
  claimIdentity,
  ensureRecoveryCode,
  playerIdFor,
  storedRecoveryCode,
} from '../lib/identity';

interface RecoveryPanelProps {
  uid: string;
  /**
   * Re-read the board, because claiming changes whose row is yours. Handed the
   * new identity rather than leaving the screen to read it back out of storage,
   * which nothing re-renders on.
   */
  onClaimed: (playerId: string) => void;
  /**
   * The code to open on, which is this browser's stored one in the app.
   *
   * Overridable only so the preview gallery can render both states — a panel
   * that has a code and one that does not look nothing like each other, and the
   * Season screen fetches, so it is not in the gallery to be checked any other
   * way.
   */
  initialCode?: string | null;
}

type Status =
  | { state: 'idle' }
  | { state: 'working' }
  | { state: 'copied' }
  | { state: 'manual' }
  | { state: 'claimed'; merged: boolean }
  | { state: 'error'; message: string };

const FEEDBACK_MS = 3000;

/**
 * The way a season record stops belonging to one browser.
 *
 * Standings follow the anonymous auth uid, which is durable per browser and dies
 * with site storage — iOS Safari clears it after about a week without a visit,
 * and a work machine has never had it. A recovery code is the way back: saved
 * once, it puts this record on any browser that types it.
 *
 * Deliberately not minted for everybody on arrival. A code costs a document
 * write and means nothing to somebody who has not played yet, and a secret
 * handed to someone who did not ask for it is a secret nobody saves.
 */
export function RecoveryPanel({ uid, onClaimed, initialCode }: RecoveryPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState<string | null>(
    initialCode === undefined ? storedRecoveryCode : () => initialCode,
  );
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<Status>({ state: 'idle' });

  useEffect(() => {
    if (status.state !== 'copied' && status.state !== 'manual' && status.state !== 'claimed') {
      return;
    }

    const timer = window.setTimeout(() => setStatus({ state: 'idle' }), FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  function fail(cause: unknown): void {
    setStatus({
      state: 'error',
      message:
        cause instanceof UnknownRecoveryCode
          ? 'No record matches that code. Check it against the device that has it.'
          : cause instanceof Error
            ? cause.message
            : 'Something went wrong, please try again',
    });
  }

  async function mint(): Promise<void> {
    setStatus({ state: 'working' });
    try {
      // The identity, not the uid — for a browser that has already claimed one,
      // those differ, and a code minted against the uid would point at a record
      // nobody plays as.
      setCode(await ensureRecoveryCode(playerIdFor(uid)));
      setStatus({ state: 'idle' });
    } catch (cause) {
      fail(cause);
    }
  }

  // Same fallback as the room link: the clipboard needs a secure context and a
  // permission the browser can refuse, and is absent outright on an insecure
  // origin — which throws where the others reject. A copy button that silently
  // fails is worse than none, because the next paste is whatever was there
  // already, and here that would be pasted in place of an identity.
  async function copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setStatus({ state: 'copied' });
    } catch {
      inputRef.current?.select();
      setStatus({ state: 'manual' });
    }
  }

  async function claim(): Promise<void> {
    const candidate = normaliseRecoveryCode(typed);
    if (!isValidRecoveryCode(candidate)) {
      setStatus({ state: 'error', message: 'That is not a complete recovery code.' });
      return;
    }

    setStatus({ state: 'working' });
    try {
      const { playerId, merged } = await claimIdentity(uid, candidate);
      setCode(candidate);
      setTyped('');
      setStatus({ state: 'claimed', merged });
      onClaimed(playerId);
    } catch (cause) {
      fail(cause);
    }
  }

  return (
    <section className="recovery">
      <p className="eyebrow">This record, on another device</p>

      {code ? (
        <div className="share__row">
          <input
            ref={inputRef}
            className="input share__link"
            value={formatRecoveryCode(code)}
            readOnly
            aria-label="Your recovery code"
            onFocus={(event) => event.target.select()}
          />
          <button
            type="button"
            className="btn share__copy"
            onClick={() => void copy(formatRecoveryCode(code))}
          >
            {status.state === 'copied' ? 'Copied' : 'Copy code'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn"
          disabled={status.state === 'working'}
          onClick={() => void mint()}
        >
          {status.state === 'working' ? 'Just a moment…' : 'Get a recovery code'}
        </button>
      )}

      <p className="recovery__hint">
        {code
          ? 'Keep this somewhere you will still have it in a month. Typing it on another browser moves this record there — it does not copy it, and anyone who has the code can use it.'
          : 'Save one and this record follows you to a new laptop, a phone, or a browser that has cleared its storage. Without one it lives only here.'}
      </p>

      <div className="recovery__claim">
        <label className="field">
          <span className="field__label">Already have a code?</span>
          <input
            className="input"
            value={typed}
            placeholder="ABCD-EFGH"
            autoComplete="off"
            spellCheck={false}
            aria-label="Recovery code to claim"
            onChange={(event) => setTyped(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={status.state === 'working' || typed.length === 0}
          onClick={() => void claim()}
        >
          Take it on
        </button>
      </div>

      <p
        className={status.state === 'error' ? 'notice' : 'recovery__status'}
        aria-live="polite"
      >
        {status.state === 'error'
          ? status.message
          : status.state === 'claimed'
            ? status.merged
              ? 'Done — this browser now plays as that record, and the games it had already played have been added to it.'
              : 'Done — this browser now plays as that record.'
            : status.state === 'manual'
              ? 'Your browser wouldn’t let us copy — the code is selected, so take it from the box.'
              : status.state === 'copied'
                ? 'Copied.'
                : ''}
      </p>
    </section>
  );
}
