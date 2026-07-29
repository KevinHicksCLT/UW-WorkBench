// POST /impact/summary — a fast AI read of an already-computed impact report.
// The deterministic report (from /impact/assess) is the ground truth; this
// endpoint only narrates it: what the change means, the biggest risk, the
// next step. Speed is a hard requirement — the panel shows the report
// instantly and this strip must land within the user's attention span — so
// the call runs on Haiku with a small token budget and a hard 4s race;
// on timeout or any failure the response is { summary: null } and the UI
// simply doesn't render the strip. Never blocks or fails the assessment.
import type { Router, Request, Response } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../lib/logger.js';

const MODEL = process.env.IMPACT_AI_MODEL ?? 'claude-haiku-4-5-20251001';
const TIMEOUT_MS = 4_000;

let client: Anthropic | null = null;
function anthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  // maxRetries 0: a retry cannot finish inside the 4s budget anyway.
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });
  return client;
}

const impactSchema = z.object({
  severity: z.enum(['BREAKING', 'HIGH', 'MEDIUM', 'LOW']),
  category: z.string().max(40),
  entityName: z.string().max(300),
  description: z.string().max(500),
});
const bodySchema = z.object({
  subject: z.object({
    kind: z.string().max(40),
    name: z.string().max(300),
    context: z.string().max(400).nullable().optional(),
  }),
  changeType: z.string().max(20),
  summary: z.object({
    breaking: z.number().int().min(0),
    high: z.number().int().min(0),
    medium: z.number().int().min(0),
    low: z.number().int().min(0),
  }),
  impacts: z.array(impactSchema).max(40),
});

const SYSTEM = [
  'You are the change-impact analyst inside an enterprise operating-model platform',
  '(value streams, processes, roles, applications, product models for an insurance carrier).',
  'You are given a deterministic impact report computed from the live operating-model graph.',
  'Write a 2-3 sentence executive assessment: what applying this change means operationally,',
  'the single biggest risk (name the concrete entities from the report), and the one action',
  'to take before proceeding. Ground every claim ONLY in the report given — never invent',
  'entities or numbers. Plain business language, no headings, no bullets, no preamble.',
].join(' ');

export function registerSummaryRoutes(router: Router): void {
  router.post('/summary', async (req: Request, res: Response) => {
    try {
      const parsed = bodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      }
      const ai = anthropic();
      if (!ai) return res.json({ summary: null });

      const { subject, changeType, summary, impacts } = parsed.data;
      const lines = impacts.map(
        (i) => `[${i.severity}] (${i.category}) ${i.entityName} — ${i.description}`,
      );
      const prompt = [
        `Change: ${changeType} "${subject.name}"${subject.context ? ` (${subject.context})` : ''} — subject kind: ${subject.kind}.`,
        `Totals: ${summary.breaking} breaking, ${summary.high} high, ${summary.medium} medium, ${summary.low} info.`,
        'Impact report:',
        ...lines,
      ].join('\n');

      const call = ai.messages.create({
        model: MODEL,
        max_tokens: 220,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      });
      const timeout = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), TIMEOUT_MS).unref();
      });
      const result = await Promise.race([call, timeout]);
      if (!result) return res.json({ summary: null });

      const text = result.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join(' ')
        .trim();
      res.json({ summary: text || null });
    } catch (e) {
      // The strip is optional garnish — an upstream AI error must never surface
      // as a failed request in the panel.
      logger.warn({ err: e }, 'impact summary failed');
      res.json({ summary: null });
    }
  });
}
