import { doc, getDoc, setDoc } from 'firebase/firestore';
import { randomRecoveryCode } from '../engine/recoveryCode';
import { firestore } from '../firebase';

/**
 * Who this browser plays as, which is deliberately no longer the same question
 * as who Firebase thinks it is.
 *
 * The season used to be keyed on the anonymous auth uid. That uid is durable per
 * browser and dies with site storage — iOS Safari evicts after about a week
 * without a visit, and a second machine has simply never seen it. While the row
 * held points that cost a total; once it holds honours it would erase a season
 * of earned reputation, silently.
 *
 * You cannot move an auth uid between browsers. A custom token needs a server,
 * which means leaving the free tier, and linking a real provider means an
 * account, which is the one thing anonymous auth is here to avoid. So the uid
 * stops being the identity: a **playerId** is stored instead, it *defaults to
 * the uid*, and another browser can claim it with a recovery code.
 *
 * Defaulting is what makes this free. Every season row written before this
 * existed is keyed by a uid, which is now simply a playerId nobody has claimed —
 * so there is no migration, and a player who never touches any of it is on
 * exactly the path they were on before.
 *
 * The code is the capability, the same trust model as the room code: anyone
 * holding it can write that row. The blast radius is a leaderboard entry.
 */

const PLAYER_ID_KEY = 'vibequiz.playerId';
const RECOVERY_KEY = 'vibequiz.recovery';

function read(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    return value && value.length > 0 ? value : null;
  } catch {
    // Private windows and locked-down profiles throw on access, which puts this
    // browser back on its uid — the identity it would have had anyway.
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing is lost for this game. The cost is that the claim does not survive
    // the tab, which is the same limitation the remembered name already carries.
  }
}

/**
 * The identity this browser writes its season row under.
 *
 * Nothing is stored until something is claimed, so an ordinary player's
 * behaviour is byte-for-byte what it was before any of this existed.
 */
export function playerIdFor(uid: string): string {
  return read(PLAYER_ID_KEY) ?? uid;
}

export function hasClaimedIdentity(uid: string): boolean {
  return playerIdFor(uid) !== uid;
}

export function storedRecoveryCode(): string | null {
  return read(RECOVERY_KEY);
}

function recoveryDoc(code: string) {
  return doc(firestore(), 'recovery', code);
}

function claimDoc(uid: string) {
  return doc(firestore(), 'claims', uid);
}

/**
 * This browser's recovery code, minting one the first time it is asked for.
 *
 * Minting rather than deriving, because the code has to be a secret and a
 * playerId is not one — it is the id of a document on a leaderboard anybody
 * signed in can read. The rules only permit a code to be minted for an identity
 * the writer already holds, so a visitor who reads a playerId off the season
 * table still cannot mint themselves a way into it.
 *
 * Retried on collision the same way a room code is. `recovery` documents are
 * create-only, so a collision fails loudly rather than repointing somebody
 * else's code at this player — which is the whole reason `update` is refused.
 */
export async function ensureRecoveryCode(playerId: string): Promise<string> {
  const existing = storedRecoveryCode();
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = randomRecoveryCode();
    const taken = await getDoc(recoveryDoc(candidate));
    if (taken.exists()) continue;

    await setDoc(recoveryDoc(candidate), { playerId });
    write(RECOVERY_KEY, candidate);
    return candidate;
  }

  throw new Error('Could not find a free recovery code, please try again');
}

export class UnknownRecoveryCode extends Error {
  constructor() {
    super('That recovery code does not match anybody');
    this.name = 'UnknownRecoveryCode';
  }
}

/**
 * Takes on the identity a recovery code points at, and returns its playerId.
 *
 * The code is read rather than asserted, which is the opposite of how the vault
 * works and is right here: the vault's document ids are public — they ship in
 * the packs — so an answer had to be unreadable and merely checkable. A recovery
 * code *is* the secret, so knowing the id is the whole proof. `list` is denied on
 * the collection for the same reason it is denied on rooms: a capability you can
 * enumerate is not one.
 *
 * The claim is written second and separately, because it is the claim — not the
 * recovery document — that the season rules consult on every write. Storing it
 * locally last means a failed write leaves this browser on the identity it had.
 */
export async function claimIdentity(uid: string, code: string): Promise<string> {
  const snapshot = await getDoc(recoveryDoc(code));
  if (!snapshot.exists()) throw new UnknownRecoveryCode();

  const { playerId } = snapshot.data() as { playerId?: unknown };
  if (typeof playerId !== 'string' || playerId.length === 0) throw new UnknownRecoveryCode();

  await setDoc(claimDoc(uid), { playerId, code });

  write(PLAYER_ID_KEY, playerId);
  write(RECOVERY_KEY, code);

  return playerId;
}
