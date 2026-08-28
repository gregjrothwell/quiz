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

## Known limits

- **Any room member can write scores, and anyone holding the code can become a
  member.** Deliberate — see the quizmaster row above. Fine among colleagues, not
  fine for strangers. The room code is the only thing standing between a room and
  the internet, which is why `list` is no longer granted.
- **Cheating now takes a script rather than a console.** The answers left the
  packs and the room document — see [the vault](vault.md#turning-the-vault-on) for what
  that does and does not buy. `elapsedMs` is still self-reported, so a
  fast-but-wrong answer is honest and a slow-but-claimed-instant one is not.
- **~262 kB gzipped across two chunks** — 114 kB of app and 148 kB of Firebase —
  plus 67 kB of fonts. **The split is about the deploy, not the download.** As
  one file, every deploy changed the bundle's hash, so a returning player
  re-fetched all of it including the Firebase half that had not changed, and saw
  nothing at all until it landed because `index.html` is a 0.7 kB shell. That was
  the delay after each deploy, and only after each deploy — every visit
  afterwards was cached. Split, an ordinary change leaves the Firebase chunk's
  hash alone. **Verified by building twice across a real code change**, not
  assumed: the app hash moved and the Firebase hash did not. `font-display: swap`
  was already set, so the fonts were never part of it. The review, the
  recovery panel, the identity modules and the opening titles added about 5 kB
  between them. The
  lobby QR
  code added about 10 kB of that (`qrcode-generator`, MIT, no dependencies) —
  more than it looked like it would. Code-splitting is the fix if it matters.
  The clock added 0.9 kB, being oscillators rather than audio.
- **Devices in the same room will phase against each other, and it costs
  answers.** Each one schedules its own clock from when *it* saw the question
  open, and those moments differ by the spread of the Firestore snapshot. This
  was already true of the tick and nobody remarked on it; nine seconds of music
  makes it far more noticeable. **It was filed here as an audio nuisance and
  that was wrong** — on 17 August a player's window started about five seconds
  late, so the reveal killed his lecterns while his own timer still read five
  seconds and he could not answer at all. It cannot be fixed by syncing to
  `questionOpenedAt`, which is a client wall clock and would fold the
  quizmaster's offset into every device — but `openedAt` is a
  `serverTimestamp()` and there is a route through it. See [the clock, and what
  it actually costs](clock.md#the-clock-and-what-it-actually-costs).
- **A non-member can still write an answer document.** Nothing checks
  membership on the way in — the room code is the capability, as everywhere
  else. It no longer *scores*, and no longer inflates the answered count, but
  the write itself is still possible and the rules still permit it. What that
  costs now is a stray document, not somebody's game.
- **Season standings follow the browser until somebody saves a recovery code.**
  Anonymous auth gives a durable uid with no sign-up, which is the whole appeal
  and was the whole limitation — **iOS Safari evicts site storage after about a
  week without a visit**, so a weekly quiz survived and a fortnight off did not.
  [Durable identity](identity.md#durable-identity) is the answer to that, and it is opt-in
  by design: a player who never saves a code is exactly where they always were,
  and eviction still costs them everything. The remembered name has the same
  lifetime and for the same reason, which is deliberate: it is
  stored beside the uid rather than fetched from the season row, so the two can
  never disagree about who this browser is.
- **Honours are counted per device, so a device that missed a reveal banks
  none.** `useGameLog` is assembled from reveals this client saw, and
  `sawWholeGame` refuses to bank from a short log — which is the safe direction,
  but it means a player can silently lose a night's rosettes rather than merely
  see a screen say nothing. Session storage made this much rarer, since a reload
  no longer loses the log; a coalesced snapshot could still do it. Not fixable
  without letting one device write everybody's row, which is the thing the rules
  deliberately prevent — the same trade-off as somebody closing the tab before
  the final screen.
- **The `recovery` collection only grows.** Same shape as rooms never being
  deleted: each minted code is a permanent document. It is deletable by its
  owner, which is how a leaked code is revoked, but nothing tidies up
  automatically. One document per person who ever asks for a code, so it is a
  much slower leak than rooms.
- **The season board is the one read that scales with curiosity rather than with
  play** — 50 rows every time somebody opens it, and the final screen now points
  them there. Counted properly under [what it all
  costs](cost.md#what-it-all-costs-and-how-much-room-is-left).
- **The answer lamps have no cap, so a very large room makes a tall desk.** Ten
  names wrap to two rows on a phone, which is about 20% of the screen and was
  judged worth it. Twenty names would be four rows and would start to crowd the
  lecterns. It degrades rather than breaks — the strip grows and the question
  scrolls under it — but if the office ever fields that many, the fix is to name
  only who is *outstanding* and collapse the rest to a count.
- **Season numbers are self-reported.** The rules stop you writing someone else's
  row but not your own. Same trust model as the rest of the game.
- **The source corpora file their own questions unreliably.** OpenTriviaQA's
  `sports` file opens with a question about Aristotle and metaphysics. The
  positive sport filter catches that particular class; nothing checks the other
  packs, so a stray is possible anywhere. This is the same failure the project
  already hit once, when a `general-knowledge` fallback made that pack 68% video
  games.
- **The Trivia API is licence-incompatible.** 14,400 questions with real
  difficulty ratings, which would solve the levelling problem — but it is CC
  BY-**NC**, and NonCommercial cannot be folded into a ShareAlike work. Ruled out
  rather than overlooked.
- **Three OpenTDB categories are genuinely empty**: Musicals & Theatres,
  Celebrities and Gadgets have no *verified* questions, only pending ones. Note
  that `api_count.php` counts pending questions too, so its totals overstate what
  the API will actually serve — don't size a harvest from them.

---

## Still not fixed

`submitAnswer` stamps `questionIndex` from this device's snapshot. A client whose
listener has stalled writes an answer against the question it can still see, and
it is filtered out everywhere. Much harder to reach than the above — `phase` and
`index` travel in the same snapshot, so a stalled client is usually showing the
scoreboard and cannot answer at all. Left alone deliberately: it is now
*visible* rather than silent, which was the actual problem, and the fix would be
a retry path on a write that must not be retried carelessly.

---
