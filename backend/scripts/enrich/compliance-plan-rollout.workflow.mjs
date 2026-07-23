export const meta = {
  name: 'compliance-plan-rollout',
  description: 'Author atomic checklist + testing plans for every compliance register item',
  phases: [{ title: 'Author', detail: 'one agent per regulation chunk writes a plan pack' }],
};

const BASE = 'C:/Users/xando/Code/transform-platform/backend';
const CHUNKS = `${BASE}/scripts/output/compliance-chunks`;
const PACKS = `${BASE}/data/compliance-plans`;

// Fail-safe tuning. Waves are small so a usage limit costs at most one wave of
// doomed agents instead of every remaining chunk (batch 2 lost 91 that way).
const WAVE = 12;
const DEAD_WAVE_RATIO = 0.75;

const RECEIPT = {
  type: 'object',
  properties: {
    chunkId: { type: 'string' },
    itemsWritten: { type: 'number' },
    file: { type: 'string' },
    skipped: { type: 'boolean' },
    notes: { type: 'string' },
  },
  required: ['chunkId', 'itemsWritten', 'file'],
  additionalProperties: false,
};

const prompt = (id) => `You author compliance execution plans for an insurance operating-model platform. Work is file-in / file-out. Be concrete and domain-accurate.

READ FIRST (absolute paths):
1. ${CHUNKS}/${id}.json — the regulation and the compliance items you must author. Author EVERY item in it, none skipped.
2. ${CHUNKS}/_refs.json — the ONLY legal Role names, the ONLY legal Application names, and the exact generic template keys.
3. ${PACKS}/REG-018-pilot.json — the gold-standard example. Match its grain and structure exactly.

RESUME CHECK (do this before authoring anything): if ${PACKS}/${id}.json already exists AND contains an entry for every itemCode in the chunk AND each of those entries has 15 checklist steps and 10 testing steps, do NOT rewrite it. Return immediately with itemsWritten 0, skipped true, notes "already complete". A partially written pack must be rewritten in full.

WRITE EXACTLY ONE FILE: ${PACKS}/${id}.json
Shape: { "items": [ <one object per item in the chunk, same order> ] }

Per item object:
- "itemCode": the exact code from the chunk file.
- "templates": ["Regulation compliance checklist", "Regulation verification testing"] — always both, verbatim.
- "generic": an object keyed by the EXACT template key strings listed in _refs.json for those two templates. Include ALL of them, invent none. Each value is { "value": "...", "role"?: "<exact role name>", "app"?: "<exact application name>" }. Keys whose valueKind is ROLE get a "role"; keys about systems get an "app" when a listed application genuinely fits. Answers must be specific to THIS item — its owner team, frequency, evidence artifact, jurisdiction scope, citations. An answer that would read identically for an unrelated obligation is a failure.
- "checklist": 15 step objects (the work — how the obligation is actually met).
- "testing": 10 step objects (the verification — how someone proves it was met).

Step object: { "step": "<short imperative title>", "by": "<exact role name from _refs.json>", "role": "<the same name>", "app": "<exact application name — omit if none fits>", "actions": [3-6 strings], "done": "<completion condition, WITHOUT a leading 'Done when'>" }

DETAIL BAR for every action string — this is the whole point of the task:
- WHO the performer pulls input from or hands output to (a named role or team).
- WHICH system, portal, screen, menu, tab, button or field they touch — e.g. "In SERFF open Industry ▸ Filing Rules and select the state", "In NAIC iSite+ open the Financial Data Repository ▸ Annual Statement upload", "In the FinCEN BSA E-Filing System open Reports ▸ FinCEN SAR and complete Part I", "In NIPR Gateway run Appointment Renewal for the state".
- WHAT they read, enter, compute or attach — named fields, forms, schedules, exhibits, codes, thresholds, day counts.
- WHAT artifact falls out and where it is filed.
Use the real regulator systems, forms, schedules, portals and deadlines for THIS regulation where you know them (SERFF, NIPR, NAIC iSite+/MCAS, IIPRC, EDGAR, FinCEN BSA E-Filing, IRS FIRE, CMS HPMS, EIOPA/Bank of England returns, OSFI regulatory reporting, etc.). Where a genuine deadline exists (e.g. "within 30 days", "by March 1"), state it. Use the item's own frequency and deadlineSignals fields.
Never write filler like "ensure compliance", "review documentation", "follow the procedure" — every action must be executable by someone who has never done the job.

TESTING steps must independently verify the checklist steps, mirroring the pilot: build the population, reconcile it to the source of record, draw a documented sample, re-perform the key judgement in the same regulator system, trace to evidence and identifiers, recompute any deadline/threshold maths, log exceptions with root cause and owner, and close with an independent reviewer sign-off and a stated conclusion.

HARD RULES:
- Never invent a Role or Application name. Use only names present in _refs.json; if none fits, omit "app" and choose the closest legitimate role.
- Output must be valid JSON (UTF-8, no trailing commas, quotes escaped). Do not wrap it in markdown fences.
- Write the file in ONE complete write — never leave a half-finished item object in it.
- Do not modify any other file.

Then return the JSON receipt only — never paste plan content back.`;

const raw = typeof args === 'string' ? JSON.parse(args) : args;
const ids = Array.isArray(raw) ? raw : (raw?.ids ?? []);
log(`authoring ${ids.length} chunks in waves of ${WAVE}`);

const receipts = [];
const doneIds = new Set();
let halted = null;

for (let i = 0; i < ids.length; i += WAVE) {
  const wave = ids.slice(i, i + WAVE);
  const res = await parallel(
    wave.map((id) => () => agent(prompt(id), { label: `plan:${id}`, phase: 'Author', schema: RECEIPT })),
  );
  res.forEach((r, j) => {
    if (r) {
      receipts.push(r);
      doneIds.add(wave[j]);
    }
  });
  const dead = res.filter((r) => !r).length;
  log(`wave ${Math.floor(i / WAVE) + 1}: ok=${wave.length - dead} dead=${dead} (total ok=${doneIds.size})`);
  // Circuit breaker — a wave that dies wholesale means a usage limit or an
  // outage, not bad luck. Stop rather than march the rest of the list into it.
  if (dead >= Math.ceil(wave.length * DEAD_WAVE_RATIO)) {
    halted = `wave ${Math.floor(i / WAVE) + 1} lost ${dead}/${wave.length} agents — stopped early`;
    log(halted);
    break;
  }
}

const remaining = ids.filter((id) => !doneIds.has(id));
return {
  chunks: receipts.length,
  items: receipts.reduce((n, r) => n + (r.itemsWritten ?? 0), 0),
  skipped: receipts.filter((r) => r.skipped).length,
  halted,
  remaining,
};
