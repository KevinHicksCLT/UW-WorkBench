// Normalize an authored Phase-A part file before loading.
//
// Authoring agents drift on the shape of the link arrays — most often emitting
// `regs` (and sometimes `apps`) as bare id strings instead of the {regId, rel} /
// {appId, use} objects the loader expects. load-enrichment reads `r.regId` off a
// string, gets undefined, and silently SKIPs the row, so the enrichment loads
// looking clean while quietly losing links. This coerces the known-good shapes
// and drops ids that are not in the catalog, reporting both.
//
//   node scripts/enrich/normalize-part.mjs <slug> [<vs-catalog-slug>]
//
// Rewrites scripts/output/enrichment-part-<slug>.json in place.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const slug = process.argv[2];
const catSlug = process.argv[3];
if (!slug) throw new Error('usage: normalize-part.mjs <slug> [<vs-catalog-slug>]');

const partPath = `scripts/output/enrichment-part-${slug}.json`;
const catPath = catSlug
  ? `scripts/output/enrich-catalog-${catSlug}.json`
  : 'scripts/output/enrich-catalog.json';
if (!existsSync(catPath)) throw new Error(`missing catalog ${catPath}`);

const cat = JSON.parse(readFileSync(catPath, 'utf8'));
const valid = {
  role: new Set(cat.roles.map((r) => r.id)),
  app: new Set(cat.apps.map((a) => a.id)),
  standard: new Set(cat.standards.map((s) => s.id)),
  reg: new Set(cat.regs.map((r) => r.id)),
};

const tasks = JSON.parse(readFileSync(partPath, 'utf8'));
const stat = { regShape: 0, appShape: 0, dropped: 0 };

for (const t of tasks) {
  t.regs = (t.regs ?? [])
    .map((r) => {
      if (typeof r === 'string') {
        stat.regShape++;
        return { regId: r, rel: 'GOVERNS' };
      }
      return r?.regId ? { regId: r.regId, rel: r.rel ?? 'GOVERNS' } : null;
    })
    .filter((r) => r && (valid.reg.has(r.regId) || (stat.dropped++, false)));

  t.apps = (t.apps ?? [])
    .map((a) => {
      if (typeof a === 'string') {
        stat.appShape++;
        return { appId: a, use: 'performed' };
      }
      return a?.appId ? { appId: a.appId, use: a.use ?? 'performed' } : null;
    })
    .filter((a) => a && (valid.app.has(a.appId) || (stat.dropped++, false)));

  t.roles = (t.roles ?? []).filter(
    (r) => r?.roleId && (valid.role.has(r.roleId) || (stat.dropped++, false)),
  );

  t.standards = (t.standards ?? []).filter(
    (s) => typeof s === 'string' && (valid.standard.has(s) || (stat.dropped++, false)),
  );
}

writeFileSync(partPath, JSON.stringify(tasks, null, 2));
console.log(
  `${slug}: tasks=${tasks.length} regShape=${stat.regShape} appShape=${stat.appShape} droppedUnknownIds=${stat.dropped}`,
);
