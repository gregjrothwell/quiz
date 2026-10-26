/**
 * What players were shown going wrong. Run with:
 *
 *   npm run read-errors                  # the last day
 *   npm run read-errors -- --since 7d
 *
 * One line per message and room, most frequent first. What the beacon writes
 * and why: docs/decisions/slop-cannon.md, A.
 *
 * **Needs a service account**, as `read-traces` does: the rules let no client
 * read `clientErrors`. Point `GOOGLE_APPLICATION_CREDENTIALS` at a key under
 * `.secrets/`.
 *
 * Not part of the build or the tests: it talks to the live project. The
 * grouping is `scripts/error-report.ts`, which `npm test` covers.
 */

import { readFile } from 'node:fs/promises';
import { cert, initializeApp as initAdmin, type ServiceAccount } from 'firebase-admin/app';
import { Timestamp, getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { formatGroup, groupErrors, parseErrorRow, parseSince, type ErrorRow } from './error-report';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — point it at a service account key under .secrets/`);
  return value;
}

function sinceArg(argv: string[]): string {
  const at = argv.indexOf('--since');
  return at >= 0 && argv[at + 1] ? argv[at + 1] ?? '1d' : '1d';
}

async function main(): Promise<void> {
  const since = sinceArg(process.argv.slice(2));
  const from = Date.now() - parseSince(since);
  const key = JSON.parse(await readFile(required('GOOGLE_APPLICATION_CREDENTIALS'), 'utf8')) as ServiceAccount;
  const db = getAdminFirestore(initAdmin({ credential: cert(key) }, 'read-errors-admin'));

  const snapshots = (
    await db.collection('clientErrors').where('at', '>=', Timestamp.fromMillis(from)).orderBy('at', 'desc').get()
  ).docs;

  const rows: ErrorRow[] = [];
  let malformed = 0;
  for (const snapshot of snapshots) {
    const data = snapshot.data();
    const at = data['at'] instanceof Timestamp ? data['at'].toMillis() : null;
    const row = parseErrorRow(data, at);
    if (row) rows.push(row);
    else malformed += 1;
  }

  const { groups, probes } = groupErrors(rows);
  console.log(`Errors players saw in the last ${since}, from ${required('VITE_FIREBASE_PROJECT_ID')}.\n`);
  if (groups.length === 0) console.log('None.');
  for (const group of groups) console.log(`${formatGroup(group)}\n`);
  console.log(
    `${rows.length - probes} rows in ${groups.length} groups`
      + `${probes ? `; ${probes} check-rules probe rows skipped` : ''}`
      + `${malformed ? `; ${malformed} malformed` : ''}.`,
  );
}

main().then(
  () => process.exit(0),
  (cause: unknown) => {
    console.error(cause instanceof Error ? cause.message : cause);
    process.exit(1);
  },
);
