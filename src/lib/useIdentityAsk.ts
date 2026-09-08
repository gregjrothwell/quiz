import { useEffect, useState } from 'react';
import {
  hasBeenAskedToSaveRecovery,
  markAskedToSaveRecovery,
  needsReclaim,
  readOwnClaim,
  shouldAskToSaveRecovery,
  storedPlayerId,
  storedRecoveryCode,
  type IdentityAskKind,
} from './identity';

/**
 * Whether the final screen should offer a save-your-code line, or a re-claim.
 *
 * Re-claim wins: a stored code that would not write is the thing blocking the
 * season row, and they already have a code so the first-win ask does not apply.
 *
 * `offeredGameId` keeps this visit's line up after `vibequiz.recoveryAsked` is
 * written, otherwise the flag would hide the offer on the next render.
 */
export function useIdentityAsk(
  uid: string | null,
  options: { won: boolean; banked: boolean; gameId: string | null; refresh?: number },
): IdentityAskKind | null {
  const [claim, setClaim] = useState<{ uid: string; playerId: string | null } | null>(null);
  const [offeredGameId, setOfferedGameId] = useState<string | null>(null);

  const storedId = storedPlayerId();
  const code = storedRecoveryCode();
  const probe = Boolean(uid && storedId && code && storedId !== uid);

  useEffect(() => {
    if (!uid || !probe) return;

    let cancelled = false;

    void readOwnClaim(uid).then(
      (playerId) => {
        if (!cancelled) setClaim({ uid, playerId });
      },
      (cause: unknown) => {
        if (cancelled) return;
        // A failed read is not a missing claim. Fail closed so the podium is
        // not interrupted by a re-claim we have not actually proved.
        if (cause instanceof Error) return;
      },
    );

    return () => {
      cancelled = true;
    };
  }, [uid, probe, options.refresh]);

  const claimPlayerId = probe && uid && claim?.uid === uid ? claim.playerId : undefined;

  const reclaim =
    Boolean(uid) &&
    probe &&
    claimPlayerId !== undefined &&
    needsReclaim({
      uid: uid ?? '',
      storedPlayerId: storedId,
      storedCode: code,
      claimPlayerId,
    });

  const alreadyAskedThisVisit = Boolean(options.gameId && offeredGameId === options.gameId);
  const wantSave =
    !reclaim &&
    shouldAskToSaveRecovery({
      won: options.won,
      banked: options.banked,
      alreadyAsked: hasBeenAskedToSaveRecovery() && !alreadyAskedThisVisit,
      storedCode: code,
    });

  if (wantSave && options.gameId && offeredGameId !== options.gameId) {
    setOfferedGameId(options.gameId);
  }

  useEffect(() => {
    if (wantSave) markAskedToSaveRecovery();
  }, [wantSave]);

  if (reclaim) return 'reclaim';
  if (wantSave || (options.gameId !== null && offeredGameId === options.gameId)) return 'save';
  return null;
}
