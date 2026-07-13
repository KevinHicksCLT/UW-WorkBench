// Cross-check dec-*.json against catalogs.json + task inputs. No DB.
// Run: node scripts/uw-enrichment/validate-decs.mjs   (from backend/)
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const cat = JSON.parse(readFileSync(join(DIR, 'catalogs.json'), 'utf8'));
const exp = JSON.parse(readFileSync(join(DIR, 'export.json'), 'utf8'));

const roleIds = new Set(cat.roles.map((r) => r.id));
const appIds = new Set(cat.applications.map((a) => a.id));
const stdIds = new Set(cat.standards.map((s) => s.id));
const regIds = new Set(cat.regulations.map((r) => r.id));
const keyIds = new Set();
const customIds = new Set();
const taskById = new Map();
const norm = (s) => s.trim().toLowerCase();
for (const t of exp.tasks) {
  taskById.set(t.id, t);
  for (const tp of t.templates) for (const k of tp.keys) keyIds.add(k.id);
  for (const c of t.customKeys) customIds.add(c.answerId);
}

const errs = [];
const warns = [];
let nTasks = 0, nAns = 0, nStd = 0, nReg = 0;
const seenTask = new Set();
const roleDist = {};

const files = readdirSync(DIR).filter((f) => /^dec-\d+\.json$/.test(f)).sort();
for (const f of files) {
  let dec;
  try { dec = JSON.parse(readFileSync(join(DIR, f), 'utf8')); }
  catch (e) { errs.push(`${f}: JSON parse fail — ${e.message}`); continue; }
  if (!Array.isArray(dec.tasks)) { errs.push(`${f}: no tasks[]`); continue; }
  for (const d of dec.tasks) {
    const t = taskById.get(d.id);
    if (!t) { errs.push(`${f}: unknown task id ${d.id}`); continue; }
    if (seenTask.has(d.id)) errs.push(`${f}: duplicate task ${t.name}`);
    seenTask.add(d.id);
    nTasks++;
    const curNames = new Map(t.roles.map((r) => [norm(r.name), r]));
    const curAppNames = new Set(t.apps.map((a) => norm(a.name)));
    // owner
    const curOwner = t.roles.find((r) => r.relation === 'Owner');
    const ownerAfter = d.owner?.action === 'replace' ? 1 : curOwner ? 1 : 0;
    if (ownerAfter === 0) errs.push(`${f}/${t.name}: no Owner after`);
    // removeRoleNames must match current roles
    for (const n of d.removeRoleNames ?? [])
      if (!curNames.has(norm(n))) warns.push(`${f}/${t.name}: removeRole "${n}" not a current role`);
    for (const n of d.removeAppNames ?? [])
      if (!curAppNames.has(norm(n))) warns.push(`${f}/${t.name}: removeApp "${n}" not a current app`);
    for (const a of d.addApps ?? [])
      if (!['performed', 'memorialized'].includes(a.usageType)) errs.push(`${f}/${t.name}: bad usageType ${a.usageType}`);
    // final role count
    const removes = new Set((d.removeRoleNames ?? []).map(norm));
    const kept = t.roles.filter((r) => !removes.has(norm(r.name)) && !(d.owner?.action === 'replace' && r.relation === 'Owner'));
    const finalRoles = kept.length + (d.owner?.action === 'replace' ? 1 : 0) + (d.addParticipants ?? []).length;
    roleDist[finalRoles] = (roleDist[finalRoles] ?? 0) + 1;
    if (finalRoles > 4) warns.push(`${f}/${t.name}: ${finalRoles} roles after (target 2-3)`);
    // answers
    for (const a of d.answers ?? []) {
      nAns++;
      if (a.templateKeyId) {
        if (!keyIds.has(a.templateKeyId)) errs.push(`${f}/${t.name}: bad templateKeyId ${a.templateKeyId}`);
      } else if (a.answerId) {
        if (!customIds.has(a.answerId)) warns.push(`${f}/${t.name}: answerId ${a.answerId} not a known customKey`);
      } else errs.push(`${f}/${t.name}: answer has neither templateKeyId nor answerId`);
      if (a.applicationId && !appIds.has(a.applicationId)) errs.push(`${f}/${t.name}: bad applicationId ${a.applicationId}`);
      if (a.roleId && !roleIds.has(a.roleId)) errs.push(`${f}/${t.name}: bad roleId ${a.roleId}`);
      const hasVal = a.value != null || a.applicationId || a.roleId || a.newApplication || a.newRole;
      if (!hasVal) warns.push(`${f}/${t.name}: empty answer`);
    }
    // coverage: every generic key answered?
    const answered = new Set((d.answers ?? []).filter((a) => a.templateKeyId).map((a) => a.templateKeyId));
    const allKeys = t.templates.flatMap((tp) => tp.keys.map((k) => k.id));
    const missing = allKeys.filter((k) => !answered.has(k));
    if (missing.length) warns.push(`${f}/${t.name}: ${missing.length}/${allKeys.length} generic keys unanswered`);
    // ties
    for (const s of d.standards ?? []) {
      nStd++;
      if (!s.standardId || !stdIds.has(s.standardId)) errs.push(`${f}/${t.name}: bad standardId ${s.standardId}`);
    }
    for (const r of d.regulations ?? []) {
      nReg++;
      if (!r.regId || !regIds.has(r.regId)) errs.push(`${f}/${t.name}: bad regId ${r.regId}`);
    }
  }
}
console.log(`files=${files.length} tasks=${nTasks} answers=${nAns} stdTies=${nStd} regTies=${nReg}`);
console.log('final-role-count dist:', Object.entries(roleDist).sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k}:${v}`).join(' '));
console.log(`ERRORS: ${errs.length}`);
errs.slice(0, 40).forEach((e) => console.log('  E', e));
console.log(`WARNINGS: ${warns.length}`);
warns.slice(0, 30).forEach((w) => console.log('  W', w));
