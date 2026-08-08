// End-to-end smoke: boots the API against a real Postgres and walks the whole
// democratization + underwriting lifecycle, asserting the invariants fire:
//   signup (company provisioned + starter pack) → intake (IN appetite) →
//   clearance → triage rescore → decision (pure-fn authority PASS) → quote
//   (cross-module refs) → bind (INV-2/INV-7 gates, correlationId idempotency)
//   → audit trail replay → MCP tools/list + proposal-only contract.
// Run: DATABASE_URL=... node scripts/smoke.mjs   (used by the CI smoke job)
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(HERE, '../server');
const BASE = 'http://localhost:4100';

let failures = 0;
const ok = (cond, label) => {
  if (cond) console.log(`ok   ${label}`);
  else {
    console.error(`FAIL ${label}`);
    failures++;
  }
};

const api = async (method, pathName, { token, body } = {}) => {
  const res = await fetch(`${BASE}${pathName}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, json };
};

// ── boot ────────────────────────────────────────────────────────────────
const tsxCli = path.resolve(HERE, '../node_modules/tsx/dist/cli.mjs');
const child = spawn(process.execPath, [tsxCli, 'src/index.ts'], {
  cwd: SERVER,
  env: { ...process.env, PORT: '4100', NODE_ENV: 'production', JWT_SECRET: 'smoke-secret' },
  stdio: ['ignore', 'inherit', 'inherit'],
});
process.on('exit', () => child.kill());

let up = false;
for (let i = 0; i < 60 && !up; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  try {
    up = (await fetch(`${BASE}/health`)).ok;
  } catch {
    /* not up yet */
  }
}
if (!up) {
  console.error('server never came up');
  process.exit(1);
}
console.log('server up');

try {
  // ── signup: anyone can create a company ───────────────────────────────
  const email = `smoke-${randomUUID().slice(0, 8)}@uw-workbench.dev`;
  const signup = await api('POST', '/auth/signup', {
    body: { companyName: 'Smoke Test Mutual', adminName: 'Smoke Admin', email, password: 'underwrite!' },
  });
  ok(signup.status === 201 && signup.json.token, 'signup provisions a company and returns a token');
  ok(signup.json.starterPack?.applied?.appetiteStatements >= 3, 'starter pack applied appetite statements');
  ok(signup.json.starterPack?.applied?.authorityGrants >= 3, 'starter pack resolved authority grants against the role ladder');
  const token = signup.json.token;

  const catalog = (await api('GET', '/uw/catalog', { token })).json;
  ok(catalog.roles.length >= 4 && catalog.applications.length >= 1, 'catalog exposes roles + PAS application');

  // ── intake ────────────────────────────────────────────────────────────
  const intake = await api('POST', '/uw/submissions', {
    token,
    body: {
      accountName: 'Harborline Warehousing LLC',
      lob: 'CP',
      brokerName: 'Marsh',
      naics: '4931',
      domicile: 'SC',
      tivTotal: 30_000_000,
      slaHours: 24,
      description: 'Two sprinklered distribution warehouses.',
      extractedFields: [
        { field: 'Sprinkler class', value: 'ESFR', confidence: 0.97, provenance: { docId: 'sov.xlsx', page: 1, extractorVersion: 'ext-1.0' } },
        { field: 'Roof age', value: 'unknown', confidence: 0.4, provenance: { docId: 'acord.pdf', extractorVersion: 'ext-1.0' } },
      ],
      riskObjects: [{ name: 'Charleston DC', situs: 'Charleston, SC', tiv: 30_000_000 }],
    },
  });
  ok(intake.status === 201, 'intake accepted');
  ok(intake.json.appetite?.verdict === 'IN', `appetite verdict IN with citations (got ${intake.json.appetite?.verdict})`);
  ok(intake.json.appetite?.citedStatements?.length >= 1, 'verdict cites statement refs (HLR-05)');
  ok(intake.json.extractionExceptions === 1, 'low-confidence field quarantined (LLR-01)');
  const subId = intake.json.id;

  const badIntake = await api('POST', '/uw/submissions', { token, body: { accountName: 'X', lob: 'ZZ' } });
  ok(badIntake.status === 422 && badIntake.json.error === 'validation_failed', 'syntax gate: 422 with violations');

  // ── clearance + triage ────────────────────────────────────────────────
  const clearance = await api('POST', `/uw/submissions/${subId}/clearance`, { token, body: { checks: ['DUPLICATE', 'WATCHLIST'] } });
  ok(clearance.status === 201 && clearance.json.held === false, 'clearance clear, submission advances');
  const rescore = await api('POST', '/uw/triage/rescore', { token, body: { submissionIds: [subId] } });
  ok(rescore.status === 201 && rescore.json[0]?.composite > 0, 'versioned triage score appended');

  // ── premature bind must fail before any decision exists ───────────────
  const decision = await api('POST', '/uw/decisions', {
    token,
    body: { submissionId: subId, outcome: 'QUOTE', premium: 400_000, rationale: 'Clean target-class risk, sprinklered, priced at technical.' },
  });
  ok(decision.status === 201 && decision.json.decision?.authorityResult === 'PASS', 'pure-fn authority validation PASS (CUO grant)');

  const quoteNoRefs = await api('POST', '/uw/quotes', {
    token,
    body: { submissionId: subId, decisionId: decision.json.decision.id, premium: 400_000 },
  });
  const bindBlocked = await api('POST', '/uw/bind', {
    token,
    body: { quoteId: quoteNoRefs.json.id, correlationId: randomUUID(), applicationId: catalog.applications[0].id },
  });
  ok(bindBlocked.status === 409 && bindBlocked.json.invariant === 'INV-7', 'bind blocked on unresolved cross-module refs (INV-7)');

  const quote = await api('POST', '/uw/quotes', {
    token,
    body: { submissionId: subId, decisionId: decision.json.decision.id, premium: 400_000, modelRef: 'M-CP-04', formSetRef: 'FS-CP-STD-26' },
  });
  ok(quote.status === 201, 'quote assembled with priced-by + documented-by refs');

  const correlationId = randomUUID();
  const bind = await api('POST', '/uw/bind', { token, body: { quoteId: quote.json.id, correlationId, applicationId: catalog.applications[0].id } });
  ok(bind.status === 201 && bind.json.pasPolicyRef, 'bind executed against the PAS application node');
  const replay = await api('POST', '/uw/bind', { token, body: { quoteId: quote.json.id, correlationId, applicationId: catalog.applications[0].id } });
  ok(replay.status === 200 && replay.json.replayed === true && replay.json.pasPolicyRef === bind.json.pasPolicyRef, 'bind replay is idempotent (LLR-12)');

  // ── the audit IS the event log ────────────────────────────────────────
  const events = await api('GET', `/uw/events?correlationId=${subId}&limit=100`, { token });
  const types = events.json.events.map((e) => e.eventType);
  ok(['SubmissionCreated', 'ClearanceCompleted', 'TriageScored', 'DecisionRecorded', 'QuoteProposed', 'BindExecuted'].every((t) => types.includes(t)), `intake-to-bind narrative on one correlation id (got: ${[...new Set(types)].join(',')})`);

  // ── MCP: governed tools, proposal-only writes ─────────────────────────
  const mcpList = await api('POST', '/uw/mcp', { token, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
  ok(mcpList.json.result?.tools?.length >= 9, 'MCP tools/list exposes the surface');
  const mcpPropose = await api('POST', '/uw/mcp', {
    token,
    body: { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'uw_propose_decision', arguments: { submissionId: subId, outcome: 'QUOTE', premium: 390_000, rationale: 'Agent counter-proposal', confidence: 0.8 } } },
  });
  const proposeText = JSON.parse(mcpPropose.json.result.content[0].text);
  ok(proposeText.disposition === 'PENDING', 'MCP mutation lands as a PENDING ProposalEnvelope (ADR-02)');
  const actions = await api('GET', '/uw/agent-actions?disposition=PENDING', { token });
  ok(actions.json.some((a) => a.id === proposeText.agentActionId), 'AgentAction audited with governance event (INV-5)');
} catch (e) {
  console.error('smoke crashed:', e);
  failures++;
} finally {
  child.kill();
}

console.log(failures ? `\n${failures} smoke failure(s)` : '\nSMOKE GREEN — full lifecycle verified.');
process.exit(failures ? 1 : 0);
