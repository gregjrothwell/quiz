/**
 * The Price Was Right pack: which ONS item each question asks about, over
 * which gap, and what to call it. **Greg plays this round blind** — and this
 * file holds no price at all. Prices are computed from the ONS files by
 * `prices-fetch.ts` into `.cache/`, never typed. Slugs are numbers; never
 * renumber, since a slug is a vault id. See docs/decisions/price-was-right.md.
 */

export type Gap = 5 | 10 | 20 | 30;

/** Which ONS file a gap is read from, and the two months it compares. */
export const GAPS: Record<
  Gap,
  { source: 'quotes' | 'rpi'; later: string; earlier: string; laterLabel: string; earlierLabel: string }
> = {
  5: { source: 'quotes', later: '202608', earlier: '202108', laterLabel: 'August 2026', earlierLabel: 'August 2021' },
  10: { source: 'quotes', later: '202608', earlier: '201608', laterLabel: 'August 2026', earlierLabel: 'August 2016' },
  20: { source: 'rpi', later: '2025 JAN', earlier: '2005 JAN', laterLabel: 'January 2025', earlierLabel: 'January 2005' },
  30: { source: 'rpi', later: '2025 JAN', earlier: '1995 JAN', laterLabel: 'January 2025', earlierLabel: 'January 1995' },
};

/** Never more than a quarter of the pack, so no one kind of shopping sets the pattern. */
export type Kind =
  | 'pub'
  | 'eating out'
  | 'takeaway'
  | 'leisure'
  | 'motoring'
  | 'fuel'
  | 'services'
  | 'health and beauty'
  | 'home'
  | 'clothes'
  | 'pets'
  | 'smoking'
  | 'fruit and veg'
  | 'meat and fish'
  | 'larder';

export interface PriceSpec {
  /** `price-` and three digits. */
  slug: string;
  gap: Gap;
  /** An ONS item code (shop quotes) or a CDID (RPI average prices). */
  key: string;
  /** How the question names it — plain English, with its article. */
  name: string;
  kind: Kind;
}

/**
 * Shown to Greg on 6 October 2026, in a draft of the decision doc and in a
 * question: a man's haircut, a pub pint of lager (as a quote and as an RPI
 * series), takeaway fish and chips, a double duvet. Never in the pack.
 */
export const SPOILED_KEYS = ['520301', '310109', 'CZMS', '220301', '430211'];

export const PRICES_MIN_PACK = 60;
export const PRICES_MIN_PER_LEVEL = 15;
export const PRICES_MIN_PER_GAP = 15;
/** The fewest quotes a median may stand on, in each month. */
export const PRICES_MIN_QUOTES = 30;

function spec(n: number, gap: Gap, key: string, name: string, kind: Kind): PriceSpec {
  return { slug: `price-${String(n).padStart(3, '0')}`, gap, key, name, kind };
}

