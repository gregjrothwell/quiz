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
| `npm run e2e` / `emulators` | Playwright vs `dist/` + local Auth/Firestore/RTDB. Never a debug token |
| `npm run check-rules` | Live project: both rulesets, **both directions** |
| `npm run appcheck-probe` | What App Check actually enforces, from an unattested client |
| `npm run reveal-probe` | When the vault's reveal gate actually opens, against the two clocks a client could anchor to |
| `npm run tune-audit` | Where each tunes clip sings its own title, and the `previewSeconds` that cuts it off. Needs `whisper` |
| `npm run sync-harness [n]` | *n* concurrent clients against live Firebase |
| `npm run host-room -- [secs]` | Drive a round from the terminal |
| `npm run rank-harness [-- --browser]` | Seven answerers in one live question — the whole rank ladder, proved |
| `npm run seed-vault` | Admin SDK; needs `GOOGLE_APPLICATION_CREDENTIALS` under `.secrets/` |
| `npm run fold-votes [-- --go]` | What the office voted out. Dry run by default; `--go` writes the blocklist. `cannon -- off\|on <shot> [--go]` is the Slop Cannon's kill switch, same shape |
| `npm run backfill-finals [-- --go]` | Finals tallies onto season-2, from `games/`, by uid. Dry run by default |
| `npm run backfill-rivals [-- --go]` | Who you've beaten and lost to, onto season-2, from `games/`. Dry run by default |
| `npm run read-games` / `audit-players` / `read-errors` / `read-cannon` | Kept rounds, per-player timings, errors players saw, Slop Cannon Keep/Bin. Admin SDK; the client cannot |
| `npm run read-traces [-- --name cass]` | What each device saw of question one: seen late, or wrote slowly ([`cass-q1.md`](docs/decisions/cass-q1.md)) |
| `npm run read-owed [-- --last 40]` | The owed live checks in one print: The Double, Theme Tunes by level, Higher or Lower % right, Cass's question one, whether Geekend's asked doc exists. Admin SDK |
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

- **Questions are for a British office.** American things famous worldwide are fine; anything that needs American knowledge is not — US sport, politics, and brands, slogans or shows nobody here would know. No pack leans American overall. Hand-built packs as much as harvested (`classify.ts` filters only the harvest): Blankety Blank leaned American on 6 Oct 2026 because this was never written down. Greg's rule, 6 Oct 2026.
- No `any`, no `@ts-ignore`, no `@ts-expect-error`.
- Quizmaster is derived (`resolveQuizmaster`), never stored.
- Answers live in a subcollection. `elapsedMs` is measured on the answering device, not a wall-clock timestamp.
- A phase transition never writes the `players` map. Membership changes are `players.{uid}` only.
- **Published packs are sealed: no file in `public/packs/` may contain an answer** — anyone with the URL can read them. `src/questions/seal.test.ts` enforces it both ways. (`correctIndex` under `src/` is fine: the runtime field, set once the vault resolves.)
- **Whatever goes live together ships as one PR.** Two or more feature branches: merge each into a `release-<date>` branch with its own merge commit (so one can be reverted alone), then one PR, one deploy, one live check — as #72 did. On 12 Oct 2026, #58 and #73 were merged 33s apart: two CI runs and two deploys for one release. **One feature goes live from its own PR, with no release branch** — on 22 Oct a one-PR release re-ran CI that had already passed ([`lead-time.md`](docs/decisions/lead-time.md)). An urgent fix still ships alone. Greg's rule, 12 Oct 2026; the one-feature exception, 22 Oct 2026. **A PR players will notice carries its What's new line** (`src/lib/updates.ts`); CI fails it otherwise, and `What's new: none — <why>` waives it. **A PR names its Jira ticket** (`PROJ-<n>` in title, branch, description or a commit; `Ticket: none — <why>` waives it, CI fails it otherwise). Comment on the ticket when you open the PR; whoever takes it live moves it to Done with the live hash (Greg, 28 Oct 2026).

## What bites

1. **Nothing in `scripts/` may reach `src/firebase.ts`.** It reads
   `import.meta.env`, which Vite defines and Node does not, so importing it at
   any depth kills a script before its own code runs. `host-room` was dead that
   way for weeks. `scripts/imports.test.ts` walks the graph and fails if it
   comes back.
2. **Rules are published by CI**, on `master` after e2e, before the site (W2, [`rules-from-ci.md`](docs/decisions/rules-from-ci.md)). Do not paste `firestore.rules` or `database.rules.json` into the console: the next merge overwrites it. `firestore.seed.rules` is still pasted by hand, and left live it is the usual "nothing works" failure. After a rules merge, `npm run check-rules` locally — it must refuse as well as allow.
3. **Never add `localhost` to the reCAPTCHA allowlist.** The site key is public. Local and Node use a debug token. App Check is enforced on **Firestore, the RTDB and auth** — `appcheck-probe` is refused at sign-in.
4. **Do not undo derived-quizmaster or the no-whole-`players`-map rule** without reading the handover table. Both were bugs that already shipped.

## Verify

`npm run typecheck && npm run lint && npm test`. For rules or presence: `npm run check-rules`, then `npm run sync-harness 10`.
