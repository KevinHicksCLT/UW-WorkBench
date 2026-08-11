// One-off smoke test for Change Impact v2 endpoints (SCRUM-228). Not part of the
// suite — run manually against a running backend + seeded run DB.
const BASE = 'http://localhost:4000';

async function main() {
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'kevin.hicks@capgemini.com', password: 'demo1234' }),
  });
  const { token } = (await login.json()) as { token: string };
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  console.log('login:', login.status, 'token?', Boolean(token));

  // 1. taxonomy
  const tax = await fetch(`${BASE}/impact/taxonomy`, { headers: H });
  const taxBody = (await tax.json()) as { byLens: Record<string, unknown[]> };
  console.log(
    'taxonomy:',
    tax.status,
    Object.fromEntries(Object.entries(taxBody.byLens).map(([k, v]) => [k, v.length])),
  );

  // Grab a deliverable id and an initiative id from the app.
  const work = await fetch(`${BASE}/work?take=5&kind=deliverables`, { headers: H });
  const workBody = (await work.json()) as { deliverables: { id: string; title: string }[] };
  const deliv = workBody.deliverables?.[0];
  console.log('deliverable:', deliv?.id, deliv?.title);

  const inits = await fetch(`${BASE}/portfolio/initiatives`, { headers: H });
  const initsBody = (await inits.json()) as
    { id: string; name: string }[] | { initiatives?: { id: string; name: string }[] };
  const initList = Array.isArray(initsBody) ? initsBody : (initsBody.initiatives ?? []);
  const init = initList[0];
  console.log('initiative:', init?.id, init?.name);

  // 2. deliverable assessment
  if (deliv) {
    const r = await fetch(`${BASE}/impact/assess`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({
        changeType: 'CONVERT_TO_STRUCTURED_DATA',
        subject: { kind: 'deliverable', deliverableIds: [deliv.id] },
      }),
    });
    const body = (await r.json()) as {
      summary?: { total: number };
      stakeholders?: unknown[];
      sections?: { title: string; rows: unknown[] }[];
    };
    console.log('deliverable assess:', r.status, {
      total: body.summary?.total,
      stakeholders: body.stakeholders?.length,
      sections: body.sections?.map((s) => `${s.title}(${s.rows.length})`),
    });

    // 3. save packet, then read it back
    const save = await fetch(`${BASE}/impact/assessments`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({
        subject: { kind: 'deliverable', deliverableIds: [deliv.id] },
        subjectName: deliv.title,
        changeType: 'CONVERT_TO_STRUCTURED_DATA',
        status: 'ASSESSED',
        report: body,
      }),
    });
    const saved = (await save.json()) as { id: string };
    console.log('save packet:', save.status, saved.id);
    const list = await fetch(
      `${BASE}/impact/assessments?subjectKind=deliverable&subjectId=${deliv.id}`,
      { headers: H },
    );
    const listBody = (await list.json()) as unknown[];
    console.log('history for subject:', list.status, 'count', listBody.length);
  }

  // 4. plan assessment
  if (init) {
    const r = await fetch(`${BASE}/impact/assess`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({
        changeType: 'RESCHEDULE',
        subject: { kind: 'plan', initiativeId: init.id },
      }),
    });
    const body = (await r.json()) as {
      summary?: { total: number };
      stakeholders?: unknown[];
      sections?: { title: string; rows: unknown[] }[];
    };
    console.log('plan assess:', r.status, {
      total: body.summary?.total,
      stakeholders: body.stakeholders?.length,
      sections: body.sections?.map((s) => `${s.title}(${s.rows.length})`),
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
