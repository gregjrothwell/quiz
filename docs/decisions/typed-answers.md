# Typed answers — investigation

> **Owner: Greg Rothwell. Last updated: 21 October 2026. Budget: 250 lines.**

**Status: LIVE 21 October 2026** (#104, gh-pages `860e6a5`). Was: built, not live. Greg decided the same day — see
[Decided](#decided-21-october-2026). He asked on
21 October for typed answers on Catchphrase "and other appropriate rounds". This
was turned down twice before: on 2 October ([`catchphrase.md`](catchphrase.md),
when he picked the hold) and on 5 October
([`catchphrase-difficulty.md`](catchphrase-difficulty.md), option 6). This page
re-opens it with measurements. **Catchphrase, Blankety Blank and The Price Was
Right are blind, so everything below about them is numbers only.**

## The finding that changes the cost

The 2 October reason was that typed answers *"would need a new vault shape and
a rule paste"*. That holds only if the typed text is checked against the vault.
**It does not hold if the typed text is matched against the question's own four
options, on the answering device:**

- The options already ship in every pack (`public/packs/*.json`). Matching
  against them reveals nothing a player could not already read.
- The device turns what was typed into an `optionIndex`, exactly as a tap does
  today. The vault, the reveal (`resolveAnswer`), scoring and the game record
  never see the difference.
- **"No match" is an index past the options.** The answer rule already allows
  `optionIndex` 0–9 (`firestore.rules`, answers block), and a pack has four
  options. So a typed answer that matches nothing is simply wrong, with **no
  rules change**. (Rules have come from CI since W2 in any case. There is no
  paste any more.)

**What it costs:** the right answer has to be one of the four, written close to
how the option spells it. A right answer phrased differently is marked wrong,
and the person who typed it will dispute it. Matching (below) handles case,
punctuation, "the" and typos. It cannot handle a genuinely different phrasing.

**One trap found:** `awards.ts:98` gives the *wrong answer nobody else picked*
rosette by comparing indexes. Every no-match shares one index, so two people
typing different wrong things would block each other, and one person alone
would earn it. That code has to skip the no-match index. Nothing else indexes
`options` by `optionIndex` (grep, 21 Oct).

## What the data says

**Verified 21 Oct 2026.** Admin SDK, read-only, over all 63 rounds in `games/`.

| Pack | Rounds | Hit rate | Questions everyone got right | Median answer |
|---|---|---|---|---|
| Catchphrase | 8 | **86%** | **51%** | 8.6 s (includes the hold) |
| On the box (`screens`) | 8 | **86%** | 47% | 2.6 s |
| Name that Tune (`tunes`) | 8 | 77% | 38% | 3.8 s |
| Blankety Blank | 2 | 73% | 27% | 3.7 s |
| Sleeves | 6 | 48% | 18% | 4.7 s |
| Flags | 1 | 46% | 7% | 3.3 s |
| Name the Artist | 0 | — | — | never played |

- **Catchphrase is close to given away by its options, hold included.** It has
  an 86% hit rate, and on half the questions every answerer was right.
- The hold was supposed to separate knowing from matching. Of the 339 right
  answers to ordinary (non-bonus) Catchphrase puzzles, **5%** landed within 1 s
  of the options appearing, 69% at 1–3 s and 25% after 3 s. Reading four
  options takes a second or two even for somebody who knows, so **the timing
  cannot tell knowing from matching**. Typing it can, because there is nothing
  to match.
- **The other side, in Greg's own record** ([`catchphrase.md`](catchphrase.md)):
  the office keeps choosing rounds it can get. The three highest hit rates
  above (Catchphrase, On the box, Name that Tune) are three of the four most-played
  packs. That fits the claim but does not prove it, since it could equally be
  the pictures and music people like. Typed-only would cut hit rates.
  How far is **not measured**, and it is the one number that decides this.

### Which rounds can be typed

Option text, normalised (lowercase, no accents or punctuation, no "the/a/an").
**Verified 21 Oct 2026** from `public/packs/`:

| Pack | Questions | Median length | Longest 10% | Two options within 2 typos |
|---|---|---|---|---|
| Catchphrase | 233 | 13 chars, 3 words | 21+ | 2% |
| On the box | 445 | 11, 2 words | 19+ | 1% |
| Name that Tune | 424 | 12, 2 words | 20+ | 0% |
| Name the Artist | 259 | 10, 2 words | 14+ | 1% |
| Sleeves | 212 | 11, 2 words | 21+ | 3% |
| Flags | 76 | 7, 1 word | 11+ | 5% |
| Blankety Blank | 148 | 5, 1 word | 8+ | **18%** |
| Harvested trivia (`general-knowledge`) | 1,500 | 10, 2 words | 23+ | 14% |
| The Price Was Right, `tags` | — | prices/codes | — | 100% |

- **Fit:** Catchphrase, On the box, Name that Tune, Name the Artist, Sleeves,
  Flags. These are short names with one well-known spelling, and their options
  are rarely close enough for a typo to land on the wrong one.
- **Fit, but exact only:** Blankety Blank. It is one word, which is ideal to
  type, but its wrong options are close variants *by design*
  ([`blankety-blank.md`](blankety-blank.md)). So no typo tolerance there.
- **No:** harvested trivia, whose options were written as distractors (dates,
  numbers, several parts) and not as things anyone would type. The Price Was
  Right is a different game when typed: nearest-without-going-over, which is
  the show's own mechanic, and a feature of its own if wanted. Same for `tags`.

## Two shapes

**A. A typed round.** This is a lobby choice, offered only for the packs that
fit. No options are shown, you type, and the window is longer, because the
median Catchphrase answer is already 8.6 s of a 10–15 s clock. It is the real
thing, and it is the hardest. It needs no rules change.

**B. Call it, Catchphrase only.** The picture already plays alone for half the
clock (`optionsHold.ts`). Put a text box in that half. A typed answer that
lands **before the options appear** is a *call*: it is final, it beats every
tap in the rank race, and a wrong call loses the question. Everyone else still
gets the options at half time, so the round stays one the office can get. This
also needs **no new field and no rules change**: "landed before the options"
is `elapsedMs < optionsAtMs`, which every device can already compute. The only
open choice is whether a call earns a bonus on top of the rank race.

**Recommendation: B, Catchphrase only, then decide A from its first office
round.** It keeps the floor the office plays for and adds a ceiling for
knowing. It reuses the hold that already exists, and it fits one PR with no
rules or vault change. Its first round answers the open question: `read-games`
can count calls, right calls and wrong calls. That tells us whether a typed-only
round would be welcome before anybody builds one.

## Matching, proposed

On submit, on the answering device:

1. Normalise both sides: case, accents, punctuation, `&` → `and`, leading
   "the/a/an", spacing.
2. If it equals exactly one option, take it.
3. Otherwise, allow up to one edit per five letters (at most two) against
   exactly one option, and only if that option is strictly closer than the
   runner-up. **Blankety Blank: exact only.**
4. Otherwise, no match. No partial credit: typing one word of a three-word
   phrase is half a guess, and accepting it rewards guessing.

All of it is a pure engine function, so the tests can reach it. Fixtures use
made-up options, never a blind pack's.

## Risks

- **Disputes.** A right answer phrased another way is marked wrong. Lowering
  that risk means keeping what was typed, so a no-match can be checked
  afterwards. That is a new answer field (`typed`, bounded) and a rules change.
  It is not needed for B. Greg's call.
- **Phones.** The on-screen keyboard covers about 40% of a phone, over a
  picture round. It is measurable in the gallery at 375px before any office
  round. How many of the office play on phones is **not measured**.
- **Typing speed decides the rank race** between people who know. Under B, a
  slow typist can still wait and tap.
- **Bonus Catchphrase** (every fifth question) has no hold, because its options
  show from the first frame (Greg, 6 Oct). Under B it stays as it is.

## Open

| Decision | Owner |
|---|---|
| B (call it, Catchphrase) first, A (typed round) first, or neither | Greg — **B**, 21 Oct |
| Under B: rank race only, or a call bonus on top | Greg — **rank race only**, 21 Oct |
| Keep what was typed (rules change) or only the matched index | Greg — **index only**, 21 Oct |

## Decided, 21 October 2026

**B. Catchphrase only. Rank race only. The typed text is not kept.**

A text box sits in the existing hold. Submitting before the options appear
writes `optionIndex` from `matchTypedAnswer` and `elapsedMs` from the device
clock. That is a call: this client will not replace it, a wrong one (including
no match) scores nothing, and the earlier `elapsedMs` beats every tap in the
rank race that already exists. There is no call bonus. Bonus Catchphrase has
no hold, so no box. Everyone else still gets the options at half time.

No match is index **4**. Every question in `public/packs/` has four options
(counted 21 Oct, numbers only), and the answer rules already allow 0–9. Nothing
new is stored, so there is no rules or vault change. The reducer still refuses
an index past the lecterns; live answers are written by `useRoom`, not the
reducer.

`contrarian` skips index 4 and above, so a no-match cannot earn "boldly wrong".

Not in a `release-<date>` branch. Finals history is a separate change in
flight, and the two ship together only when Greg folds them. Merging deploys.

**The phone, measured in `#/preview` at 375px.** The box sits under the prompt.
On a 667px-tall screen it ends above a keyboard covering the bottom 40%, and
that keyboard then covers the picture, which is fully on screen until the
keyboard opens. On 812px the top of the picture stays clear of the same
keyboard. The sticky desk does not cover the picture at either height.
