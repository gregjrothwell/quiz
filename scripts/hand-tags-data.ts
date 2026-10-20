/**
 * The Price is Right pack (`tags`): which ONS item each question shows, what to
 * call it and what to draw. **Greg plays this round blind** — and this file
 * holds no price at all. Prices are the August 2026 medians `prices-fetch.ts`
 * already writes into `.cache/prices/observed.json`, never typed. Slugs are
 * numbers; never renumber, since a slug is a vault id. See
 * docs/decisions/price-is-right.md.
 */

/** The one month every question asks about, and how the question names it. */
export const TAGS_MONTH = '202608';
export const TAGS_MONTH_LABEL = 'August 2026';

/** Fewer valid quotes than this and the median is one shop's whim. */
export const TAGS_MIN_QUOTES = 30;

/** AC 1: at least this many questions, and at least `TAGS_MIN_PER_LEVEL` at each level. */
export const TAGS_MIN_PACK = 60;
export const TAGS_MIN_PER_LEVEL = 15;

/** Never more than a quarter of the pack, so no one kind of shopping sets the pattern. */
export type TagKind = 'home' | 'kitchen' | 'diy' | 'tech' | 'clothes' | 'accessories' | 'beauty' | 'leisure' | 'kids';

/** How the question's chip names each kind. */
export const KIND_LABEL: Record<TagKind, string> = {
  home: 'Home',
  kitchen: 'Kitchen',
  diy: 'DIY and odds',
  tech: 'Tech',
  clothes: 'Clothes',
  accessories: 'Accessories',
  beauty: 'Health and beauty',
  leisure: 'Leisure',
  kids: 'Children',
};

export interface TagSpec {
  /** `tag-` and three digits. */
  slug: string;
  /** An ONS shop-quote item code. */
  key: string;
  /** How the question names it — plain English, with its article. */
  name: string;
  kind: TagKind;
  /** What to draw: the object alone. The style around it is `TAGS_STYLE`. */
  picture: string;
  /** Set once somebody has looked at the drawings: which version ships. */
  seed?: number;
  /** Looked at and kept out, and why. Ships nothing and refuses nothing. */
  dropped?: string;
}

function tag(n: number, key: string, name: string, kind: TagKind, picture: string): TagSpec {
  return { slug: `tag-${String(n).padStart(3, '0')}`, key, name, kind, picture };
}

/**
 * In an order that mixes the kinds, because the level is dealt in turn down
 * this list and the answer's place is balanced every four.
 */
