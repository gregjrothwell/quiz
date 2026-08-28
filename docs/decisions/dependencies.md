# Dependencies

> **Owner: Greg Rothwell. Last updated: 28 August 2026. Budget: 250 lines.**

What is held back, and why. Every major below was **installed and measured**, not
read off a changelog — the verdicts are results, not predictions. Re-measure
before trusting a number; the reasoning outlives the version.

## The in-range pass, 28 August 2026

Six had drifted inside their existing `^` ranges. Lockfile only; `package.json`
was untouched.

| | from | to |
|---|---|---|
| `@types/node` | 26.2.0 | 26.4.0 |
| `@vitejs/plugin-react` | 6.0.5 | 6.1.1 |
| `eslint` | 10.8.1 | 10.9.1 |
| `firebase-admin` | 14.2.0 | 14.3.0 |
| `typescript-eslint` | 8.67.0 | 8.68.0 |
| `vite` | 8.2.1 | 8.2.2 |
| `vitest` | 4.1.10 | 4.1.11 |

**The evidence that mattered was the bundle, not the test count.** Every emitted
hash came back identical to the pre-update build — `index-VtHlbLAd`,
`firebase-Cns3pSRr`, `motion-DjvErkuy`, `index-Bp5L2KZu` — and `index-VtHlbLAd`
is what production is serving. All six were build-time or dev tooling; nothing
reaching a player changed a byte. `firebase-admin` moved, so `check-rules` (47
PASS, both directions) and `take-stock` were run against the live project too.

## The majors, measured

### `globals` 15 → 17 — **taken**

Free. It feeds the two `languageOptions` blocks in `eslint.config.js` and
nothing else, so its blast radius is lint. Clean, and the bundle did not move.

### `typescript` 5.9 → 7 — **blocked, and not on our code**

**Our source is already TS 7 clean**: `tsc --noEmit` passes, 513 tests pass, and
`vite build` emits byte-identical chunks under 7.0.2.

What stops it is the linter. `typescript-eslint` **refuses to load**:

```
typescript-eslint does not support TS 7.0.
```

Its tracking issue is
[typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940),
and support is aimed at **TS >= 7.1**. Losing lint fails the project's own bar —
typecheck *and* lint *and* tests — so this waits. When typescript-eslint ships,
this is a one-line bump with the work already proven done.

### `firebase` 11 → 12 — **deferred, and this one has a price**

Passes typecheck, lint, 513 tests and build. The objection is size, and it is
not small. Measured by splitting the chunk per package (a throwaway
`manualChunks` change, reverted):

| chunk | 11.10.0 | 12.18.0 | delta (gzip) |
|---|---|---|---|
| `app-check` | 13.12 kB / 4.79 | 13.98 kB / 5.16 | +0.37 kB |
| `app` | 36.08 kB / 12.50 | 32.27 kB / 10.94 | −1.56 kB |
| `database` | 127.67 kB / 37.83 | 127.49 kB / 37.78 | ~0 |
| **umbrella `firebase`** | **311.76 kB / 95.03** | **515.28 kB / 151.94** | **+56.91 kB** |

**+57 kB gzipped on the chunk every player downloads**, all of it inside the
umbrella package where Firestore and Auth live after bundling — presence and
App Check are flat. Against that: nothing in v12 is needed here, and v11 has no
advisory. So the trade is 57 kB for nothing, on a static site served to office
phones, and the answer is no *for now*.

**Defer, not never.** Take it when there is a reason — a feature that needs it,
or v11 leaving support — and re-measure that table on the day rather than
trusting this one.

### `react` 18 → 19 (with `@types/react` 19) — **clean, but unprovable here**

Passes typecheck, lint and 513 tests with `motion` 11 still installed. The app
chunk grows 230.55 → 279.57 kB, **+14 kB gzipped**.

**The test suite cannot vouch for this and it is important to say so.**
`vite.config.ts` sets `environment: 'node'` and includes `src/**/*.test.ts` —
`.ts`, not `.tsx`. **No component is ever rendered by `npm test`.** A green
suite under React 19 is evidence about the engine, which is pure TypeScript and
was never going to break.

So it was checked the only way available: the built output served on `:5274`,
driven to `#/preview`, which renders **every** screen in one page. All ~30
sections came up — lobby, QR, the three question states, reveal, standings with
the live squad board, the final card, awards, season, cold open, week, recovery,
review — 178 headings, 8,399 characters, every chunk `200`, **zero console
errors**.

That is a real check and still not the one that counts. React 19 changes
rendering behaviour, and a static gallery exercises no live Firestore
subscription, no answer window and no phase transition. **This should ride along
with a real round rather than ship on its own**, and there is one of those
wanted anyway.

### `motion` 11 → 13 — **clean, same caveat**

Typecheck, lint, 513 tests and build all clean **on React 18**, so it is not
coupled to the React bump. Chunk grows 119.71 → 132.26 kB, **+3.6 kB gzipped**.
The gallery rendered identically — same 178 sections, same 8,399 characters,
no console errors. Same limitation as above: nothing here animates under real
state changes, which is the whole job.

## What this pass did not cover

- **No component or browser test exists in `npm test`**, and that is the reason
  two of these five cannot be signed off from the terminal. It is the gap
  underneath the React and motion verdicts, not a detail of them.
- **The gallery is static.** It proves the components mount and paint. It proves
  nothing about subscriptions, timing or the answer window.
- `npm audit` was clean throughout — production tree and full tree, before and
  after — so none of the above is security-driven.
