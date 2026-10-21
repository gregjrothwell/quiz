import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ArcTimer } from '../components/ArcTimer';
import { Confetti } from '../components/Confetti';
import { ScoreTicker } from '../components/ScoreTicker';
import { Standings } from '../components/Standings';
import { roomStandings } from '../engine/scoring';
import {
  outcomeOf,
  PICK_MS,
  potOf,
  takeFor,
  TALK_MS,
  type StandoffOutcome,
  type StandoffPick,
} from '../engine/standoff';
import { standoffWords } from '../engine/standoffWords';
import type { RoomState } from '../engine/state';
import { BUZZ_CORRECT, BUZZ_LOCK, BUZZ_SHAFTED, buzz, useBuzz } from '../lib/haptics';
import { play, useCue } from '../lib/sound';
import type { StandoffView } from '../lib/useStandoff';
import { useReducedMotion } from '../lib/useReducedMotion';

interface ShareOrShaftProps {
  room: RoomState;
  youUid: string | null;
  isQuizmaster: boolean;
  view: StandoffView;
  /** Ends the talking early. The quizmaster's device ends it anyway when the clock runs out. */
  onOpenPicks: () => void;
  /** From the reveal to the results. */
  onNext: () => void;
}

const points = (value: number): string => value.toLocaleString('en-GB');

/**
 * The reveal, beat by beat. Played on every device from the moment the room
 * reaches `revealed` — the same Firestore change lands everywhere together, so
 * the room watches one sequence rather than each screen keeping its own time.
 *
 * - `flip`: both picks turn over.
 * - `clash`: the seats act it out — they slide together, or one lunges.
 * - `impact`: whoever was shafted breaks. Nothing breaks on a share.
 * - `settled`: the words and the table, which is everything the screen showed
 *   before any of this existed.
 *
 * Reduced motion goes straight to `settled`, and every end state carries the
 * outcome on its own — the joined desk, the cracked seat — so nothing is lost.
 */
type Beat = 'flip' | 'clash' | 'impact' | 'settled';
const BEATS: readonly Beat[] = ['flip', 'clash', 'impact', 'settled'];

const CLASH_MS = 900;
/** Where the lunge lands: 45% of its 520ms in the stylesheet. */
const IMPACT_MS = CLASH_MS + 230;
const SETTLE_MS = 2_600;
/** Longer, for the blackout and third place walking into the light. */
const SETTLE_BOTH_MS = 4_200;

/** Ten pieces of a seat, cut from one point a little above centre out to its rim. */
const RIM: Array<[number, number]> = [
  [0, 0],
  [34, 0],
  [68, 0],
  [100, 0],
  [100, 55],
  [100, 100],
  [62, 100],
  [28, 100],
  [0, 100],
  [0, 48],
];
const SPINS = [-38, 24, -14, 46, -52, 30, -22, 41, -33, 18];

/*
  Fixed rather than random, so every screen in the room breaks the same way and
  the render stays pure. Each piece flies outwards from the centre and falls.
*/
const SHARDS: CSSProperties[] = RIM.map(([x1, y1], index) => {
  const [x2, y2] = RIM[(index + 1) % RIM.length] ?? [0, 0];
  const midX = (x1 + x2) / 2 - 50;
  const midY = (y1 + y2) / 2 - 45;
  return {
    clipPath: `polygon(50% 45%, ${x1}% ${y1}%, ${x2}% ${y2}%)`,
    '--dx': `${Math.round(midX * 2.4)}px`,
    '--dy': `${Math.round(midY * 1.6 + 120)}px`,
    '--spin': `${SPINS[index] ?? 0}deg`,
    '--lag': `${(index % 4) * 25}ms`,
  } as CSSProperties;
});

type SeatRole = 'sharer' | 'shafter' | 'victim' | 'wrecked';

function roleOf(outcome: StandoffOutcome, uid: string): SeatRole {
  switch (outcome.kind) {
    case 'shared':
      return 'sharer';
    case 'shafted':
      return outcome.by === uid ? 'shafter' : 'victim';
    case 'bothShafted':
      return 'wrecked';
  }
}

interface SeatProps {
  uid: string;
  side: 'left' | 'right';
  name: string;
  isYou: boolean;
  stake: number;
  /** Null until the seats act the outcome out. */
  take: number | null;
  label: string;
  state: string;
  role: SeatRole | null;
  /** Whether this seat has taken its hit yet. */
  broken: boolean;
  lockKey: string;
}

