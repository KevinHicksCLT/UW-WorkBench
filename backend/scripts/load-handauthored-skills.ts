import 'dotenv/config';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db/prisma.js';
import { KEEP } from '../src/lib/skillPacks.js';

// Load the hand-authored compliance skill packs (KEEP) from disk into the
// SkillFile table so prod/serverless serves them without filesystem access.
// Generated packs are NOT loaded here — they're built on demand from Standards.
// Only text files the viewer serves are stored (md/json/csv/txt); the .mjs test
// harness stays on disk as repo tooling. Idempotent: upserts present files and
// prunes rows whose file no longer exists.

const SKILLS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../standards/skills');
const TEXT_EXT = /\.(md|json|csv|txt)$/i;

function textFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      const full = resolve(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (TEXT_EXT.test(entry)) out.push(relative(dir, full).split(sep).join('/'));
    }
  };
  walk(dir);
  return out;
}

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, name: true } });
  if (!company) throw new Error('No company');
  const companyId = company.id;

  let upserts = 0, pruned = 0, packs = 0;
  for (const skill of KEEP) {
    const dir = resolve(SKILLS_ROOT, skill);
    if (!existsSync(dir)) { console.warn(`skip ${skill}: not on disk`); continue; }
    packs++;
    const paths = textFiles(dir);
    for (const path of paths) {
      const content = readFileSync(resolve(dir, path), 'utf8');
      await prisma.skillFile.upsert({
        where: { companyId_skill_path: { companyId, skill, path } },
        update: { content, bytes: content.length },
        create: { companyId, skill, path, content, bytes: content.length },
      });
      upserts++;
    }
    const r = await prisma.skillFile.deleteMany({ where: { companyId, skill, path: { notIn: paths } } });
    pruned += r.count;
  }

  console.log(`${company.name}: loaded ${packs} hand-authored packs, ${upserts} files upserted, ${pruned} stale rows pruned.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
