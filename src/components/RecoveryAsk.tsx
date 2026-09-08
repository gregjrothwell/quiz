import { useState } from 'react';
import {
  UnknownRecoveryCode,
  claimIdentity,
  storedRecoveryCode,
  type IdentityAskKind,
} from '../lib/identity';
import { RecoveryPanel } from './RecoveryPanel';

interface RecoveryAskProps {
  kind: IdentityAskKind;
  uid: string;
  onClaimed: (playerId: string) => void;
}

type RestoreStatus =
  | { state: 'idle' }
  | { state: 'working' }
  | { state: 'error'; message: string };

/**
 * One line, one button. Not a dialog: nobody has ever thanked a quiz for
 * interrupting the podium.
 *
 * Save inlines the existing recovery panel rather than covering the result.
 * Re-claim presents the code already in localStorage — they should not have to
 * type it again to mint `claims/{uid}`.
 */
export function RecoveryAsk({ kind, uid, onClaimed }: RecoveryAskProps) {
  const [expanded, setExpanded] = useState(false);
  const [restore, setRestore] = useState<RestoreStatus>({ state: 'idle' });

  async function restoreClaim(): Promise<void> {
    const code = storedRecoveryCode();
    if (!code) {
      setRestore({ state: 'error', message: 'No recovery code is stored in this browser.' });
      return;
    }

    setRestore({ state: 'working' });
    try {
      const { playerId } = await claimIdentity(uid, code);
      onClaimed(playerId);
      setRestore({ state: 'idle' });
    } catch (cause: unknown) {
      setRestore({
        state: 'error',
        message:
          cause instanceof UnknownRecoveryCode
            ? 'No record matches that code. Check it against the device that has it.'
            : cause instanceof Error
              ? cause.message
              : 'Something went wrong, please try again',
      });
    }
  }

  if (kind === 'save') {
    return (
      <div className="identity-ask">
        <div className="identity-ask__line">
          <p className="muted hint">
            That win is tied to this browser. Save a recovery code if you ever play from anywhere
            else.
          </p>
          {expanded ? null : (
            <button type="button" className="btn btn--ghost" onClick={() => setExpanded(true)}>
              Save a recovery code
            </button>
          )}
        </div>
        {expanded ? <RecoveryPanel uid={uid} onClaimed={onClaimed} initialCode={null} /> : null}
      </div>
    );
  }

  return (
    <div className="identity-ask">
      <div className="identity-ask__line">
        <p className="muted hint">
          This browser can no longer update that record. Restore it with the code already saved
          here.
        </p>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={restore.state === 'working'}
          onClick={() => void restoreClaim()}
        >
          {restore.state === 'working' ? 'Restoring…' : 'Restore it'}
        </button>
      </div>
      {restore.state === 'error' ? <p className="notice">{restore.message}</p> : null}
    </div>
  );
}
