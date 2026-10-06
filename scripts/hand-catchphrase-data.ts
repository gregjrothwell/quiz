import type { Difficulty } from '../src/questions/types';

/**
 * The Catchphrase pack: a cartoon of a saying or a title, and four options.
 *
 * **Greg plays this round, so he has not read this file**, by his own choice on
 * 2 October 2026. Twelve phrases named in the planning conversation were
 * swapped out for that reason. Keep answers out of the docs and out of chat.
 *
 * The rules a spec follows came out of the trial — docs/decisions/catchphrase.md:
 *
 * - **The scene never says the phrase.** The model letters what it is told, so
 *   a prompt that names the answer is a picture that can print it. Tested in
 *   `hand-catchphrase-data.test.ts`.
 * - **Lead with the thing that makes the joke.** The trial's first scene put a
 *   street and rain first and drew grounded pets under ordinary rain.
 * - **Wrong answers come from the picture's own subjects**, so the options
 *   cannot hand the answer over.
 * - **Mr Fries is in most new pictures, and none of the first 30.** A spec
 *   opts in with `fries`; its scene calls him "the character". When the
 *   drawings are picked, the one that ships has him on model, and nobody
 *   else's: a gold square drew SpongeBob twice. docs/decisions/mr-fries.md.
 */

export interface CatchphraseSpec {
  slug: string;
  correct: string;
  incorrect: string[];
  difficulty: Difficulty;
  /** What the picture shows, for the model. Never the phrase itself. */
  scene: string;
  /** The one piece of writing the puzzle needs — a word or a number, never the answer. */
  lettering?: string;
  /** Mr Fries is in the picture, and the scene calls him "the character". */
  fries?: boolean;
  /**
   * How the puzzle works, from the harder batch on (5 October 2026): one literal
   * scene, two things that make the phrase, a picture plus the one word or
   * number it needs, or a sound-alike that lands when said aloud. Set so the
   * next round's hit rate can be read by kind. The first thirty predate it.
   */
  kind?: 'scene' | 'rebus' | 'lettered' | 'soundalike';
  /**
   * Which drawn version ships. Absent until somebody has looked at the
   * drawings, and the pack writer refuses a spec without one.
   */
  seed?: number;
}

export const CATCHPHRASE_PROMPT = 'Say what you see';

/** Two default rounds. Not grown past this until the office has played it. */
export const CATCHPHRASE_MIN_PACK = 30;

/**
 * Greg, 2 October 2026: the 1980s look over the clay 3D the trial started with.
 * First in every prompt, because style placed later in the trial's prompts
 * drew some scenes flat and some in clay.
 */
export const CATCHPHRASE_STYLE =
  'Simple 1980s computer graphics animation still, like an early home-computer cartoon: flat bright colours, chunky simple shapes, thick black outlines, no shading, no texture, plain dark background.';

/**
 * What the model is asked for. Mflux's Turbo model ignores the negative prompt
 * ("never encoded", in its own help), so the ban on writing has to be here.
 */
export function promptFor(spec: CatchphraseSpec): string {
  const writing =
    spec.lettering === undefined
      ? 'No writing anywhere in the image.'
      : `${spec.lettering} is the only writing in the image.`;
  const cast = spec.fries ? `${MR_FRIES} ` : '';
  return `${CATCHPHRASE_STYLE} ${cast}${spec.scene} ${writing}`;
}

/**
 * Mr Fries, the house character — the show had Mr Chips. Greg chose this one,
 * the bean, from four on 5 October 2026; the chip-shop chip and the microchip
 * are kept as backups in docs/decisions/mr-fries.md.
 *
 * Described rather than named: a name in a prompt is a word the model may
 * letter into the picture. After the style and before the scene, which is
 * where it held across six scenes in the trial.
 */
export const MR_FRIES =
  'A cartoon character whose whole body is a single smooth rounded golden-yellow potato chip shaped like a bean, flat colour with no crumbs or speckles. It has two big round white eyes with black pupils, a wide happy smile, thin black stick arms with white cartoon gloves, and thin black stick legs with red trainers.';

/** A scene with him in it has to say who he is, or the model draws him idle. */
export function friesSceneOk(spec: CatchphraseSpec): boolean {
  return !spec.fries || /\bthe character\b/i.test(spec.scene);
}

/**
 * Most of what is added after the shipped pictures has him in it — more than
 * half, so an even split fails. The shipped ones are never counted: they are
 * not redrawn.
 */
