/**
 * Higher or Lower: which item is shown, which is hidden, and what each is
 * called. The prices are the ONS's, read at build time by
 * `write-higher-pack.ts`; none is written here. Greg plays it blind.
 * See docs/decisions/higher-or-lower.md.
 */

import { PRICE_SPECS } from './hand-prices-data';

/** The month every price is read from, as `quotes-202608.csv` has it. */
export const HIGHER_MONTH = '202608';

export const HIGHER_MIN_QUOTES = 30;
export const HIGHER_MIN_PACK = 60;
export const HIGHER_MIN_PER_LEVEL = 15;

/** A shown card may be dealt this often. A hidden item, only ever once. */
export const HIGHER_MAX_SHOWN_USES = 2;

export interface HigherItem {
  /** An ONS shop-quote item code. */
  key: string;
  /** How the question names it — plain English, with its article. */
  name: string;
}

export interface HigherSpec {
  /** `higher-` and three digits. Never reused: it is a vault id. */
  slug: string;
  shown: HigherItem;
  hidden: HigherItem;
}

/**
 * Items in neither price pack, named by hand from the ONS description on
 * 25 October 2026. Left out: items whose unit the description does not give
 * (carpet, MDF, nursery fees, van hire, car parks, care homes), numbered
 * twins (two blouses, two dresses, three computer games), vague ones (a
 * staff-restaurant snack, a phone accessory, car repairs), and condoms.
 */
