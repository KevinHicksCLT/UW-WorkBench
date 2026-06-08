import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth } from '../middleware/auth.js';

// ─── SDLC compliance agent skills (GET /standards-skills) ────────────────────
// Serves the markdown skill packs that live in the repo's standards/skills/
// folder (SKILL.md + phase guides + references), so the Standards screen can let
// a user VIEW a standard's enforcing skill and DOWNLOAD its files. Read-only;
// every path is validated to stay inside the skills root (no traversal).

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

export default router;
