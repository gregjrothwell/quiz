# The question pipeline

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

Moved verbatim out of `docs/HANDOVER.md` on 20 August 2026, when that file reached
2,422 lines. The text is unchanged; only where it lives is.

## Question pipeline

14,176 questions from two sources, both CC BY-SA 4.0 and **committed as JSON** —
no runtime API, no key in the bundle, no rate limit:

- [Open Trivia DB](https://opentdb.com) — 3,996 questions, each with a
  difficulty rating
- [OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA) — ~39,000 usable
  questions, no difficulty rating, capped into the packs

Packs: General Knowledge / Geography / History / Odds & Ends / Music / Science /
TV & Film / Best of British 1,500 each, Video Games 1,400, Sport 776 — counted
from `public/packs/` on 13 August 2026, after the US-nickname filter fix in
`eafcfce` gave Sport its 20 back.

The pools are cached at `.cache/pool.json` and `.cache/opentriviaqa.json`, both
gitignored. **Tuning the classification rules costs a re-sort, not a re-fetch:**

```bash
npm run fetch-questions -- --resort
```

A full OpenTDB re-harvest is ~25 minutes (one request per 5s, and the page-size
ladder costs a few extra requests per category). The second source is a separate
command because it is twenty seconds rather than twenty-five minutes:

```bash
npm run fetch-otqa
```

`--resort` never touches the network, so it uses whatever is already cached; if
`.cache/opentriviaqa.json` is missing it says so and rebuilds from OpenTDB alone.

---

## The second question source

**Shipped.** Sport was 125 questions — a fifteen-question round is 12% of the
pack, so by the second month of a weekly quiz it is visibly repeating. Every
thin pack is now several times deeper.

| Pack | Was | Now |
|---|---|---|
| Sport | 125 | **776** |
| Best of British | 201 | 1,500 |
| Geography | 299 | 1,500 |
| History | 340 | 1,500 |
| General Knowledge | 345 | 1,500 |
| TV & Film | 397 | 1,500 |
| Music / Science | 399 | 1,500 |
| Odds & Ends | 640 | 1,500 |
| Video Games | 999 | 1,400 |

> ### `seed-vault` costs a full-vault read every time you run it
>
> The diff that makes it additive — "412 added, 0 changed, 3947 already correct"
> — is computed by reading every answer already up there. At 13,500 answers that
> is **13,500 reads a run**, against a free tier of 50,000 a day.
>
> Four runs on 11 August 2026 exhausted the day's reads and took the game down
> until the quota reset: two seeding, and two more confirming the seed had
> landed. Confirming is the expensive habit to break — the run that writes
> nothing costs exactly as much as the run that writes everything.
>
> Seed once, read the count it prints, and believe it. If something really does
> need checking, there are two cheap ways and neither is this script:
> [an aggregate count](vault.md#checking-the-vault-without-paying-for-it) answers "is it
> seeded?" for about 24 reads, and `npm run check-rules` proves the vault *path*
> works for about 24 operations.

> ### Seed the vault before you deploy, not after
>
> This is the opposite order from [the answer window](answer-window.md#publish-the-rules-first-then-deploy),
> and getting it wrong is the failure that ruins a quiz night rather than merely
> leaking one.
>
> New packs against the old vault means every imported question reaches its
> first reveal and stops dead on "the vault would not confirm an answer" — the
> rules cannot confirm an answer they have never been told. The reverse costs
> nothing: a vault holding answers to questions no pack serves yet is inert.
>
> ```bash
> npm run seed-vault && npm run deploy
> ```
>
> The seed is additive and works out for itself what is new, so re-running it is
> free. 13,431 answers against a free tier of 20,000 writes a day — which is
> most of why the packs are capped where they are.

### Why the packs are capped at 1,500

`loadPackQuestions` downloads the **whole pack** to pick fifteen questions, so a
pack is a download at the top of every round on the quizmaster's device. The
full import would put 10,000 questions and about 2 MB into Odds & Ends alone.
The cap holds every pack near 380 kB, against the 237 kB Video Games already
shipped, and keeps the vault seedable inside one day's free-tier writes.

`capPack` keeps the **rated** questions when it trims. Only the OpenTDB half
carries a difficulty, so trimming those first would thin the only questions the
easy and hard levels can draw on, to make room for questions neither level will
ever serve. Within a source it orders by id — a hash of the prompt, so
arbitrary but stable; a selection that reshuffled on every harvest would orphan
vault entries for nothing.

### The difficulty rating that is not there

**Imported questions are all marked `medium`, and that is an admission, not a
design.** OpenTriviaQA carries no difficulty, and three ways of inferring one
were measured against a hand-labelled sample of 120 questions. None beat the
baseline of labelling everything hard:

| Approach | Agreement | Baseline |
|---|---|---|
| Surface features — prompt length, years, numeric answers | no signal (21–28% band) | 22% |
| Word-frequency obscurity of the answer | 56% | 53% |
| Correcting OpenTDB's systematic offset | 53% | 53% |

The same exercise measured something worth keeping: **OpenTDB's own labels agree
with a UK-office judgement only 39% of the time**, and it under-rates by about
0.4 of a step. Its "easy" means easy *within that category's fandom* — the pool
contains "Which game did Sonic first appear in? → Rad Mobile" and "the metric
prefix atto- → one quintillionth", both rated easy. The gap is worst exactly
where you would expect: anime +0.71 steps, video games +0.68, general knowledge
+0.33, science 0.00.

What this costs, by level — and it is much less than it sounds, because
**`mixed` is the default**:

| Level | Effect |
|---|---|
| `mixed` (default) | Fully fixed — draws on everything |
| `medium` | Fully fixed |
| `ramp` | Mostly; its easy and hard slots still come from the rated pool |
| `easy` / `hard` | **Unchanged.** A hard Sport round still draws on 15 questions |

Two things would actually work, if this ever matters enough: hand-rating a
capped set, or a build-time LLM pass validated against a hand-labelled gold set.
Both were costed; neither is queued.

### Four things that will bite

- **Team names go in the list with their city, not on their own.** Nearly every
  American franchise nickname is also an ordinary English word, and the filter
  reads the distractors too, so a bare entry takes out a wide swathe of
  perfectly good questions. `vikings` cost us Lindisfarne and the Danelaw,
  `raiders` cost us Raiders of the Lost Ark, `pirates` the Disneyland ride,
  `cubs` the answer to what a baby shark is called, and `mariners` the Ancient
  Mariner — about 370 questions between them, none about American sport. The
  packs are cap-bound so none of this showed up as a size change; it silently
  swapped good questions for arbitrary ones. Only genuinely unambiguous
  nicknames — `yankees`, `dodgers`, `lakers`, `knicks`, `celtics`, `49ers` —
  belong in the list bare.
- **`toPattern` appends `s?`, and that is load-bearing.** Every term list in
  `classify.ts` is matched with a word boundary at each end, so `\bsuper bowl\b`
  misses "Super Bowls" and `\bteam\b` misses "teams". Questions are asked in the
  plural at least as often as the singular, so without it an intact-looking list
  quietly catches half of what it names. American football got through the sport
  filter twice before this was spotted.
- **`TextDecoder('windows-1252')` is not cp1252 in Node.** Every label —
  `windows-1252`, `cp1252`, `x-cp1252` — decodes as Latin-1, mapping 0x80–0x9F
  to C1 control characters rather than to punctuation. That range is exactly
  where cp1252 keeps curly quotes, dashes and ellipses, which a trivia corpus is
  full of. `decodeCp1252` does the 32-entry mapping by hand. The failure is
  silent: the string is valid, just full of invisible control characters.
- **The encoding is per file, not per corpus.** Twelve of the twenty-two files
  are cp1252 and ten are UTF-8. Decoding everything as cp1252 — which the old
  version of this note assumed — turns every accented character in the other ten
  into "RenÃ©e", which is also silent. Strict UTF-8 first, cp1252 on the throw.
- **Sport is the one pack filtered *positively*.** It has to name a sport with a
  following in Britain or it is dropped. The source's `sports` file is
  overwhelmingly American and stripping it by exclusion was a losing game: three
  passes of adding leagues, franchises and positional vocabulary each caught more
  and each left a long tail. Inverting it is shorter, stricter, and costs volume
  the pool can afford. It is the same shape as `uk-leaning`, which has always
  been a positive filter.

---
