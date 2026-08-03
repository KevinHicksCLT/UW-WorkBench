// POST /impact/analyze — the AI deep-dive over an already-computed impact
// report. The deterministic report (from /impact/assess) is the ground truth;
// this endpoint enriches it: Claude reads the report PLUS a subject context
// pack pulled live from the operating-model graph and derives specific,
// forward-looking knock-on impacts for ALL six domains — including the ones
// the graph walk left empty. Lines come back flagged aiGenerated so the panel
// can badge them; on any failure or timeout the response is { impacts: [] }
// and the panel simply keeps the deterministic view.
import type { Router, Request, Response } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../../db/prisma.js';
import { logger } from '../../lib/logger.js';
import { activeCompany } from '../explorer/helpers.js';
import { subjectSchema } from './assess.js';
import { IMPACT_DOMAINS, type Impact } from './types.js';

const MODEL = process.env.IMPACT_ANALYZE_MODEL ?? 'claude-sonnet-5';
// A reasoning pass over a full context pack — allow real thinking time, but
// never hold the panel hostage: the spinner runs until this resolves.
const TIMEOUT_MS = 60_000;

let client: Anthropic | null = null;
function anthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  return client;
}

const reportLineSchema = z.object({
  domain: z.string().max(20),
  severity: z.string().max(10),
  entityName: z.string().max(300),
  description: z.string().max(500),
});
const bodySchema = z.object({
  changeType: z.string().max(20),
  subject: subjectSchema,
  subjectName: z.string().max(300),
  subjectContext: z.string().max(400).nullable().optional(),
  reportLines: z.array(reportLineSchema).max(60),
});

const aiItemSchema = z.object({
  domain: z.enum(IMPACT_DOMAINS),
  severity: z.enum(['BREAKING', 'HIGH', 'MEDIUM', 'LOW']),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
});
const aiResponseSchema = z.object({ impacts: z.array(aiItemSchema).max(30) });

type Subject = z.infer<typeof subjectSchema>;

const cap = <T>(xs: T[], n: number) => xs.slice(0, n);
const names = (xs: { name: string }[]) => cap(xs, 12).map((x) => x.name);

/** Pull a compact context pack about the subject from the live graph — the
 *  facts the AI grounds on beyond the deterministic report lines. */
async function contextPack(companyId: string, subject: Subject): Promise<string[]> {
  const lines: string[] = [];
  if (subject.kind === 'application') {
    const rAppIds = subject.rationalizationAppIds ?? [];
    const rApps = rAppIds.length
      ? await prisma.rationalizationApp.findMany({
          where: { id: { in: rAppIds }, companyId },
          select: { name: true, kind: true, applicationId: true },
        })
      : [];
    const appIds = [
      ...new Set([
        ...(subject.applicationIds ?? []),
        ...rApps.map((r) => r.applicationId).filter((id): id is string => !!id),
      ]),
    ];
    const [apps, screens] = await Promise.all([
      appIds.length
        ? prisma.application.findMany({
            where: { id: { in: appIds }, companyId },
            select: {
              name: true,
              kind: true,
              description: true,
              isInternal: true,
              orgUnit: { select: { displayValue: true } },
            },
          })
        : [],
      rAppIds.length
        ? prisma.screenAsset.findMany({
            where: { appId: { in: rAppIds }, companyId },
            select: { name: true },
            take: 12,
          })
        : [],
    ]);
    for (const a of apps) {
      lines.push(
        `Application: ${a.name} (${a.kind}${a.isInternal ? ', internal' : ', external'}${a.orgUnit ? `, owned by ${a.orgUnit.displayValue}` : ''})`,
      );
      if (a.description) lines.push(`What it does: ${a.description.slice(0, 400)}`);
    }
    for (const r of rApps) if (!r.applicationId) lines.push(`Board app: ${r.name} (${r.kind})`);
    if (screens.length) lines.push(`Documented screens: ${names(screens).join(', ')}`);
  } else if (subject.kind === 'role') {
    const role = await prisma.role.findFirst({
      where: { id: subject.roleId, companyId },
      select: {
        displayValue: true,
        description: true,
        orgUnit: { select: { displayValue: true } },
        roleDeliverables: { select: { deliverable: { select: { title: true } } }, take: 12 },
      },
    });
    if (role) {
      lines.push(
        `Role: ${role.displayValue}${role.orgUnit ? ` in ${role.orgUnit.displayValue}` : ''}`,
      );
      if (role.description) lines.push(`Role charter: ${role.description.slice(0, 400)}`);
      const delivs = role.roleDeliverables.map((d) => d.deliverable.title);
      if (delivs.length) lines.push(`Deliverables: ${delivs.join(', ')}`);
    }
  } else if (subject.kind === 'process-nodes') {
    const nodes = await prisma.processNode.findMany({
      where: { id: { in: subject.nodeIds }, companyId },
      select: { displayValue: true, description: true, isTask: true },
      take: 12,
    });
    for (const n of nodes) {
      lines.push(`Process ${n.isTask ? 'task' : 'node'}: ${n.displayValue}`);
      if (n.description) lines.push(`  ${n.description.slice(0, 250)}`);
    }
  } else {
    const lob = await prisma.productNode.findFirst({
      where: { id: subject.lobId, companyId },
      select: { displayValue: true },
    });
    if (lob) {
      lines.push(
        `Product element: ${subject.elementName ?? subject.component} in component "${subject.component}" of line of business "${lob.displayValue}"`,
      );
    }
  }
  return lines;
}

