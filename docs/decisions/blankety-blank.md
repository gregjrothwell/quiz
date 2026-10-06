# Blankety Blank — fill the blank

> **Owner: Greg Rothwell. Last updated: 6 October 2026. Budget: 250 lines.**

Greg's idea, parked 5 October 2026 as #1 in [`parked-ideas.md`](parked-ideas.md), picked up
6 October once #66 and #67 were live. **Version chosen by Greg, 6 October: a four-option pack
through the existing vault** — not the show's own rule, where you score by matching the room.
That one changes the reveal and scoring, and is recorded below as a later idea, not built.

**Greg plays it blind** (6 October), as he does Catchphrase: no phrase, answer or brand from
the pack appears in this file, in chat or in a commit message. Slugs are numbers
(`blank-014`), never the phrase. The examples below are deliberately **not** in the pack.
The puzzles live in `scripts/hand-blanks-data.ts` only.

## Why this shape

- **No engine change, no rules paste.** `firestore.rules` and `database.rules.json` name no
  pack ids (`grep` for `flags|sleeves|catchphrase` over both: nothing), so a new pack is
  data plus one entry in `PACK_IDS`. Friday 9 October's 30-seat game is untouched by it.
- **Four options, not typed answers.** Catchphrase settled this on 2 October from
  `read-games`: the office picks rounds it can get, and the rank race does the deciding
  ([`catchphrase.md`](catchphrase.md#why-this-round)).
- **Wiktionary is the source, and it checks both directions.** Every phrase is a Wiktionary
  entry title, so the right answer is a page that exists. Every wrong option, put back in the
  phrase, must be a page that **does not** exist — which is what catches a distractor that is
  really a known variant ("shepherd's" against "sailor's"). Probed 6 October: *every cloud has
  a silver lining* exists, *… silver spoon* is `missing`.

## Story

**As** an office player, **I want** a round where I complete a well-known saying, ad slogan or
TV catchphrase from four options, **so that** there is a quick, everyone-can-play round that
is not trivia recall.

Scope widened by Greg on 6 October from sayings alone to all three kinds. Slogans and
catchphrases carry a clue (the brand, the character or the show) unless the phrase already
names it, and the clue never contains the answer.

### Acceptance criteria

1. **A pack called Blankety Blank** appears in the lobby picker, with at least **60
   questions** and at least **15 at each of easy, medium and hard**, so every level fills a
   default round.
2. **Each question is a saying with one word blanked** as `_____`, and four options. The
   blanked word occurs exactly once in the saying, as a whole word, so the blank is
   unambiguous.
3. **Every phrase has a source that says it** (`npm run blanks-check`, live, kept out of
   `npm test`). A saying is an exact Wiktionary entry title; a slogan or catchphrase appears
   verbatim (case and punctuation aside) in the text of a named Wikipedia article. The date
   and result are recorded here.
4. **No wrong option is a real variant** (the same check). Put in the blank, a saying's
   distractor must not be a Wiktionary entry, and a slogan's or catchphrase's must not appear
   in its source article. A distractor that is a real variant is a second right answer.
5. **Sealed.** `public/packs/blanks.json` holds no answer; `seal.test.ts` passes over it
   unchanged.
6. **No overlap with Catchphrase.** No Blankety Blank saying contains a Catchphrase answer,
   or the reverse, so neither round gives the other away. The test reports a count, never
   the phrase, because Greg plays Catchphrase blind.
7. **Slugs cannot collide** with any other hand pack (the `am` bug: one vault id, two
   answers). All slugs carry a `blank-` prefix and the existing cross-pack test includes them.
8. **Seeded before it ships.** `npm run seed-vault -- --pack blanks` writes every answer and
   reads them back, before the deploy. An unseeded pack stalls at the first reveal.
9. **Played end to end** before it is called done: `host-room --pack blanks` (taught the
   pack here; it knew only sleeves and catchphrase) reaches a reveal that marks the right
   option.

### Not in v1

- **Match the room** — the show's actual rule. The modal pick is derivable on every client
  (they already hold every answer document), but the reveal and the scoring both change.
