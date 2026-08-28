/**
 * Whether a join link should put this browser straight into the room.
 *
 * The link already carries the code, and a returning browser already knows its
 * own name — so the landing screen it lands on is asking a question it has the
 * answer to. This decides when that screen can be skipped.
 *
 * **It lives in the engine so the refusals can be tested**, which is the half
 * that matters. Every condition below is a case where joining silently would be
 * wrong, and all of them fail back to exactly today's behaviour: the landing
 * screen, with the code already filled in. Nothing here can make the app do
 * something it could not do before — it can only skip a press.
 */
export interface AutoJoinContext {
  /**
   * The room code carried in on the hash, or null. `codeFromHash` returns null
   * rather than half-filling, so a malformed link is already nothing.
   */
  linkedCode: string | null;
  /** What this browser last played under. Empty if it never has. */
  name: string;
  /** The squad this browser last played for. Empty for none. */
  squad: string;
  /**
   * Which side a Lurker is sitting with tonight. Empty if unchosen — and
   * unchosen is the normal state at the start of a session, because it is kept
   * in session storage on purpose.
   */
  playingWith: string;
  /** Null until anonymous sign-in lands. `join` throws without it. */
  uid: string | null;
  /**
   * Whether the client is connected. Not implied by {@link uid}: a uid outlives
   * a connection going bad, because the room listener can fail long after
   * sign-in succeeded.
   */
  connected: boolean;
  /** Whether this page load has already acted on the link. */
  consumed: boolean;
  /** Whether this device is in a room already. */
  inRoom: boolean;
}

/**
 * The one carve-out, and the only condition here that is about the game rather
 * than about readiness.
 *
 * A Lurker belongs to no side for the season and picks one for the night, and
 * that pick is held in **session** storage deliberately — sitting with Hermes
 * this week is not a standing arrangement. So a Lurker opening a link in a
 * fresh session has a squad and no side, and auto-joining would bank their
 * week's points to Lurkers rather than to whoever they actually sat with.
 *
 * That is a wrong outcome nobody would see happen, which is the kind this app
 * refuses to risk for the sake of one press. An empty squad is **not** the same
 * case: it banks as "keep whatever the record says" and changes nothing.
 */
function needsToPickASide(squad: string, playingWith: string): boolean {
  return squad === 'Lurkers' && playingWith === '';
}

export function shouldAutoJoin(context: AutoJoinContext): boolean {
  const { linkedCode, name, squad, playingWith, uid, connected, consumed, inRoom } = context;

  if (linkedCode === null) return false;
  if (consumed || inRoom) return false;
  if (uid === null || !connected) return false;

  // Trimmed rather than trusted: what is in storage is whatever an older build
  // wrote, and joining as "   " puts a nameless plate on the board. Trimming
  // only, not `cleanName` — nothing in `engine/` reaches into `lib/`, and a
  // yes-or-no decision does not need the length cap that `rememberName` applies
  // on the way in anyway.
  if (name.trim() === '') return false;

  return !needsToPickASide(squad, playingWith);
}
