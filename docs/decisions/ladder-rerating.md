# Re-rating the Ladder's thin buckets

> **Owner: Greg Rothwell. Last updated: 23 October 2026. Budget: 250 lines.**

**Status: plan only. Nothing here is built. Greg decides.**

The Ladder still fills a spent `easy` or `hard` bucket from whichever level has
the most left. As of 23 October it says so on the question
([`repeats.md`](repeats.md)). That does not make the round climb. A fold of
`games/` cannot, either: it only rates questions already played, and those do
not come back ([`beat-the-chaser.md`](beat-the-chaser.md)). This is the
decision that was left open.

## What is actually thin

Counted from `public/packs/index.json` on 23 October 2026: **16,367** questions,
**1,886** easy, **12,987** medium, **1,494** hard.

The ~10,000 figure is the unrated half, not a fresh count. Open Trivia DB
shipped about 4,000 questions with a real rating. OpenTriviaQA has none, and
the harvest marks those `medium` (`classify.ts`). `source` is stripped before a
pack is sealed, so the sealed files cannot say which mediums are real and
which are the default. Any re-rate has to join through the harvest, not the
published JSON.

The labels that do exist mean something in this office. On 22 October, over 65
rounds: easy **77%** right, medium **64%**, hard **50%**. Within a band the
spread is wide (standard deviation 34 points), so a band is an average, not a
prediction for one question.

A fifteen-question Ladder wants five easy, five medium and five hard. Against
that, Sport has **15** hard, Sleeves **14** easy, Catchphrase **8** easy,
Classical and Fine Art **no** hard at all. General Knowledge is 159 / 1,282 /
59. The text packs go flat because the unrated half sits in medium. The show
rounds go flat when that end of the set is actually small.

## Option A — one-off difficulty grade, checked against the office

An offline script grades each unrated question easy, medium or hard. One pass,
text only, prompt plus the four options and the answer (difficulty is not
visible from the prompt alone). The answer stays in the script. Nothing is
written to a pack, the vault, or the client until the check below passes.

**Check, before any pack changes.** Hold out Open Trivia DB questions this
office has already played: they have a real label and a hit rate. The model's
three bands on that hold-out must stay ordered the way the office is — easy
above medium above hard, the same direction as 77 / 64 / 50. Overlap, or a
band that inverts, and the grades are not written. Group rates only. A single
question will not match, and the 34-point spread says that is expected.

**Cost.** One batch, not a feature that keeps calling out. About 10,000 short
text items. Price it when the model is chosen; the shape is one invoice, not a
subscription. No Firebase writes, no rules change, no re-seed: difficulty lives
on the pack, and the ids do not change. Publishing the new labels is a normal
pack PR after that.

**Risks.**

- Grading the Open Trivia DB half as well would throw away the only labels
  that already track the office. Unrated questions only.
- A model that calls "obscure" hard will not match an office that knows it.
  That is what the hold-out is for. If it fails, stop.
- Hand-built packs (Sleeves, Catchphrase, Classical, Fine Art, the picture
  rounds) are not this pile. Their labels were assigned on purpose. Leaving
  them out is the point.
- After a good grade, Sport may still have few questions that are actually
  hard. The notice stays for that case. Re-rating does not invent questions.
- The sealed pack must not gain an answer, a `source`, or a question id.
  `seal.test.ts` already fails a pack that contains an answer.

## Option B — let a played question return after a gap

`buildRamp` refuses a repeat of the wanted difficulty while another level
still has fresh questions. That was measured and not built ([`repeats.md`](repeats.md)):
hard buckets of 15 to 59, nearly spent, would have repeated a hard question
every round.

A gap softens that rather than removing it. Sport's 15 hard questions cover
about three Ladders of fifteen. A gap of one round brings a hard question back
on the fourth sitting. A gap of a season leaves the Ladder flat until the
season rolls, which does not help the next Friday. The engineering is small.
The cost is the complaint the rule was written to stop.

## Option C — top up the thin buckets

Write or harvest more questions at the thin end, then seal and `seed-vault`
the new ids. This is the right tool when the bucket is genuinely small:
Classical and Fine Art have no hard questions to reveal by re-labelling, and
Catchphrase's eight easy ones will not become fifty by staring at them.

It does not use the questions already sitting in medium. It is the expensive
option: someone produces the questions, and every new id has to be seeded
before it can score. Worth doing for a show round whose rated end is still
thin after Option A, not before.

## Recommendation

**Option A, as a dry run Greg sees before any pack changes.** It is the only
option that can make a text pack's Ladder climb without serving last week's
question again. The hold-out against the office hit rate is the gate, not a
nice-to-have: if the bands do not order, the grades stay on disk.

Do not do Option B. The measurement that killed it still holds; a gap only
chooses how soon the repeat returns.

Do Option C afterwards, and only for a bucket that is still thin once the
unrated half has real labels. Classical and Fine Art are that case already —
they have no hard questions — and the notice is the honest line until someone
writes some.

The notice shipped on 23 October stays in every version. A bucket that is
actually empty should still say so.

## What Greg is deciding

1. Approve the dry run: unrated questions only, no pack write, no vault, no
   deploy, and the grades are binned until the hold-out orders easy above
   medium above hard.
2. Leave played questions where they are (Option B off).
3. Leave topping-up until after that check, except if he wants hard questions
   written for Classical or Fine Art anyway — re-rating will not create those.
