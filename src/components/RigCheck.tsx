import { useEffect, useState } from 'react';
import { realtimeDb } from '../firebase';
import { RIG_CUES, RIG_PASS_CUES, RIG_PASS_SHARE, RIG_TOLERANCE_MS, type RigReport, type RigRun } from '../engine/rigProbe';
import { followRig, startRig, watchRig } from '../lib/rigDevice';

/**
 * The rig check, in the lobby (docs/decisions/rig-in-your-hand.md, part 1).
 *
 * Every device in the room follows the host's runs and fades the whole screen
 * to amber on each cue — slowly, two seconds apart, nowhere near a flash. The
 * host's device also shows what the paint times say. A measurement, not a
 * feature: nothing here touches the round.
 */
export function RigCheck({ code, uid, isHost }: { code: string; uid: string; isHost: boolean }) {
  const [lit, setLit] = useState(false);
  const [cue, setCue] = useState<number | null>(null);
  const [run, setRun] = useState<RigRun | null>(null);
  const [report, setReport] = useState<RigReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      followRig(realtimeDb(), code, uid, {
        onCue: (index, on) => {
          setCue(index);
          setLit(on);
          if (index === RIG_CUES - 1) window.setTimeout(() => setCue(null), 2_000);
        },
        // Two frames: the first is when the style is applied, the second when
        // it has been painted.
        afterPaint: (then) => requestAnimationFrame(() => requestAnimationFrame(then)),
        onError: (cause) => setError(cause instanceof Error ? cause.message : String(cause)),
      }),
    [code, uid],
  );

  useEffect(() => {
    if (!run) return;
    return watchRig(realtimeDb(), code, run, setReport);
  }, [code, run]);

  const start = (): void => {
    setError(null);
    setReport(null);
    startRig(realtimeDb(), code, uid).then(setRun, (cause: unknown) =>
      setError(cause instanceof Error ? cause.message : String(cause)),
    );
  };

  return (
    <>
      <i className={lit ? 'rig-wash rig-wash--on' : 'rig-wash'} aria-hidden="true" />
      {isHost || cue !== null ? (
        <section className="panel stack rig-check">
          <p className="eyebrow">Rig check</p>
          {cue !== null ? (
            <p aria-live="polite">Hold your phone up — cue {cue + 1} of {RIG_CUES}</p>
          ) : (
            <p className="muted hint">
              Ten slow amber fades, two seconds apart, on every phone in the room. It measures how
              closely they change together, before we build the lights.
            </p>
          )}
          {isHost ? (
            <button type="button" className="btn btn--ghost" disabled={cue !== null} onClick={start}>
              Run the rig check
            </button>
          ) : null}
          {isHost && report ? (
            <p className="muted" aria-live="polite">
              {report.devices} {report.devices === 1 ? 'phone' : 'phones'} · {report.cuesPassed} of {RIG_CUES} cues
              had {Math.round(RIG_PASS_SHARE * 100)}% within ±{RIG_TOLERANCE_MS} ms · worst spread{' '}
              {Math.round(Math.max(0, ...report.cues.map((entry) => entry.spreadMs)))} ms ·{' '}
              {report.pass ? 'passes' : `needs ${RIG_PASS_CUES} to pass`}
            </p>
          ) : null}
          {error ? <p className="notice">{error}</p> : null}
        </section>
      ) : null}
    </>
  );
}
