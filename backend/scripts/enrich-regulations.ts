// enrich-regulations.ts — decompose each regulatory requirement into single,
// actionable, applicable atomic regulations and wire every one to the operating
// model. For each source requirement, Claude (grounded in the reg's own text +
// the live value-stream catalog + the role catalog) returns:
//   • one-or-more atomic obligations (each = ONE thing produced / one testable duty)
//   • ownerRole       — the single accountable role                 → RoleRegulation Owner
//   • contributorRoles — the hands-on doer role(s)                   → RoleRegulation Contributor
//   • valueStreams    — the specific L2/L3 process node(s) governed  → NodeRegulation
//   • regime          — the named regulation (GDPR here)
//
// Writes: atomic RegulatoryRequirement rows (compound source → SUPERSEDED, children
// created ACTIVE; already-atomic source → updated in place) + RoleRegulation +
// NodeRegulation links + regime. Idempotent (skips already-processed unless
// --force). Ground truth is the live DB; text is grounded per-reg, never templated.
//
// Run (cwd = backend):
//   npx tsx scripts/enrich-regulations.ts --regime GDPR --dry-run
//   npx tsx scripts/enrich-regulations.ts --regime GDPR
//   npx tsx scripts/enrich-regulations.ts --regime GDPR --force
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../src/db/prisma.js';

const MODEL = process.env.ADMIN_AI_MODEL ?? process.env.CHATBOT_MODEL ?? 'claude-sonnet-4-6';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string, d = '') => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DRY = flag('dry-run');
const FORCE = flag('force');
const STATES = flag('states'); // target every US state insurance regulator at once
const FEDERAL = flag('federal'); // target the federal securities regulators (FINRA/SEC/MSRB)
const REGIME = opt('regime', ''); // override regime for all atoms (e.g. GDPR); else AI infers per-atom
const JUR = opt('jurisdiction', ''); // single USPS/regulator code, else provide --states
const LIMIT = Number(opt('limit', '0')) || 0;
const CONCURRENCY = Number(opt('concurrency', '4')) || 4;
const COMPANY = opt('company', '');

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

const SYSTEM = `You are a senior data-protection & insurance compliance architect mapping a regulator's obligations onto a US insurer's operating model. You are given ONE regulatory requirement (which may bundle several distinct duties) and you decompose it into ATOMIC regulations.

An ATOMIC regulation is ONE single, actionable, testable, applicable obligation — one concrete thing the business must produce, maintain, or do. If the given requirement text bundles several distinct producible duties (e.g. "maintain a consent record AND honor withdrawal AND log proof"), split it into that many atomic regulations. If it is already a single duty, return exactly one.

For EACH atomic regulation return, via the tool:
- title: a short, specific noun-phrase naming the single obligation (e.g. "Consent withdrawal mechanism", not "Consent Management").
- description: 1–2 precise sentences stating exactly what must be produced/done and the pass condition. Specific to THIS duty — never a generic template.
- category: the best-fit category token from: PRODUCT_FILING, LICENSING, PREMIUM_TAX, SURPLUS_LINES, WORKERS_COMP_REPORTING, AUTO_VERIFICATION, APCD_REPORTING, FINANCIAL_REPORTING, MARKET_CONDUCT, DATA_CALL, CYBERSECURITY, DATA_PRIVACY, OTHER.
- obligationType: one of ONGOING, FILING_GATE, INFORMATIONAL, EVENT_DRIVEN.
- frequency: short cadence phrase if applicable (e.g. "per data subject request", "annual", "continuous"), else null.
- regime: the SHORT name of the specific named regulation / framework / filing system this obligation comes from (e.g. "SERFF", "IIPRC", "NYDFS 500", "CCPA-CPRA", "GDPR", "IAIABC EDI", "SBS"), or null if it is a general state statutory duty with no branded regime.
- ownerRef: the number from the ROLE CATALOG of the SINGLE accountable owner (the role answerable for this obligation, typically a senior/lead/officer).
- contributorRefs: 1–3 numbers from the ROLE CATALOG of the hands-on people who DO the work day-to-day. Not the owner.
- nodeRefs: the numbers (1–3) from the VALUE-STREAM CATALOG identifying the process area(s) this obligation actually governs. Prefer a specific L3 Process; include its L2 Division when helpful. Only pick nodes it genuinely applies to.

Always pick the CLOSEST existing catalog entry — never invent a role or node not in the lists.`;

