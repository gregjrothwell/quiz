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
  return `${CATCHPHRASE_STYLE} ${spec.scene} ${writing}`;
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
  },
  {
    slug: 'cp-egg-face',
    correct: 'Egg on your face',
    incorrect: ['A good egg', 'Save face', "Don't put all your eggs in one basket"],
    difficulty: 'easy',
    scene: "A man's surprised face with a whole fried egg splattered right across it, the yolk dripping off his nose.",
  },
  {
    slug: 'cp-pigs-fly',
    correct: 'Pigs might fly',
    incorrect: ['Bring home the bacon', "Make a pig's ear of it", 'Time flies'],
    difficulty: 'easy',
    scene: 'Three pink pigs with little white wings flying past the window of an aeroplane, the passengers inside staring at them.',
  },
  {
    slug: 'cp-couch-potato',
    correct: 'Couch potato',
    incorrect: ['Hot potato', 'Small potatoes', 'Meat and two veg'],
    difficulty: 'easy',
    scene: 'A big brown potato with a happy face lounging on a sofa, holding a television remote, a bowl of crisps beside it, watching television.',
  },
  {
    slug: 'cp-cat-bag',
    correct: 'Let the cat out of the bag',
    incorrect: ['Curiosity killed the cat', 'Cat got your tongue', 'A mixed bag'],
    difficulty: 'easy',
    scene: 'A ginger cat leaping out of an open brown paper shopping bag, while the woman holding the bag gasps in surprise.',
  },
  {
    slug: 'cp-heart-sleeve',
    correct: 'Wear your heart on your sleeve',
    incorrect: ['Heart of gold', 'Something up your sleeve', 'A change of heart'],
    difficulty: 'easy',
    scene: 'A smiling man in a jumper with a big red heart stitched onto the outside of his sleeve, proudly pointing at it.',
  },
  {
    slug: 'cp-cold-feet',
    correct: 'Cold feet',
    incorrect: ['Get the cold shoulder', 'Itchy feet', 'Skating on thin ice'],
    difficulty: 'easy',
    scene: 'A nervous groom in a suit standing at a church altar, both of his feet frozen solid inside big blocks of ice, shivering.',
  },
  {
    slug: 'cp-top-dog',
    correct: 'Top dog',
    incorrect: ['Hot dog', "A dog's dinner", 'Top of the class'],
    difficulty: 'easy',
    scene: 'A small proud dog wearing a gold crown, standing at the very top of a tall wobbly pile of other dogs.',
  },
  {
    slug: 'cp-storm-teacup',
    correct: 'A storm in a teacup',
    incorrect: ['Not my cup of tea', 'The calm before the storm', 'Take the world by storm'],
    difficulty: 'medium',
    scene: 'A tiny dark thundercloud pouring rain and flashing a lightning bolt, sitting inside a china teacup on a saucer.',
  },
  {
    slug: 'cp-spill-beans',
    correct: 'Spill the beans',
    incorrect: ['Full of beans', 'Cry over spilt milk', 'Not worth a bean'],
    difficulty: 'medium',
    scene: 'A plain unlabelled tin knocked over on its side on a kitchen table, orange baked beans pouring out of it and sliding across the table.',
  },
  {
    slug: 'cp-under-weather',
    correct: 'Under the weather',
    incorrect: ['Right as rain', 'Weather the storm', "Steal someone's thunder"],
    difficulty: 'medium',
    scene: 'A poorly man in bed with a thermometer in his mouth, and a little grey rain cloud hovering over the bed, raining only on him.',
  },
  {
    slug: 'cp-cloud-nine',
    correct: 'On cloud nine',
    incorrect: ['Head in the clouds', 'Dressed to the nines', 'Every cloud has a silver lining'],
    difficulty: 'medium',
    scene: 'A grinning woman sitting happily on top of a fluffy white cloud, with a big number 9 painted on the side of the cloud.',
    lettering: '9',
  },
  {
    slug: 'cp-bite-bullet',
    correct: 'Bite the bullet',
    incorrect: ['Dodge a bullet', 'A silver bullet', 'Sweating bullets'],
    difficulty: 'medium',
    scene: 'A man with his eyes squeezed shut, clenching a huge shiny brass bullet sideways between his teeth.',
  },
  {
    slug: 'cp-wrong-tree',
    correct: 'Barking up the wrong tree',
    incorrect: ['Let sleeping dogs lie', 'His bark is worse than his bite', "Can't see the wood for the trees"],
    difficulty: 'medium',
    scene: 'A dog barking up at an empty tree, while a cat sits smugly in the branches of a different tree right behind the dog.',
  },
  {
    slug: 'cp-pulling-leg',
    correct: 'Pulling your leg',
    incorrect: ['Break a leg', 'Cost an arm and a leg', 'Shake a leg'],
    difficulty: 'medium',
    scene: "One grinning man pulling hard on another man's leg with both hands, while the other man hops and wobbles on his one free foot.",
  },
  {
    slug: 'cp-same-boat',
    correct: 'In the same boat',
    incorrect: ['Rock the boat', 'Miss the boat', 'Push the boat out'],
    difficulty: 'medium',
    scene: 'Two grumpy men who clearly dislike each other, squeezed together shoulder to shoulder into one tiny rowing boat on a lake.',
  },
  {
    slug: 'cp-eggshells',
    correct: 'Walking on eggshells',
    incorrect: ['Walking on air', "Don't put all your eggs in one basket", 'Walk all over someone'],
    difficulty: 'medium',
    scene: 'A man in his socks tiptoeing very carefully across a floor completely covered in broken eggshells, arms out for balance.',
  },
  {
    slug: 'cp-frog-throat',
    correct: 'A frog in your throat',
    incorrect: ['A lump in your throat', "Jump down someone's throat", 'Toad in the hole'],
    difficulty: 'medium',
    scene: 'A singer at a microphone trying to sing, with a green frog clearly visible sitting inside his see-through throat.',
  },
  {
    slug: 'cp-big-cheese',
    correct: 'The big cheese',
    incorrect: ['Say cheese', 'Cheesed off', 'A big fish in a small pond'],
    difficulty: 'medium',
    scene: 'A huge wedge of yellow cheese wearing a tie, sitting at the head of a long boardroom table, with business people in suits around the table listening to it.',
  },
  {
    slug: 'cp-two-peas',
    correct: 'Two peas in a pod',
    incorrect: ['Peace and quiet', 'Two left feet', "Two's company"],
    difficulty: 'medium',
    scene: 'A pair of little green peas with happy faces, wearing matching outfits, sitting snugly side by side inside an open pea pod.',
  },
  {
    slug: 'cp-break-ice',
    correct: 'Break the ice',
    incorrect: ['Skating on thin ice', 'The tip of the iceberg', 'Cool as a cucumber'],
    difficulty: 'medium',
    scene: 'A party with balloons, and in the middle of the room a man in a party hat swinging a hammer at a giant block of ice, cracks spreading across it.',
  },
  {
    slug: 'cp-frying-pan',
    correct: 'Out of the frying pan, into the fire',
    incorrect: ['A flash in the pan', 'Playing with fire', 'Too many cooks spoil the broth'],
    difficulty: 'medium',
    scene: 'A fried egg with a scared face leaping out of a frying pan and heading straight down into a blazing campfire.',
  },
  {
    slug: 'cp-square-one',
    correct: 'Back to square one',
    incorrect: ['Back to the drawing board', 'Fair and square', 'A square meal'],
    difficulty: 'hard',
    scene: 'A board-game counter with little legs and a worried face, walking backwards along a board-game path onto the first square, which is marked with a big number 1.',
    lettering: '1',
  },
  {
    slug: 'cp-face-music',
    correct: 'Face the music',
    incorrect: ['Music to my ears', 'Save face', 'Change your tune'],
    difficulty: 'hard',
    scene: 'A man standing nose to nose with a giant black musical note as tall as he is, the two of them glaring at each other.',
  },
  {
    slug: 'cp-tongue-cheek',
    correct: 'Tongue in cheek',
    incorrect: ['Cat got your tongue', 'Turn the other cheek', 'Bite your tongue'],
    difficulty: 'hard',
    scene: 'A close-up of a cheeky face with a big round bulge in one cheek where the tongue is pushing it out from the inside, one eyebrow raised.',
  },
  {
    slug: 'cp-fools-horses',
    correct: 'Only Fools and Horses',
    incorrect: ['Black Beauty', 'The Fall Guy', 'Steptoe and Son'],
    difficulty: 'hard',
    scene: 'Two horses standing in a field beside two court jesters in jester hats with bells, and the single word ONLY in big white capital letters above them.',
    lettering: 'ONLY',
  },
  {
    slug: 'cp-neighbours',
    correct: 'Neighbours',
    incorrect: ['Home and Away', 'Black Beauty', 'The Good Life'],
    difficulty: 'hard',
    scene: 'Two horses leaning over a garden fence towards each other, both neighing loudly and gossiping.',
  },
  {
    slug: 'cp-dads-army',
    correct: "Dad's Army",
    incorrect: ['Father Ted', "It Ain't Half Hot Mum", 'Soldier Soldier'],
    difficulty: 'hard',
    scene: "A line of soldiers in old wartime uniforms marching in step, every one of them a father pushing a baby's pram.",
  },
  {
    slug: 'cp-daylight-robbery',
    correct: 'Daylight robbery',
    incorrect: ['Make hay while the sun shines', 'Rob Peter to pay Paul', 'A place in the sun'],
    difficulty: 'hard',
    scene: 'A burglar in a black eye mask and a striped jumper climbing down a ladder from the sky, carrying the shining sun away in a sack over his shoulder.',
  },
  {
    slug: 'cp-penny-thoughts',
    correct: 'A penny for your thoughts',
    incorrect: ['The penny dropped', 'Spend a penny', 'Lost in thought'],
    difficulty: 'hard',
    scene: 'A man deep in thought with his chin on his hand, and a big shiny copper coin floating inside the thought bubble above his head.',
  },
];