export function friesShareOk(specs: CatchphraseSpec[], shipped: number): boolean {
  const added = specs.slice(shipped);
  return added.length === 0 || added.filter((spec) => spec.fries).length * 2 > added.length;
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Whether `text` says `answer`, ignoring case, punctuation and a leading
 * article. Whole words only, so a word the two share is not a match — a puzzle
 * is allowed to show part of its answer, never all of it.
 */
export function namesTheAnswer(text: string, answer: string): boolean {
  const core = fold(answer).replace(/^(a|an|the) /, '');
  return ` ${fold(text)} `.includes(` ${core} `);
}

export const CATCHPHRASE_SPECS: CatchphraseSpec[] = [
  {
    slug: 'cp-bull-china',
    correct: 'A bull in a china shop',
    incorrect: ['Take the bull by the horns', 'Like a red rag to a bull', 'Not my cup of tea'],
    difficulty: 'easy',
    scene: 'A big brown bull charging through a little shop full of shelves of china plates, teapots and teacups, with plates smashing and flying everywhere and a shocked shopkeeper behind the counter.',
    seed: 2,
  },
  {
    slug: 'cp-egg-face',
    correct: 'Egg on your face',
    incorrect: ['A good egg', 'Save face', "Don't put all your eggs in one basket"],
    difficulty: 'easy',
    scene: "A man's surprised face with a whole fried egg splattered right across it, the yolk dripping off his nose.",
    seed: 3,
  },
  {
    slug: 'cp-pigs-fly',
    correct: 'Pigs might fly',
    incorrect: ['Bring home the bacon', "Make a pig's ear of it", 'Fly off the handle'],
    difficulty: 'easy',
    scene: 'Three pink pigs with little white wings flying past the window of an aeroplane, the passengers inside staring at them.',
    seed: 2,
  },
  {
    slug: 'cp-couch-potato',
    correct: 'Couch potato',
    incorrect: ['Hot potato', 'Small potatoes', 'Meat and two veg'],
    difficulty: 'easy',
    scene: 'A big brown potato with a happy face lounging on a sofa, holding a television remote, a bowl of crisps beside it, watching television.',
    seed: 3,
  },
  {
    slug: 'cp-cat-bag',
    correct: 'Let the cat out of the bag',
    incorrect: ['Curiosity killed the cat', 'A bag of tricks', 'A mixed bag'],
    difficulty: 'easy',
    scene: 'A ginger cat leaping out of an open brown paper shopping bag, while the woman holding the bag gasps in surprise.',
    seed: 3,
  },
  {
    slug: 'cp-heart-sleeve',
    correct: 'Wear your heart on your sleeve',
    incorrect: ['Heart of gold', 'Something up your sleeve', 'A change of heart'],
    difficulty: 'easy',
    scene: 'A smiling man holding one arm straight out towards the viewer to show off the sleeve of his jumper, which has a big red heart sewn onto it near the cuff. The front of his jumper is plain.',
    seed: 2,
  },
  {
    slug: 'cp-cold-feet',
    correct: 'Cold feet',
    incorrect: ['Get the cold shoulder', 'Itchy feet', 'Skating on thin ice'],
    difficulty: 'easy',
    scene: 'A nervous groom in a suit, shown from head to toe, standing at a church altar beside his bride and shivering, with both of his shoes frozen solid inside big blocks of ice with icicles hanging off them.',
    seed: 2,
  },
  {
    slug: 'cp-top-dog',
    correct: 'Top dog',
    incorrect: ['Hot dog', "A dog's dinner", 'Top of the class'],
    difficulty: 'easy',
    scene: 'A small proud dog wearing a gold crown, standing at the very top of a tall wobbly pile of other dogs.',
    seed: 2,
  },
  {
    slug: 'cp-storm-teacup',
    correct: 'A storm in a teacup',
    incorrect: ['Not my cup of tea', 'The calm before the storm', 'Take the world by storm'],
    difficulty: 'medium',
    scene: 'A tiny dark thundercloud pouring rain and flashing a lightning bolt, sitting inside a china teacup on a saucer.',
    seed: 1,
  },
  {
    slug: 'cp-spill-beans',
    correct: 'Spill the beans',
    incorrect: ['Full of beans', 'Cry over spilt milk', 'Not worth a bean'],
    difficulty: 'medium',
    scene: 'A plain unlabelled tin knocked over on its side on a kitchen table, orange baked beans pouring out of it and sliding across the table.',
    seed: 2,
  },
  {
    slug: 'cp-under-weather',
    correct: 'Under the weather',
    incorrect: ['Right as rain', 'Weather the storm', "Steal someone's thunder"],
    difficulty: 'medium',
    scene: 'A poorly man in bed with a thermometer in his mouth, and a little grey rain cloud hovering over the bed, raining only on him.',
    seed: 2,
  },
  {
    slug: 'cp-cloud-nine',
    correct: 'On cloud nine',
    incorrect: ['Head in the clouds', 'Dressed to the nines', 'Cloud cuckoo land'],
    difficulty: 'medium',
    scene: 'A grinning woman sitting happily on top of a fluffy white cloud, with a big number 9 painted on the side of the cloud.',
    lettering: '9',
    seed: 1,
  },
  {
    slug: 'cp-bite-bullet',
    correct: 'Bite the bullet',
    incorrect: ['Dodge a bullet', 'A silver bullet', 'Sweating bullets'],
    difficulty: 'medium',
    scene: 'A man with his eyes squeezed shut, clenching a huge shiny brass bullet sideways between his teeth.',
    seed: 3,
  },
  {
    slug: 'cp-wrong-tree',
    correct: 'Barking up the wrong tree',
    incorrect: ['Let sleeping dogs lie', 'His bark is worse than his bite', "Can't see the wood for the trees"],
    difficulty: 'medium',
    scene: 'A dog barking up at an empty tree, while a cat sits smugly in the branches of a different tree right behind the dog.',
    seed: 2,
  },
  {
    slug: 'cp-pulling-leg',
    correct: 'Pulling your leg',
    incorrect: ['Break a leg', 'Cost an arm and a leg', 'Shake a leg'],
    difficulty: 'medium',
    scene: "One grinning man gripping another man's leg with both hands and pulling it hard like a rope, stretching the leg out long, while the other man hops on his other foot, arms flailing, about to topple over.",
    seed: 1,
  },
  {
    slug: 'cp-same-boat',
    correct: 'In the same boat',
    incorrect: ['Rock the boat', 'Miss the boat', 'Push the boat out'],
    difficulty: 'medium',
    scene: 'Two grumpy men who clearly dislike each other, squeezed together shoulder to shoulder into one tiny rowing boat on a lake.',
    seed: 2,
  },
  {
    slug: 'cp-eggshells',
    correct: 'Walking on eggshells',
    incorrect: ['Walking on air', "Don't put all your eggs in one basket", 'Walk all over someone'],
    difficulty: 'medium',
    scene: 'A man in his socks tiptoeing very carefully across a floor completely covered in broken eggshells, arms out for balance.',
    seed: 2,
  },
  {
    slug: 'cp-frog-throat',
    correct: 'A frog in your throat',
    incorrect: ['A lump in your throat', "Jump down someone's throat", 'Toad in the hole'],
    difficulty: 'medium',
    scene: 'A singer at a microphone trying to sing, with a green frog clearly visible sitting inside his see-through throat.',
    seed: 2,
  },
  {
    slug: 'cp-big-cheese',
    correct: 'The big cheese',
    incorrect: ['Say cheese', 'Cheesed off', 'A big fish in a small pond'],
    difficulty: 'medium',
    scene: 'A huge wedge of yellow cheese wearing a tie, sitting at the head of a long boardroom table, with business people in suits around the table listening to it.',
    seed: 1,
  },
  {
    slug: 'cp-two-peas',
    correct: 'Two peas in a pod',
    incorrect: ['Peace and quiet', 'Two heads are better than one', "Two's company"],
    difficulty: 'medium',
    scene: 'A pair of little green peas with happy faces, wearing matching outfits, sitting snugly side by side inside an open pea pod.',
    seed: 3,
  },
  {
    slug: 'cp-break-ice',
    correct: 'Break the ice',
    incorrect: ['Skating on thin ice', 'The tip of the iceberg', 'The cold shoulder'],
    difficulty: 'medium',
    scene: 'A party with balloons, and in the middle of the room a man in a party hat swinging a hammer at a giant block of ice, cracks spreading across it.',
    seed: 1,
  },
  {
    slug: 'cp-frying-pan',
    correct: 'Out of the frying pan, into the fire',
    incorrect: ['A flash in the pan', 'Playing with fire', 'Too many cooks spoil the broth'],
    difficulty: 'medium',
    scene: 'A frightened fried egg in mid-air, having just jumped out of a tilted frying pan, falling straight down towards a blazing campfire below it.',
    seed: 2,
  },
  {
    slug: 'cp-square-one',
    correct: 'Back to square one',
    incorrect: ['Back to the drawing board', 'Fair and square', 'A square meal'],
    difficulty: 'hard',
    scene: 'A board-game counter with little legs and a worried face, walking backwards along a board-game path onto the first square, which is marked with a big number 1.',
    lettering: '1',
    seed: 1,
  },
  {
    slug: 'cp-face-music',
    correct: 'Face the music',
    incorrect: ['Music to my ears', 'Save face', 'Change your tune'],
    difficulty: 'hard',
    scene: 'A man standing nose to nose with a giant black musical note as tall as he is, the two of them glaring at each other.',
    seed: 1,
  },
  {
    slug: 'cp-crystal-maze',
    correct: 'The Crystal Maze',
    incorrect: ['Gladiators', 'The Krypton Factor', 'Fort Boyard'],
    difficulty: 'hard',
    scene: 'A maze of tall walls made entirely of sparkling clear glass crystals, seen from above at an angle, with one little person lost in the middle of it.',
    seed: 3,
  },
  {
    slug: 'cp-fools-horses',
    correct: 'Only Fools and Horses',
    incorrect: ['Black Beauty', 'The Fall Guy', 'Steptoe and Son'],
    difficulty: 'hard',
    scene: 'Two horses standing in a field beside two court jesters in jester hats with bells, and the single word ONLY in big white capital letters above them.',
    lettering: 'ONLY',
    seed: 2,
  },
  {
    slug: 'cp-neighbours',
    correct: 'Neighbours',
    incorrect: ['Home and Away', 'Black Beauty', 'The Good Life'],
    difficulty: 'hard',
    scene: 'Two horses leaning over a garden fence towards each other, both neighing loudly and gossiping.',
    seed: 2,
  },
  {
    slug: 'cp-dads-army',
    correct: "Dad's Army",
    incorrect: ['Father Ted', "It Ain't Half Hot Mum", 'Soldier Soldier'],
    difficulty: 'hard',
    scene: "A line of soldiers in old wartime uniforms marching in step, every one of them a father pushing a baby's pram.",
    seed: 2,
  },
  {
    slug: 'cp-daylight-robbery',
    correct: 'Daylight robbery',
    incorrect: ['Make hay while the sun shines', 'Rob Peter to pay Paul', 'A place in the sun'],
    difficulty: 'hard',
    scene: 'A burglar in a black eye mask and a striped jumper climbing down a ladder from the sky, carrying the shining sun away in a sack over his shoulder.',
    seed: 1,
  },
  {
    slug: 'cp-penny-thoughts',
    correct: 'A penny for your thoughts',
    incorrect: ['The penny dropped', 'Spend a penny', 'Lost in thought'],
    difficulty: 'hard',
    scene: 'A man deep in thought with his chin on his hand, and a big shiny plain copper coin floating inside the thought bubble above his head. The coin is blank, with no symbols or markings on it.',
    seed: 2,
  },
  // The harder batch, 5 October 2026 — docs/decisions/catchphrase-harder.md.
  // Appended, never inserted: the first thirty are pinned by hash.
  {
    slug: 'cp-head-over-heels',
    kind: 'rebus',
    correct: 'Head over heels',
    incorrect: ['Head in the clouds', 'Dig your heels in', 'Keep your head down'],
    difficulty: 'medium',
    scene: 'A big round cartoon head with a surprised face floats in the air directly above a pair of shiny red high-heeled shoes standing empty on the floor. Nothing else is in the picture.',
    seed: 2,
  },
  {
    slug: 'cp-third-wheel',
    kind: 'lettered',
    fries: true,
    correct: 'Third wheel',
    incorrect: ['Reinvent the wheel', 'Third time lucky', 'Wheel of Fortune'],
    difficulty: 'hard',
    scene: 'A young couple sit close together on a park bench holding hands, and the character sits squeezed between them looking awkward, holding up a large bicycle wheel with 3RD painted on it in big white letters.',
    lettering: '3RD',
    seed: 2,
  },
  {
    slug: 'cp-two-left-feet',
    kind: 'lettered',
    fries: true,
    correct: 'Two left feet',
    incorrect: ['Put your best foot forward', 'Get off on the wrong foot', 'Footloose and fancy-free'],
    difficulty: 'medium',
    scene: 'The character is dancing clumsily on a dance floor and tripping over. Both of its red trainers are left shoes pointing the same way, and each trainer has a big white letter L on it.',
    lettering: 'L',
    seed: 2,
  },
  {
    slug: 'cp-catch-22',
    kind: 'lettered',
    fries: true,
    correct: 'Catch-22',
    incorrect: ['Catch of the day', 'Catch your breath', 'Catch me if you can'],
    difficulty: 'medium',
    scene: 'The character is diving through the air with both gloved hands outstretched to catch a giant red number 22 flying towards it like a ball.',
    lettering: '22',
    seed: 1,
  },
  {
    slug: 'cp-back-future',
    kind: 'lettered',
    fries: true,
    correct: 'Back to the Future',
    incorrect: ['Back to School', 'Turn Back Time', 'The Shape of Things to Come'],
    difficulty: 'hard',
    scene: 'The character is seen from behind, its back turned to the viewer, walking down a long corridor towards a glowing doorway with a sign above it that says FUTURE.',
    lettering: 'FUTURE',
    seed: 3,
  },
  {
    slug: 'cp-top-gun',
    kind: 'rebus',
    fries: true,
    correct: 'Top Gun',
    incorrect: ['Top of the Pops', 'Top Cat', 'Young Guns'],
    difficulty: 'medium',
    scene: 'The character is balancing on a huge spinning wooden toy top, waving a toy cowboy pistol in the air.',
    seed: 1,
  },
  {
    slug: 'cp-countdown',
    kind: 'soundalike',
    correct: 'Countdown',
    incorrect: ['Count Duckula', 'Downtown', 'Going Underground'],
    difficulty: 'hard',
    scene: 'A cartoon vampire count in a black cape with a high collar and slicked-back hair whizzes head first along a long playground slide towards the ground, looking delighted.',
    seed: 1,
  },
  {
    slug: 'cp-blind-date',
    kind: 'soundalike',
    fries: true,
    correct: 'Blind Date',
    incorrect: ['Turn a blind eye', "Blind man's buff", 'Out of date'],
    difficulty: 'hard',
    scene: 'A big brown date fruit with a little face, wearing round dark sunglasses and tapping a white walking cane, is being helped across a zebra crossing by the character, who holds its arm.',
    seed: 3,
  },
  {
    slug: 'cp-red-dwarf',
    kind: 'scene',
    fries: true,
    correct: 'Red Dwarf',
    incorrect: ['Seeing red', 'Red alert', 'Lost in Space'],
    difficulty: 'medium',
    scene: 'A small bearded dwarf with a pointy hat, coloured bright red from head to toe, shakes hands with the character on the deck of a spaceship with stars outside the window.',
    seed: 1,
  },
  {
    slug: 'cp-spring-leak',
    kind: 'rebus',
    fries: true,
    correct: 'Spring a leak',
    incorrect: ['No spring chicken', 'Spring into action', 'Spring cleaning'],
    difficulty: 'hard',
    scene: 'The character proudly holds up a big shiny coiled metal spring in one gloved hand and a long green and white leek vegetable in the other.',
    seed: 1,
  },
  {
    slug: 'cp-sole-mates',
    kind: 'soundalike',
    correct: 'Soul mates',
    incorrect: ['Best of mates', 'Birds of a feather', 'A match made in heaven'],
    difficulty: 'hard',
    scene: 'Two shoe soles, the flat rubber undersides of shoes, each with a smiling face, walk along hand in hand under a big pink heart.',
    seed: 1,
  },
  {
    slug: 'cp-pull-muscle',
    kind: 'soundalike',
    fries: true,
    correct: 'Pull a muscle',
    incorrect: ['Pull your weight', 'Flex your muscles', 'Pull your socks up'],
    difficulty: 'hard',
    scene: 'The character is straining to drag a giant blue-black mussel shellfish along the ground on a thick rope over its shoulder.',
    seed: 1,
  },
  {
    slug: 'cp-time-flies',
    kind: 'soundalike',
    fries: true,
    correct: 'Time flies',
    incorrect: ['Time is money', 'A flying visit', 'Time out'],
    difficulty: 'hard',
    scene: 'A little flowerpot of the herb thyme, labelled THYME, has sprouted white feathered wings and is flying away across the sky while the character waves goodbye.',
    lettering: 'THYME',
    seed: 3,
  },
  {
    slug: 'cp-bear-with-me',
    kind: 'rebus',
    fries: true,
    correct: 'Bear with me',
    incorrect: ['Bear a grudge', 'Like a bear with a sore head', 'Pleased to meet you'],
    difficulty: 'medium',
    scene: 'The character stands arm in arm with a big friendly brown bear, pointing at itself with its free gloved thumb and grinning.',
    seed: 2,
  },
  {
    slug: 'cp-flower-power',
    kind: 'soundalike',
    fries: true,
    correct: 'Flower power',
    incorrect: ['Power nap', 'In full bloom', 'Power to the people'],
    difficulty: 'hard',
    scene: 'A plump paper sack of flour labelled FLOUR, with big muscly arms, lifts a heavy barbell above its head in a gym while the character cheers it on.',
    lettering: 'FLOUR',
    seed: 1,
  },
  {
    slug: 'cp-night-town',
    kind: 'soundalike',
    correct: 'A night on the town',
    incorrect: ['A knight in shining armour', 'Paint the town red', 'Up all night'],
    difficulty: 'hard',
    scene: 'A giant knight in silver armour strides carefully through a tiny model town, stepping between the little houses and church spires.',
    seed: 1,
  },
  {
    slug: 'cp-hair-raising',
    kind: 'soundalike',
    fries: true,
    correct: 'Hair-raising',
    incorrect: ['Mad as a March hare', 'Raise the roof', 'Splitting hairs'],
    difficulty: 'hard',
    scene: 'The character is lifting a surprised brown hare high above its head with both gloved hands, like a weightlifter holding up a trophy.',
    seed: 1,
  },
  {
    slug: 'cp-brainwave',
    kind: 'rebus',
    fries: true,
    correct: 'Brainwave',
    incorrect: ['Brainstorm', 'Mexican wave', 'Brain freeze'],
    difficulty: 'medium',
    scene: 'A pink cartoon brain with a smiling face and little arms is waving hello, and the character waves back at it.',
    seed: 1,
  },
  {
    slug: 'cp-butterfingers',
    kind: 'rebus',
    correct: 'Butterfingers',
    incorrect: ['Fingers crossed', 'Bread and butter', "Butter wouldn't melt in your mouth"],
    difficulty: 'medium',
    scene: 'A cartoon hand whose five fingers are yellow sticks of butter lets go of a plate, which smashes on the floor below.',
    seed: 1,
  },
  {
    slug: 'cp-bigwig',
    kind: 'rebus',
    fries: true,
    correct: 'Bigwig',
    incorrect: ['Big shot', 'Flip your wig', 'Too big for your boots'],
    difficulty: 'medium',
    scene: "The character is wearing an enormous curly white judge's wig, many times larger than itself, and peers out from underneath it.",
    seed: 2,
  },
  {
    slug: 'cp-cheapskate',
    kind: 'soundalike',
    correct: 'Cheapskate',
    incorrect: ['Cheap and cheerful', 'Skating on thin ice', 'Chicken feed'],
    difficulty: 'hard',
    scene: 'A fluffy yellow baby chick rolls along on a single roller skate, with a speech bubble coming from its beak that says CHEEP.',
    lettering: 'CHEEP',
    seed: 1,
  },
  {
    slug: 'cp-pie-sky',
    kind: 'scene',
    correct: 'Pie in the sky',
    incorrect: ['Easy as pie', 'The sky is the limit', 'Reach for the sky'],
    difficulty: 'medium',
    scene: 'A golden pie with a crinkled crust floats high up among the clouds of a bright blue sky, with a bird flying past it.',
    seed: 2,
  },
  {
    slug: 'cp-cool-cucumber',
    kind: 'scene',
    fries: true,
    correct: 'Cool as a cucumber',
    incorrect: ['Hot under the collar', 'Cool, calm and collected', 'As cold as ice'],
    difficulty: 'medium',
    scene: 'A cucumber wearing sunglasses lounges calmly in a deckchair with a cold drink, while the character stands beside it sweating in the heat.',
    seed: 2,
  },
  {
    slug: 'cp-cat-tongue',
    kind: 'scene',
    fries: true,
    correct: 'Cat got your tongue',
    incorrect: ['Hold your tongue', 'Curiosity killed the cat', 'Bite your tongue'],
    difficulty: 'medium',
    scene: 'A grinning ginger cat runs off holding a long pink tongue in its mouth, while the character stares after it with its mouth wide open and empty.',
    seed: 1,
  },
  {
    slug: 'cp-candle-ends',
    kind: 'scene',
    fries: true,
    correct: 'Burn the candle at both ends',
    incorrect: ['Burn the midnight oil', "Can't hold a candle to", 'Burn your bridges'],
    difficulty: 'medium',
    scene: 'The character holds one single long white candle level across its body with both gloved hands. The candle is lit at both ends: one bright flame burns at the left end and another bright flame burns at the right end. The character looks exhausted, with heavy drooping eyelids and dark rings under its eyes. There is only one candle.',
    seed: 2,
  },
  {
    slug: 'cp-silver-lining',
    kind: 'scene',
    fries: true,
    correct: 'Every cloud has a silver lining',
    incorrect: ['Under a cloud', 'Head in the clouds', 'Born with a silver spoon'],
    difficulty: 'medium',
    scene: 'The character smiles up at a dark grey rain cloud above it whose edges shine bright metallic silver.',
    seed: 3,
  },
  {
    slug: 'cp-hold-horses',
    kind: 'scene',
    fries: true,
    correct: 'Hold your horses',
    incorrect: ["Straight from the horse's mouth", 'Hold the fort', "Wild horses couldn't drag me away"],
    difficulty: 'medium',
    scene: 'The character leans back with all its might, pulling on the reins of two galloping horses to stop them.',
    seed: 3,
  },
  {
    slug: 'cp-bury-hatchet',
    kind: 'scene',
    fries: true,
    correct: 'Bury the hatchet',
    incorrect: ['Bury your head in the sand', 'Have an axe to grind', 'Dig your own grave'],
    difficulty: 'medium',
    scene: 'The character is digging a hole in a garden with a spade and lowering a small axe into it.',
    seed: 3,
  },
  {
    slug: 'cp-sweet-shop',
    kind: 'scene',
    correct: 'Like a kid in a sweet shop',
    incorrect: ['Have a sweet tooth', 'Like taking candy from a baby', 'Shop till you drop'],
    difficulty: 'medium',
    scene: 'A small boy with wide amazed eyes stands in an old-fashioned shop surrounded by shelves of tall glass jars full of colourful sweets.',
    seed: 3,
  },
  {
    slug: 'cp-second-hand',
    kind: 'rebus',
    correct: 'Second-hand',
    incorrect: ['Against the clock', 'Second nature', 'Hands down'],
    difficulty: 'hard',
    scene: 'A big round wall clock with plain dots instead of numbers, whose thinnest, fastest hand is a tiny white cartoon glove pointing with one finger as it ticks around the face.',
    seed: 2,
  },
  // The third batch, 6 October 2026 — docs/decisions/catchphrase-batch-3.md.
  // Appended, never inserted: the first sixty are pinned by hash.
  {
    slug: 'cp-hot-water',
    kind: 'scene',
    fries: true,
    correct: 'In hot water',
    incorrect: ['A watched pot never boils', 'Keep your head above water', 'Too hot to handle'],
    difficulty: 'medium',
    scene: 'The character sits in a big steel cooking pot full of bubbling, steaming water on a lit gas hob, with the water up to its middle and blue flames under the pot. It looks very worried and is sweating.',
  },
  {
    slug: 'cp-crocodile-tears',
    kind: 'scene',
    correct: 'Crocodile tears',
    incorrect: ['See you later, alligator', 'Cry your eyes out', 'Cry Me a River'],
    difficulty: 'medium',
    scene: 'A big green crocodile sits on a riverbank sobbing, with huge blue teardrops streaming from its eyes and splashing into puddles, and it dabs its eyes with a white handkerchief.',
  },
  {
    slug: 'cp-nutshell',
    kind: 'scene',
    fries: true,
    correct: 'In a nutshell',
    incorrect: ['A tough nut to crack', 'Nuts and bolts', 'Snug as a bug in a rug'],
    difficulty: 'medium',
    scene: 'The character sits snugly inside one half of a giant cracked-open walnut, peeking over the rim and smiling. The walnut shell is light brown, hard and deeply wrinkled all over like a brain, the other wrinkled half lies beside it, and a few small whole walnuts are scattered nearby.',
  },
  {
    slug: 'cp-bed-roses',
    kind: 'scene',
    fries: true,
    correct: 'A bed of roses',
    incorrect: ['Come up smelling of roses', "You've made your bed, now lie in it", 'Roses are red'],
    difficulty: 'medium',
    scene: 'The character lies back happily, gloved hands behind its head, on a bed whose mattress is made entirely of hundreds of red roses, with rose petals for a pillow.',
  },
  {
    slug: 'cp-goose-chase',
    kind: 'scene',
    fries: true,
    correct: 'A wild goose chase',
    incorrect: ['Your goose is cooked', 'Chasing rainbows', 'Running around like a headless chicken'],
    difficulty: 'medium',
    scene: 'The character runs flat out across a muddy field with its arms outstretched, chasing a big white goose that has wild staring eyes and flapping wings and is running away from it.',
  },
  {
    slug: 'cp-by-a-thread',
    kind: 'scene',
    fries: true,
    correct: 'Hanging by a thread',
    incorrect: ['Hang in there', 'Lose the thread', 'Cliffhanger'],
    difficulty: 'medium',
    scene: 'The character dangles high in the air, holding on with both gloved hands to one single thin white sewing thread that unwinds from a giant wooden cotton reel at the top of the picture, above a deep dark drop.',
  },
  {
    slug: 'cp-egyptian',
    kind: 'scene',
    fries: true,
    correct: 'Walk Like an Egyptian',
    incorrect: ['Walk This Way', 'Walking on Sunshine', 'Death on the Nile'],
    difficulty: 'hard',
    scene: 'The character wears an ancient Egyptian striped headdress and strides sideways across the desert sand in front of the pyramids in a flat side-on pose, one arm bent up in front of it and one bent down behind, like the figures in ancient Egyptian paintings.',
  },
  {
    slug: 'cp-supermarket-sweep',
    kind: 'scene',
    fries: true,
    correct: 'Supermarket Sweep',
    incorrect: ['Sweep it under the carpet', 'A clean sweep', 'Open All Hours'],
    difficulty: 'medium',
    scene: 'The character pushes a big wide broom along a supermarket aisle, sweeping a pile of spilt groceries ahead of it, between tall shelves stacked with plain unlabelled tins and boxes, with an empty shopping trolley beside it.',
  },
  {
    slug: 'cp-dances-wolves',
    kind: 'scene',
    fries: true,
    correct: 'Dances with Wolves',
    incorrect: ['Hungry Like the Wolf', 'Strictly Come Dancing', "A wolf in sheep's clothing"],
    difficulty: 'medium',
    scene: 'The character dances happily hand in paw with two big grey wolves, all three kicking up their legs in a ring in a moonlit forest clearing.',
  },
  {
    slug: 'cp-ghostbusters',
    kind: 'rebus',
    fries: true,
    correct: 'Ghostbusters',
    incorrect: ['Ghost', 'Summer Holiday', 'Casper'],
    difficulty: 'medium',
    scene: 'A friendly white bedsheet ghost with two round black eye holes sits at the steering wheel driving a red double-decker bus along a street at night, and the character rides as a passenger, waving from an upstairs window. The bus has no signs and no numbers.',
  },
  {
    slug: 'cp-cash-cow',
    kind: 'rebus',
    fries: true,
    correct: 'Cash cow',
    incorrect: ['Till the cows come home', "Money doesn't grow on trees", 'Holy cow'],
    difficulty: 'medium',
    scene: 'The character sits on a milking stool milking a black and white cow, but instead of milk, shiny plain gold coins pour out into the metal bucket and overflow onto the straw.',
  },
  {
    slug: 'cp-monkey-business',
    kind: 'rebus',
    correct: 'Monkey business',
    incorrect: ['Monkey see, monkey do', 'Business as usual', 'Cheeky monkey'],
    difficulty: 'medium',
    scene: 'Three brown monkeys wearing smart grey office suits and ties mess about in an office: one swings from the ceiling light, one throws paper aeroplanes, and one sits at a desk typing on a computer with its feet. The computer screen is blank.',
  },
  {
    slug: 'cp-snail-mail',
    kind: 'rebus',
    fries: true,
    correct: 'Snail mail',
    incorrect: ["At a snail's pace", 'Return to sender', "You've Got Mail"],
    difficulty: 'medium',
    scene: "A big garden snail wearing a little red postman's cap crawls slowly up a garden path with a large plain white envelope strapped on top of its shell, while the character waits at the front door with its arms folded, tapping one foot.",
  },
  {
    slug: 'cp-breadwinner',
    kind: 'rebus',
    correct: 'Breadwinner',
    incorrect: ['The best thing since sliced bread', 'The Winner Takes It All', 'Use your loaf'],
    difficulty: 'medium',
    scene: 'A smiling brown loaf of bread with little arms and legs holds a big gold trophy cup high above its head and wears a gold medal on a ribbon, while confetti falls all around it.',
  },
  {
    slug: 'cp-lip-service',
    kind: 'rebus',
    fries: true,
    correct: 'Lip service',
    incorrect: ['My lips are sealed', 'Read my lips', 'Room service'],
    difficulty: 'hard',
    scene: 'A giant pair of bright red lips with two little arms, dressed as a waiter with a black bow tie and a white cloth over one arm, carries a silver tray with a glass of lemonade to the character, who sits at a small round cafe table.',
  },
  {
    slug: 'cp-heartbeat',
    kind: 'rebus',
    fries: true,
    correct: 'Heartbeat',
    incorrect: ['Beat It', 'Heart of Glass', 'Heart and Soul'],
    difficulty: 'medium',
    scene: 'A big red cartoon heart with a happy face and little arms sits at a drum kit, beating the drums hard with two drumsticks, while the character dances beside it. The drums are plain, with no logo.',
  },
  {
    slug: 'cp-dog-eared',
    kind: 'rebus',
    correct: 'Dog-eared',
    incorrect: ["A dog's life", 'All ears', 'Read between the lines'],
    difficulty: 'hard',
    scene: "A thick closed hardback book with a plain red cover has a pair of big floppy brown dog's ears sticking up from the top of its pages and a wagging dog's tail at the back. It sits alone on a wooden table.",
  },
  {
    slug: 'cp-piece-cake',
    kind: 'rebus',
    fries: true,
    correct: 'A piece of cake',
    incorrect: ['The icing on the cake', 'Fall to pieces', 'Have your cake and eat it'],
    difficulty: 'medium',
    scene: 'The character pushes the last missing piece into a big jigsaw puzzle on a table, and that one jigsaw piece is made of sponge cake, with a layer of jam and cream in the middle and white icing on top.',
  },
  {
    slug: 'cp-forty-winks',
    kind: 'lettered',
    fries: true,
    correct: 'Forty winks',
    incorrect: ['Life begins at forty', 'Sleep like a log', 'Nudge nudge, wink wink'],
    difficulty: 'medium',
    scene: 'The character naps in a comfy armchair with a cheeky sleepy wink, one eye shut and the other half open, and a big white number 40 floats in the air above its head.',
    lettering: '40',
  },
  {
    slug: 'cp-go-bananas',
    kind: 'lettered',
    fries: true,
    correct: 'Go bananas',
    incorrect: ['Top banana', 'Go for gold', 'Banana split'],
    difficulty: 'medium',
    scene: 'The character dances wildly with its arms flung in the air on top of a huge heap of yellow bananas, next to a traffic light whose glowing green light shows the word GO.',
    lettering: 'GO',
  },
  {
    slug: 'cp-new-leaf',
    kind: 'lettered',
    fries: true,
    correct: 'Turn over a new leaf',
    incorrect: ['Shake like a leaf', 'As good as new', 'Turn the tables'],
    difficulty: 'medium',
    scene: 'The character heaves a giant green leaf, much bigger than itself, over onto its other side like turning a huge page, and the word NEW is painted in big white letters on the leaf.',
    lettering: 'NEW',
  },
  {
    slug: 'cp-ps-qs',
    kind: 'lettered',
    fries: true,
    correct: 'Mind your Ps and Qs',
    incorrect: ["Dot the i's and cross the t's", 'Mind the gap', 'Easy as ABC'],
    difficulty: 'hard',
    scene: 'The character, wearing a frilly white apron like a nanny, keeps a careful eye on a playpen full of toddler-sized capital letter P and capital letter Q shapes with little faces, crawling about.',
    lettering: 'P and Q',
  },
  {
    slug: 'cp-x-marks',
    kind: 'lettered',
    fries: true,
    correct: 'X marks the spot',
    incorrect: ['Treasure Island', 'Pieces of eight', 'Spot on'],
    difficulty: 'medium',
    scene: 'On a small sandy desert island with one palm tree, the character digs with a spade at a big red X painted on the sand, and the corner of a wooden treasure chest pokes out of the hole.',
    lettering: 'X',
  },
  {
    slug: 'cp-seal-approval',
    kind: 'soundalike',
    correct: 'Seal of approval',
    incorrect: ['Signed, Sealed, Delivered', 'Sealed with a Kiss', 'Pen pusher'],
    difficulty: 'medium',
    scene: 'A happy grey seal sits at an office desk holding a big rubber stamp in its flipper and stamping a large green tick mark onto a sheet of paper, with a neat pile of papers beside it.',
  },
  {
    slug: 'cp-foul-play',
    kind: 'soundalike',
    fries: true,
    correct: 'Foul play',
    incorrect: ['Play chicken', "Don't count your chickens", 'A game of two halves'],
    difficulty: 'hard',
    scene: 'Two white hens are playing football on a grassy pitch, and one hen sneakily sticks out its leg and trips the other hen over, while the character, as the referee, blows a whistle and holds up a red card.',
  },
  {
    slug: 'cp-sunday-best',
    kind: 'soundalike',
    correct: 'Sunday best',
    incorrect: ['The cherry on top', 'Sunday roast', 'All dressed up and nowhere to go'],
    difficulty: 'hard',
    scene: 'A tall ice-cream sundae in a glass, with scoops of ice cream, chocolate sauce, wafers and a cherry on top, is dressed up in its finest clothes, a little black top hat, a red bow tie and a flower pinned on, and admires itself in a mirror.',
  },
  {
    slug: 'cp-main-event',
    kind: 'soundalike',
    correct: 'The main event',
    incorrect: ["The lion's share", 'Throw in the towel', 'Saved by the bell'],
    difficulty: 'hard',
    scene: 'A proud lion with an enormous fluffy golden mane, many times bigger than its head, stands in the middle of a boxing ring under bright spotlights, wearing red boxing gloves and raising them in victory.',
  },
  {
    slug: 'cp-plan-b',
    kind: 'soundalike',
    correct: 'Plan B',
    incorrect: ['Busy as a bee', 'The best-laid plans', 'A bee in your bonnet'],
    difficulty: 'hard',
    scene: "A cartoon honeybee wearing a yellow builder's hard hat studies a big blue architect's blueprint of a house spread out on a table, pointing at it with one leg. The blueprint has only white lines on it.",
  },
  {
    slug: 'cp-wait-see',
    kind: 'soundalike',
    fries: true,
    correct: 'Wait and see',
    incorrect: ['All at sea', 'A weight off your shoulders', 'Watch this space'],
    difficulty: 'hard',
    scene: 'A giant black iron kettlebell, the round gym weight with a handle on top, drops into a calm blue sea with a big splash, while the character watches from the beach holding a stopwatch.',
  },
  {
    slug: 'cp-nosy-parker',
    kind: 'soundalike',
    correct: 'Nosy parker',
    incorrect: ['Keep your nose clean', 'Follow your nose', 'Back-seat driver'],
    difficulty: 'hard',
    scene: 'A giant cartoon nose with two eyes and little arms sits behind the steering wheel of a small red car, carefully reversing it into a parking space between two other cars, marked by white lines on the ground.',
  },
];
