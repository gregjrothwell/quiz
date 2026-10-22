/**
 * Survey Says prompts. No answers: the room is the answer.
 *
 * All 40 of Claude's draft, kept whole by Greg on 22 October 2026 ("it's fine
 * go ahead"; docs/decisions/survey-prompts-draft.md). The number is the
 * draft's, kept in the id so a later cut never renumbers what the season has
 * already served.
 *
 * `npm run write-survey-pack` writes public/packs/survey.json and its index
 * entry from this file.
 */
export interface SurveyPrompt {
  /** `survey-` and the draft's number. Never reused. */
  id: string;
  prompt: string;
  /** Exactly four, in the order shown. Both halves of a round use this order. */
  options: [string, string, string, string];
}

export const SURVEY_PROMPTS: readonly SurveyPrompt[] = [
  { id: 'survey-001', prompt: 'Best biscuit with a brew', options: ['Digestive', 'Hobnob', 'Custard Cream', 'Bourbon'] },
  { id: 'survey-002', prompt: 'How do you take your tea', options: ['Builder\'s', 'Milky', 'Black', 'I don\'t drink tea'] },
  { id: 'survey-003', prompt: 'Best crisp flavour', options: ['Salt & vinegar', 'Cheese & onion', 'Ready salted', 'Prawn cocktail'] },
  { id: 'survey-004', prompt: 'The proper Sunday roast', options: ['Beef', 'Chicken', 'Lamb', 'Pork'] },
  { id: 'survey-005', prompt: 'Best chocolate in the tin', options: ['Purple one', 'Green triangle', 'Toffee penny', 'Caramel'] },
  { id: 'survey-006', prompt: 'Lunch at your desk is usually', options: ['Meal deal', 'Leftovers', 'Sandwich from home', 'Skip it'] },
  { id: 'survey-007', prompt: 'Chippy order', options: ['Fish', 'Sausage', 'Pie', 'Just chips'] },
  { id: 'survey-008', prompt: 'Best pizza topping', options: ['Pepperoni', 'Ham & pineapple', 'Margherita', 'Meat feast'] },
  { id: 'survey-009', prompt: 'Jaffa Cake is a', options: ['Cake', 'Biscuit', 'Both', 'Don\'t care, pass them over'] },
  { id: 'survey-010', prompt: 'Cheese on toast or beans on toast', options: ['Cheese', 'Beans', 'Both together', 'Neither'] },
  { id: 'survey-011', prompt: 'Best day of the working week', options: ['Monday', 'Wednesday', 'Thursday', 'Friday'] },
  { id: 'survey-012', prompt: 'Worst meeting', options: ['Monday 9am', 'Friday 4pm', 'One that could\'ve been an email', 'Any with cameras on'] },
  { id: 'survey-013', prompt: 'Best way to sign off an email', options: ['Thanks', 'Cheers', 'Best', 'Kind regards'] },
  { id: 'survey-014', prompt: 'Your desk is', options: ['Spotless', 'Organised chaos', 'Just chaos', 'What desk?'] },
  { id: 'survey-015', prompt: 'First thing you do at work', options: ['Kettle', 'Emails', 'Chat', 'Stare at the screen'] },
  { id: 'survey-016', prompt: 'The office temperature is usually', options: ['Too hot', 'Too cold', 'Just right', 'Depends who\'s in'] },
  { id: 'survey-017', prompt: 'Best thing about working from home', options: ['No commute', 'Snacks', 'Comfy clothes', 'Quiet'] },
  { id: 'survey-018', prompt: 'Most annoying office habit', options: ['Loud calls', 'Reply-all', 'Microwaving fish', 'Not refilling the kettle'] },
  { id: 'survey-019', prompt: 'Out of office, you\'re mostly', options: ['Fully off', 'Checking emails', 'Feeling guilty', 'Gone, don\'t call'] },
  { id: 'survey-020', prompt: 'Best perk', options: ['Free food', 'Early finish Friday', 'Extra holiday', 'A good chair'] },
  { id: 'survey-021', prompt: 'Best room in the house', options: ['Kitchen', 'Bedroom', 'Living room', 'Garden'] },
  { id: 'survey-022', prompt: 'Weekend morning', options: ['Lie-in', 'Gym', 'Big breakfast', 'Kids are up at six'] },
  { id: 'survey-023', prompt: 'How many alarms do you set', options: ['One', 'Two or three', 'Four or more', 'None'] },
  { id: 'survey-024', prompt: 'Toilet roll goes', options: ['Over', 'Under', 'Whatever, it\'s on the floor', 'On the shelf'] },
  { id: 'survey-025', prompt: 'Best season', options: ['Spring', 'Summer', 'Autumn', 'Winter'] },
  { id: 'survey-026', prompt: 'Holiday of choice', options: ['Beach', 'City break', 'Staycation', 'Somewhere cold'] },
  { id: 'survey-027', prompt: 'Phone battery at bedtime', options: ['Plenty left', 'Under 20%', 'Dead', 'Always on charge'] },
  { id: 'survey-028', prompt: 'Dream way to get to work', options: ['Walk', 'Bike', 'Drive', 'Teleport, obviously'] },
  { id: 'survey-029', prompt: 'Best day of Christmas', options: ['Christmas Eve', 'Christmas Day', 'Boxing Day', 'The weird days in between'] },
  { id: 'survey-030', prompt: 'Bath or shower', options: ['Shower', 'Bath', 'Shower, but a bath on Sundays', 'Neither, I\'m a cat'] },
  { id: 'survey-031', prompt: 'Best soap ever', options: ['Corrie', 'EastEnders', 'Emmerdale', 'Neighbours'] },
  { id: 'survey-032', prompt: 'Karaoke song you\'d pick', options: ['Bohemian Rhapsody', 'Don\'t Stop Me Now', 'Mr Brightside', 'Wonderwall'] },
  { id: 'survey-033', prompt: 'Best Bond', options: ['Connery', 'Brosnan', 'Craig', 'Moore'] },
  { id: 'survey-034', prompt: 'The best Christmas film', options: ['Love Actually', 'Elf', 'Home Alone', 'Die Hard'] },
  { id: 'survey-035', prompt: 'Best board game', options: ['Monopoly', 'Scrabble', 'Cluedo', 'Trivial Pursuit'] },
  { id: 'survey-036', prompt: 'Saturday night telly', options: ['Strictly', 'A film', 'Whatever\'s on', 'Telly? It\'s Saturday'] },
  { id: 'survey-037', prompt: 'Best Spice Girl', options: ['Baby', 'Ginger', 'Scary', 'Sporty'] },
  { id: 'survey-038', prompt: 'Superpower you\'d pick', options: ['Fly', 'Invisible', 'Read minds', 'Never need sleep'] },
  { id: 'survey-039', prompt: 'Best decade for music', options: ['70s', '80s', '90s', '00s'] },
  { id: 'survey-040', prompt: 'If you won the lottery, first thing', options: ['Quit work', 'Buy a house', 'Tell nobody', 'Holiday'] },
];
