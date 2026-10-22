# The What's new page

> **Owner: Greg Rothwell. Last updated: 22 October 2026. Budget: 250 lines.**

**Status: LIVE 22 October 2026** (#107, merge `9bab66d`, gh-pages `08594c7`, live `Updates-xf0SqJkg.js` byte-identical to a local build).
Asked for 21 Oct ("note down an updates page so users can see"); Greg said build it 22 Oct.

## Story

> As a player, I want to see what changed in the quiz since I last played, so a
> new round, a new rule or a new button is not a surprise mid-question.

## Acceptance criteria

1. The landing page has a **What's new** button beside **Season table**. — `Landing.tsx`
2. It opens a page listing each release, newest first, dated, in plain words. — `Updates.tsx`, `lib/updates.ts`
3. The button carries a dot until this browser has opened the newest entry; a
   private window that cannot store shows it every visit. — `hasUnseen`, `updates.test.ts`
4. No Firebase reads: the list is bundled, and the page is its own lazy chunk.
5. Nothing blind and nothing internal: blind packs get a name and a count only;
   no player names, costs or behind-the-scenes work. The repo and site are public.
6. Readable at 375px with no sideways scroll.

## Decisions taken without Greg (22 Oct), change any of them

| Open question (21 Oct log) | Taken | Why |
|---|---|---|
| Where the link sits | Landing only | Every player passes it, link or no link. The lobby is a live room; leaving it to read hides the room |
| Hand-written or from PR titles | Hand-written | PR titles are written for the repo, not the office |
| How far back | 21 Oct | The four releases that day are the ones nobody has been told about |
| Shown to the room by the quizmaster | No | Needs a shared state and a write; a link does the job for now |
| `public/updates.json` or bundled | Bundled (`src/lib/updates.ts`) | Cannot fail to load, and is typed and tested |

## Process

**Every PR that changes what players see adds its entry, and CI enforces it**
(22 Oct, [`lead-time.md`](lead-time.md)). Written as a rule, it was missed the
same day: #110 went live without its lines, and #114 added them. A PR touching
`src/` or `public/` without `src/lib/updates.ts` fails verify unless a line in
its description or a commit message starts `What's new: none — <why>`. Behind-the-scenes releases (scripts, docs,
traces) add nothing. Wording for call it: a right call beats any tap, a wrong one
scores nothing — **there is no call bonus** ([`typed-answers.md`](typed-answers.md)).

## Evidence, 22 Oct

- `npm run typecheck`, `eslint src`, `npm test` 1,707 passed (5 new).
- Dev server, desktop: dot present with storage cleared; opening the page wrote
  `vibequiz.updatesSeen = 2026-10-22`; back on the landing, the dot was gone.
  Screen readers hear "What's new (new)" while it shows.
- 375px: `scrollWidth` 375 = `innerWidth`.
- Gallery: last entry, `#/preview/<last>`, so no existing index moved.

**Not covered:** at 375px the Back button sits close under the sound control.
Season uses the same header markup; not checked whether it does the same there.
