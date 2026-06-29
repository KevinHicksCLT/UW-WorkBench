import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { basename } from 'node:path';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { prisma } from '../db/prisma.js';
import { buildGroupings, generatedPackFiles, skillName, KEEP, type Grouping } from '../lib/skillPacks.js';

// ─── SDLC compliance agent skills (/standards-skills) ────────────────────────
// No filesystem. Two kinds of pack:
//  • Generated (per-category) — a pure function of the company's Standard rows;
//    built on demand via lib/skillPacks.ts. Read-only (edit the underlying
//    standards instead). Nothing is stored for these.
//  • Hand-authored (KEEP) — served from the SkillFile table; ADMIN-editable.
// The Standards screen views/downloads packs; Data Admin edits the editable ones.

const router = Router();
router.use(requireAuth);

const SKILL_RE = /^[a-z0-9-]+$/;
const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

async function activeCompanyId(req: Request, res: Response): Promise<string | null> {
  const requested = typeof req.query.companyId === 'string' ? req.query.companyId : '';
  const company = await prisma.company.findFirst({
    where: requested ? { id: requested, tenantId: req.tenantId } : { tenantId: req.tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!company) { res.status(404).json({ error: 'No company found' }); return null; }
  return company.id;
}

// Find the generated grouping whose skill name matches, if any.
async function findGenerated(companyId: string, skill: string): Promise<Grouping | null> {
  const groupings = await buildGroupings(companyId);
  return groupings.find((g) => skillName(g.category) === skill) ?? null;
}

// GET /standards-skills — list every pack (generated + hand-authored) with file counts.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;
    const groupings = await buildGroupings(companyId);
    const generated = groupings.map((g) => ({ name: skillName(g.category), files: generatedPackFiles(g).length }));

    const handGroups = await prisma.skillFile.groupBy({ by: ['skill'], where: { companyId }, _count: true });
    const handAuthored = handGroups.map((h) => ({ name: h.skill, files: h._count }));

    const skills = [...generated, ...handAuthored].sort((a, b) => a.name.localeCompare(b.name));
    res.json({ skills });
  } catch (e) { next(e); }
});

// GET /standards-skills/:skill — manifest + the SKILL.md content.
router.get('/:skill', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skill = req.params.skill;
    if (!SKILL_RE.test(skill)) return res.status(404).json({ error: 'Skill not found' });
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;

    if (!KEEP.has(skill)) {
      const g = await findGenerated(companyId, skill);
      if (g) {
        const packFiles = generatedPackFiles(g);
        const files = packFiles
          .map((f) => ({ path: f.path, bytes: bytes(f.content) }))
          .sort((a, b) => (a.path === 'SKILL.md' ? -1 : b.path === 'SKILL.md' ? 1 : a.path.localeCompare(b.path)));
        const skillMd = packFiles.find((f) => f.path === 'SKILL.md')?.content ?? null;
        return res.json({ name: skill, files, primary: 'SKILL.md', skillMd, editable: false });
      }
    }

    const rows = await prisma.skillFile.findMany({ where: { companyId, skill }, select: { path: true, bytes: true, content: true } });
    if (!rows.length) return res.status(404).json({ error: 'Skill not found' });
    const files = rows
      .map((r) => ({ path: r.path, bytes: r.bytes }))
      .sort((a, b) => (a.path === 'SKILL.md' ? -1 : b.path === 'SKILL.md' ? 1 : a.path.localeCompare(b.path)));
    const skillMd = rows.find((r) => r.path === 'SKILL.md')?.content ?? null;
    res.json({ name: skill, files, primary: 'SKILL.md', skillMd, editable: true });
  } catch (e) { next(e); }
});

// GET /standards-skills/:skill/file?path=<relative> — raw text of one file.
router.get('/:skill/file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skill = req.params.skill;
    if (!SKILL_RE.test(skill)) return res.status(404).json({ error: 'Skill not found' });
    const rel = typeof req.query.path === 'string' ? req.query.path : '';
    if (!rel) return res.status(400).json({ error: 'Invalid file path' });
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;

    if (!KEEP.has(skill)) {
      const g = await findGenerated(companyId, skill);
      if (g) {
        const f = generatedPackFiles(g).find((x) => x.path === rel);
        if (!f) return res.status(404).json({ error: 'File not found' });
        return res.json({ path: rel, name: basename(rel), content: f.content });
      }
    }

    const row = await prisma.skillFile.findUnique({
      where: { companyId_skill_path: { companyId, skill, path: rel } },
      select: { content: true },
    });
    if (!row) return res.status(404).json({ error: 'File not found' });
    res.json({ path: rel, name: basename(rel), content: row.content });
  } catch (e) { next(e); }
});

// PUT /standards-skills/:skill/file — overwrite a file's content. ADMIN only.
// Generated packs are read-only (edit the underlying standards). Hand-authored
// packs write to the SkillFile row (which must already exist). Audited.
router.put('/:skill/file', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skill = req.params.skill;
    if (!SKILL_RE.test(skill)) return res.status(404).json({ error: 'Skill not found' });
    const rel = typeof req.body?.path === 'string' ? req.body.path : '';
    const content = req.body?.content;
    if (!rel) return res.status(400).json({ error: 'Invalid file path' });
    if (typeof content !== 'string') return res.status(400).json({ error: 'content (string) is required' });
    const companyId = await activeCompanyId(req, res);
    if (!companyId) return;

    if (!KEEP.has(skill)) {
      const g = await findGenerated(companyId, skill);
      if (g) return res.status(405).json({ error: 'Generated packs are read-only; edit the underlying standards instead.' });
    }

    const existing = await prisma.skillFile.findUnique({
      where: { companyId_skill_path: { companyId, skill, path: rel } },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'File not found' });

    await prisma.skillFile.update({ where: { id: existing.id }, data: { content, bytes: bytes(content) } });
    logAudit({
      tenantId: req.tenantId,
      actorEmail: req.user.email,
      entityType: 'SkillFile',
      entityId: `${skill}/${rel}`,
      action: 'UPDATE',
      diff: { bytes: content.length },
    });
    res.json({ path: rel, name: basename(rel), bytes: content.length });
  } catch (e) { next(e); }
});

export default router;
