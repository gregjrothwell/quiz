# Office feedback — 7 October 2026 (`XRUE`)

> **Owner: Greg Rothwell. Last updated: 7 October 2026. Budget: 250 lines.**

Greg, after `XRUE` (08:51 The Price Was Right, 09:00 Catchphrase, 8 seats): five items.
**Blind:** The Price Was Right and Catchphrase are played blind, so everything below is counts,
positions and question numbers — no item, price or phrase.

**Status: PLAN.** Findings are measured; the stories wait for Greg's approval.

## 1. The Price Was Right — options that give the answer away

> "Some had only one price lower than the current day's price, and so it was obviously going
> to be that one." — Greg

**Measured on the shipped pack, 7 Oct** (`.cache/prices-tells*.ts`, not committed):

| Options below today's price | Questions | |
|---|---|---|
| 4 | 49 | fine |
| 3 | 18 | one option ruled out by common sense |
| 2 | 17 | a coin toss once the other two are ruled out |
| 1 | 10 | **in 6 that one is the answer** — Greg's giveaway; the other 4 got cheaper |
| 0 | 1 | |

**46 of 95** have at least one option at or above the price the question gives.

**Cause.** `optionPence` builds a ×1.5 / ×1.3 / ×1.16 ladder around the answer at a balanced
position and never looks at today's price. With the answer at the bottom of an easy ladder,
the top option is 3.4× the answer, which is above today for anything that less than tripled.
AC 5 of [`price-was-right.md`](price-was-right.md) guarded only the opposite case (prices that
fell). Seven of 95 got cheaper or stayed level.

**Feasible** (same data): with every option under today's price at the 12% minimum spacing,
57 of 95 could still take any position; 7 (rose under 12%) are forced to the top option, the
rest to the upper half. So positions stay close to even within each gap.

### Story (draft)

**As** a player, **I want** every option to be a price the thing could believably have cost,
**so that** the only route to the answer is my memory of prices.

1. **Rose → every option below today's price.**
2. **Got cheaper or level (7)** → the answer at or above today, options either side of it.
3. **Spacing as before** where it fits under today; otherwise it narrows, never below 12%,
   and the level recorded is the spacing actually used.
4. **Positions** as even as AC 1 allows within each gap; the writer prints the spread.
5. **No reseed**: all 95 answers come out identical to the seeded ones, checked before deploy.
6. Blind: tests on invented prices; reports in counts.

## 2. The podium and joint winners

**Today** (`Final.tsx` `RISER_SLOTS`): the risers are the top three *rows*, sized by row. Joint
winners: one stands on the full riser, the other on the shorter second-place one, though both
show "1". A three-way tie for third shows one of the three. The header already says "dead heat".
The share card has its own podium (`drawCard.ts`).

### Story (draft)

**As** a joint winner, **I want** to stand as high as the person I tied with, **so that** the
podium says what the header says.

1. A riser's height follows the **place**, not the row.
2. **Everyone placed third or better stands**, left–right around the middle; past five risers
   the rest fold into "+N" on their place (as the lectern did in #65).
3. **Nobody stands and sits**: `seatedLast` follows the new podium.
4. The **share card** draws the same podium.
5. Gallery fixtures: tie for 1st, tie for 2nd, three-way tie for 3rd, everyone level.

## 3. Image generation overnight, with no session running

**Today:** `catchphrase-draw` already runs without Claude — resumable, Vision OCR at the end.
The tokens go on two things: a session kept open for a 2.8-hour draw, and Claude reading each
of ~90 full-size drawings to pick seeds. **Greg cannot pick them himself: the round is blind.**
mflux is used only by Catchphrase.

### Story (draft)

**As** Greg, **I want** to start the drawing myself at night and find a sheet ready in the
morning, **so that** nothing runs a session while it draws and the morning pick costs a few
images rather than ninety.

1. `npm run draw-overnight` from a plain terminal: keeps the Mac awake (`caffeinate`), will not
   start on battery, pauses below 30% and resumes above 50%. A long draw holds the battery flat even on the charger (5 Oct).
2. Writes `.cache/catchphrase/run.json` — started, finished, drawn, failed, minutes each — and a
   log.
3. **Contact sheets**: 12 puzzles a sheet, three seeds a row, labelled by puzzle number and seed
   only, never a slug.
4. A macOS notification when it finishes or fails.
5. Pick-up next morning reads `run.json`, `text.json` and the sheets — ~8 images, not ~90.

**Not covered:** writing the specs (Claude, text, cheap) and choosing the seed (Claude, blind).

## 4. The slow reveal

`read-games --game` on both `XRUE` rounds, same quizmaster device (`RCuSUX`), both on #70.
`correctIndex` is the number of refusals before the hit, because the vault asks in option order.

| Round | Slowest | Vault step | Refusals before the hit |
|---|---|---|---|
| Price Was Right Q6 | **3.2s** | 2,789ms | 2 |
| Price Was Right Q8 | 2.1s | 1,694ms | 3 |
| Catchphrase Q10 | 1.9s | 1,752ms | 3 |
| Price Was Right Q10 | 1.9s | 1,521ms | 2 |

Hit first: **47–87ms** (n=9). Each refusal in the office: **~180–250ms** typically — about twice
the ~110ms measured in a browser on 6 Oct — with outliers of 0.5–1.4s per refusal.

**Cause.** A refused write closes Firestore's write stream, and the next write waits for a new
one ([`reveal-stop-at-hit.md`](reveal-stop-at-hit.md)). #70 halved how many reopens a reveal
pays; it cannot remove them. On the office network a reopen is slower, and occasionally slow
enough to see.

**Proposed fix: send the candidates over Firestore Lite (REST).** A refusal there is an HTTP
403 on its own request — no stream to reopen — so all four go at once and the main write stream
never sees a refusal. **Lite sends App Check**: `x-firebase-appcheck` is in the installed SDK's
lite bundle (`@firebase/firestore` 4.8.0), checked 7 Oct. No rules change, no reseed.
**Unmeasured:** the bundle cost and the real number. Expected: one round trip wherever the hit.

**Also seen, not chased:** the room update took ~290ms on every Price Was Right reveal and
~85ms on every Catchphrase one, same device, nine minutes apart.

## 5. The design system

- **No Design System artifact** exists on Greg's account (Artifact list, 7 Oct).
- The **Claude Design "Vibe Quiz" canvas** (29 Aug) was a one-off review. Nothing syncs it, and
  reaching it from Claude Code needs `/design-login` ([`recall/2026-08.md`](../recall/2026-08.md)).
- **What is actually used:** `src/design/global.css` — 35 tokens in `:root`, 310 `var()` uses —
  and the gallery (`src/screens/Preview.tsx`), which is how screens get checked.
- **Drift:** 75 hex literals (57 distinct) and 116 `rgb()` literals outside `:root`;
  `drawCard.ts` hardcodes 8 colours. Nothing checks it.
