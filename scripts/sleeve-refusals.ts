/**
 * Covers a person looked at and refused, which the machine had passed.
 *
 * **Hand-maintained.** `sleeve-cover-text.ts` is generated; this is not.
 *
 * Apple's Vision framework reads printed prose well and stylised cover type
 * badly, and the gap is not a threshold that can be tuned — the text simply is
 * not in its output. Of the 37 sleeves it cleared on 21 September 2026, **11
 * print their own title in a form it never saw**:
 *
 * | Slug | What is on the cover | What Vision read |
 * |---|---|---|
 * | `joshua-tree` | `T H E  J O S H U A  T R E E` in letterspaced caps | nothing at all |
 * | `viva-la-vida-album` | `VIVA LA VIDA` painted across the Delacroix | nothing at all |
 * | `war-u2` | `WAR` in red down the side | nothing at all |
 * | `parallel-lines` | `PARALLEL LINES` in plain caps, above the band | `bloncie` |
 * | `the-fame` | `The Fame` in script on the sunglasses | `tma il` |
 * | `lungs` | `LUNGS` under the artist | the artist only |
 * | `off-the-wall` | `OFF THE WALL` down the left | the artist only |
 * | `bad-mj` | `BAD` in red at the top | the artist only |
 * | `low-bowie` | `DAVID BOWIE LOW` across the top | `davlorowie` |
 * | `frank-amy` | `FRANK` under the artist | `amy wrafhouse` |
 * | `achtung-baby` | `ACHTUNG BABY` inverted in the first tile | nothing at all |
 *
 * That is a **30% miss rate on covers the machine had passed**, so the audit
 * narrows the field and a person settles it. A second batch of candidates the
 * same afternoon held the rate almost exactly: eight of 26 newly cleared covers
 * print their title, *Rubber Soul* in its own stretched lettering and *The
 * Prodigy Experience* as a logo filling the sleeve. Nineteen in all, listed
 * below.
 *
 * The way to do the pass is to look at them. `npm run sleeve-audit -- --sheet`
 * writes a labelled contact sheet of every cover it cleared, and every one of
 * the nineteen is obvious in it at 190px — which is the point: this is not a
 * close call the machine narrowly lost, it is text a person reads instantly and
 * an OCR engine tuned for prose does not see at all.
 *
 * A slug listed here is refused whatever the audit says, so the judgement
 * survives a regenerate. Removing one needs a reason written next to it.
 */

