import pg from 'pg';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function main() {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const q = (sql: string) => c.query(sql).then((r) => r.rows);

  const [{ total }] = await q('select count(*)::int total from "RegulatoryRequirement"');
  const [{ flagged }] = await q(
    'select count(*)::int flagged from "RegulatoryRequirement" where "complianceFlagged"=true',
  );
  const byCategory = await q(
    'select category, count(*)::int n from "RegulatoryRequirement" group by 1 order by 2 desc',
  );
  const byRegime = await q(
    'select coalesce(regime,\'(none)\') regime, count(*)::int n from "RegulatoryRequirement" group by 1 order by 2 desc limit 25',
  );
  const byOblig = await q(
    'select "obligationType", count(*)::int n from "RegulatoryRequirement" group by 1 order by 2 desc',
  );
  const byStatus = await q(
    'select status, count(*)::int n from "RegulatoryRequirement" group by 1 order by 2 desc',
  );
  const distinctReg = await q(
    'select count(distinct title)::int titles, count(distinct citation)::int citations from "RegulatoryRequirement"',
  );
  const sample = await q(
    'select title, category, regime, citation, "lineOfBusiness", left(requirement,140) req from "RegulatoryRequirement" limit 6',
  );

  console.log(
    JSON.stringify(
      {
        total,
        flagged,
        distinctReg: distinctReg[0],
        byCategory,
        byRegime,
        byOblig,
        byStatus,
        sample,
      },
      null,
      2,
    ),
  );
  await c.end();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
