# The Round

A real-time quiz for playing with colleagues over Teams. One **quizmaster** creates
a room and drives the round; everyone else joins as **quizzers** on their phones
and answers against the clock. Fastest correct answer takes the most points.

Built to replace Polly. Static site on GitHub Pages, Firebase for the live room.

---

## What you need to do before it runs

The app needs a Firebase project. That's an action on your own Google account, so
it isn't something I can create for you.

### 1. Create the Firebase project

At [console.firebase.google.com](https://console.firebase.google.com), create a
project, then enable three things:

| Service | Where | Notes |
|---|---|---|
| **Firestore** | Build → Firestore Database → Create | Start in **production mode**; the rules in this repo replace the defaults |
| **Realtime Database** | Build → Realtime Database → Create | Pick a **europe-west1** instance. Used only for presence |
| **Anonymous auth** | Build → Authentication → Sign-in method → Anonymous → Enable | Gives every player a stable id with no sign-up |

Realtime Database is needed alongside Firestore because Firestore has no
`onDisconnect`, so it cannot tell you when someone closes their laptop.

### 2. Fill in the environment

```bash
cp .env.example .env.local
```

Then paste the values from **Project settings → General → Your apps → SDK setup
and configuration**, plus the Realtime Database URL from its console page.

These values are public by design — they identify the project, they don't
authorise anything. Access control lives in the rules files below.

### 3. Publish the security rules

Both rule sets are in this repo and both matter. Without them Firestore's
production defaults deny everything and no room will open.

- `firestore.rules` → paste into Firestore → Rules → Publish
- `database.rules.json` → paste into Realtime Database → Rules → Publish

---

## Running it

```bash
npm install
npm run dev
```

The app is served under `/quiz/`, so the local URL is
**http://localhost:5273/quiz/**.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Engine tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Typecheck then production build |
| `npm run fetch-questions` | Re-harvest question packs (~10 min, throttled) |
| `npm run fetch-questions -- --resort` | Re-sort the cached pool without re-fetching |

### Seeing the design without a Firebase project

`#/preview` renders every screen with fixed data, and `#/preview/4` renders one on
its own. Useful for reviewing the look, or checking a layout on a phone, without
needing a room and four other people.

---

## Deploying to GitHub Pages

The site is configured for `https://gregjrothwell.github.io/quiz/`.

```bash
npm run deploy
```

That builds and pushes `dist/` to a `gh-pages` branch. Then set **Settings →
Pages → Source** to the `gh-pages` branch.

> **A GitHub Actions workflow won't push with your current token.** Its scopes are
> `gist, read:org, repo` — no `workflow` — so committing anything under
> `.github/workflows/` is rejected. Either run `gh auth refresh -s workflow`
> first, or stick with the branch deploy above, which needs no workflow file.

---

## Questions

Questions come from the [Open Trivia Database](https://opentdb.com) (CC BY-SA
4.0) and are **committed to this repo as JSON**, not fetched at runtime. That
means no third-party domain to reach mid-quiz, no rate limit, and no API key in
the bundle.

`scripts/fetch-questions.ts` harvests the verified pool, then filters it:

- drops structurally broken questions — duplicate options, unresolved HTML
  entities, "all of the above" options that break answer shuffling, and questions
  whose answer decays over time
- drops questions specific to the United States
- tags questions with British reference points into a separate `uk-leaning` pack

Current packs:

| Pack | Questions | Easy / Medium / Hard |
|---|---|---|
| Video Games | 999 | 308 / 482 / 209 |
| Odds & Ends | 640 | 184 / 288 / 168 |
| Music | 399 | 106 / 219 / 74 |
| Science | 399 | 119 / 171 / 109 |
| TV & Film | 397 | 140 / 189 / 68 |
| General Knowledge | 345 | 161 / 124 / 60 |
| History | 340 | 75 / 173 / 92 |
| Geography | 299 | 85 / 141 / 73 |
| Best of British | 201 | 54 / 103 / 44 |
| Sport | 125 | 39 / 62 / 24 |

The quizmaster picks a level as well as a pack, so those columns matter: a level
a pack cannot fill is disabled in the lobby rather than quietly serving a shorter
round. "The Ladder" builds from easy to hard across the round and uses all three.

**On the British pack:** the open datasets are roughly 4:1 US-marked to
UK-marked, so a keyword filter can only surface what is actually there — it can't
manufacture British questions. 201 is enough for ten rounds without
repeats. If it wears thin,
[OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA) is ~45k questions under
the same licence and would slot into the same pipeline; it needs cp1252
transcoding, which is the only reason it isn't already in.

Derived packs are redistributed under **CC BY-SA 4.0** — see
`public/packs/ATTRIBUTION.md`.

---

## How it fits together

```
src/engine/     Pure TypeScript game rules. No React, no Firebase, fully tested.
src/lib/        Firebase wiring, question loading, the question clock.
src/screens/    One component per phase.
src/design/     Tokens and the stylesheet.
scripts/        Build-time question harvest.
```

A few decisions worth knowing about, because they look odd until you know why:

**The quizmaster is derived, never stored.** It's whoever has been in the room
longest. Storing it would mean every disconnect needs a reassignment *write*, and
several clients noticing the same departure would race each other. Deriving it
means a dropped quizmaster hands over instantly and silently.

**Answers record elapsed time, not a timestamp.** Each device measures how long
*it* took to answer. Comparing one laptop's clock against another's would fold
clock skew straight into the speed scores, and office laptops disagree about the
time by more than the speed bonus is worth.

**Answers live in a subcollection.** If they were on the room document, every
answer would push an update to every player. One listener per client on the room
document, updated only on phase transitions, keeps a game around 800 reads
against a 50,000/day free tier.

**Entrance animations are CSS, not JS.** They're the only thing standing between
content and `opacity: 0`, and a delayed JS animation that fails to start — as
happens under React StrictMode's double mount — leaves the screen blank. This bit
us during development; CSS `animation-fill-mode: both` cannot fail the same way.

---

## Known limits

- **Any room member can write scores.** The rules require a signed-in member, but
  can't restrict phase and score writes to the quizmaster without storing the
  quizmaster's id — which would reintroduce the disconnect race above. Fine among
  colleagues; not fine for strangers.
- **Bundle is ~242 kB gzipped**, nearly all Firebase, plus 67 kB of self-hosted
  fonts. Fine on an office network; code-splitting would be the fix if it ever
  matters.
- **Season standings follow the browser, not the person.** Anonymous auth gives
  every browser a durable id with no sign-up, which is the appeal and the
  limitation: cleared site data, a private window or a second device all start a
  fresh record. iOS Safari evicts site storage after roughly a week without a
  visit, so a phone player who misses a fortnight comes back as a stranger.
- **Season numbers are self-reported.** The rules stop you writing someone
  else's row, but not your own.