function Seat({ uid, side, name, isYou, stake, take, label, state, role, broken, lockKey }: SeatProps) {
  // The room's only news during the pick is that somebody locked in, so it
  // lands with a thud on every screen but the one that pressed the button —
  // that one already heard its own lock.
  useCue('lock', `${lockKey}:${uid}`, state === 'locked' && !isYou);

  return (
    <div
      className={isYou ? 'standoff__seat standoff__seat--you' : 'standoff__seat'}
      data-side={side}
      data-role={role ?? undefined}
      data-broken={broken ? '' : undefined}
    >
      {/* First, so the words paint over the cracks rather than under them. */}
      {broken ? (
        <svg className="standoff__crack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="14,0 31,28 50,45 71,61 84,100" />
          <polyline points="50,45 100,31" />
          <polyline points="50,45 22,100" />
          <polyline points="31,28 0,36" />
        </svg>
      ) : null}
      <p className="standoff__name">
        {name}
        {isYou ? <span className="standoff__you"> (you)</span> : null}
      </p>
      <p className="standoff__stake">
        {take === null ? (
          <>{points(stake)} in the pot</>
        ) : (
          <>
            {take > 0 ? 'Takes ' : 'Leaves with '}
            <span aria-hidden="true">
              <ScoreTicker value={take} from={stake} />
            </span>
            <span className="sr-only">{points(take)}</span>
          </>
        )}
      </p>
      {/* Keyed on the state, so each change remounts it and plays its own
          entrance: the stamp for "locked in", the flip for a pick. */}
      <p className="standoff__state" data-state={state} key={state}>
        {label}
      </p>

      {broken ? (
        <>
          <span className="standoff__shards" aria-hidden="true">
            {SHARDS.map((style, index) => (
              <i key={index} style={style} />
            ))}
          </span>
        </>
      ) : null}
    </div>
  );
}

/**
 * The final: the top two, both their scores in the pot, sixty seconds to talk
 * and fifteen to pick. See `engine/standoff.ts` for the rules and
 * docs/decisions/share-or-shaft.md for why each one is what it is.
 *
 * Every screen shows the same two seats. What differs is only what a viewer can
 * do: a finalist gets the two buttons, the quizmaster gets the stage controls,
 * and everybody else watches. Nobody's screen shows a pick before the reveal —
 * the most a spectator ever sees is *locked in*.
 */
