# Verified, unverified, and known limits

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

Moved verbatim out of `docs/HANDOVER.md` on 20 August 2026, when that file reached
2,422 lines. The text is unchanged; only where it lives is.

## Verified vs not

**Verified against the live Firebase:** anonymous sign-in, room creation, pack
selection, round start, question render, answer write, reveal and scoring, and
leaving a room. Engine covered by 140 tests including six full three-question
games (quizmaster disconnect, skip, reset, ties). 272 across the repo, the
balance being the question pipeline, the clock's arithmetic, the review, the
honours and the recovery code.

> The count in this file had been stale at 192 for several commits before the
> review landed; the suite was already at 208. Read it as "roughly this many"
> and trust `npm test`.

**Verified in the browser, on fixtures only:** every screen at 1280px and 390px,
the level picker disabling a level its pack can't fill, and no horizontal scroll
at the narrow width. Added 14 August: the remembered name prefilled with **Start
a new room** live on arrival and an empty box on a first visit; both podium
fixtures with the chair; the desk pinned at every scroll position on a
fifteen-question, ten-player round; and the chair's label at its worst case — 24
characters with no space in them — measured against the podium row height to
confirm it cannot push the risers around.

**A round has now been played on all of it, solo, on 15 August 2026.** It found
one real fault — the titles starting the round on a timer, [now
fixed](form-and-awards.md#the-quizmaster-starts-the-round-and-nothing-else-does) — and nothing
else. What a solo round could not cover, and what to watch on the next one with
other people in it:

- **The titles on more than one device.** Everybody should now leave the card at
  the same moment, because they all leave on the same room update rather than on
  their own timers. Never watched.
- **A recovery code actually moving a record between two browsers**, and the
  merge folding the old row in. `check-rules` proves the rules permit it from a
  genuinely second client; nobody has done it through the UI.
- **Honours appearing on the season table.** They are banked from the game log,
  which is now persisted, but a rosette has never travelled from a final screen
  to a row.
- **The review panel with a real room in it.** Both its highlights need at least
  two people who answered, so a solo round can never show either.
- ~~**Two people in different teams on the board.**~~ One real record did carry
  one — `Awesome team`, from the free-text era — and it was cleared by hand on
  19 August when squads became a fixed list. Still nobody has played a round
  with two *different* squads in the room.

**Not verified in a real room:** everything from 14 August. The name persists
across a reload on one browser, but has not been watched surviving a week, and
the iOS Safari eviction window above applies to it. Nobody has yet lost a round
badly enough to sit in the chair in anger.

**Verified with real concurrent clients** — this was the long-standing gap:

- `npm run sync-harness [n]` brings up *n* independent anonymous clients against
  the live project and reports how fast each sees a phase change and whether
  anyone was dropped. Ten players see a round start within ~85 ms, none dropped.
  `LEGACY_WRITE=1` restores the whole-document write so the players-clobber bug
  can be watched happening rather than taken on trust.
- `npm run host-room` hosts a room from the terminal so the browser can be
  watched as an ordinary player while somebody else runs the game. **It had
  never run until 20 August 2026** — it died on an import — so this section
  claimed it as verification for months while it was doing nothing. It works
  now; see [the note](season.md#npm-run-host-room-was-broken-for-weeks--fixed-20-august-2026).

**Not verified — start here:**

0. **Changing an answer, against a live room.** The engine and the UI are
   covered — three reducer tests, and the preview shows the unpicked lecterns
   staying live — but a second write landing on `answers/{uid}` in Firestore has
   not been watched. The rules permit it and always did, so the risk is not
   permission but the write racing the reveal. `npm run host-room -- 20` gives a
   window long enough to answer, change and watch which one scores — and that
   harness runs again as of 20 August 2026.

   > **Correction, 20 August 2026.** That last sentence was false when written and
   > stayed false for the rest of the day: `host-room` built its state with
   > `answers: {}` hard-coded and folded every reveal with nothing to score, so
   > "watch which one scores" was never possible — it scored nobody, always. The
   > harness now reads the subcollection through the same `liveAnswers` filter the
   > app uses, and prints what the reveal awarded. The claim is true from now on;
   > it was not before, and this is the second time a doc has named this harness as
   > verification while it was doing nothing.
   > → [`shared-clock.md`](shared-clock.md#the-harness-could-not-show-it-and-now-can)

0. ~~**Fix `host-room`.**~~ **Done, 20 August 2026** — see [the
   note](season.md#npm-run-host-room-was-broken-for-weeks--fixed-20-august-2026). Its own
   reveal path ran for the first time in the same session: `>>> ASKING the
   vault` to `>>> WRITING reveal` in 225 ms, which is the terminal harness
   asking the vault and being answered.

   What it *unblocks* is still outstanding, and is now reachable: a quizmaster
   dropping out mid-round, and the keyboard shortcuts in a live game. Both need
   a browser alongside `npm run host-room -- 10`.

**Verified — the vault, end to end.** The rules were written from documented
semantics and, at the time of writing, nothing had executed. It has now: seeded
against the live project and confirmed by `npm run check-rules`. Seven
of its checks pin one assumption each, so a future failure names which one
broke rather than just "the vault doesn't work":

| Check | Assumption it pins |
|---|---|
| read the vault → denied | `allow read: if false` is published |
| write the vault → denied | `firestore.seed.rules` is *not* still published |
| list the vault → denied | no `list` on the collection |
| reveal while the clock runs → denied | the gate exists |
| backdate `openedAt` → denied | `openedAt == request.time` is enforced |
| ask about another question → denied | the reveal is pinned to the question in play |
| shorten the window mid-question → denied | `timingOk()` pins `durationSecs` too |
| open a question on a one-second window → denied | the 5–120s bound is published |
| reveal after the clock → **allowed** | the gate actually opens, and the vault is seeded |

That last one is the one that ruins a quiz night rather than merely leaking
one, which is why it waits out a real gate instead of being assumed. It runs on
the five-second floor, which also makes it the check that fails if the published
rules are still using a fixed twenty.

0. ~~**The season table against live Firestore.**~~ **Done, 19 August 2026.**
   `recordGame` ran against the real project in a full ten-question round, and
   reloading the final screen afterwards left `played: 1` in both the season and
   the week bucket — so the repeat-write guard is now watched rather than
   reasoned about, per bucket. See [squads, weeks and the average
   board](season.md#squads-weeks-and-the-average-board).

1. ~~**Whether the clock sounds right.**~~ **Done** — heard on 14 August 2026
   and it works, including the bed-to-gong balance that had been set by eye
   rather than by ear. What one pair of ears cannot cover is several laptops
   phasing against each other, or fifteen questions of it in a row; both are
   noted under [the clock](clock.md#the-clock).
2. **Quizmaster handover with real clients.** The reaper and the join race are now
   covered by `sync-harness`, but a quizmaster actually dropping out mid-round and
   the role passing to somebody else has still only been tested in the engine.
3. **Keyboard shortcuts in a live round.** A–D/1–4 to answer, Space to reveal or
   advance. Compiles and the legend renders; keys never pressed in a real game.
4. **A ramped round in play.** `selectQuestions` is unit-tested, but nobody has
   watched a fifteen-question ladder actually climb in a live room.
5. **Reachability from the work network.** `github.io` is confirmed fine.
   `firestore.googleapis.com` and `*.firebasedatabase.app` are the same stack
   `rgblife/estimation-room` uses successfully there, but that's inference, not a test.

---

## The UI, measured — 28 August 2026

Against the **built** output at 375px and 320px, not eyeballed. The design holds
up on a phone; these are defects in it rather than a case for redesigning it.

**Open, and both are Greg's call.** Two colour tokens fail WCAG AA on every
surface they are used on:

| Token | `--night` | `--panel` | `--panel-hi` | Needs |
|---|---|---|---|---|
| `--ink-dim` `#5d7794`, 25 uses | 4.38 | 3.79 | **3.27** | 4.5 |
| `--cyan-dim` `#0e7ea3`, 11 uses | 4.38 | 3.79 | **3.27** | 4.5 |
| `--ink-soft` `#9fb8cf`, 14 uses | 9.89 | 8.55 | 7.38 | passes |

It is specifically the dim pair, and `--ink-dim` is what carries the hint text —
"shown on the leaderboard", "4-character code" — read once, under pressure, on a
phone. `#708fb2` and `#1197c4` are the minimum values that clear 4.5 on the
worst surface. Also open: the sound toggle at 36px and the squad filter chips at
30, both above WCAG 2.2's 24px floor and below the 44 Apple and Google ask for.

**Fixed the same day:** the verdict pills were 80×24, the smallest targets in
the app — see [`question-votes.md`](question-votes.md).

**Checked and cleared, so nobody re-reports them:**

- **No horizontal overflow** at either width. The 132 elements extending past the
  edge are the light beams and the chair's label overhang, both deliberate and
  capped ([`gotchas.md`](gotchas.md)).
- **Reduced motion** is properly handled — a blanket rule plus targeted ones.
- **Keyboard focus is fine.** Nearly filed as missing: programmatic `.focus()`
  reports `outline: none`, which looks like a stripped focus style. A real Tab
  press gives `:focus-visible` and the UA ring. Press the key.

## Known limits

Moved to [`known-limits.md`](known-limits.md) on 28 August 2026, when this file
went over its 250-line budget. That is the other half of the same question — what
has been checked, and what is known not to work — and it had grown its own size.

## Still not fixed

`submitAnswer` stamps `questionIndex` from this device's snapshot. A client whose
listener has stalled writes an answer against the question it can still see, and
it is filtered out everywhere. Much harder to reach than the above — `phase` and
`index` travel in the same snapshot, so a stalled client is usually showing the
scoreboard and cannot answer at all. Left alone deliberately: it is now
*visible* rather than silent, which was the actual problem, and the fix would be
a retry path on a write that must not be retried carelessly.

---