export const HIGHER_ITEMS: Record<string, string> = {
  '220329': 'a takeaway hot drink',
  '220330': 'a chilled takeaway sandwich',
  '220331': 'a takeaway can of soft drink',
  '310102': 'a pint of draught bitter in a pub',
  '310110': 'a pint of premium lager in a pub',
  '310301': 'a single whisky in a pub',
  '310302': 'a single vodka in a pub',
  '310307': 'a single liqueur in a pub',
  '410509': "an hour of an electrician's time",
  '410517': "a day of a decorator's time",
  '410518': "an hour of a carpenter's time",
  '410602': 'a tub of ready-mixed filler',
  '410621': 'a tin of clear gloss varnish',
  '410637': 'a pack of ceramic tiles',
  '410638': 'a pack of wood screws',
  '420103': 'a 50kg bag of smokeless fuel',
  '420405': '1,000 litres of heating oil, delivered',
  '430119': 'a kitchen base unit',
  '430139': 'a kitchen wall unit',
  '430143': 'a fabric sofa',
  '430144': "an adult's bed",
  '430216': 'a duvet cover',
  '430224': 'a fitted bed sheet',
  '430229': 'a fabric roller blind',
  '430235': 'a floor rug',
  '430236': 'a pair of ready-made curtains',
  '430237': 'a square metre of luxury vinyl tile',
  '430323': 'a landline phone',
  '430351': 'an electric hair styler',
  '430413': 'a gas fire',
  '430414': 'a gas cooker',
  '430505': 'a roll of kitchen foil',
  '430507': 'a bottle of washing-up liquid',
  '430509': 'a bottle of household cleaner',
  '430529': 'a bottle of bleach',
  '430531': 'a bottle of fabric conditioner',
  '430533': 'a pack of kitchen roll',
  '430538': 'a pack of dishwasher tablets',
  '430542': 'a pack of antibacterial wipes',
  '430543': 'a roll of kitchen bin liners',
  '430544': 'a smart light bulb',
  '430626': 'a bag of dog treats',
  '430628': 'a bag of wild bird seed',
  '430629': 'a trip to the dog groomer',
  '440118': 'a computer repair',
  '440123': 'a house removal with one van',
  '440126': 'a week of a nanny',
  '440127': 'a month of self-storage',
  '440128': 'an hour of a home care assistant',
  '440129': 'a playgroup session',
  '440132': "hiring a men's suit",
  '440226': "a home-buyer's survey",
  '440227': 'a cremation funeral',
  '440249': "a solicitor's conveyancing on a house move",
  '440254': "an hour of a solicitor's time",
  '510108': "a men's knitted jumper",
  '510113': "a men's short-sleeved casual top",
  '510117': "a pair of men's formal trousers",
  '510118': "a pair of men's casual trousers",
  '510122': "a pair of men's tracksuit bottoms",
  '510124': "a pair of men's shorts",
  '510126': "a men's branded T-shirt",
  '510128': "a men's branded sports sweatshirt",
  '510131': "a men's casual shirt",
  '510133': "a pair of men's lounge trousers",
  '510134': "a men's blazer",
  '510208': "a women's formal jacket",
  '510212': "a women's jumper",
  '510215': "a women's plain T-shirt",
  '510219': "a women's casual jacket",
  '510223': "a women's long-sleeved top",
  '510235': "a pair of women's casual trousers",
  '510236': "a pair of women's formal trousers",
  '510237': "a women's casual skirt",
  '510238': "a women's work skirt",
  '510244': "a women's vest top",
  '510246': "a women's sports T-shirt",
  '510248': "a pair of women's own-brand jeans",
  '510254': "a pair of women's sports shorts",
  '510256': "a women's showerproof jacket",
  '510258': "a pair of women's leggings",
  '510259': "a women's short-sleeved smart top",
  '510260': "a pair of women's exercise leggings",
  '510261': "a women's sweatshirt",
  '510328': "a pair of boys' jeans",
  '510336': "a girls' school skirt",
  '510340': 'a fashion top for a girl of twelve',
  '510344': "a pair of girls' trousers",
  '510347': "a girls' jacket",
  '510348': "a boys' T-shirt",
  '510349': "a pair of girls' leggings",
  '510350': "a boys' jumper",
  '510351': 'a pair of baby trousers',
  '510352': "a baby's jumper",
  '510353': "a baby's dress",
  '510354': "a pair of boys' trousers",
  '510402': "a pair of men's boxer shorts",
  '510405': "a pair of women's pyjamas",
  '510406': "a pair of women's knickers",
  '510432': "a women's scarf",
  '510433': "a men's base layer top",
  '510435': 'a sports bra',
  '510439': "a men's belt",
  '510441': "a pair of boys' pyjamas",
  '510442': "a pair of girls' knickers",
  '510443': "a pair of girls' socks",
  '510444': "a pair of girls' pyjamas",
  '510445': "a pair of boys' pants",
  '510446': "a pair of boys' socks",
  '510501': "a pair of men's formal shoes",
  '510507': "a pair of boys' shoes",
  '510515': "a pair of men's casual shoes",
  '510528': "a pair of children's trainers",
  '510529': "a pair of women's boots",
  '510530': "a pair of women's flat shoes",
  '510537': "a pair of women's canvas shoes",
  '520123': 'a pair of fashion earrings',
  '520140': 'a fashion necklace',
  '520213': 'a large box of tissues',
  '520219': 'a pack of disposable nappies',
  '520222': 'a tub of multivitamins',
  '520228': 'a pack of plasters',
  '520235': 'a bottle of sun cream',
  '520236': "a box of women's hair dye",
  '520237': 'a tub of hair gel',
  '520238': 'a bottle of shower gel',
  '520243': 'a bottle of liquid foundation',
  '520245': 'a pack of hay fever tablets',
  '520246': 'a lip gloss',
  '520248': 'a bottle of hair conditioner',
  '520249': 'a pack of baby wipes',
  '520252': 'a bottle of body lotion',
  '520253': 'a bottle of fake tan',
  '520255': 'a bottle of mouthwash',
  '520256': 'a pack of sanitary towels',
  '520332': 'a session with a private chiropractor',
  '610232': 'a car service at a main dealer',
  '610241': 'a wheel alignment',
  '610242': 'a new exhaust, fitted',
  '630159': 'a TV of 39 inches or smaller',
  '630314': 'a construction toy set',
  '630341': 'a toy for a pre-schooler',
  '630347': 'a baby doll',
  '630365': 'a craft kit for a child',
  '630368': 'an electronic learning toy',
  '630382': 'a craft kit for an adult',
  '630383': 'a video game accessory',
  '630384': 'an SD memory card',
  '630386': 'a card game',
  '630388': 'a new video game',
  '630425': 'a hardback non-fiction book',
  '630426': 'a paperback non-fiction book',
  '630434': 'a picture book for an under-five',
  '630435': 'a hardback novel',
  '630437': 'a teenage novel',
  '630440': "a children's novel",
  '630510': 'a bag of potting compost',
  '630519': 'a potted shrub',
  '630525': 'a bottle of plant food',
  '630526': 'a packet of seeds',
  '640240': "a week's livery for a horse",
  '640244': 'a climbing wall session',
};