export const PRICE_SPECS: PriceSpec[] = [
  // Ten years: shop quotes, August 2016 → August 2026.
  spec(1, 10, '220121', 'a cup of coffee in a café', 'eating out'),
  spec(2, 10, '220316', 'a takeaway pizza', 'takeaway'),
  spec(3, 10, '220324', 'a tub of popcorn at the cinema', 'leisure'),
  spec(4, 10, '640219', 'an adult swim at a public pool', 'leisure'),
  spec(5, 10, '640212', 'an evening theatre seat in the front stalls', 'leisure'),
  spec(6, 10, '620308', 'a two-mile minicab ride', 'motoring'),
  spec(7, 10, '610227', 'an MOT test', 'motoring'),
  spec(8, 10, '440105', 'a one-hour driving lesson', 'motoring'),
  spec(9, 10, '440104', "dry cleaning a man's suit", 'services'),
  spec(10, 10, '410508', "an hour of a plumber's time", 'services'),
  spec(11, 10, '520303', "a woman's cut and blow-dry", 'health and beauty'),
  spec(12, 10, '520209', 'a tube of toothpaste', 'health and beauty'),
  spec(13, 10, '430536', 'a pack of toilet rolls', 'home'),
  spec(14, 10, '430307', 'an electric kettle', 'home'),
  spec(15, 10, '430361', 'a washing machine', 'home'),
  spec(16, 10, '510106', "a pair of men's jeans", 'clothes'),
  spec(17, 10, '510415', "a pair of women's tights", 'clothes'),
  spec(18, 10, '630336', 'a football', 'leisure'),
  spec(19, 10, '630230', 'a top-40 album on CD', 'leisure'),
  spec(20, 10, '630439', 'a top-ten paperback novel', 'leisure'),
  spec(21, 10, '430526', 'a greetings card', 'home'),
  spec(22, 10, '430622', 'a day in kennels for a dog', 'pets'),
  spec(23, 10, '220124', 'a muffin in a café', 'eating out'),
  spec(24, 10, '310310', 'a glass of wine in a pub', 'pub'),
  spec(25, 10, '220107', 'a hot meal in a pub', 'pub'),
  spec(26, 10, '220323', 'a takeaway kebab', 'takeaway'),
  spec(27, 10, '440240', 'a basic will from a solicitor', 'services'),
  spec(28, 10, '520326', 'a private dental check-up', 'health and beauty'),
  spec(29, 10, '630345', 'one golf ball', 'leisure'),
  spec(30, 10, '220214', 'a main course in a staff canteen', 'eating out'),

  // Five years: shop quotes, August 2021 → August 2026.
  spec(31, 5, '220328', 'a burger in a bun', 'takeaway'),
  spec(32, 5, '310114', 'a pint or bottle of cider in a pub', 'pub'),
  spec(33, 5, '310316', 'a single gin in a pub', 'pub'),
  spec(34, 5, '220128', 'a restaurant main course', 'eating out'),
  spec(35, 5, '220327', 'a hot savoury pastry to take away', 'takeaway'),
  spec(36, 5, '630160', 'a television of 40 inches or more', 'home'),
  spec(37, 5, '630162', 'a portable speaker', 'leisure'),
  spec(38, 5, '430363', 'an electric toothbrush', 'health and beauty'),
  spec(39, 5, '520216', 'a can of deodorant', 'health and beauty'),
  spec(40, 5, '430539', 'a four-pack of batteries', 'home'),
  spec(41, 5, '640243', 'a session at a soft play centre', 'leisure'),
  spec(42, 5, '630373', 'a jigsaw of at least 100 pieces', 'leisure'),
  spec(43, 5, '630374', "a child's scooter", 'leisure'),
  spec(44, 5, '510413', "a pair of men's socks", 'clothes'),
  spec(45, 5, '430540', 'a bottle of laundry liquid', 'home'),
  spec(46, 5, '520251', 'a bottle of cough medicine', 'health and beauty'),
  spec(47, 5, '220122', 'a pudding in a restaurant', 'eating out'),
  spec(48, 5, '640224', 'a game of ten-pin bowling', 'leisure'),
  spec(49, 5, '610238', 'a car wash', 'motoring'),
  spec(50, 5, '610204', 'a car tyre', 'motoring'),
  spec(51, 5, '520226', 'a bottle of shampoo', 'health and beauty'),
  spec(52, 5, '430624', 'a pouch of cat food', 'pets'),
  spec(53, 5, '510127', 'an official football shirt', 'clothes'),
  spec(54, 5, '630228', 'a film on DVD', 'leisure'),
  spec(55, 5, '220326', 'takeaway chicken and chips', 'takeaway'),

  // Thirty years: RPI average prices, January 1995 → January 2025.
  spec(56, 30, 'CZMK', 'a litre of petrol', 'fuel'),
  spec(57, 30, 'CZMP', 'a packet of twenty king-size cigarettes', 'smoking'),
  spec(58, 30, 'CZMT', 'a pint of bitter in a pub', 'pub'),
  spec(59, 30, 'CZNT', 'a pint of milk', 'larder'),
  spec(60, 30, 'CZOH', 'a large sliced white loaf', 'larder'),
  spec(61, 30, 'CZNN', 'a kilo of granulated sugar', 'larder'),
  spec(62, 30, 'CZNQ', 'a 250g box of tea bags', 'larder'),
  spec(63, 30, 'CZMV', 'a kilo of bananas', 'fruit and veg'),
  spec(64, 30, 'CZNB', 'a cucumber', 'fruit and veg'),
  spec(65, 30, 'CZNA', 'an iceberg lettuce', 'fruit and veg'),
  spec(66, 30, 'CZOM', 'a kilo of fresh roasting chicken', 'meat and fish'),
  spec(67, 30, 'CZPF', 'a kilo of rump steak', 'meat and fish'),
  spec(68, 30, 'CZNP', 'a 100g jar of instant coffee', 'larder'),
  spec(69, 30, 'CZOC', 'a 1.5kg bag of self-raising flour', 'larder'),
  spec(70, 30, 'CZMN', 'a 50kg bag of smokeless fuel', 'fuel'),
  spec(71, 30, 'DOHN', 'a grapefruit', 'fruit and veg'),
  spec(72, 30, 'CZND', 'a kilo of onions', 'fruit and veg'),
  spec(73, 30, 'VKYY', 'a kilo of potatoes', 'fruit and veg'),
  spec(74, 30, 'CZNH', 'a kilo of cabbage', 'fruit and veg'),
  spec(75, 30, 'CZNJ', 'a kilo of tomatoes', 'fruit and veg'),

  // Twenty years: RPI average prices, January 2005 → January 2025.
  spec(76, 20, 'CZML', 'a litre of diesel', 'fuel'),
  spec(77, 20, 'CZOL', 'a kilo of white fish fillets', 'meat and fish'),
  spec(78, 20, 'VKYU', 'a large sliced wholemeal loaf', 'larder'),
  spec(79, 20, 'CZMU', 'a kilo of grapes', 'fruit and veg'),
  spec(80, 20, 'CZMY', 'a kilo of eating apples', 'fruit and veg'),
  spec(81, 20, 'CZMX', 'a kilo of pears', 'fruit and veg'),
  spec(82, 20, 'CZMW', 'an orange', 'fruit and veg'),
  spec(83, 20, 'CZNC', 'a kilo of mushrooms', 'fruit and veg'),
  spec(84, 20, 'CZNE', 'a kilo of carrots', 'fruit and veg'),
  spec(85, 20, 'CZNG', 'a cauliflower', 'fruit and veg'),
  spec(86, 20, 'CZOQ', 'a kilo of pork sausages', 'meat and fish'),
  spec(87, 20, 'CZOR', 'a quarter of ham', 'meat and fish'),
  spec(88, 20, 'CZOU', 'a kilo of gammon', 'meat and fish'),
  spec(89, 20, 'DOIF', 'a kilo of back bacon', 'meat and fish'),
  spec(90, 20, 'CZPI', 'a kilo of best beef mince', 'meat and fish'),
  spec(91, 20, 'DOHT', 'an avocado', 'fruit and veg'),
  spec(92, 20, 'DOIB', 'a tub of margarine', 'larder'),
  spec(93, 20, 'ZPTX', 'a kilo of salmon fillets', 'meat and fish'),
  spec(94, 20, 'CZMR', 'a single whisky in a pub', 'pub'),
  spec(95, 20, 'CZNW', 'a kilo of cheddar', 'larder'),
];
