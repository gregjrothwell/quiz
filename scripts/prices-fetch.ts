/**
 * Downloads the ONS files The Price Was Right is built from and works out every
 * price it needs, into `.cache/prices/observed.json`:
 *
 *   npm run prices-fetch
 *
 * - Shop price quotes for August 2026, August 2021 and August 2016 (inside the
 *   2016 Q3 file): the median of each item's valid quotes that month.
 * - The RPI average-price series in MM23, for January 2025, 2005 and 1995.
 *
 * Raw files are kept in `.cache/prices/raw/` and reused; delete one to fetch it
 * again. Live, so it stays out of `npm test` — the arithmetic is
 * `prices-core.ts`, which is tested offline.
 *
 * **Blind**: it prints counts and slugs, never a price. Greg plays this round.
 * See docs/decisions/price-was-right.md.
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseCsv, quoteMedians, rpiAveragePrices, type QuoteMedian, type RpiSeries } from './prices-core';
import { GAPS, PRICE_SPECS } from './hand-prices-data';
import { OBSERVED_PATH, pricesFor, type Observed } from './write-prices-pack';

const USER_AGENT = 'VibeQuiz/0.1 (https://github.com/gregjrothwell/quiz; pack builder)';
const RAW = join(dirname(OBSERVED_PATH), 'raw');
const QUOTES =
  'https://www.ons.gov.uk/file?uri=/economy/inflationandpriceindices/datasets/consumerpriceindicescpiandretailpricesindexrpiitemindicesandpricequotes';

/** Each month the quotes gaps read, and the published file that holds it. */
const QUOTE_FILES: Record<string, string> = {
  '202608': `${QUOTES}/pricequotesaugust2026/upload-pricequotes202608.csv`,
  '202108': `${QUOTES}/pricequotesaugust2021/upload-pricequotes202108.csv`,
  '201608': `${QUOTES}/pricequotequarter32016/upload-pricequote2016q3.csv`,
};
const MM23 = 'https://www.ons.gov.uk/file?uri=/economy/inflationandpriceindices/datasets/consumerpriceindices/current/mm23.csv';

async function cached(url: string, name: string): Promise<string> {
  const path = join(RAW, name);
  const present = await stat(path).then(
    (info) => info.size > 0,
    () => false,
  );
  if (!present) {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
    console.log(`fetched ${name}`);
  }
  return readFile(path, 'utf8');
}

async function main(): Promise<void> {
  await mkdir(RAW, { recursive: true });

  const quoteMonths = new Set(Object.values(GAPS).filter((gap) => gap.source === 'quotes').flatMap((gap) => [gap.later, gap.earlier]));
  const quotes: Record<string, Record<string, QuoteMedian>> = {};
  for (const month of quoteMonths) {
    const url = QUOTE_FILES[month];
    if (!url) throw new Error(`No quotes file listed for ${month}`);
    const medians = quoteMedians(parseCsv(await cached(url, `quotes-${month}.csv`)), month);
    quotes[month] = Object.fromEntries(medians);
    console.log(`quotes ${month}: ${medians.size} items`);
  }

  const rpiMonths = Object.values(GAPS).filter((gap) => gap.source === 'rpi').flatMap((gap) => [gap.later, gap.earlier]);
  const rpi: Record<string, RpiSeries> = {};
  for (const [cdid, series] of rpiAveragePrices(parseCsv(await cached(MM23, 'mm23.csv')))) {
    const pence = Object.fromEntries(rpiMonths.filter((m) => series.pence[m] !== undefined).map((m) => [m, series.pence[m] as number]));
    rpi[cdid] = { title: series.title, pence };
  }
  console.log(`rpi: ${Object.keys(rpi).length} average-price series`);

  const observed: Observed = { quotes, rpi };
  await writeFile(OBSERVED_PATH, `${JSON.stringify(observed)}\n`);

  // Every spec checked against what came back — slugs and reasons only.
  const refused = PRICE_SPECS.flatMap((spec) => {
    try {
      pricesFor(spec, observed);
      return [];
    } catch (error) {
      return [error instanceof Error ? error.message : String(error)];
    }
  });
  console.log(`${PRICE_SPECS.length - refused.length}/${PRICE_SPECS.length} specs have both prices`);
  for (const reason of refused) console.log(`  ${reason}`);
  if (refused.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error('prices-fetch failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
