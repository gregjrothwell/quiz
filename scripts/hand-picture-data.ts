/**
 * Picture-round stills. Answers live here so the write script can seal and
 * vault them. Not imported by the app bundle.
 */
import type { StillSpec } from '../src/questions/stills-source';

export const STILL_SPECS: readonly StillSpec[] = [
  {
    slug: 'hay-wain',
    prompt: 'Which painting is this?',
    correct: 'The Hay Wain',
    incorrect: ['The Cornfield', 'Flatford Mill', 'The Leaping Horse'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'John_Constable_The_Hay_Wain.jpg' },
    attribution:
      'John Constable, The Hay Wain (1821). Wikimedia Commons, PD-Art (Constable d. 1837).',
    jigsaw: true,
  },
  {
    slug: 'temeraire',
    prompt: 'Which painting is this?',
    correct: 'The Fighting Temeraire',
    incorrect: ['Rain, Steam and Speed', 'The Slave Ship', 'Dido Building Carthage'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'The_Fighting_Temeraire,_JMW_Turner,_National_Gallery.jpg' },
    attribution:
      'J. M. W. Turner, The Fighting Temeraire (1839). Wikimedia Commons, PD-Art (Turner d. 1851).',
    jigsaw: true,
  },
  {
    slug: 'starry-night',
    prompt: 'Which painting is this?',
    correct: 'The Starry Night',
    incorrect: ['Café Terrace at Night', 'Wheatfield with Crows', 'Irises'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg' },
    attribution:
      'Vincent van Gogh, The Starry Night (1889). Wikimedia Commons, PD-Art (d. 1890).',
    jigsaw: true,
  },
  {
    slug: 'sunflowers',
    prompt: 'Which painting is this?',
    correct: 'Sunflowers',
    incorrect: ['Irises', 'Almond Blossom', 'The Night Café'],
    difficulty: 'easy',
    source: {
      kind: 'commons',
      file: 'Vincent_van_Gogh_-_Sunflowers_(1888,_National_Gallery_London).jpg',
    },
    attribution:
      'Vincent van Gogh, Sunflowers (1888, National Gallery, London). Wikimedia Commons, PD-Art — not the Gallery picture-library JPEG.',
    jigsaw: true,
  },
  {
    slug: 'great-wave',
    prompt: 'Which print is this?',
    correct: 'The Great Wave off Kanagawa',
    incorrect: ['Fine Wind, Clear Morning', 'Thunderstorm Beneath the Summit', 'Kajikazawa in Kai Province'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'The_Great_Wave_off_Kanagawa.jpg' },
    attribution:
      'Katsushika Hokusai, The Great Wave off Kanagawa (c. 1831). Wikimedia Commons, PD-Art (d. 1849).',
    jigsaw: true,
  },
  {
    slug: 'scream',
    prompt: 'Which painting is this?',
    correct: 'The Scream',
    incorrect: ['Madonna', 'The Dance of Life', 'Anxiety'],
    difficulty: 'easy',
    source: {
      kind: 'commons',
      file: 'Edvard_Munch,_1893,_The_Scream,_oil,_tempera_and_pastel_on_cardboard,_91_x_73_cm,_National_Gallery_of_Norway.jpg',
    },
    attribution:
      'Edvard Munch, The Scream (1893). Wikimedia Commons, PD-Art (Munch d. 1944). Not a Munchmuseet NC photograph.',
    jigsaw: true,
  },
  {
    slug: 'salisbury',
    prompt: 'Which painting is this?',
    correct: 'Salisbury Cathedral from the Bishop’s Grounds',
    incorrect: ['The Hay Wain', 'Wivenhoe Park', 'Salisbury Cathedral from the Meadows'],
    difficulty: 'medium',
    source: { kind: 'met', objectId: 435922 },
    attribution:
      'John Constable, Salisbury Cathedral from the Bishop’s Grounds (c. 1825). The Met, 50.145.8, CC0.',
  },
  {
    slug: 'stonehenge',
    prompt: 'What is this monument?',
    correct: 'Stonehenge',
    incorrect: ['Avebury', 'Callanish', 'Carnac'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'Stonehenge2007_07_30.jpg' },
    credit: 'Photo: garethwiscombe, CC BY 2.0',
    attribution:
      'Stonehenge, photograph by garethwiscombe, 30 July 2007. Wikimedia Commons, CC BY 2.0.',
    jigsaw: true,
  },
  {
    slug: 'blue-marble',
    prompt: 'Which mission took this photograph?',
    correct: 'Apollo 17',
    incorrect: ['Apollo 8', 'Apollo 11', 'Gemini 4'],
    difficulty: 'medium',
    source: { kind: 'commons', file: 'The_Earth_seen_from_Apollo_17_(AS17-148-22727).jpg' },
    attribution:
      'NASA AS17-148-22727, The Blue Marble, 7 December 1972. PD-USGov. Credit NASA. No agency logo.',
    jigsaw: true,
  },
  {
    slug: 'cornfield',
    prompt: 'Which painting is this?',
    correct: 'The Cornfield',
    incorrect: ['The Hay Wain', 'The Leaping Horse', 'Dedham Vale'],
    difficulty: 'medium',
    source: { kind: 'commons', file: 'Constable_-_The_Cornfield.jpg' },
    attribution:
      'John Constable, The Cornfield (1826). Wikimedia Commons, PD-Art (Constable d. 1837).',
    jigsaw: true,
  },
  {
    slug: 'rain-steam-speed',
    prompt: 'Which painting is this?',
    correct: 'Rain, Steam and Speed',
    incorrect: ['The Fighting Temeraire', 'Snow Storm: Steam-Boat off a Harbour’s Mouth', 'The Slave Ship'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'Turner_-_Rain,_Steam_and_Speed_-_National_Gallery_file.jpg' },
    attribution:
      'J. M. W. Turner, Rain, Steam and Speed – The Great Western Railway (1844). Wikimedia Commons, PD-Art — not the Gallery picture-library JPEG.',
    jigsaw: true,
  },
  {
    slug: 'impression-sunrise',
    prompt: 'Which painting is this?',
    correct: 'Impression, Sunrise',
    incorrect: ['Water Lilies', 'Woman with a Parasol', 'The Magpie'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'Monet_-_Impression,_Sunrise.jpg' },
    attribution:
      'Claude Monet, Impression, Sunrise (1872). Wikimedia Commons, PD-Art (Monet d. 1926).',
    jigsaw: true,
  },
  {
    slug: 'houses-of-parliament',
    prompt: 'Which painting is this?',
    correct: 'Houses of Parliament, Sunset',
    incorrect: ['Impression, Sunrise', 'The Thames below Westminster', 'Waterloo Bridge'],
    difficulty: 'medium',
    source: {
      kind: 'commons',
      file: 'Claude_Monet,_Houses_of_Parliament,_London,_1900-1903,_1933.1164,_Art_Institute_of_Chicago.jpg',
    },
    attribution:
      'Claude Monet, Houses of Parliament, Sunset (1900–1903). Art Institute of Chicago 1933.1164, Wikimedia Commons, CC0.',
    jigsaw: true,
  },
  {
    slug: 'water-lily-bridge',
    prompt: 'Which painting is this?',
    correct: 'Bridge over a Pond of Water Lilies',
    incorrect: ['Impression, Sunrise', 'The Japanese Footbridge', 'Water Lilies and Japanese Bridge'],
    difficulty: 'medium',
    source: { kind: 'commons', file: 'Bridge_over_a_Pond_of_Water_Lilies_MET_DT1854.jpg' },
    attribution:
      'Claude Monet, Bridge over a Pond of Water Lilies (1899). The Met, 29.100.113, Wikimedia Commons, CC0.',
    jigsaw: true,
  },
  {
    slug: 'bar-folies-bergere',
    prompt: 'Which painting is this?',
    correct: 'A Bar at the Folies-Bergère',
    incorrect: ['Olympia', 'Luncheon on the Grass', 'The Railway'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'Edouard_Manet,_A_Bar_at_the_Folies-Bergère.jpg' },
    attribution:
      'Édouard Manet, A Bar at the Folies-Bergère (1882). Wikimedia Commons, PD-Art (Manet d. 1883).',
    jigsaw: true,
  },
  {
    slug: 'ballet-class',
    prompt: 'Which painting is this?',
    correct: 'The Ballet Class',
    incorrect: ['L’Absinthe', 'The Dance Lesson', 'Miss La La at the Cirque Fernando'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'Edgar_Degas_-_The_Ballet_Class_-_Google_Art_Project.jpg' },
    attribution:
      'Edgar Degas, The Ballet Class (c. 1874). Wikimedia Commons, PD-Art (Degas d. 1917).',
    jigsaw: true,
  },
  {
    slug: 'mont-sainte-victoire',
    prompt: 'Which painting is this?',
    correct: 'Mont Sainte-Victoire',
    incorrect: ['The Card Players', 'The Bathers', 'Still Life with Apples'],
    difficulty: 'medium',
    source: { kind: 'commons', file: 'Mont_Sainte-Victoire_with_Large_Pine,_by_Paul_Cézanne.jpg' },
    attribution:
      'Paul Cézanne, Mont Sainte-Victoire with Large Pine (c. 1887). Wikimedia Commons, PD-Art (Cézanne d. 1906).',
    jigsaw: true,
  },
  {
    slug: 'card-players',
    prompt: 'Which painting is this?',
    correct: 'The Card Players',
    incorrect: ['Mont Sainte-Victoire', 'The Bathers', 'The House of the Hanged Man'],
    difficulty: 'medium',
    source: {
      kind: 'commons',
      file: 'Paul_Cézanne,_1892-95,_Les_joueurs_de_carte_(The_Card_Players),_60_x_73_cm,_oil_on_canvas,_Courtauld_Institute_of_Art,_London.jpg',
    },
    attribution:
      'Paul Cézanne, The Card Players (c. 1892–95, Courtauld). Wikimedia Commons, PD-Art (Cézanne d. 1906).',
    jigsaw: true,
  },
  {
    slug: 'grande-jatte',
    prompt: 'Which painting is this?',
    correct: 'A Sunday Afternoon on the Island of La Grande Jatte',
    incorrect: ['Bathers at Asnières', 'Circus Sideshow', 'The Circus'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'A_Sunday_on_La_Grande_Jatte,_Georges_Seurat,_1884.jpg' },
    attribution:
      'Georges Seurat, A Sunday Afternoon on the Island of La Grande Jatte (1884–86). Wikimedia Commons, PD-Art (Seurat d. 1891).',
    jigsaw: true,
  },
  {
    slug: 'the-kiss',
    prompt: 'Which painting is this?',
    correct: 'The Kiss',
    incorrect: ['Portrait of Adele Bloch-Bauer I', 'Judith and the Head of Holofernes', 'Danaë'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg' },
    attribution:
      'Gustav Klimt, The Kiss (1907–08). Wikimedia Commons, PD-Art (Klimt d. 1918).',
    jigsaw: true,
  },
  {
    slug: 'american-gothic',
    prompt: 'Which painting is this?',
    correct: 'American Gothic',
    incorrect: ['Nighthawks', 'Christina’s World', 'The Midnight Ride of Paul Revere'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg' },
    attribution:
      'Grant Wood, American Gothic (1930). Wikimedia Commons, PD-Art (Wood d. 1942; UK PD 1 Jan 2013, US PD 1 Jan 2026).',
    jigsaw: true,
  },
  {
    slug: 'blue-boy',
    prompt: 'Which painting is this?',
    correct: 'The Blue Boy',
    incorrect: ['Mr and Mrs Andrews', 'The Pink Boy', 'The Honourable Mrs Graham'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'Thomas_Gainsborough_-_The_Blue_Boy_(c._1770).jpg' },
    attribution:
      'Thomas Gainsborough, The Blue Boy (c. 1770). Wikimedia Commons, PD-Art (Gainsborough d. 1788).',
    jigsaw: true,
  },
  {
    slug: 'mr-mrs-andrews',
    prompt: 'Which painting is this?',
    correct: 'Mr and Mrs Andrews',
    incorrect: ['The Blue Boy', 'Mr and Mrs William Hallett', 'The Morning Walk'],
    difficulty: 'medium',
    source: { kind: 'commons', file: 'Thomas_Gainsborough_-_Mr_and_Mrs_Andrews.jpg' },
    attribution:
      'Thomas Gainsborough, Mr and Mrs Andrews (c. 1750). Wikimedia Commons, PD-Art (Gainsborough d. 1788).',
    jigsaw: true,
  },
  {
    slug: 'canaletto-grand-canal',
    prompt: 'Which painting is this?',
    correct: 'Entrance to the Grand Canal, Venice',
    incorrect: ['The Stonemason’s Yard', 'The Basin of San Marco on Ascension Day', 'London: Westminster Bridge'],
    difficulty: 'medium',
    source: { kind: 'commons', file: 'Canaletto_Entrance_to_the_Grand_Canal_Venice.jpg' },
    attribution:
      'Canaletto, Entrance to the Grand Canal, Venice. Wikimedia Commons, PD-Art (Canaletto d. 1768).',
    jigsaw: true,
  },
  {
    slug: 'red-fuji',
    prompt: 'Which print is this?',
    correct: 'Fine Wind, Clear Morning',
    incorrect: ['The Great Wave off Kanagawa', 'Thunderstorm Beneath the Summit', 'Kajikazawa in Kai Province'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'Red_Fuji_southern_wind_clear_morning.jpg' },
    attribution:
      'Katsushika Hokusai, Fine Wind, Clear Morning (Red Fuji, c. 1830–32). Wikimedia Commons, PD-Art (d. 1849).',
    jigsaw: true,
  },
  {
    slug: 'earthrise',
    prompt: 'Which mission took this photograph?',
    correct: 'Apollo 8',
    incorrect: ['Apollo 11', 'Apollo 17', 'Gemini 8'],
    difficulty: 'medium',
    source: { kind: 'commons', file: 'NASA-Apollo8-Dec24-Earthrise.jpg' },
    attribution:
      'NASA AS8-14-2383, Earthrise, 24 December 1968. PD-USGov. Credit NASA / Bill Anders. No agency logo.',
    jigsaw: true,
  },
  {
    slug: 'saturn-equinox',
    prompt: 'Which spacecraft took this photograph?',
    correct: 'Cassini',
    incorrect: ['Voyager 1', 'Pioneer 11', 'Juno'],
    difficulty: 'medium',
    source: { kind: 'commons', file: 'Saturn_during_Equinox.jpg' },
    attribution:
      'NASA / JPL / Space Science Institute, Saturn during equinox, 2009. PD-USGov. Credit NASA. No agency logo.',
    jigsaw: true,
  },
  {
    slug: 'pillars-of-creation',
    prompt: 'Which telescope took this photograph?',
    correct: 'Hubble Space Telescope',
    incorrect: ['James Webb Space Telescope', 'Spitzer Space Telescope', 'Chandra X-ray Observatory'],
    difficulty: 'medium',
    source: { kind: 'commons', file: 'Pillars_of_creation_2014_HST_WFC3-UVIS_full-res.jpg' },
    attribution:
      'NASA / ESA / Hubble Heritage, Pillars of Creation (2014 revisit). PD-USGov. Credit NASA. No agency logo.',
    jigsaw: true,
  },
  {
    slug: 'birth-of-venus',
    prompt: 'Which painting is this?',
    correct: 'The Birth of Venus',
    incorrect: ['Primavera', 'Venus and Mars', 'The Birth of Bacchus'],
    difficulty: 'easy',
    source: {
      kind: 'commons',
      file: 'Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg',
    },
    attribution:
      'Sandro Botticelli, The Birth of Venus (c. 1485). Wikimedia Commons, PD-Art.',
    jigsaw: true,
  },
  {
    slug: 'night-watch',
    prompt: 'Which painting is this?',
    correct: 'The Night Watch',
    incorrect: ['The Anatomy Lesson of Dr Nicolaes Tulp', 'The Jewish Bride', 'The Syndics'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'The_Nightwatch_by_Rembrandt.jpg' },
    attribution:
      'Rembrandt, The Night Watch (1642). Wikimedia Commons, PD-Art (Rembrandt d. 1669).',
    jigsaw: true,
  },
  {
    slug: 'liberty-leading',
    prompt: 'Which painting is this?',
    correct: 'Liberty Leading the People',
    incorrect: ['The Raft of the Medusa', 'The Death of Sardanapalus', 'Massacre at Chios'],
    difficulty: 'easy',
    source: {
      kind: 'commons',
      file: 'Eugène_Delacroix_-_Le_28_Juillet._La_Liberté_guidant_le_peuple.jpg',
    },
    attribution:
      'Eugène Delacroix, Liberty Leading the People (1830). Wikimedia Commons, PD-Art (Delacroix d. 1863).',
    jigsaw: true,
  },
  {
    slug: 'hunters-in-the-snow',
    prompt: 'Which painting is this?',
    correct: 'The Hunters in the Snow',
    incorrect: ['The Harvesters', 'Netherlandish Proverbs', 'The Tower of Babel'],
    difficulty: 'medium',
    source: {
      kind: 'commons',
      file: 'Pieter_Bruegel_the_Elder_-_Hunters_in_the_Snow_(Winter)_-_Google_Art_Project.jpg',
    },
    attribution:
      'Pieter Bruegel the Elder, The Hunters in the Snow (1565). Wikimedia Commons, PD-Art.',
    jigsaw: true,
  },
  {
    slug: 'wanderer',
    prompt: 'Which painting is this?',
    correct: 'Wanderer above the Sea of Fog',
    incorrect: ['The Monk by the Sea', 'Chalk Cliffs on Rügen', 'The Sea of Ice'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg' },
    attribution:
      'Caspar David Friedrich, Wanderer above the Sea of Fog (c. 1818). Wikimedia Commons, PD-Art (Friedrich d. 1840).',
    jigsaw: true,
  },
  {
    slug: 'whistlers-mother',
    prompt: 'Which painting is this?',
    correct: 'Whistler’s Mother',
    incorrect: ['Symphony in White, No. 1', 'Nocturne in Black and Gold', 'Harmony in Pink and Grey'],
    difficulty: 'medium',
    source: { kind: 'commons', file: 'Whistlers_Mother_high_res.jpg' },
    attribution:
      'James McNeill Whistler, Arrangement in Grey and Black No. 1 (Whistler’s Mother, 1871). Wikimedia Commons, PD-Art (Whistler d. 1903).',
    jigsaw: true,
  },
  {
    slug: 'view-of-delft',
    prompt: 'Which painting is this?',
    correct: 'View of Delft',
    incorrect: ['The Little Street', 'Girl with a Pearl Earring', 'The Milkmaid'],
    difficulty: 'medium',
    source: { kind: 'commons', file: 'Vermeer-view-of-delft.jpg' },
    attribution:
      'Johannes Vermeer, View of Delft (c. 1661). Wikimedia Commons, PD-Art (Vermeer d. 1675).',
    jigsaw: true,
  },
  {
    slug: 'las-meninas',
    prompt: 'Which painting is this?',
    correct: 'Las Meninas',
    incorrect: ['The Surrender of Breda', 'The Spinners', 'Pope Innocent X'],
    difficulty: 'easy',
    source: {
      kind: 'commons',
      file: 'Las_Meninas,_by_Diego_Velázquez,_from_Prado_in_Google_Earth.jpg',
    },
    attribution:
      'Diego Velázquez, Las Meninas (1656). Wikimedia Commons, PD-Art (Velázquez d. 1660).',
    jigsaw: true,
  },
  {
    slug: 'third-of-may',
    prompt: 'Which painting is this?',
    correct: 'The Third of May 1808',
    incorrect: ['The Second of May 1808', 'Saturn Devouring His Son', 'The Family of Charles IV'],
    difficulty: 'medium',
    source: {
      kind: 'commons',
      file: 'El_Tres_de_Mayo,_by_Francisco_de_Goya,_from_Prado_in_Google_Earth.jpg',
    },
    attribution:
      'Francisco Goya, The Third of May 1808 (1814). Wikimedia Commons, PD-Art (Goya d. 1828).',
    jigsaw: true,
  },
  {
    slug: 'raft-of-the-medusa',
    prompt: 'Which painting is this?',
    correct: 'The Raft of the Medusa',
    incorrect: ['Liberty Leading the People', 'The Charging Chasseur', 'The Death of Sardanapalus'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'Théodore_Géricault_-_The_Raft_of_the_Medusa_-_WGA08630.jpg' },
    attribution:
      'Théodore Géricault, The Raft of the Medusa (1818–19). Wikimedia Commons, PD-Art (Géricault d. 1824).',
    jigsaw: true,
  },
  {
    slug: 'surprised-tiger',
    prompt: 'Which painting is this?',
    correct: 'Tiger in a Tropical Storm',
    incorrect: ['The Sleeping Gypsy', 'The Dream', 'The Hungry Lion Throws Itself on the Antelope'],
    difficulty: 'medium',
    source: { kind: 'commons', file: 'Surprised-Rousseau.jpg' },
    attribution:
      'Henri Rousseau, Tiger in a Tropical Storm (Surprised!, 1891). Wikimedia Commons, PD-Art (Rousseau d. 1910).',
    jigsaw: true,
  },
  {
    slug: 'boating-party',
    prompt: 'Which painting is this?',
    correct: 'Luncheon of the Boating Party',
    incorrect: ['Dance at Le Moulin de la Galette', 'The Swing', 'Girls at the Piano'],
    difficulty: 'easy',
    source: {
      kind: 'commons',
      file: 'Pierre-Auguste_Renoir_-_Luncheon_of_the_Boating_Party_-_Google_Art_Project.jpg',
    },
    attribution:
      'Pierre-Auguste Renoir, Luncheon of the Boating Party (1880–81). Wikimedia Commons, PD-Art (Renoir d. 1919).',
    jigsaw: true,
  },
  {
    slug: 'whistlejacket',
    prompt: 'Which painting is this?',
    correct: 'Whistlejacket',
    incorrect: ['Mares and Foals', 'The Hambletonian', 'A Lion Attacking a Horse'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'Whistlejacket_by_George_Stubbs.jpg' },
    attribution:
      'George Stubbs, Whistlejacket (c. 1762). Wikimedia Commons, PD-Art (Stubbs d. 1806).',
    jigsaw: true,
  },
  {
    slug: 'ambassadors',
    prompt: 'Which painting is this?',
    correct: 'The Ambassadors',
    incorrect: ['The Arnolfini Portrait', 'Christina of Denmark', 'Sir Thomas More'],
    difficulty: 'easy',
    source: {
      kind: 'commons',
      file: 'Hans_Holbein_the_Younger_-_The_Ambassadors_-_Google_Art_Project.jpg',
    },
    attribution:
      'Hans Holbein the Younger, The Ambassadors (1533). Wikimedia Commons, PD-Art.',
    jigsaw: true,
  },
  {
    slug: 'flaming-june',
    prompt: 'Which painting is this?',
    correct: 'Flaming June',
    incorrect: ['The Bath of Psyche', 'Cimabue’s Celebrated Madonna', 'The Garden of the Hesperides'],
    difficulty: 'medium',
    source: { kind: 'commons', file: 'Flaming_June,_by_Frederic_Lord_Leighton_(1830-1896).jpg' },
    attribution:
      'Frederic Leighton, Flaming June (1895). Wikimedia Commons, PD-Art (Leighton d. 1896). Not a Tate photograph.',
    jigsaw: true,
  },
  {
    slug: 'arnolfini',
    prompt: 'Which painting is this?',
    correct: 'The Arnolfini Portrait',
    incorrect: ['The Ambassadors', 'Portrait of a Man in a Red Turban', 'Madonna of Chancellor Rolin'],
    difficulty: 'easy',
    source: { kind: 'commons', file: 'Van_Eyck_-_Arnolfini_Portrait.jpg' },
    attribution:
      'Jan van Eyck, The Arnolfini Portrait (1434). Wikimedia Commons, PD-Art.',
    jigsaw: true,
  },
  {
    slug: 'washington-crossing',
    prompt: 'Which painting is this?',
    correct: 'Washington Crossing the Delaware',
    incorrect: ['The Declaration of Independence', 'Watson and the Shark', 'The Course of Empire'],
    difficulty: 'easy',
    source: {
      kind: 'commons',
      file: 'Washington_Crossing_the_Delaware_by_Emanuel_Leutze,_MMA-NYC,_1851.jpg',
    },
    attribution:
      'Emanuel Leutze, Washington Crossing the Delaware (1851). Wikimedia Commons, PD-Art (Leutze d. 1868).',
    jigsaw: true,
  },
  {
    slug: 'death-of-socrates',
    prompt: 'Which painting is this?',
    correct: 'The Death of Socrates',
    incorrect: ['The Oath of the Horatii', 'The Intervention of the Sabine Women', 'Napoleon Crossing the Alps'],
    difficulty: 'medium',
    source: { kind: 'met', objectId: 436105 },
    attribution:
      'Jacques-Louis David, The Death of Socrates (1787). The Met, 31.45, CC0.',
    jigsaw: true,
  },
  {
    slug: 'madame-x',
    prompt: 'Which painting is this?',
    correct: 'Madame X',
    incorrect: ['Portrait of Madame Monet', 'Lady Agnew of Lochnaw', 'Portrait of Madame Récamier'],
    difficulty: 'medium',
    source: { kind: 'met', objectId: 12127 },
    attribution:
      'John Singer Sargent, Madame X (1883–84). The Met, 16.53, CC0. Sargent d. 1925.',
    jigsaw: true,
  },
  {
    slug: 'the-harvesters',
    prompt: 'Which painting is this?',
    correct: 'The Harvesters',
    incorrect: ['The Hunters in the Snow', 'The Peasant Wedding', 'The Corn Harvest'],
    difficulty: 'medium',
    source: { kind: 'met', objectId: 435809 },
    attribution:
      'Pieter Bruegel the Elder, The Harvesters (1565). The Met, 19.164, CC0.',
    jigsaw: true,
  },
  {
    slug: 'gulf-stream',
    prompt: 'Which painting is this?',
    correct: 'The Gulf Stream',
    incorrect: ['Breezing Up', 'Snap the Whip', 'The Fog Warning'],
    difficulty: 'medium',
    source: { kind: 'met', objectId: 11122 },
    attribution:
      'Winslow Homer, The Gulf Stream (1899). The Met, 06.1234, CC0. Homer d. 1910.',
    jigsaw: true,
  },
];