type Atom = { title: string; description: string; category: string; obligationType: string; frequency: string | null; regime: string | null; ownerRef: number; contributorRefs: number[]; nodeRefs: number[] };
type Out = { atoms: Atom[] };

const TOOL: Anthropic.Tool = {
  name: 'submit_regulations',
  description: 'Return the atomic regulation(s) decomposed from the given requirement.',
  input_schema: {
    type: 'object',
    properties: {
      atoms: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            obligationType: { type: 'string' },
            frequency: { type: ['string', 'null'] },
            regime: { type: ['string', 'null'], description: 'named regulation/framework short name, or null' },
            ownerRef: { type: 'integer', description: 'ROLE CATALOG number of the accountable owner' },
            contributorRefs: { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 3 },
            nodeRefs: { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 3 },
          },
          required: ['title', 'description', 'category', 'obligationType', 'ownerRef', 'contributorRefs', 'nodeRefs'],
        },
      },
    },
    required: ['atoms'],
  },
};

async function callOne(catalog: string, roleCat: string, r: { title: string; category: string; requirement: string }): Promise<Out> {
  const prompt = `VALUE-STREAM CATALOG (pick nodeRefs from these numbers):\n${catalog}\n\nROLE CATALOG (pick ownerRef + contributorRefs from these numbers):\n${roleCat}\n\nREQUIREMENT TO DECOMPOSE:\nTitle: ${r.title}  [category: ${r.category}]\nText: ${r.requirement}\n\nReturn one atomic regulation per distinct producible duty in this requirement.`;
  const msg = await anthropic().messages.create({
    model: MODEL, max_tokens: 4096, system: SYSTEM,
    tools: [TOOL], tool_choice: { type: 'tool', name: 'submit_regulations' },
    messages: [{ role: 'user', content: prompt }],
  });
  const block = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!block) throw new Error('no tool_use in response');
  return block.input as Out;
}

