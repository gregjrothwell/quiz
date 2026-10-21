import { explainTrace, type Q1TraceDoc } from '../src/engine/q1Trace';

/**
 * One line per question-one trace, for `read-traces`. Pure, so `npm test`
 * covers it; the script only fetches and prints. See src/engine/q1Trace.ts for
 * what each field means and docs/decisions/cass-q1.md for why it exists.
 */

function seconds(ms: number | undefined): string {
  return ms === undefined ? '    —' : `${(ms / 1000).toFixed(1).padStart(4)}s`;
}

function outcome(trace: Q1TraceDoc): string {
  if (trace.refused) return `refused ${trace.refused}`;
  if (trace.dropped) return `dropped (${trace.dropped})`;
  if (trace.writes === 0) return 'no tap';
  if (trace.ackMs === undefined) return 'never acked';
  if (trace.counted === undefined) return 'reveal unseen';
  return trace.counted ? 'counted' : 'NOT COUNTED';
}

export function formatTrace(trace: Q1TraceDoc, name: string, when: string): string {
  const { seenLagMs, reading } = explainTrace(trace);
  const lag = seenLagMs === null ? '    —' : seconds(seenLagMs);
  const fresh = trace.priorSamples === 0 ? 'fresh tab' : `${trace.priorSamples} samples`;
  return [
    `${when}  ${trace.roomCode.padEnd(4)}  ${name.slice(0, 12).padEnd(12)}`,
    `${trace.device.padEnd(7)} ${(trace.network ?? '—').padEnd(4)}`,
    `seen late ${lag}`,
    `write ${seconds(trace.ackMs)}`,
    `tap ${seconds(trace.tapElapsedMs)} of ${trace.durationMs / 1000}s`,
    `visible ${seconds(trace.visibleForMs)}`,
    `${fresh}, clock back ${seconds(trace.correctionMs)}`,
    `${outcome(trace).padEnd(13)}`,
    `→ ${reading}`,
  ].join('  ');
}
