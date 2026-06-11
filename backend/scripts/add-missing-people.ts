// add-missing-people.ts — additive person seeding for roles that have NO
// assignments (roles added after the last seedDeepLevels run, e.g. the Life &
// Retirement set). Mirrors seedDeepLevels' generation exactly (same hash, same
// id scheme per_<roleId>_<i>, same employment/region/metric/signal/app logic)
// but touches only the empty roles — it never deletes or rewrites existing
// people the way seedDeepLevels' clear pass does.
//
// Run from backend/:  npx tsx scripts/add-missing-people.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
const pickFrom = <T>(seed: number, arr: T[]): T => arr[seed % arr.length];

const FIRST = ['Alex', 'Priya', 'Wei', 'Maria', 'James', 'Aisha', 'Diego', 'Yuki', 'Omar', 'Sofia', 'Liam', 'Nina', 'Raj', 'Elena', 'Kwame', 'Hana', 'Tomas', 'Ivy', 'Noah', 'Zara', 'Mateo', 'Lena', 'Arjun', 'Mei', 'Caleb', 'Fatima', 'Pavel', 'Grace'];
const LAST = ['Chen', 'Patel', 'Garcia', 'Smith', 'Okoro', 'Kim', 'Nguyen', 'Singh', 'Rossi', 'Haddad', 'Muller', 'Silva', 'Khan', 'Ivanova', 'Mensah', 'Sato', 'Costa', 'Brown', 'Lee', 'Ali', 'Novak', 'Reyes', 'Dubois', 'Yilmaz', 'Walsh', 'Park', 'Adeyemi', 'Cohen'];
const VENDORS = ['Infosys', 'TCS', 'Accenture', 'Cognizant', 'Capgemini', 'Wipro'];
const OFFSHORE_LOC = ['Bengaluru, IN', 'Pune, IN', 'Hyderabad, IN', 'Manila, PH'];
const NEARSHORE_LOC = ['Krakow, PL', 'Lisbon, PT', 'San Jose, CR'];
const ONSHORE_LOC = ['London, UK', 'New York, US', 'Chicago, US', 'Toronto, CA'];
const PERIODS = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
const CONTRACTOR_HEAVY = ['technology', 'data', 'claims', 'cybersecurity'];
const TECH_APPS = [
  { appName: 'VS Code', category: 'IDE' }, { appName: 'IntelliJ IDEA', category: 'IDE' },
  { appName: 'GitHub', category: 'IDE' }, { appName: 'Microsoft Teams', category: 'Comms' },
  { appName: 'Jira', category: 'Productivity' }, { appName: 'Snowflake', category: 'Analytics' },
  { appName: 'Azure Portal', category: 'Domain' },
];
const BIZ_APPS = [
  { appName: 'Outlook', category: 'Comms' }, { appName: 'Microsoft Teams', category: 'Comms' },
  { appName: 'Excel', category: 'Productivity' }, { appName: 'Power BI', category: 'Analytics' },
  { appName: 'Guidewire', category: 'Domain' }, { appName: 'ServiceNow', category: 'Domain' },
  { appName: 'Salesforce', category: 'Domain' },
];
const APP_WEIGHTS = [40, 28, 20, 12];

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true, tenantId: true, name: true } });
  if (!company) throw new Error('No company found.');
  const { id: companyId, tenantId } = company;

  const roles = await prisma.role.findMany({
    where: { companyId, assignments: { none: {} } },
    select: { id: true, name: true, divisionId: true, division: { select: { name: true } }, roleTasks: { select: { text: true }, take: 8 } },
  });
  console.log(`Roles with no people: ${roles.length}${roles.length ? ' — ' + roles.map((r) => r.name).join(', ') : ''}`);
  if (!roles.length) return;

  const people: any[] = [], assignments: any[] = [], tasks: any[] = [], metrics: any[] = [];
  const signals: any[] = [], appUsage: any[] = [];
  const GENERIC = ['Refine backlog item', 'Implement feature', 'Peer code review', 'Resolve defects', 'Update runbook', 'Prepare release notes'];
  for (const role of roles) {
    const dName = role.division?.name ?? '';
    const heavy = CONTRACTOR_HEAVY.some((s) => dName.toLowerCase().includes(s));
    const count = 2 + (hash(role.name) % 3);
    for (let i = 0; i < count; i++) {
      const pid = `per_${role.id}_${i}`;
      const h = hash(`${role.id}:${i}`);
      const name = `${pickFrom(h, FIRST)} ${pickFrom(h >> 5, LAST)}`;
      const employmentType = (h % 100) < (heavy ? 65 : 15) ? (h % 7 === 0 ? 'si_partner' : 'contractor') : 'badged';
      const r = h % 100;
      const region = r < 60 ? 'Offshore' : r < 70 ? 'Nearshore' : 'Onshore';
      const vendor: string | null = employmentType !== 'badged' ? pickFrom(h >> 3, VENDORS) : null;
      const location = region === 'Offshore' ? pickFrom(h >> 7, OFFSHORE_LOC) : region === 'Nearshore' ? pickFrom(h >> 7, NEARSHORE_LOC) : pickFrom(h >> 7, ONSHORE_LOC);
      people.push({ id: pid, tenantId, companyId, name, email: `${name.replace(/[^a-z]+/gi, '.').toLowerCase()}@example.com`, employmentType, vendor, location, region, title: role.name, illustrative: true });
      assignments.push({ id: `asg_${pid}`, tenantId, personId: pid, roleId: role.id, initiativeId: null, employmentType, allocationPct: 50 + (h % 51), isPrimary: true, illustrative: true });

      const roleTexts = role.roleTasks.map((t) => t.text);
      const tcount = 3 + (h % 4);
      for (let t = 0; t < tcount; t++) {
        const th = hash(`${pid}:t${t}`);
        const title = (roleTexts.length ? roleTexts[th % roleTexts.length] : GENERIC[th % GENERIC.length]).slice(0, 140);
        tasks.push({ tenantId, personId: pid, title, status: pickFrom(th, ['In Progress', 'In Progress', 'Done', 'Done', 'To Do', 'Blocked']), priority: pickFrom(th >> 3, ['High', 'Medium', 'Medium', 'Low']), illustrative: true });
      }
      const tech = /engineer|developer|data|devops|architect|analyst|scientist|sre|platform/i.test(role.name);
      for (const period of PERIODS) {
        const mh = hash(`${pid}:${period}`);
        const mp = (lo: number, hi: number, salt: number) => lo + (((mh >> (salt % 20)) % 1000) / 1000) * (hi - lo);
        metrics.push(
          { tenantId, personId: pid, period, name: 'Throughput', value: Math.round(mp(8, 40, 1)), unit: '/mo', target: null, direction: 'up', illustrative: true },
          { tenantId, personId: pid, period, name: 'Quality', value: Math.round(mp(80, 99, 5)), unit: '%', target: 95, direction: 'up', illustrative: true },
          { tenantId, personId: pid, period, name: 'Utilization', value: Math.round(mp(60, 98, 9)), unit: '%', target: 85, direction: 'up', illustrative: true },
          { tenantId, personId: pid, period, name: 'Cycle time', value: Math.round(mp(2, 15, 13) * 10) / 10, unit: 'days', target: 5, direction: 'down', illustrative: true },
        );
        const sh = hash(`${pid}:sig:${period}`);
        const sp = (lo: number, hi: number, salt: number) => Math.round((lo + (((sh >> (salt % 20)) % 1000) / 1000) * (hi - lo)) * 10) / 10;
        signals.push(
          { tenantId, personId: pid, period, name: 'Time online', value: sp(6, 9.5, 1), unit: 'hrs/day', illustrative: true },
          { tenantId, personId: pid, period, name: 'GitHub activity', value: tech ? sp(8, 60, 3) : sp(0, 6, 3), unit: 'commits/mo', illustrative: true },
          { tenantId, personId: pid, period, name: 'Team messages', value: sp(20, 140, 5), unit: 'msgs/wk', illustrative: true },
          { tenantId, personId: pid, period, name: 'Focus hours', value: sp(8, 26, 7), unit: 'hrs/wk', illustrative: true },
          { tenantId, personId: pid, period, name: 'Meetings', value: sp(3, 22, 9), unit: 'hrs/wk', illustrative: true },
        );
      }
      const pool = tech ? TECH_APPS : BIZ_APPS;
      const start = hash(`${pid}:apps`) % pool.length;
      const ordered = [...pool.slice(start), ...pool.slice(0, start)].slice(0, APP_WEIGHTS.length);
      ordered.forEach((app, idx) => {
        appUsage.push({ tenantId, personId: pid, appName: app.appName, category: app.category, usagePct: APP_WEIGHTS[idx], rank: idx + 1, illustrative: true });
      });
    }
  }
  await prisma.person.createMany({ data: people, skipDuplicates: true });
  await prisma.assignment.createMany({ data: assignments, skipDuplicates: true });
  await prisma.personTask.createMany({ data: tasks });
  await prisma.personMetric.createMany({ data: metrics });
  await prisma.personSignal.createMany({ data: signals });
  await prisma.personAppUsage.createMany({ data: appUsage });
  console.log(`   + ${people.length} people, ${assignments.length} assignments, ${tasks.length} person-tasks, ${metrics.length} metrics, ${signals.length} signals, ${appUsage.length} app-usage rows`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
