// extract-org-from-develop.ts — ONE-TIME extractor (run manually, NOT at seed time).
//
// Pulls the OLD org spine (Division / Department / Role) from the `develop` Neon
// branch and writes it to backend/data/seed/org-from-develop.json, which the
// idempotent seedOrgFromDevelop loader reads at seed time (like the standards
// seeder — never hits develop during a normal `npm run db:seed`).
//
// develop has: Division(15), Department(99, FK divisionId),
//   Role(299, FK divisionId + departmentId; fields name, roleLevel, roleFamily, description).
//
// Run:  npx tsx scripts/extract-org-from-develop.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const DEV_URL =
  'postgresql://neondb_owner:npg_Zcwv5KgEFI7y@ep-raspy-boat-aq1uy5u0-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../data/seed/org-from-develop.json');

async function main() {
  const client = new pg.Client({ connectionString: DEV_URL });
  await client.connect();
  try {
    const divisions = (
      await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM public."Division" ORDER BY name`,
      )
    ).rows;

    const departments = (
      await client.query<{ id: string; name: string; divisionId: string; divisionName: string }>(
        `SELECT d.id, d.name, d."divisionId", v.name AS "divisionName"
           FROM public."Department" d
           JOIN public."Division" v ON v.id = d."divisionId"
          ORDER BY v.name, d.name`,
      )
    ).rows;

    const roles = (
      await client.query<{
        id: string; name: string; roleLevel: string | null; roleFamily: string | null;
        description: string | null; divisionName: string | null; departmentName: string | null;
      }>(
        `SELECT r.id, r.name, r."roleLevel", r."roleFamily", r.description,
                v.name AS "divisionName", d.name AS "departmentName"
           FROM public."Role" r
           LEFT JOIN public."Division"   v ON v.id = r."divisionId"
           LEFT JOIN public."Department" d ON d.id = r."departmentId"
          ORDER BY r.name`,
      )
    ).rows;

    const payload = {
      source: 'develop branch (ep-raspy-boat) — Division/Department/Role',
      extractedAt: new Date().toISOString(),
      divisions: divisions.map((d) => ({ name: d.name })),
      departments: departments.map((d) => ({ name: d.name, division: d.divisionName })),
      roles: roles.map((r) => ({
        name: r.name,
        division: r.divisionName,
        department: r.departmentName,
        roleLevel: r.roleLevel,
        roleFamily: r.roleFamily,
        description: r.description,
      })),
    };

    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(payload, null, 2));
    console.log(`Wrote ${OUT}`);
    console.log(`  divisions: ${payload.divisions.length}`);
    console.log(`  departments: ${payload.departments.length}`);
    console.log(`  roles: ${payload.roles.length}`);
    const noDept = payload.roles.filter((r) => !r.department).length;
    const noDiv = payload.roles.filter((r) => !r.division).length;
    console.log(`  roles without department: ${noDept}; without division: ${noDiv}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
