# Quiz

Real-time office quiz. Static site on GitHub Pages; Firebase (Firestore, Realtime Database, anonymous auth) for live rooms. Question packs ship **without answers** — those live in a Firestore vault no client can read.

The long record is [`docs/HANDOVER.md`](docs/HANDOVER.md). Read it before changing rules, scoring, the answer window, presence, or the vault.

## Stack

React 18, TypeScript, Vite, Vitest. Firebase client SDK. Deploy is `gh-pages` from `dist/`.

## Commands

| Command | What it is |
|---|---|
| `npm run dev` | Vite at `/quiz/`, port 5273 |
| `npm test` | Vitest, offline. Must keep running without the network |
| `npm run typecheck` / `lint` / `build` | |
| `npm run check-rules` | Live project: both rulesets, **both directions** |
| `npm run sync-harness [n]` | *n* concurrent clients against live Firebase |
| `npm run host-room -- [secs]` | Drive a round from the terminal |
| `npm run seed-vault` | Admin SDK; needs `GOOGLE_APPLICATION_CREDENTIALS` under `.secrets/` |
| `npm run deploy` | `build` then `gh-pages` |

`scripts/` that touch the live project stay out of `npm test` on purpose.

## Layout

```
src/engine/      Pure TS game rules — no React, no Firebase
src/lib/         Firebase wiring, clock, sound, identity
src/screens/     One component per phase
src/questions/   Pack types and classification
src/design/      One stylesheet (`global.css`)
scripts/         Harvest and live harnesses
public/packs/    Sealed questions — `options`, never `correct`
firestore.rules  / firestore.seed.rules / database.rules.json
```

## Conventions

- No `any`, no `@ts-ignore`, no `@ts-expect-error`.
- Quizmaster is derived (`resolveQuizmaster`), never stored.
- Answers live in a subcollection. `elapsedMs` is measured on the answering device, not a wall-clock timestamp.
- A phase transition never writes the `players` map. Membership changes are `players.{uid}` only.
- Published packs are sealed. Nothing under `src/` except `types.ts` may name `correct`.

## What bites

1. **Rules are published by hand.** The repo copy is not what Firebase is running. An unpublished Realtime Database ruleset, or `firestore.seed.rules` left live, is the usual "nothing works" failure. `npm run check-rules` is the check — it must refuse as well as allow.
2. **Never add `localhost` to the reCAPTCHA allowlist.** The site key is public. Local and Node use a debug token. App Check is enforced on Firestore; auth itself is not.
3. **Do not undo derived-quizmaster or the no-whole-`players`-map rule** without reading the handover table. Both were bugs that already shipped.

## Verify

`npm run typecheck && npm run lint && npm test`. For rules or presence: `npm run check-rules`, then `npm run sync-harness 10`.
