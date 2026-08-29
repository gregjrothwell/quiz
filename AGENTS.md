# Quiz

Real-time office quiz. Static site on GitHub Pages; Firebase (Firestore, Realtime Database, anonymous auth) for live rooms. Question packs ship **without answers** — those live in a Firestore vault no client can read.

[`docs/HANDOVER.md`](docs/HANDOVER.md) is the way in — live state plus a table saying which file
answers which question. Depth is one file per subsystem in [`docs/decisions/`](docs/decisions/);
[`docs/TOTAL-RECALL.md`](docs/TOTAL-RECALL.md) is the dated spine. Follow the table before changing
rules, scoring, the answer window, presence, or the vault — do not read the lot.

## Stack

React 18, TypeScript, Vite, Vitest. Firebase client SDK. Deploy is `gh-pages` from `dist/`.

## Commands

| Command | What it is |
|---|---|
| `npm run dev` | Vite at `/quiz/`, port 5273 |
| `npm test` | Vitest, offline. Must keep running without the network |
| `npm run typecheck` / `lint` / `build` | |
| `npm run check-rules` | Live project: both rulesets, **both directions** |
| `npm run appcheck-probe` | What App Check actually enforces, from an unattested client |
| `npm run reveal-probe` | When the vault's reveal gate actually opens, against the two clocks a client could anchor to |
| `npm run sync-harness [n]` | *n* concurrent clients against live Firebase |
| `npm run host-room -- [secs]` | Drive a round from the terminal |
| `npm run seed-vault` | Admin SDK; needs `GOOGLE_APPLICATION_CREDENTIALS` under `.secrets/` |
| `npm run fold-votes [-- --go]` | What the office voted out. Dry run by default; `--go` writes the blocklist |
| `npm run deploy` | `build` then `gh-pages` |

`scripts/` that touch the live project stay out of `npm test` on purpose.

## Layout

```
src/engine/      Pure TS game rules — no React, no Firebase
src/lib/         Firebase wiring, clock, sound, identity
src/screens/     One component per phase
src/questions/   Pack types, the seal test, and the retirement blocklist.
                 Classification is build-time, so it lives in scripts/
src/design/      One stylesheet (`global.css`)
scripts/         Harvest, classification and live harnesses. Never imports src/firebase.ts
public/packs/    Sealed questions — `options`, never `correct`
firestore.rules  / firestore.seed.rules / database.rules.json

docs/HANDOVER.md      Live state and the index. 150-line budget
docs/TOTAL-RECALL.md  Dated decisions and gotchas. 300-line budget
docs/decisions/       One subsystem each. 250-line budget
docs/recall/          Archived spine entries, by month. Verbatim, no budget
```

## Conventions

- No `any`, no `@ts-ignore`, no `@ts-expect-error`.
- Quizmaster is derived (`resolveQuizmaster`), never stored.
- Answers live in a subcollection. `elapsedMs` is measured on the answering device, not a wall-clock timestamp.
- A phase transition never writes the `players` map. Membership changes are `players.{uid}` only.
- **Published packs are sealed: no file in `public/packs/` may contain an answer.**
  They are static files on GitHub Pages, so anything in one is readable by
  anybody with the URL. `src/questions/seal.test.ts` enforces it in both
  directions. (`correctIndex` under `src/` is fine and expected — it is the
  runtime field that exists only once the vault has resolved an answer.)

## What bites

1. **Nothing in `scripts/` may reach `src/firebase.ts`.** It reads
   `import.meta.env`, which Vite defines and Node does not, so importing it at
   any depth kills a script before its own code runs. `host-room` was dead that
   way for weeks. `scripts/imports.test.ts` walks the graph and fails if it
   comes back.
2. **Rules are published by hand.** The repo copy is not what Firebase is running. An unpublished Realtime Database ruleset, or `firestore.seed.rules` left live, is the usual "nothing works" failure. `npm run check-rules` is the check — it must refuse as well as allow.
3. **Never add `localhost` to the reCAPTCHA allowlist.** The site key is public. Local and Node use a debug token. App Check is enforced on **Firestore, the RTDB and auth** — `appcheck-probe` is refused at sign-in.
4. **Do not undo derived-quizmaster or the no-whole-`players`-map rule** without reading the handover table. Both were bugs that already shipped.

## Verify

`npm run typecheck && npm run lint && npm test`. For rules or presence: `npm run check-rules`, then `npm run sync-harness 10`.
