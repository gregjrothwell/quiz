# Parked ideas — new rounds, in Greg's order

> **Owner: Greg Rothwell. Last updated: 9 October 2026. Budget: 250 lines.**

Ideas Greg has named and parked, newest last. **None is researched or approved.** Pick them up
in this order, and only once the work in flight is live. Moved here verbatim from
[`ideas-review.md`](ideas-review.md), which had reached its 250-line budget.

### 1. A Blankety Blank round — **parked, 5 October 2026; built 6 October**

**Picked up 6 October** once #66 and #67 were live: a four-option pack of sayings, slogans
and catchphrases, played blind. [`blankety-blank.md`](blankety-blank.md). The text below is
as parked.


Greg's idea: a round on the show's fill-in-the-blank. **Pick up only once the current
work is live** (Bonus Catchphrase, Mr Fries, the harder batch, Sleeves 168). Nothing
researched yet; the first question is whether it fits four options or wants typed answers.

### 2. The Price Is Right, then and now — **parked, 5 October 2026, after 1; built 6 October**

**Built 6 October** as *The Price Was Right*, blind: [`price-was-right.md`](price-was-right.md). The text below is as parked.


Greg's twist: compare an item's price today with what it cost ten years ago. Prices need a
dated source per item, never a guess, because a wrong price is a wrong answer.

### 3. A random round — **parked, 6 October 2026**

Greg's idea: one round that deals questions from **different round types** — a picture, a
tune, a Catchphrase, a price — instead of one pack. Nothing researched. The first question is
structural: a room has **one `packId`**, and per-pack behaviour is keyed on it (the
Catchphrase hold and bonus, `packNeedsSound`, the sleeve song, `ordered` options are the
exception — that one is per question). A mixed round needs the pack per question.


### 4. Name the artist — **parked, 9 October 2026**

Greg's idea: play a clip and ask **who the artist is**, not the song. Should be much easier than
Name that Tune, and it removes that round's hardest constraint: **a clip that sings its own
title no longer matters**, so `tunes-title-gate` and `tune-audit`'s cut-offs don't apply.
Nothing researched or built. Probably reuses the Tunes clip pipeline and `previewUrl`; the
open questions are the wrong options (other artists of the same era and genre, or it's too
easy) and whether it is a new pack or a per-question mode on `tunes`.