export function ShareOrShaft({
  room,
  youUid,
  isQuizmaster,
  view,
  onOpenPicks,
  onNext,
}: ShareOrShaftProps) {
  const standoff = room.standoff;
  const stage = standoff?.stage ?? 'talk';
  const amFinalist = youUid !== null && Boolean(standoff?.finalists.includes(youUid));
  const { pick, myPick } = view;
  const gameKey = room.gameId ?? '';
  const outcome = standoff ? outcomeOf(standoff) : null;

  // ── The reveal, beat by beat ─────────────────────────────────────────────

  const reducedMotion = useReducedMotion();
  const revealKey = stage === 'revealed' ? `${gameKey}:revealed` : null;
  /*
    `cut` is the quizmaster having jumped to the end on this device. Beats only
    ever move forward — a timer still pending after a cut must not drag the
    screen back to `impact` — and a cut sequence drops the blackout and the
    heir, which would otherwise land over the result it skipped to.
  */
  const [beatAt, setBeatAt] = useState<{ key: string; beat: Beat; cut: boolean }>({
    key: '',
    beat: 'flip',
    cut: false,
  });
  const settleMs = outcome?.kind === 'bothShafted' ? SETTLE_BOTH_MS : SETTLE_MS;

  const advance = useCallback((key: string, beat: Beat, cut = false) => {
    setBeatAt((held) => {
      const same = held.key === key;
      if (same && BEATS.indexOf(held.beat) >= BEATS.indexOf(beat)) return held;
      return { key, beat, cut: cut || (same && held.cut) };
    });
  }, []);

  useEffect(() => {
    if (revealKey === null || reducedMotion) return;
    const at = (beat: Beat, ms: number): number => window.setTimeout(() => advance(revealKey, beat), ms);
    const timers = [at('clash', CLASH_MS), at('impact', IMPACT_MS), at('settled', settleMs)];
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [revealKey, reducedMotion, settleMs, advance]);

  const beat: Beat | null =
    revealKey === null ? null : reducedMotion ? 'settled' : beatAt.key === revealKey ? beatAt.beat : 'flip';
  const reached = (target: Beat): boolean =>
    beat !== null && BEATS.indexOf(beat) >= BEATS.indexOf(target);
  const settled = reached('settled');
  const cut = !reducedMotion && beatAt.key === revealKey && beatAt.cut;

  const hurt =
    outcome !== null &&
    youUid !== null &&
    ((outcome.kind === 'shafted' && outcome.from === youUid) || (outcome.kind === 'bothShafted' && amFinalist));

  useCue('sting', `${gameKey}:final`, stage === 'talk');
  // The whistle has gone and the picks are being opened: the podium's drum
  // roll, so the wait reads as the build-up it is rather than as a stall.
  useCue('roll', `${gameKey}:closed`, stage === 'closed');
  useCue('gong', `${gameKey}:revealed`, stage === 'revealed');
  useCue(outcome?.kind === 'shared' ? 'chime' : 'shatter', `${gameKey}:impact`, reached('impact'));
  useBuzz(hurt ? BUZZ_SHAFTED : BUZZ_CORRECT, `${gameKey}:impact`, reached('impact') && amFinalist);

  // The last five seconds of the pick, on the two finalists' screens only. On
  // every screen it was a dozen heartbeats a few hundred milliseconds apart
  // down one call — each device counts its own clock from its own snapshot —
  // which is an echo, not a pulse. The two who are deciding hear it.
  const heartbeat = stage === 'pick' && amFinalist && view.secondsLeft > 0 && view.secondsLeft <= 5;
  useCue('heartbeat', `${gameKey}:pick:${view.secondsLeft}`, heartbeat);

  const choose = useCallback(
    (choice: StandoffPick) => {
      play('lock');
      buzz(BUZZ_LOCK);
      pick(choice);
    },
    [pick],
  );

  // The whole final is playable from the keyboard, as the round is: 1 to share,
  // 2 to shaft, and space for the quizmaster to move it on. During the reveal
  // the first press only jumps this screen to the result — one press used to
  // take the whole room to the final results in the middle of a shatter.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();

      if (stage === 'pick' && amFinalist && myPick === null && (key === '1' || key === '2')) {
        event.preventDefault();
        choose(key === '1' ? 'share' : 'shaft');
        return;
      }

      if (!isQuizmaster || (key !== ' ' && key !== 'enter')) return;
      if (stage === 'talk') {
        event.preventDefault();
        onOpenPicks();
      } else if (stage === 'revealed' && revealKey !== null) {
        event.preventDefault();
        if (settled) onNext();
        else advance(revealKey, 'settled', true);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, amFinalist, myPick, isQuizmaster, choose, onOpenPicks, onNext, revealKey, settled, advance]);

  if (!standoff) {
    return <p className="muted">Setting up the final…</p>;
  }

  const nameOf = (uid: string): string => room.players[uid]?.name ?? 'Somebody who left';
  const leaderAfter = roomStandings(room.players, room.scores)[0]?.uid ?? null;
  const words = standoffWords({ standoff, nameOf, youUid, leaderAfter });
  const pot = potOf(standoff);
  const acting = outcome !== null && reached('clash');

  const seatState = (uid: string): { label: string; state: string } => {
    if (stage === 'revealed') {
      const picked = standoff.picks?.[uid] ?? null;
      return picked === null ? { label: 'No pick', state: 'none' } : { label: picked, state: picked };
    }
    if (stage === 'closed') {
      return standoff.sealed?.includes(uid)
        ? { label: 'Locked in', state: 'locked' }
        : { label: 'No pick', state: 'none' };
    }
    if (stage === 'pick') {
      return view.lockedIn[uid] ? { label: 'Locked in', state: 'locked' } : { label: 'Choosing…', state: 'waiting' };
    }
    return { label: 'Talking', state: 'waiting' };
  };

  const shafterSide =
    outcome?.kind === 'shafted' ? (standoff.finalists.indexOf(outcome.by) === 0 ? 'left' : 'right') : undefined;

  return (
    <>
      <div className="card">
        <span className="card__ghost" aria-hidden="true">
          ?
        </span>
        <div className="chrome-wrap">
          <h1 className="display chrome card__round">Share or Shaft</h1>
        </div>
        <p className="card__topic">The top two, for both their scores</p>
      </div>

      <div
        className="standoff"
        aria-live="polite"
        data-stage={stage}
        data-outcome={acting ? outcome.kind : undefined}
        data-taker={shafterSide}
        data-shake={acting && hurt ? '' : undefined}
      >
        {standoff.finalists.map((uid, index) => {
          const { label, state } = seatState(uid);
          const role = acting ? roleOf(outcome, uid) : null;
          return (
            <Seat
              key={uid}
              uid={uid}
              side={index === 0 ? 'left' : 'right'}
              name={nameOf(uid)}
              isYou={uid === youUid}
              stake={standoff.stakes[uid] ?? 0}
              take={acting ? takeFor(standoff, uid) : null}
              label={label}
              state={state}
              role={role}
              broken={role === 'victim' || role === 'wrecked'}
              lockKey={gameKey}
            />
          );
        })}

        <div className="standoff__pot">
          <p className="standoff__pot-label">The pot</p>
          <p className="standoff__pot-sum">
            <span aria-hidden="true">
              <ScoreTicker value={pot} from={0} />
            </span>
            <span className="sr-only">{points(pot)}</span>
          </p>
        </div>
      </div>

      {/* The light in the room as it lands: green for a share, red for a shaft,
          and the house going dark when both of them throw it away. */}
      {acting && !cut ? <div className="standoff__wash" data-outcome={outcome.kind} aria-hidden="true" /> : null}
      {/* Joint winners get what any winner gets. */}
      <Confetti fire={outcome?.kind === 'shared' && reached('impact') && !reducedMotion} />

      {stage === 'talk' ? (
        <div className="stack standoff__stage">
          <ArcTimer secondsLeft={view.secondsLeft} remainingMs={view.remainingMs} totalMs={TALK_MS} />
          <p className="lede">
            {amFinalist
              ? 'Sixty seconds, out loud on the call. Then you each pick in secret.'
              : 'Sixty seconds for them to talk it over. Then they each pick in secret.'}
          </p>
          <p className="muted hint">
            Both share: half each, joint winners. One shafts: they take the lot. Both shaft: both lose
            it all, and whoever is third wins.
          </p>
          {isQuizmaster ? (
            <div className="btn-row">
              <button type="button" className="btn btn--primary" onClick={onOpenPicks}>
                Time to choose
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {stage === 'pick' ? (
        <div className="stack standoff__stage">
          <ArcTimer secondsLeft={view.secondsLeft} remainingMs={view.remainingMs} totalMs={PICK_MS} />
          {amFinalist ? (
            <>
              <div className="picker picker--standoff">
                <button
                  type="button"
                  className="pick pick--share"
                  aria-pressed={myPick === 'share'}
                  disabled={myPick !== null}
                  onClick={() => choose('share')}
                >
                  <b>Share</b>
                  <span>Split the pot, level</span>
                  <i className="pick__key">Press 1</i>
                  {myPick === 'share' ? (
                    <span className="pick__seal" aria-hidden="true">
                      Sealed
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="pick pick--shaft"
                  aria-pressed={myPick === 'shaft'}
                  disabled={myPick !== null}
                  onClick={() => choose('shaft')}
                >
                  <b>Shaft</b>
                  <span>Take the lot, unless they do too</span>
                  <i className="pick__key">Press 2</i>
                  {myPick === 'shaft' ? (
                    <span className="pick__seal" aria-hidden="true">
                      Sealed
                    </span>
                  ) : null}
                </button>
              </div>
              <p className="muted hint">
                {myPick === null
                  ? 'Nobody sees your pick until both of you are in. No pick counts as share.'
                  : 'Locked in. Nobody can see it, and it cannot change.'}
              </p>
            </>
          ) : (
            <p className="lede">
              They are choosing. Nobody sees either pick until both are in.
            </p>
          )}
        </div>
      ) : null}

      {stage === 'closed' ? (
        <div className="stack standoff__stage">
          <p className="lede">Turning them over…</p>
        </div>
      ) : null}

      {/* Third place, walking into the one light left on. Said in full by the
          headline a moment later, so it is hidden from a screen reader here. */}
      {outcome?.kind === 'bothShafted' && acting && !cut && leaderAfter ? (
        <p className="standoff__heir" aria-hidden="true">
          {leaderAfter === youUid ? 'You win it' : `${nameOf(leaderAfter)} wins it`}
        </p>
      ) : null}

      {stage === 'revealed' && words && settled ? (
        <div className="stack standoff__stage">
          <p className="standoff__headline">{words.headline}</p>
          {words.note ? <p className="muted hint">{words.note}</p> : null}
          <Standings players={room.players} scores={room.scores} deltas={room.lastDeltas} youUid={youUid} />
          {isQuizmaster ? (
            <div className="btn-row">
              <button type="button" className="btn btn--primary" onClick={onNext}>
                Final results
              </button>
            </div>
          ) : (
            <p className="muted">Waiting for the quizmaster…</p>
          )}
        </div>
      ) : null}
    </>
  );
}