/**
 * The Price Was Right's shop-quote items, by key: shown cards only, since
 * their August 2026 price is already in that pack.
 */
const PRICE_NAMES: Record<string, string> = Object.fromEntries(
  PRICE_SPECS.filter((spec) => /^\d{6}$/.test(spec.key)).map((spec) => [spec.key, spec.name]),
);

/**
 * Each question as [number, shown key, hidden key]. Paired on 25 October 2026
 * by a scratch script that read the prices and printed counts only: the same
 * kind of thing where it could (84 of 90 share an ONS division), and 15 of
 * each level each way, so Higher is right in exactly half at every level.
 */
const PAIRS: readonly (readonly [number, string, string])[] = [
  [1, '510439', '510515'],
  [2, '630505', '630341'],
  [3, '410607', '410638'],
  [4, '410621', '410602'],
  [5, '430132', '430143'],
  [6, '510235', '510432'],
  [7, '510237', '510352'],
  [8, '630230', '630435'],
  [9, '440254', '440226'],
  [10, '510501', '510131'],
  [11, '510529', '510254'],
  [12, '440105', '440132'],
  [13, '430139', '430629'],
  [14, '510402', '510244'],
  [15, '510353', '510118'],
  [16, '520140', '520245'],
  [17, '410509', '410637'],
  [18, '510435', '510347'],
  [19, '430236', '430351'],
  [20, '220122', '220330'],
  [21, '520243', '520123'],
  [22, '430628', '430543'],
  [23, '610241', '610242'],
  [24, '630426', '630510'],
  [25, '440104', '440128'],
  [26, '510122', '510238'],
  [27, '510117', '510208'],
  [28, '510406', '510446'],
  [29, '430413', '430144'],
  [30, '510528', '510261'],
  [31, '510506', '510256'],
  [32, '520252', '520237'],
  [33, '510415', '510328'],
  [34, '510236', '510433'],
  [35, '430509', '430531'],
  [36, '640222', '640244'],
  [37, '520255', '520236'],
  [38, '430362', '430119'],
  [39, '410508', '410517'],
  [40, '430317', '430235'],
  [41, '220331', '220329'],
  [42, '510530', '510537'],
  [43, '520209', '520249'],
  [44, '630384', '630519'],
  [45, '310114', '310307'],
  [46, '510405', '510507'],
  [47, '510413', '510442'],
  [48, '510108', '510134'],
  [49, '630309', '630383'],
  [50, '520235', '520222'],
  [51, '440101', '440118'],
  [52, '630228', '630440'],
  [53, '520215', '520256'],
  [54, '510350', '510444'],
  [55, '430526', '430538'],
  [56, '630439', '630526'],
  [57, '520219', '520246'],
  [58, '520213', '520228'],
  [59, '430622', '430323'],
  [60, '510348', '510128'],
  [61, '510233', '510258'],
  [62, '640212', '640240'],
  [63, '630507', '630386'],
  [64, '510336', '510354'],
  [65, '630357', '630425'],
  [66, '430539', '430224'],
  [67, '510223', '510126'],
  [68, '510132', '510340'],
  [69, '520311', '520332'],
  [70, '510419', '510212'],
  [71, '510441', '510113'],
  [72, '630332', '630434'],
  [73, '510215', '630525'],
  [74, '630437', '630365'],
  [75, '510219', '510260'],
  [76, '430626', '430542'],
  [77, '510348', '510259'],
  [78, '510106', '510248'],
  [79, '510530', '510124'],
  [80, '430422', '430505'],
  [81, '430137', '440249'],
  [82, '430229', '430216'],
  [83, '430613', '430507'],
  [84, '430540', '430544'],
  [85, '630373', '630382'],
  [86, '610303', '510133'],
  [87, '520241', '520253'],
  [88, '610227', '630388'],
  [89, '630162', '440127'],
  [90, '440126', '420405'],
];

function nameOf(key: string): string {
  const name = HIGHER_ITEMS[key] ?? PRICE_NAMES[key];
  if (!name) throw new Error(`No name for item ${key}`);
  return name;
}

export const HIGHER_SPECS: HigherSpec[] = PAIRS.map(([n, shown, hidden]) => ({
  slug: `higher-${String(n).padStart(3, '0')}`,
  shown: { key: shown, name: nameOf(shown) },
  hidden: { key: hidden, name: nameOf(hidden) },
}));