export const SLEEVE_HAND_REFUSALS: Record<string, string> = {
  'joshua-tree': 'letterspaced “THE JOSHUA TREE” across the top',
  'viva-la-vida-album': '“VIVA LA VIDA” painted across the artwork',
  'war-u2': '“WAR” in red down the right-hand side',
  'parallel-lines': '“PARALLEL LINES” in caps above the band',
  'the-fame': '“The Fame” in script on the sunglasses',
  lungs: '“LUNGS” beneath the artist',
  'off-the-wall': '“OFF THE WALL” down the left-hand side',
  'bad-mj': '“BAD” in red at the top',
  'low-bowie': '“DAVID BOWIE LOW” across the top',
  'frank-amy': '“FRANK” beneath the artist',
  'achtung-baby': '“ACHTUNG BABY” inverted in the top-left tile',

  // The second batch, same pass, same afternoon. Eight of the 26 new covers
  // Vision cleared print their title; the rate held at roughly a third.
  'rubber-soul': '“Rubber Soul” in stretched lettering, top left',
  'the-kick-inside': '“KATE BUSH” and “THE KICK INSIDE” down the right',
  'leisure-blur': '“blur” and “leisure.” in the top-right corner',
  'experience-prodigy': '“THE PRODIGY EXPERIENCE” as the whole cover',
  'disraeli-gears': '“DISRAELI GEARS” in the psychedelic lettering at the top',
  'harvest-neil': '“Harvest — Neil Young” in the centre',
  'after-the-gold-rush': '“AFTER THE GOLD RUSH • NEIL YOUNG” across the top',
  doolittle: '“Doolittle” top left, “PIXIES” top right',

  // The third batch, 26 September 2026. Read by a model at 400px, full size
  // where there was doubt — a person has not done this pass yet. Eleven of the
  // 55 new covers Vision cleared print their title, some only as initials.
  'the-doors-album': '“the doors” logo, which is the album’s title as well as the band’s',
  'whitney-1987': '“Whitney” in script, top left',
  'sour-or': '“SOUR” on the sticker on her tongue',
  'guts-or': '“GUTS” spelt out in the rings on her fingers',
  'heavy-is-the-head': '“h.i.t.h” on the crown — the title’s initials',
  'mylo-xyloto': '“MX” as the whole design — the title’s initials',
  'queen-ii': '“Queen II” logo, top left',
  'songs-in-the-key-of-life': '“Songs in the Key of Life” in script round the rings',
  'settle-disclosure': '“DISCLOSURE SETTLE” across the top',
  'alright-still': '“ALRIGHT, STILL” in the artwork behind her',
  'spice-album': '“SPICE” as the whole cover',

  // Not a giveaway: the wrong picture. `titleMatches` accepted a release whose
  // name merely contains the album's, the californication shape again.
  'dua-lipa-2017': 'resolved to “Dua Lipa - Live from the Royal Albert Hall”, not the album',
  'lust-for-life-ldr': 'resolved to a BloodPop remix single, not the album',

  // Fourth batch, same afternoon, same model pass. Eight of 26 new clears.
  'sasha-fierce': '“I AM…” bottom right, “BEYONCÉ” bottom left',
  'rated-r': '“R A T E D R” letterspaced along the bottom',
  'kiwanuka-album': '“KIWANUKA” above the portrait',
  'planet-her': '“PLANET HER · DOJA CAT” down the left-hand edge',
  'scorpion-drake': '“SCORPION 2018” handwritten under the signature',
  abraxas: '“SANTANA ABRAXAS” in the red lettering, top right',
  'sound-of-silver': '“LCD SOUNDSYSTEM SOUND OF SILVER” across the middle',
  // Not the title, but the answer all the same: her name is on the sash, and
  // with one album to her name every distractor is somebody else's.
  'midwest-princess': '“CHAPPELL” on the sash, and all three distractors are other artists',
  // Fifth batch, 5 October 2026: 32 of the 68 new clears, Claude's pass on the
  // contact sheet, confirmed by Greg ("fine"). docs/decisions/sleeves-growth.md.
  'the-king-of-limbs': '“RADIOHEAD THE KING OF LIMBS” across the middle',
  'the-2nd-law': '“T H E  2 N D  L A W” letterspaced under MUSE, top left',
  dirt: '“D I R T” letterspaced under the logo',
  'invaders-must-die': '“INVADERS MUST DIE” in the orange logo',
  'perfect-symmetry': '“PERFECT SYMMETRY” under KEANE',
  'coming-up': '“Coming Up” in yellow script along the bottom',
  'why-me-why-not': '“WHY ME? WHY NOT.” under the name, top left',
  konk: '“KONK” in neon over the door',
  spiceworld: '“SPICE” spelt in figures across the middle, which is also a distractor',
  'taylor-swift': 'her signature across the bottom, and the album is her name',
  'can-t-rush-greatness': '“RUSH” on the rings',
  kylie: '“K Y L I E  M I N O G U E” along the top, and the album is her name',
  'body-language': '“BODY LANGUAGE” top left',
  madonna: '“M A D O N N A” down both sides, and the album is her name',
  erotica: '“Madonna Erotica” in gold script',
  '1999': '“PRINCE 1999” in the painted lettering',
  janet: '“janet.” across the top',
  'break-every-rule': '“Tina Turner Break Every Rule” in red script',
  reckless: '“R E C K L E S S” letterspaced along the bottom',
  'slippery-when-wet': '“SLIPPERY WHEN WET” written on the wet glass',
  hysteria: '“Hysteria” in the lettering under the triangle',
  'use-your-illusion-i': '“USE YOUR ILLUSION I” down the right',
  metallica: 'the METALLICA logo, black on black, and the album is the band',
  'bella-donna': '“Stevie Nicks Bella Donna” in script, top right',
  'the-cars': '“T H E  C A R S” letterspaced across the top, and the album is the band',
  'hunting-high-and-low': '“hunting high and low” under a-ha, and DELUXE EDITION down the side',
  'the-1975': '“THE 1975” in the light box, and the album is the band',
  uprising: '“UPRISING” in the red lettering',
  kaya: '“Kaya” in yellow script, bottom right',
  diana: '“diana” top right',
  'spirits-having-flown': '“Spirits Having Flown” under BEE GEES',
  'black-cherry': '“BLACK CHERRY” handwritten on the right',
  // Sixth batch, 5 October 2026: 14 of the 42 new clears, Claude's pass on the
  // contact sheet, confirmed by Greg ("fine").
  'the-life-of-a-showgirl': '“THE LIFE OF A SHOWGIRL” painted down the left',
  artpop: '“ARTPOP” across the ball, under LADY GAGA',
  'hot-pink': '“Hot Pink” in pink script, top left',
  animal: '“ANIMAL” in purple lettering, bottom right',
  purpose: '“Purpose” in script along the bottom',
  justice: '“JUSTICE” across the middle',
  camila: '“C A M I L A” across the middle, and the album is her name',
  'my-head-is-an-animal': 'the title in small type down the left, under the band name',
  'be-the-cowboy': '“Be the … Cowboy” in script around MITSKI',
  aja: '“aja” in red script, top right',
  'g-i-r-l': '“G I R L” across the bottom',
  'last-splash': '“Last Splash” in script over the logo',
  secrets: '“S e c r e t s” along the bottom',
  millennium: '“millennium 2.0” across the middle',
};