async function main() {
  const company = await prisma.company.findFirst({
    where: COMPANY ? { id: COMPANY } : {}, orderBy: { createdAt: 'asc' }, select: { id: true, name: true },
  });
  if (!company) throw new Error('no company');
  const cid = company.id;
  console.log(`company: ${company.name} (${cid})  regime=${REGIME} jur=${JUR}  model=${MODEL}  ${DRY ? '[DRY RUN]' : ''}${FORCE ? ' [FORCE]' : ''}`);

  // Value-stream catalog: L2 Division + L3 Process nodes (the mappable grain).
  const plts = await prisma.processLevelType.findMany({ where: { companyId: cid }, select: { id: true, levelNumber: true } });
  const l2l3 = plts.filter((p) => p.levelNumber === 2 || p.levelNumber === 3).map((p) => p.id);
  const nodes = await prisma.processNode.findMany({
    where: { companyId: cid, processLevelTypeId: { in: l2l3 } },
    select: { id: true, displayValue: true, processLevelType: { select: { levelNumber: true } }, parent: { select: { displayValue: true } } },
    orderBy: [{ sortOrder: 'asc' }],
  });
  const catNodes = nodes.map((n) => ({ id: n.id, label: `L${n.processLevelType.levelNumber} ${n.displayValue}${n.parent ? ` (in ${n.parent.displayValue})` : ''}` }));
  const catalog = catNodes.map((n, i) => `${i + 1}. ${n.label}`).join('\n');

  // Role catalog: stable index → role. AI picks owner/contributor by number so
  // every pick resolves to a real role (no free-text title guessing).
  const roles = await prisma.role.findMany({ where: { companyId: cid }, select: { id: true, displayValue: true }, orderBy: { displayValue: 'asc' } });
  const roleCat = roles.map((r, i) => `${i + 1}. ${r.displayValue}`).join('\n');
  const roleAt = (ref: number): string | null => roles[ref - 1]?.id ?? null;

  // Target jurisdictions: a single code (--jurisdiction) or every US state
  // insurance regulator (--states).
  const jurWhere = STATES
    ? { companyId: cid, regulatorType: { notIn: ['FEDERAL_SECURITIES', 'INTERNATIONAL'] } }
    : FEDERAL ? { companyId: cid, regulatorType: 'FEDERAL_SECURITIES' }
    : JUR ? { companyId: cid, code: JUR.toUpperCase() } : null;
  if (!jurWhere) throw new Error('provide --jurisdiction <CODE>, --states, or --federal');
  const jurs = await prisma.jurisdiction.findMany({ where: jurWhere, select: { id: true, name: true } });
  if (!jurs.length) throw new Error('no matching jurisdictions');
  const jurIds = jurs.map((j) => j.id);
  const jurLabel = STATES ? `${jurs.length} states` : FEDERAL ? `${jurs.length} federal regulators` : jurs[0].name;

  if (FORCE) {
    // Undo a prior run: delete derived children, reset sources to ACTIVE + clear links.
    const derived = await prisma.regulatoryRequirement.findMany({ where: { companyId: cid, jurisdictionId: { in: jurIds }, sourceNote: { startsWith: 'derivedFrom:' } }, select: { id: true } });
    const derivedIds = derived.map((d) => d.id);
    await prisma.$transaction([
      prisma.nodeRegulation.deleteMany({ where: { regId: { in: derivedIds } } }),
      prisma.roleRegulation.deleteMany({ where: { regId: { in: derivedIds } } }),
      prisma.regulatoryRequirement.deleteMany({ where: { id: { in: derivedIds } } }),
    ]);
    const reset = await prisma.regulatoryRequirement.findMany({ where: { companyId: cid, jurisdictionId: { in: jurIds } }, select: { id: true } });
    const srcIds = reset.map((s) => s.id);
    await prisma.$transaction([
      prisma.nodeRegulation.deleteMany({ where: { regId: { in: srcIds } } }),
      prisma.roleRegulation.deleteMany({ where: { regId: { in: srcIds } } }),
      prisma.regulatoryRequirement.updateMany({ where: { id: { in: srcIds } }, data: { status: 'ACTIVE', supersededById: null, regime: null } }),
    ]);
    console.log(`FORCE: removed ${derivedIds.length} derived, reset ${srcIds.length} sources`);
  }

  // Unprocessed = ACTIVE, not a derived child, and no owner wired yet.
  const sources = await prisma.regulatoryRequirement.findMany({
    where: {
      companyId: cid, jurisdictionId: { in: jurIds }, status: 'ACTIVE',
      roleRegulations: { none: {} },
      NOT: { sourceNote: { startsWith: 'derivedFrom:' } },
    },
    orderBy: [{ jurisdictionId: 'asc' }, { category: 'asc' }, { title: 'asc' }],
    select: { id: true, title: true, category: true, requirement: true, lineOfBusiness: true, citation: true, citationUrl: true, agentSkill: true, confidence: true, tenantId: true, jurisdictionId: true },
    ...(LIMIT ? { take: LIMIT } : {}),
  });
  console.log(`source requirements to decompose: ${sources.length} (${jurLabel})`);
  if (!sources.length) return;
  if (DRY) {
    console.log('catalog head:\n' + catNodes.slice(0, 8).map((n, i) => `${i + 1}. ${n.label}`).join('\n'));
    console.log('\nsources:', sources.map((s) => s.title));
    return;
  }

  let atomsCreated = 0, split = 0, inPlace = 0, roleLinks = 0, nodeLinks = 0;
  const unresolved = new Set<string>();

  const process1 = async (r: (typeof sources)[number]) => {
    let out: Out;
    try { out = await callOne(catalog, roleCat, r); }
    catch (e) { console.error(`  failed (${r.title}):`, (e as Error).message); return; }
    const atoms = out.atoms.filter((a) => a.title && a.description);
    if (!atoms.length) { console.warn(`  no atoms for ${r.title}`); return; }

    const resolveLinks = (a: Atom) => {
      const ownerId = roleAt(a.ownerRef);
      if (!ownerId) unresolved.add(String(a.ownerRef));
      const contribs = a.contributorRefs.map(roleAt).filter((x): x is string => !!x);
      const nodeIds = [...new Set(a.nodeRefs.map((n) => catNodes[n - 1]?.id).filter((x): x is string => !!x))];
      // Owner must not also be a contributor.
      const contribIds = [...new Set(contribs)].filter((id) => id !== ownerId);
      return { ownerId, contribIds, nodeIds };
    };

    const wire = async (tx: typeof prisma, regId: string, a: Atom) => {
      const { ownerId, contribIds, nodeIds } = resolveLinks(a);
      if (ownerId) { await tx.roleRegulation.upsert({ where: { roleId_regId_role_: { roleId: ownerId, regId, role_: 'Owner' } }, create: { companyId: cid, roleId: ownerId, regId, role_: 'Owner' }, update: {} }); roleLinks++; }
      for (const rid of contribIds) { await tx.roleRegulation.upsert({ where: { roleId_regId_role_: { roleId: rid, regId, role_: 'Contributor' } }, create: { companyId: cid, roleId: rid, regId, role_: 'Contributor' }, update: {} }); roleLinks++; }
      for (const nid of nodeIds) { await tx.nodeRegulation.upsert({ where: { processNodeId_regId: { processNodeId: nid, regId } }, create: { companyId: cid, processNodeId: nid, regId, relationship: 'GOVERNS' }, update: {} }); nodeLinks++; }
    };

    const regimeOf = (a: Atom) => REGIME || a.regime || null; // --regime override wins, else AI-inferred
    await prisma.$transaction(async (tx) => {
      if (atoms.length === 1) {
        const a = atoms[0];
        await tx.regulatoryRequirement.update({
          where: { id: r.id },
          data: { title: a.title, requirement: a.description, category: a.category, obligationType: a.obligationType, frequency: a.frequency ?? null, regime: regimeOf(a) },
        });
        await wire(tx, r.id, a);
        inPlace++;
      } else {
        let firstChildId: string | null = null;
        for (const a of atoms) {
          const child = await tx.regulatoryRequirement.create({
            data: {
              tenantId: r.tenantId, companyId: cid, jurisdictionId: r.jurisdictionId,
              category: a.category, title: a.title, requirement: a.description,
              lineOfBusiness: r.lineOfBusiness, citation: r.citation, citationUrl: r.citationUrl,
              obligationType: a.obligationType, frequency: a.frequency ?? null,
              status: 'ACTIVE', regime: regimeOf(a), agentSkill: r.agentSkill, confidence: r.confidence,
              sourceNote: `derivedFrom:${r.id}`,
            },
          });
          if (!firstChildId) firstChildId = child.id;
          await wire(tx, child.id, a);
          atomsCreated++;
        }
        await tx.regulatoryRequirement.update({ where: { id: r.id }, data: { status: 'SUPERSEDED', supersededById: firstChildId } });
        split++;
      }
    });
    console.log(`  ✓ ${r.title} → ${atoms.length} atomic`);
  };

  for (let i = 0; i < sources.length; i += CONCURRENCY) {
    await Promise.all(sources.slice(i, i + CONCURRENCY).map(process1));
  }
  console.log(`\nDONE: ${inPlace} kept-atomic · ${split} split into ${atomsCreated} children · ${roleLinks} role links · ${nodeLinks} VS links`);
  if (unresolved.size) console.log(`unresolved role titles (${unresolved.size}): ${[...unresolved].slice(0, 40).join(', ')}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
