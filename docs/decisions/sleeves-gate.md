# When the cover is the answer key

**Owner: Greg Rothwell. Last updated: 21 September 2026. Budget: 250 lines.**

Sleeves asks you to name an album from its cover. Most album covers have the
album's name written on them. That was never checked, and the round played on
**21 September 2026** is what it cost.

## The measurement

`53FN`, 21 September 09:23, four seats, fifteen questions. Eleven of the fifteen
had the title printed on the picture.

| | n | mean hit |
|---|---|---|
| Title printed on the cover | 11 | 89% |
| Everything else | 4 | 75% |

The tell is not the averages, it is the **hard** questions:

| Hit | Cover | Album |
|---|---|---|
| 100% | prints the title | Channel Orange |
| 100% | prints the title | Illmatic |
| 100% | prints the title | Dummy |
| 100% | prints the title | The Bends |
| **50%** | **wordless** | **Vespertine** |

All four "hard" questions with a printed title were answered by everybody. The
one hard question with a wordless cover halved. The difficulty rating was
decorative, because the picture was the answer key.

## It is an edition problem, not a taste problem

The specs name an album; iTunes GB returns whatever **edition** it holds, and
reissues print titles on artwork the original never carried.

Pink Floyd's *The Wall* is a bare brick wall. The mzstatic art for it reads
`PINK FLOYD THE WALL`. Nothing in `write-sleeves-pack.ts` had ever looked at a
pixel.

Which is also why curating harder would not have fixed it. You cannot pick a
wordless cover by knowing the album; you have to look at the file that comes
back.

## The shape of the fix

Same split as the tunes round, and for the same reason — the part worth testing
must run offline:

| | Tunes | Sleeves |
|---|---|---|
| Gets the evidence | `tune-title-audit.ts` (whisper) | `sleeve-audit.ts` (Vision) |
| Decides what it means | `title-in-clip.ts` | `title-on-cover.ts` |
| Needs a Mac + network | yes | yes |
| In `npm test` | no | no |

One difference, deliberate. The tune audit prints numbers for a person to paste;
the sleeve audit **writes a file the builder enforces**. A clip that gives
itself away can be trimmed; a cover that does can only be dropped, and a
judgement made once should not need making again.

### The verdicts are checked in

`sleeve-cover-text.ts` holds what Vision read off each cover. Generated, never
hand-edited.

A build that had to OCR fifty images would need a Mac, a network and 4.8MB of
downloads to produce a file that changes about as often as the album list does.
Checking it in makes the gate deterministic, reviewable in a diff, enforceable
by an offline test — and it puts the reason a sleeve was dropped next to the
drop.

### Two rules, asking different questions

**`titleOnCover` — does the cover say the answer?** Shape-fuzzy, not phonetic.
Vision misreads by shape where whisper misheard by sound, so `phonetic()` from
`title-in-clip.ts` is wrong here: it flattens vowels because a singer bends
them. What Vision actually returned:

| Read | Is |
|---|---|
| `nevernino` | Nevermind |
| `eack to black` | Back to Black |
| `rink floyp he wall` | Pink Floyd, The Wall |
| `ill matic` | Illmatic |
| `stadtum arcadtum` | Stadium Arcadium |

An edit-distance ratio on the plain letters takes all of those. It also matches
a **part** of a title anywhere on the cover, which is what catches the ones a
whole-phrase compare cannot: Sgt. Pepper's on a drum skin read as `lonely
hearts`, London Calling as a sticker and the word `calling`, Appetite for
Destruction as `guns roses destruction`.

**The busy rule — is the cover saying anything at all?** After the artist's name
is struck out, how many letters are left. This is not a backstop for the first
rule, it is a different question, and it is what catches Kendrick's *good kid,
m.A.A.d city* (`jo00 k d aao city ag orteilte 3y vemorio lartar`) and Prince's
*Purple Rain* (`pustetain phucstane the fevolation`) — both print their title,
both are mangled past any matcher, and both are plainly covered in writing. A
round that asks what a picture is has no use for a picture that is talking,
whatever it turns out to be saying.

Measured over 143 covers, the distribution is not a gradient but two clumps:
**31 have nothing left at all**, a handful carry a garbled fragment of up to
seven letters, and everything above that has real words on it. The allowance
sits at eight, in the gap.

The artist's name is struck out **loosely** (0.6), because `davlorowie` is David
Bowie and `wrafhouse` is Winehouse. Striking tightly leaves the misreading
behind to be counted as something the cover says, and fails a good sleeve for
the band being on it.

## What it cost, and what that means

| | Before | After |
|---|---|---|
| Candidate albums | 53 | 159 |
| Resolved | 52 | 143 |
| Refused | 0 | 103 |
| **Published** | **52** | **40** |
| *Actually playable* | *19* | *40* |

**`SLEEVES_MIN_PACK` came down from 45 to 36.** That is an honest bar, not a
loosened one: the old 52 met the old bar by publishing 33 that gave the answer
away. 40 is two full rounds of fifteen with six spare, against 19 that worked.

The way this goes back up is a longer candidate list, not a looser matcher. The
106 albums added were not chosen for having wordless covers — nobody here can
see what iTunes will return — so the ones the gate refused stay in the file as a
record of what was tried.

## While in there: a wrong picture, not a giveaway

`resolveAlbum` trusted a hand-typed `collectionId` absolutely, with **no title
check at all**.

`californication` carried `947680622`, which is Red Hot Chili Peppers' *The
Studio Album Collection 1991-2011*. The question showed a box set's artwork and
asked which album it was, with *Stadium Arcadium* sitting in the options. It
scored **25%** in `53FN`, the worst of the fifteen, and it was not hard — it was
wrong. The pack built green the whole time.

`titleMatches` already existed and already gets this right. It now runs on the
id path too.

## What keeps it fixed

- `sleeve-gate.test.ts` — offline, over the published file. That every published
  cover passes, that every refused one is absent, that an **unaudited** cover is
  refused rather than trusted, and that the eleven slugs which broke `53FN` are
  named and gone. **Proved both ways**: faking a giveaway for `abbey-road` turns
  it red naming `abbey-road` and `00285753f289`.
- `title-on-cover.test.ts` — the rule itself. Every string in it is one Vision
  actually returned.

## Known limits

- **Vision under-reads stylised type, so a clean verdict is the weaker one.** It
  returned `lonely hearts` for a drum skin a person reads in full, and nothing
  at all for the `1989` printed on that sleeve's corner. Every threshold leans
  towards rejecting for this reason: the machine sees less than the player does,
  never more.
- **15 albums will not resolve at all** — Master of Puppets, Dookie, Blood Sugar
  Sex Magik and twelve others. The GB store's album search returns tributes and
  soundtracks instead, and searching the artist does not list them either. They
  need `collectionId`s found by hand in the store. The audit names them every
  run.
- **The difficulty ratings are now wrong, systematically.** They were set when
  the cover named the album, which is why so many were `easy`; the pack is now
  4 easy, 21 medium, 15 hard. Naming an album from a wordless cover is a harder
  game than the one those ratings describe. Re-rating is a judgement for Greg or
  for played data, not for this pass.
- **Ed Sheeran's symbol albums cannot be gated by title** — `÷` has no letters
  to match, so `titleOnCover` returns nothing for them. The busy rule is what
  protects those, and the symbol *is* the artwork, so that is the right answer.