const SYSTEM = [
  'You are the change-impact analyst inside an enterprise operating-model platform for an',
  'insurance carrier (process value streams, roles, applications, product models, compliance).',
  'You receive: a proposed change, a deterministic impact report computed from the live',
  'operating-model graph, and a context pack about the subject. Derive the SPECIFIC knock-on',
  'impacts of applying the change across six domains: product (product models, variants,',
  'states), technology (core systems such as Guidewire/Duck Creek, rating engines, APIs,',
  'integrations), data (data model, data warehouse, analytics/reporting), operational',
  '(underwriting, service, claims, billing), compliance (state filings, forms, regulatory',
  'notices), testing (test scripts, UAT, regression packs).',
  'Rules: cover EVERY domain with exactly 2 concrete impacts each. Ground each impact in the',
  'report or context pack wherever they carry a relevant fact, and name those entities exactly;',
  'where the graph is silent, reason from what the subject IS (its name, kind, description)',
  'using insurance-industry knowledge — be concrete about WHAT breaks or must change and WHY,',
  'never generic filler like "review documentation". Do not restate a report line verbatim —',
  'add the consequence. Severity: BREAKING only when something stops working, HIGH for must-do',
  'rework, MEDIUM for coordinated updates, LOW for informational. Titles at most 8 words,',
  'descriptions 1-2 sentences. Report via the report_impacts tool.',
].join(' ');

const IMPACT_TOOL: Anthropic.Tool = {
  name: 'report_impacts',
  description: 'Report the derived knock-on impacts across all six domains.',
  input_schema: {
    type: 'object',
    required: ['impacts'],
    properties: {
      impacts: {
        type: 'array',
        maxItems: 30,
        items: {
          type: 'object',
          required: ['domain', 'severity', 'title', 'description'],
          properties: {
            domain: { type: 'string', enum: [...IMPACT_DOMAINS] },
            severity: { type: 'string', enum: ['BREAKING', 'HIGH', 'MEDIUM', 'LOW'] },
            title: { type: 'string', description: 'At most 8 words' },
            description: { type: 'string', description: '1-2 sentences' },
          },
        },
      },
    },
  },
};

/** Tool inputs come back in slightly different wrappings run to run —
 *  {impacts:[…]}, {impacts:{impacts:[…]}}, a stringified array, or the bare
 *  array. Normalize all of them to {impacts:[…]} before validating. */
function unwrapImpacts(raw: unknown): unknown {
  let cur: unknown = raw;
  for (let depth = 0; depth < 4; depth++) {
    if (Array.isArray(cur)) return { impacts: cur };
    if (!cur || typeof cur !== 'object') return raw;
    const inner = (cur as Record<string, unknown>).impacts;
    if (Array.isArray(inner)) return { impacts: inner };
    if (typeof inner === 'string') {
      // A stringified payload can itself be the array OR another wrapper
      // object — parse and keep unwrapping rather than returning as-is.
      try {
        cur = JSON.parse(inner);
        continue;
      } catch {
        return raw;
      }
    }
    cur = inner;
  }
  return raw;
}

export function registerAnalyzeRoutes(router: Router): void {
  router.post('/analyze', async (req: Request, res: Response) => {
    try {
      const parsed = bodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      }
      const ai = anthropic();
      if (!ai) return res.json({ impacts: [] });
      const company = await activeCompany(req, { id: true });
      if (!company) return res.status(404).json({ error: 'No company' });

      const { changeType, subject, subjectName, subjectContext, reportLines } = parsed.data;
      const pack = await contextPack(company.id, subject);
      const prompt = [
        `Proposed change: ${changeType} "${subjectName}"${subjectContext ? ` (${subjectContext})` : ''} — subject kind: ${subject.kind}.`,
        '',
        'Context pack (live graph):',
        ...(pack.length ? pack : ['(no additional context found)']),
        '',
        'Deterministic impact report:',
        ...(reportLines.length
          ? reportLines.map(
              (l) => `[${l.severity}] (${l.domain}) ${l.entityName} — ${l.description}`,
            )
          : ['(the graph walk found nothing linked to this subject)']),
      ].join('\n');

      // Forced tool use — the API returns the impacts as parsed JSON, so a
      // long response can never truncate into an unparseable string.
      const call = ai.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
        tools: [IMPACT_TOOL],
        tool_choice: { type: 'tool', name: 'report_impacts' },
      });
      const timeout = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), TIMEOUT_MS).unref();
      });
      const result = await Promise.race([call, timeout]);
      if (!result) return res.json({ impacts: [] });

      const block = result.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      const input = unwrapImpacts(block?.input);
      const json = aiResponseSchema.safeParse(input);
      if (!json.success) {
        logger.warn(
          {
            issues: json.error.issues.slice(0, 3),
            sample: JSON.stringify(input).slice(0, 600),
          },
          'impact analyze: bad AI shape',
        );
        return res.json({ impacts: [] });
      }
      // Derived lines wear the same category vocabulary as the graph-walk
      // lines — they read as part of one report, not a separate AI section.
      const categoryByDomain: Record<string, string> = {
        product: 'products',
        technology: 'applications',
        data: 'applications',
        operational: 'tasks',
        compliance: 'compliance',
        testing: 'testing',
      };
      const impacts: Impact[] = json.data.impacts.map((i) => ({
        severity: i.severity,
        domain: i.domain,
        category: categoryByDomain[i.domain] ?? 'scope',
        entityType: 'DerivedImpact',
        entityId: null,
        entityName: i.title,
        description: i.description,
      }));
      res.json({ impacts });
    } catch (e) {
      // The deep-dive is enrichment — an AI failure must never surface as a
      // failed request; the panel keeps the deterministic report.
      logger.warn({ err: e }, 'impact analyze failed');
      res.json({ impacts: [] });
    }
  });
}
