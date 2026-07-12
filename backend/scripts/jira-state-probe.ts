/** Read-only: current SCRUM state for reconciliation. */
const BASE = 'https://kevinhicksclt.atlassian.net';
const auth =
  'Basic ' +
  Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');

async function jql(body: object): Promise<any> {
  for (let i = 0; i < 10; i += 1) {
    try {
      const r = await fetch(`${BASE}/rest/api/3/search/jql`, {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
      return await r.json();
    } catch {
      await new Promise((x) => setTimeout(x, 6000));
    }
  }
  throw new Error('network down');
}

async function all(): Promise<any[]> {
  let token: string | undefined;
  const out: any[] = [];
  do {
    const b: any = await jql({
      jql: 'project = SCRUM ORDER BY key ASC',
      maxResults: 100,
      fields: ['summary', 'issuetype', 'status', 'parent', 'labels'],
      ...(token ? { nextPageToken: token } : {}),
    });
    out.push(...(b.issues ?? []));
    token = b.nextPageToken;
  } while (token);
  return out;
}

const issues = await all();
console.log('TOTAL', issues.length);

// 1) foundation-complete present?
const found = issues.filter((i) => (i.fields.labels ?? []).includes('foundation-complete'));
console.log('\nfoundation-complete label count:', found.length);

// 2) sample transcript transitions
const sample = [
  'SCRUM-114',
  'SCRUM-119',
  'SCRUM-135',
  'SCRUM-141',
  'SCRUM-157',
  'SCRUM-161',
  'SCRUM-164',
  'SCRUM-168',
  'SCRUM-183',
  'SCRUM-186',
  'SCRUM-113',
  'SCRUM-125',
  'SCRUM-71',
  'SCRUM-48',
  'SCRUM-49',
  'SCRUM-50',
];
console.log('\ntranscript/transition sample:');
for (const k of sample) {
  const it = issues.find((i) => i.key === k);
  if (it) console.log(' ', k, '=>', it.fields.status.name, '|', it.fields.summary.slice(0, 50));
}

// 3) FB-mapped existing tickets
const fbmap = [
  'SCRUM-32',
  'SCRUM-33',
  'SCRUM-34',
  'SCRUM-37',
  'SCRUM-46',
  'SCRUM-51',
  'SCRUM-66',
  'SCRUM-169',
  'SCRUM-28',
  'SCRUM-172',
  'SCRUM-73',
  'SCRUM-174',
];
console.log('\nFB-mapped existing tickets:');
for (const k of fbmap) {
  const it = issues.find((i) => i.key === k);
  if (it) console.log(' ', k, '=>', it.fields.status.name, '|', it.fields.summary.slice(0, 56));
}

// 4) duplicate scan by normalized summary (stories/tasks only)
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const bySum = new Map<
  string,
  { key: string; type: string; status: string; parent: string; summary: string }[]
>();
for (const i of issues) {
  if (i.fields.issuetype.name === 'Epic') continue;
  const k = norm(i.fields.summary);
  const arr = bySum.get(k) ?? [];
  arr.push({
    key: i.key,
    type: i.fields.issuetype.name,
    status: i.fields.status.name,
    parent: i.fields.parent?.key ?? '-',
    summary: i.fields.summary,
  });
  bySum.set(k, arr);
}
console.log('\n=== EXACT-SUMMARY DUPLICATES ===');
let dupes = 0;
for (const [, arr] of bySum) {
  if (arr.length > 1) {
    dupes += 1;
    console.log(
      'DUP:',
      arr.map((a) => `${a.key}[${a.status}→${a.parent}]`).join('  '),
      '::',
      arr[0].summary.slice(0, 70),
    );
  }
}
if (!dupes) console.log('(none)');

// 5) epic list
console.log('\n=== EPICS ===');
for (const i of issues.filter((x) => x.fields.issuetype.name === 'Epic'))
  console.log(' ', i.key, i.fields.status.name, '|', i.fields.summary);
