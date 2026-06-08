import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

// ─── SDLC compliance agent skills (/standards-skills) ────────────────────────
// Serves + edits the markdown skill packs that live in the repo's
// standards/skills/ folder (SKILL.md + phase guides + references). The Standards
// screen views/downloads them; Data Admin edits them (ADMIN-only PUT). Every path
// is validated to stay inside the skills root (no traversal); text files only.

const router = Router();
router.use(requireAuth);

// backend/src/routes -> repo root -> standards/skills
const SKILLS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../standards/skills');

const SKILL_RE = /^[a-z0-9-]+$/;
const TEXT_EXT = /\.(md|json|csv|txt)$/i;

// Resolve + validate a skill directory; null if the name is unsafe or missing.
function skillDir(skill: string): string | null {
  if (!SKILL_RE.test(skill)) return null;
  const dir = resolve(SKILLS_ROOT, skill);
  if (!dir.startsWith(SKILLS_ROOT + sep)) return null;
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return null;
  return dir;
}

// Recursively list the text files in a skill folder, as repo-relative POSIX paths.
function listFiles(dir: string): { path: string; bytes: number }[] {
  const out: { path: string; bytes: number }[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      const full = resolve(d, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (TEXT_EXT.test(entry)) out.push({ path: relative(dir, full).split(sep).join('/'), bytes: st.size });
    }
  };
  walk(dir);
  // SKILL.md first, then the rest alphabetically.
  return out.sort((a, b) => (a.path === 'SKILL.md' ? -1 : b.path === 'SKILL.md' ? 1 : a.path.localeCompare(b.path)));
}

// GET /standards-skills — list the available skill packs (folders with a SKILL.md).
router.get('/', (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!existsSync(SKILLS_ROOT)) return res.json({ skills: [] });
    const skills = readdirSync(SKILLS_ROOT)
      .filter((name) => SKILL_RE.test(name) && existsSync(resolve(SKILLS_ROOT, name, 'SKILL.md')))
      .map((name) => ({ name, files: listFiles(resolve(SKILLS_ROOT, name)).length }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ skills });
  } catch (e) { next(e); }
});

// GET /standards-skills/:skill — manifest + the SKILL.md content (the primary doc).
router.get('/:skill', (req: Request, res: Response, next: NextFunction) => {
  try {
    const dir = skillDir(req.params.skill);
    if (!dir) return res.status(404).json({ error: 'Skill not found' });
    const files = listFiles(dir);
    const skillMdPath = resolve(dir, 'SKILL.md');
    const skillMd = existsSync(skillMdPath) ? readFileSync(skillMdPath, 'utf8') : null;
    res.json({ name: req.params.skill, files, primary: 'SKILL.md', skillMd });
  } catch (e) { next(e); }
});

// GET /standards-skills/:skill/file?path=<relative> — raw text content of one file.
router.get('/:skill/file', (req: Request, res: Response, next: NextFunction) => {
  try {
    const dir = skillDir(req.params.skill);
    if (!dir) return res.status(404).json({ error: 'Skill not found' });
    const rel = typeof req.query.path === 'string' ? req.query.path : '';
    if (!rel || !TEXT_EXT.test(rel)) return res.status(400).json({ error: 'Invalid file path' });
    const full = resolve(dir, rel);
    if (!full.startsWith(dir + sep) || !existsSync(full) || !statSync(full).isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.json({ path: rel, name: basename(full), content: readFileSync(full, 'utf8') });
  } catch (e) { next(e); }
});

// PUT /standards-skills/:skill/file — overwrite a skill file's content. ADMIN
// only. The file must already exist (we edit, not create) and stay within the
// skill folder. Audited.
router.put('/:skill/file', requireRole('ADMIN'), (req: Request, res: Response, next: NextFunction) => {
  try {
    const dir = skillDir(req.params.skill);
    if (!dir) return res.status(404).json({ error: 'Skill not found' });
    const rel = typeof req.body?.path === 'string' ? req.body.path : '';
    const content = req.body?.content;
    if (!rel || !TEXT_EXT.test(rel)) return res.status(400).json({ error: 'Invalid file path' });
    if (typeof content !== 'string') return res.status(400).json({ error: 'content (string) is required' });
    const full = resolve(dir, rel);
    if (!full.startsWith(dir + sep) || !existsSync(full) || !statSync(full).isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }
    writeFileSync(full, content, 'utf8');
    logAudit({
      tenantId: req.tenantId,
      actorEmail: req.user.email,
      entityType: 'SkillFile',
      entityId: `${req.params.skill}/${rel}`,
      action: 'UPDATE',
      diff: { bytes: content.length },
    });
    res.json({ path: rel, name: basename(full), bytes: content.length });
  } catch (e) { next(e); }
});

export default router;
