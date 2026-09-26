# Question data attribution

Questions in this directory are derived from two sources, both published under
the [Creative Commons Attribution-ShareAlike 4.0 International Licence](https://creativecommons.org/licenses/by-sa/4.0/):

- The [Open Trivia Database](https://opentdb.com)
- [OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA)

Sharing a licence is what makes the two poolable. A third source considered and
rejected, [The Trivia API](https://the-trivia-api.com), is CC BY-**NC** — its
NonCommercial term cannot be combined into a ShareAlike work.

## What we changed

- From Open Trivia DB: fetched only the verified question pool, via the public
  API, and decoded the base64 transport encoding to plain UTF-8
- From OpenTriviaQA: parsed the flat-file category format, decoding each file as
  UTF-8 or CP1252 as its contents require, and kept only four-option questions
- Removed questions whose text the source had already damaged — stripped
  apostrophes, double-encoded characters
- Removed structurally unusable questions: duplicate answer options, unresolved
  HTML entities, order-dependent options such as "all of the above", and
  questions whose answer decays over time
- Removed questions specific to the United States, which land poorly with a UK
  audience
- Tagged questions carrying British reference points into a separate
  `uk-leaning` pack
- Grouped the remainder into themed packs by source category, capped so no
  single pack becomes an unreasonable download
- Marked OpenTriviaQA questions as medium difficulty, the source carrying no
  difficulty rating of its own

## Licence of this derived work

Because both sources are ShareAlike, these derived packs are also released under
**CC BY-SA 4.0**. If you reuse them, credit the Open Trivia Database and
OpenTriviaQA, and keep the same licence.

## Picture-round stills

Hand-built stills, hashed into `images/` at pack-build so a filename cannot
name the work. PD-Art, CC0 and NASA PD-USGov are recorded here only. CC BY
also appears on-screen.

- John Constable, The Hay Wain (1821). Wikimedia Commons, PD-Art (Constable d. 1837).
- J. M. W. Turner, The Fighting Temeraire (1839). Wikimedia Commons, PD-Art (Turner d. 1851).
- Vincent van Gogh, The Starry Night (1889). Wikimedia Commons, PD-Art (d. 1890).
- Vincent van Gogh, Sunflowers (1888, National Gallery, London). Wikimedia Commons, PD-Art — not the Gallery picture-library JPEG.
- Katsushika Hokusai, The Great Wave off Kanagawa (c. 1831). Wikimedia Commons, PD-Art (d. 1849).
- Edvard Munch, The Scream (1893). Wikimedia Commons, PD-Art (Munch d. 1944). Not a Munchmuseet NC photograph.
- John Constable, Salisbury Cathedral from the Bishop’s Grounds (c. 1825). The Met, 50.145.8, CC0.
- Stonehenge, photograph by garethwiscombe, 30 July 2007. Wikimedia Commons, CC BY 2.0.
- NASA AS17-148-22727, The Blue Marble, 7 December 1972. PD-USGov. Credit NASA. No agency logo.
- John Constable, The Cornfield (1826). Wikimedia Commons, PD-Art (Constable d. 1837).
- J. M. W. Turner, Rain, Steam and Speed – The Great Western Railway (1844). Wikimedia Commons, PD-Art — not the Gallery picture-library JPEG.
- Claude Monet, Impression, Sunrise (1872). Wikimedia Commons, PD-Art (Monet d. 1926).
- Claude Monet, Houses of Parliament, Sunset (1900–1903). Art Institute of Chicago 1933.1164, Wikimedia Commons, CC0.
- Claude Monet, Bridge over a Pond of Water Lilies (1899). The Met, 29.100.113, Wikimedia Commons, CC0.
- Édouard Manet, A Bar at the Folies-Bergère (1882). Wikimedia Commons, PD-Art (Manet d. 1883).
- Edgar Degas, The Ballet Class (c. 1874). Wikimedia Commons, PD-Art (Degas d. 1917).
- Paul Cézanne, Mont Sainte-Victoire with Large Pine (c. 1887). Wikimedia Commons, PD-Art (Cézanne d. 1906).
- Paul Cézanne, The Card Players (c. 1892–95, Courtauld). Wikimedia Commons, PD-Art (Cézanne d. 1906).
- Georges Seurat, A Sunday Afternoon on the Island of La Grande Jatte (1884–86). Wikimedia Commons, PD-Art (Seurat d. 1891).
- Gustav Klimt, The Kiss (1907–08). Wikimedia Commons, PD-Art (Klimt d. 1918).
- Grant Wood, American Gothic (1930). Wikimedia Commons, PD-Art (Wood d. 1942; UK PD 1 Jan 2013, US PD 1 Jan 2026).
- Thomas Gainsborough, The Blue Boy (c. 1770). Wikimedia Commons, PD-Art (Gainsborough d. 1788).
- Thomas Gainsborough, Mr and Mrs Andrews (c. 1750). Wikimedia Commons, PD-Art (Gainsborough d. 1788).
- Canaletto, Entrance to the Grand Canal, Venice. Wikimedia Commons, PD-Art (Canaletto d. 1768).
- Katsushika Hokusai, Fine Wind, Clear Morning (Red Fuji, c. 1830–32). Wikimedia Commons, PD-Art (d. 1849).
- NASA AS8-14-2383, Earthrise, 24 December 1968. PD-USGov. Credit NASA / Bill Anders. No agency logo.
- NASA / JPL / Space Science Institute, Saturn during equinox, 2009. PD-USGov. Credit NASA. No agency logo.
- NASA / ESA / Hubble Heritage, Pillars of Creation (2014 revisit). PD-USGov. Credit NASA. No agency logo.
- Sandro Botticelli, The Birth of Venus (c. 1485). Wikimedia Commons, PD-Art.
- Rembrandt, The Night Watch (1642). Wikimedia Commons, PD-Art (Rembrandt d. 1669).
- Eugène Delacroix, Liberty Leading the People (1830). Wikimedia Commons, PD-Art (Delacroix d. 1863).
- Pieter Bruegel the Elder, The Hunters in the Snow (1565). Wikimedia Commons, PD-Art.
- Caspar David Friedrich, Wanderer above the Sea of Fog (c. 1818). Wikimedia Commons, PD-Art (Friedrich d. 1840).
- James McNeill Whistler, Arrangement in Grey and Black No. 1 (Whistler’s Mother, 1871). Wikimedia Commons, PD-Art (Whistler d. 1903).
- Johannes Vermeer, View of Delft (c. 1661). Wikimedia Commons, PD-Art (Vermeer d. 1675).
- Diego Velázquez, Las Meninas (1656). Wikimedia Commons, PD-Art (Velázquez d. 1660).
- Francisco Goya, The Third of May 1808 (1814). Wikimedia Commons, PD-Art (Goya d. 1828).
- Théodore Géricault, The Raft of the Medusa (1818–19). Wikimedia Commons, PD-Art (Géricault d. 1824).
- Henri Rousseau, Tiger in a Tropical Storm (Surprised!, 1891). Wikimedia Commons, PD-Art (Rousseau d. 1910).
- Pierre-Auguste Renoir, Luncheon of the Boating Party (1880–81). Wikimedia Commons, PD-Art (Renoir d. 1919).
- George Stubbs, Whistlejacket (c. 1762). Wikimedia Commons, PD-Art (Stubbs d. 1806).
- Hans Holbein the Younger, The Ambassadors (1533). Wikimedia Commons, PD-Art.
- Frederic Leighton, Flaming June (1895). Wikimedia Commons, PD-Art (Leighton d. 1896). Not a Tate photograph.
- Jan van Eyck, The Arnolfini Portrait (1434). Wikimedia Commons, PD-Art.
- Emanuel Leutze, Washington Crossing the Delaware (1851). Wikimedia Commons, PD-Art (Leutze d. 1868).
- Jacques-Louis David, The Death of Socrates (1787). The Met, 31.45, CC0.
- John Singer Sargent, Madame X (1883–84). The Met, 16.53, CC0. Sargent d. 1925.
- Pieter Bruegel the Elder, The Harvesters (1565). The Met, 19.164, CC0.
- Winslow Homer, The Gulf Stream (1899). The Met, 06.1234, CC0. Homer d. 1910.
- Leonardo da Vinci, Mona Lisa (c. 1503–1519). Wikimedia Commons, PD-Art (Leonardo d. 1519).
- Leonardo da Vinci, The Last Supper (1495–1498). Wikimedia Commons, PD-Art (Leonardo d. 1519).
- Leonardo da Vinci, Lady with an Ermine (c. 1489–1491). Wikimedia Commons, PD-Art (Leonardo d. 1519).
- Michelangelo, The Creation of Adam (c. 1512). Wikimedia Commons, PD-Art (Michelangelo d. 1564).
- Raphael, The School of Athens (1509–1511). Wikimedia Commons, PD-Art (Raphael d. 1520).
- Johannes Vermeer, Girl with a Pearl Earring (c. 1665). Wikimedia Commons, PD-Art (Vermeer d. 1675).
- Johannes Vermeer, The Milkmaid (c. 1658). Wikimedia Commons, PD-Art (Vermeer d. 1675).
- Sandro Botticelli, Primavera (c. 1480). Wikimedia Commons, PD-Art (Botticelli d. 1510).
- Pieter Bruegel the Elder, The Tower of Babel (1563). Wikimedia Commons, PD-Art (Elder d. 1569).
- Pieter Bruegel the Elder, Netherlandish Proverbs (1559). Wikimedia Commons, PD-Art (Elder d. 1569).
- Rembrandt, The Anatomy Lesson of Dr Nicolaes Tulp (1632). Wikimedia Commons, PD-Art (Rembrandt d. 1669).
- Frans Hals, The Laughing Cavalier (1624). Wikimedia Commons, PD-Art (Hals d. 1666).
- Caravaggio, The Supper at Emmaus (1601). Wikimedia Commons, PD-Art (Caravaggio d. 1610).
- Caravaggio, The Calling of Saint Matthew (1599–1600). Wikimedia Commons, PD-Art (Caravaggio d. 1610).
- J. M. W. Turner, Snow Storm: Hannibal and his Army Crossing the Alps (1812). Wikimedia Commons, PD-Art (Turner d. 1851).
- J. M. W. Turner, The Burning of the Houses of Lords and Commons (1834). Wikimedia Commons, PD-Art (Turner d. 1851).
- John Everett Millais, Ophelia (1851–1852). Wikimedia Commons, PD-Art (Millais d. 1896).
- John William Waterhouse, The Lady of Shalott (1888). Wikimedia Commons, PD-Art (Waterhouse d. 1917).
- After Hans Holbein the Younger, Portrait of Henry VIII (c. 1537–1547). Wikimedia Commons, PD-Art (Holbein d. 1543).
- Unknown English artist, The Armada Portrait (c. 1588). Wikimedia Commons, PD-Art.
- Joseph Wright of Derby, An Experiment on a Bird in the Air Pump (1768). Wikimedia Commons, PD-Art (Derby d. 1797).
- James McNeill Whistler, Nocturne in Black and Gold – The Falling Rocket (1875). Wikimedia Commons, PD-Art (Whistler d. 1903).
- John Singer Sargent, Carnation, Lily, Lily, Rose (1885–1886). Wikimedia Commons, PD-Art (Sargent d. 1925).
- Henri Rousseau, The Sleeping Gypsy (1897). Wikimedia Commons, PD-Art (Rousseau d. 1910).
- Paul Gauguin, Tahitian Women on the Beach (1891). Wikimedia Commons, PD-Art (Gauguin d. 1903).
- Henri de Toulouse-Lautrec, At the Moulin Rouge (1892–1895). Wikimedia Commons, PD-Art (Toulouse-Lautrec d. 1901).
- Pierre-Auguste Renoir, Bal du moulin de la Galette (1876). Wikimedia Commons, PD-Art (Renoir d. 1919).
- Edgar Degas, L’Absinthe (1875–1876). Wikimedia Commons, PD-Art (Degas d. 1917).
- Claude Monet, Woman with a Parasol (1875). Wikimedia Commons, PD-Art (Monet d. 1926).
- Claude Monet, Poppy Field (1873). Wikimedia Commons, PD-Art (Monet d. 1926).
- Claude Monet, Haystacks (1890–1891). Wikimedia Commons, PD-Art (Monet d. 1926).
- Vincent van Gogh, Café Terrace at Night (1888). Wikimedia Commons, PD-Art (Gogh d. 1890).
- Vincent van Gogh, The Bedroom (1888). Wikimedia Commons, PD-Art (Gogh d. 1890).
- Vincent van Gogh, Irises (1889). Wikimedia Commons, PD-Art (Gogh d. 1890).
- Vincent van Gogh, Almond Blossoms (1890). Wikimedia Commons, PD-Art (Gogh d. 1890).
- Vincent van Gogh, Self-Portrait with Bandaged Ear (1889). Wikimedia Commons, PD-Art (Gogh d. 1890).
- Vincent van Gogh, Wheatfield with Crows (1890). Wikimedia Commons, PD-Art (Gogh d. 1890).
- Vincent van Gogh, The Potato Eaters (1885). Wikimedia Commons, PD-Art (Gogh d. 1890).
- Gustav Klimt, Portrait of Adele Bloch-Bauer I (1907). Wikimedia Commons, PD-Art (Klimt d. 1918).
- Gustav Klimt, The Tree of Life (1909). Wikimedia Commons, PD-Art (Klimt d. 1918).
- Wassily Kandinsky, Composition VII (1913). Wikimedia Commons, PD-Art (Kandinsky d. 1944).
- Piet Mondrian, Composition with Red, Blue and Yellow (1930). Wikimedia Commons, PD-Art (Mondrian d. 1944).
- Giuseppe Arcimboldo, Vertumnus (1591). Wikimedia Commons, PD-Art (Arcimboldo d. 1593).
- Titian, Bacchus and Ariadne (1520–1523). Wikimedia Commons, PD-Art (Titian d. 1576).
- Georges Seurat, Bathers at Asnières (1884). Wikimedia Commons, PD-Art (Seurat d. 1891).
- Jean-Honoré Fragonard, The Swing (1767). Wikimedia Commons, PD-Art (Fragonard d. 1806).
- Jean-François Millet, The Gleaners (1857). Wikimedia Commons, PD-Art (Millet d. 1875).
- Jean-François Millet, The Angelus (1857–1859). Wikimedia Commons, PD-Art (Millet d. 1875).
- Henry Fuseli, The Nightmare (1781). Wikimedia Commons, PD-Art (Fuseli d. 1825).
- Paul Delaroche, The Execution of Lady Jane Grey (1833). Wikimedia Commons, PD-Art (Delaroche d. 1856).
- William Holman Hunt, The Light of the World (1851–1853). Wikimedia Commons, PD-Art (Hunt d. 1910).
- John Everett Millais, Bubbles (1886). Wikimedia Commons, PD-Art (Millais d. 1896).
- Edwin Landseer, The Monarch of the Glen (1851). Wikimedia Commons, PD-Art (Landseer d. 1873).

## Flags

Public-domain country flags fetched from [Flagcdn](https://flagcdn.com) (Wikipedia /
Wikimedia rasters) at pack-build and content-hashed into `images/`, same as
the stills. England, Scotland, Wales and Northern Ireland use Flagcdn's
`gb-eng` / `gb-sct` / `gb-wls` / `gb-nir` codes. Northern Ireland has
no official flag; `gb-nir` is the Ulster Banner, used here as the
recognisable quiz image, not as a statement of status.

## On the box

Film and TV stills fetched from [TMDB](https://www.themoviedb.org) at pack-build
and content-hashed into `images/`, same as the flags. Untitled backdrops only
— a language tag on TMDB is usually titled keyart, which would print the
answer. This product uses the TMDB API but is not endorsed or certified by
TMDB. The stills remain studio copyright; hashing them is a seal, not a licence.