export const TAG_SPECS: TagSpec[] = [
  tag(1, '430101', 'a double wardrobe', 'home', 'a white double wardrobe with two doors'),
  tag(2, '430365', 'an air fryer', 'kitchen', 'a black kitchen air fryer'),
  tag(3, '410614', 'a hammer drill', 'diy', 'a cordless hammer drill'),
  tag(4, '630166', 'a TV soundbar', 'tech', 'a slim black TV soundbar speaker'),
  tag(5, '510104', "a man's coat", 'clothes', "a navy man's winter coat on a hanger"),
  tag(6, '520130', 'a 9-carat solid gold ring', 'accessories', 'a plain 9-carat gold ring'),
  tag(7, '520234', 'a bottle of perfume', 'beauty', 'a glass bottle of perfume'),
  tag(8, '620318', "an adult's bicycle", 'leisure', "an adult's bicycle, side on"),
  tag(9, '630312', "a child's plastic doll", 'kids', "a child's plastic doll"),
  tag(10, '430104', 'an upholstered armchair', 'home', 'an upholstered fabric armchair'),
  tag(11, '430407', 'a small saucepan, 14 to 18cm', 'kitchen', 'a small stainless steel saucepan with a lid'),
  tag(12, '410625', 'a screwdriver', 'diy', 'a single screwdriver'),
  tag(13, '630167', 'a home printer', 'tech', 'a small white home printer'),
  tag(14, '510109', "a man's long-sleeved formal shirt", 'clothes', "a folded white man's formal shirt"),
  tag(15, '520103', 'a folding umbrella', 'accessories', 'an open folding umbrella'),
  tag(16, '520250', 'a bottle of nail varnish', 'beauty', 'a small bottle of red nail varnish'),
  tag(17, '610115', 'an adult electric bike', 'leisure', 'an electric bike with a battery on the frame, side on'),
  tag(18, '620317', "a child's bicycle", 'kids', "a small child's bicycle, side on"),
  tag(19, '430120', 'a coffee table', 'home', 'a wooden coffee table'),
  tag(20, '430423', 'a frying pan, 24 to 30cm', 'kitchen', 'a non-stick frying pan'),
  tag(21, '410631', 'a shower head', 'diy', 'a chrome shower head'),
  tag(22, '630168', 'a virtual reality headset', 'tech', 'a white virtual reality headset'),
  tag(23, '510249', "a pair of branded women's jeans", 'clothes', "a folded pair of blue women's jeans"),
  tag(24, '520135', 'a diamond solitaire ring', 'accessories', 'a diamond solitaire engagement ring'),
  tag(25, '520244', 'a manual toothbrush', 'beauty', 'a single manual toothbrush'),
  tag(26, '620319', 'an adult cycle helmet', 'leisure', 'an adult cycle helmet'),
  tag(27, '620321', "a toddler's car seat", 'kids', "a toddler's car seat"),
  tag(28, '430133', 'a freestanding bookcase', 'home', 'an empty freestanding wooden bookcase'),
  tag(29, '430419', 'a stainless steel cutlery set', 'kitchen', 'a stainless steel cutlery set laid out: knives, forks and spoons'),
  tag(30, '410639', 'a tin of gloss or emulsion paint, 750ml to 2.5 litres', 'diy', 'a closed metal tin of paint with a plain unprinted label'),
  tag(31, '630377', 'an action camera', 'tech', 'a small action camera'),
  tag(32, '510255', "a women's swimsuit", 'clothes', "a one-piece women's swimsuit"),
  tag(33, '520109', 'a handbag', 'accessories', "a women's leather handbag"),
  tag(34, '630317', "an adult's sleeping bag", 'leisure', 'a rolled-out sleeping bag'),
  tag(35, '630313', 'a toy model car', 'kids', 'a die-cast toy model car'),
  tag(36, '430136', 'a patio table and chairs', 'home', 'a garden patio table with four chairs'),
  tag(37, '430425', 'a dinner plate', 'kitchen', 'a plain white dinner plate'),
  tag(38, '410640', 'a roll of wallpaper', 'diy', 'a roll of patterned wallpaper'),
  tag(39, '610243', 'a dashcam', 'tech', 'a small car dashboard camera'),
  tag(40, '510516', "a pair of men's trainers", 'clothes', "a pair of men's running trainers"),
  tag(41, '520134', 'a wheeled suitcase, 60 to 70cm', 'accessories', 'a hard-shell wheeled suitcase with its handle up'),
  tag(42, '630340', 'a carbon-fibre fishing rod', 'leisure', 'a carbon-fibre fishing rod with a reel'),
  tag(43, '630376', 'a sit-and-ride toy for an under-five', 'kids', 'a plastic sit-and-ride toy car for a toddler'),
  tag(44, '430138', 'a home office desk', 'home', 'a simple home office desk'),
  tag(45, '430418', 'a plastic food storage box', 'kitchen', 'a clear plastic food storage box with a lid'),
  tag(46, '410611', 'a pair of door handles for one door', 'diy', 'a pair of chrome lever door handles'),
  tag(47, '630156', 'a pair of headphones', 'tech', 'a pair of over-ear headphones'),
  tag(48, '510536', "a pair of men's walking boots", 'clothes', "a pair of men's leather walking boots"),
  tag(49, '520131', "a man's analogue watch", 'accessories', "a man's analogue wristwatch"),
  tag(50, '630369', 'a charcoal barbecue', 'leisure', 'a round kettle charcoal barbecue on legs'),
  tag(51, '430142', "a baby's high chair", 'kids', "a baby's high chair"),
  tag(52, '430238', 'a cushion', 'home', 'a square sofa cushion'),
  tag(53, '430409', 'a pair of household scissors', 'kitchen', 'a pair of household scissors'),
  tag(54, '430545', 'a single lightbulb', 'diy', 'a single LED lightbulb'),
  tag(55, '430321', 'an electric shaver', 'tech', "a man's electric shaver"),
  tag(56, '630343', "a pair of men's football boots", 'clothes', 'a pair of football boots with studs'),
  tag(57, '520137', 'a pair of sterling silver earrings', 'accessories', 'a pair of sterling silver stud earrings'),
  tag(58, '630381', 'a pair of hand weights', 'leisure', 'a pair of small dumbbells'),
  tag(59, '510330', 'a long-sleeved baby sleepsuit', 'kids', 'a long-sleeved baby sleepsuit laid flat'),
  tag(60, '430141', 'a dining table with two to six chairs', 'home', 'a wooden dining table with four chairs'),
  tag(61, '520142', 'a reusable drinks bottle', 'kitchen', 'a reusable metal drinks bottle'),
  tag(62, '430525', 'a roll of clear sticky tape', 'diy', 'a roll of clear sticky tape'),
  tag(63, '630164', 'a DVD or Blu-ray player', 'tech', 'a slim black DVD player'),
  tag(64, '510538', "a pair of men's sliders", 'clothes', "a pair of men's pool sliders"),
  tag(65, '630387', 'an exercise mat', 'leisure', 'a rolled exercise mat'),
  tag(66, '520118', 'a flower vase', 'home', 'an empty glass flower vase'),
  tag(67, '430304', 'a freestanding electric cooker', 'kitchen', 'a freestanding electric cooker with an oven and hob'),
  tag(68, '430503', 'a ballpoint pen', 'diy', 'a single ballpoint pen'),
  tag(69, '430364', 'a home security camera', 'tech', 'a small white home security camera'),
  tag(70, '510434', "an adult's cap", 'clothes', 'a plain baseball cap'),
  tag(71, '510429', 'a 100g ball of double-knit wool', 'leisure', 'a ball of knitting wool'),
  tag(72, '430627', 'a pet collar', 'leisure', 'a dog collar'),
  tag(73, '430228', 'a bath sheet', 'home', 'a folded bath towel'),
  tag(74, '430355', 'a vacuum cleaner', 'home', 'an upright vacuum cleaner'),
  tag(75, '430546', 'a roll of wrapping paper', 'diy', 'a roll of patterned gift wrapping paper'),
  tag(76, '630385', 'a USB memory stick', 'tech', 'a USB memory stick'),
  tag(77, '510440', "one pair of women's socks", 'clothes', "a pair of women's socks"),
  tag(78, '430617', 'a cage for a gerbil or hamster', 'leisure', 'an empty small pet cage for a hamster'),
  tag(79, '520136', 'a photo frame', 'home', 'an empty wooden photo frame'),
  tag(80, '520132', 'a wall mirror', 'home', 'a round wall mirror'),
  tag(81, '610237', 'a 12-volt car bulb', 'diy', 'a single car headlight bulb'),
];
