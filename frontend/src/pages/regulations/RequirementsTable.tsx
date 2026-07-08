import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { withCompany } from '../../lib/portfolio';
import { Card } from '../../components/ui';
import { HeaderComboFilter } from '../../components/Sheet';
import { ListSearch } from '../../components/sheet/headerControls';
import { type VsLink } from '../../components/RequirementLinks';
import { catLabel, lobGroups, marketDisplay } from './Regulations';

// Server-driven requirements grid — the ONE table used for every regulations
// list (Regulations lens, regime page, catalog). Matches the dense Sheet look
// (grid with cell dividers + a per-column combobox filter on every level) but
// filters/sorts/pages in the API (single source of truth = the DB) and lazy-
// loads the next page on scroll, so it stays fast across the ~22k-row catalog.

export type ReqRow = {
  id: string;
  category: string;
  title: string;
  markets: string[];
  lineOfBusinessLinks: { lob: { code: string; label: string; group: string } }[];
  obligationType: string;
  frequency: string | null;
  confidence: string;
  regime: string | null;
  jurisdiction: { id: string; code: string; name: string; regulatorType: string };
  valueStreamLinks: VsLink[];
  owner: { id: string; name: string } | null;
  contributors: { id: string; name: string }[];
};
type Page = { rows: ReqRow[]; total: number; page: number; pageSize: number };
type Filters = {
  categories: string[];
  regimes: string[];
  jurisdictions: { code: string; name: string }[];
  owners: string[];
};

const MARKET_OPTS = ['All', 'Personal', 'Commercial', 'Both'];
const GROUP_OPTS = [
  'All',
  'Property',
  'Personal Auto',
  'Commercial Auto',
  'Liability',
  "Workers' Compensation",
  'Marine & Aviation',
  'Individual Life',
  'Group Life',
  'Individual Annuities',
  'Group Annuities',
  'Medical & Health',
  'Financial & Credit',
  'Title',
  'Reinsurance',
  'Alternative Risk',
  'Specialty & Other',
];
const PAGE_SIZE = 100;
const GRID = '150px 90px 150px 160px minmax(0,2fr) 140px minmax(0,1.2fr) 56px';

export function RequirementsTable({ baseParams }: { baseParams: Record<string, string> }) {
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const [filters, setFilters] = useState<Filters>({
    categories: [],
    regimes: [],
    jurisdictions: [],
    owners: [],
  });

  const [regulator, setRegulator] = useState<string[]>([]);
  const [market, setMarket] = useState<string[]>([]);
  const [group, setGroup] = useState<string[]>([]);
  const [regime, setRegime] = useState<string[]>([]);
  const [category, setCategory] = useState<string[]>([]);
  const [owner, setOwner] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  const [rows, setRows] = useState<ReqRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const baseKey = JSON.stringify(baseParams);

  useEffect(() => {
    if (!companyId) return;
    const params = new URLSearchParams(baseParams);
    api
      .get<Filters>(withCompany(`/regulations/requirement-filters?${params.toString()}`, companyId))
      .then(setFilters)
      .catch(() => setFilters({ categories: [], regimes: [], jurisdictions: [], owners: [] }));
  }, [companyId, baseKey]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const nameToCode = useMemo(
    () => new Map(filters.jurisdictions.map((j) => [j.name, j.code])),
    [filters.jurisdictions],
  );
  const catLabelToToken = useMemo(
    () => new Map(filters.categories.map((c) => [catLabel(c), c])),
    [filters.categories],
  );

  const queryParams = useCallback(
    (pageNum: number) => {
      const p = new URLSearchParams({
        ...baseParams,
        page: String(pageNum),
        pageSize: String(PAGE_SIZE),
      });
      if (regulator[0]) p.set('state', nameToCode.get(regulator[0]) ?? regulator[0]);
      if (market[0]) p.set('market', market[0] === 'Both' ? 'BOTH' : market[0].toUpperCase());
      if (group[0]) p.set('group', group[0]);
      if (regime[0]) p.set('regime', regime[0]);
      if (category[0]) p.set('category', category[0]);
      if (owner[0]) p.set('owner', owner[0]);
      if (debounced) p.set('search', debounced);
      return p;
    },
    [baseKey, regulator, market, group, regime, category, owner, debounced, nameToCode],
  );

  const filterKey = JSON.stringify([
    baseKey,
    regulator,
    market,
    group,
    regime,
    category,
    owner,
    debounced,
  ]);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    setLoading(true);
    setPage(1);
    api
      .get<Page>(withCompany(`/regulations/requirements?${queryParams(1).toString()}`, companyId))
      .then((d) => {
        if (!active) return;
        setRows(d.rows);
        setTotal(d.total);
      })
      .catch(() => active && (setRows([]), setTotal(0)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [companyId, filterKey]);

  const sentinel = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !companyId) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting || loadingMore.current || rows.length >= total) return;
      loadingMore.current = true;
      const next = page + 1;
      api
        .get<Page>(
          withCompany(`/regulations/requirements?${queryParams(next).toString()}`, companyId),
        )
        .then((d) => {
          setRows((prev) => [...prev, ...d.rows]);
          setPage(next);
        })
        .finally(() => {
          loadingMore.current = false;
        });
    });
    io.observe(el);
    return () => io.disconnect();
  }, [companyId, rows.length, total, page, queryParams]);

  const anyFilter = !!(
    regulator[0] ||
    market[0] ||
    group[0] ||
    regime[0] ||
    category[0] ||
    owner[0] ||
    debounced
  );
  const clearAll = () => {
    setRegulator([]);
    setMarket([]);
    setGroup([]);
    setRegime([]);
    setCategory([]);
    setOwner([]);
    setSearch('');
  };

  const jurOpts = useMemo(() => ['All', ...filters.jurisdictions.map((j) => j.name)], [filters]);
  const regimeOpts = useMemo(() => ['All', ...filters.regimes], [filters]);
  const ownerOpts = useMemo(() => ['All', ...filters.owners], [filters]);
  const catDisplayOpts = useMemo(
    () => ['All', ...filters.categories.map(catLabel).sort()],
    [filters],
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3 pb-1.5 flex-wrap">
        <span className="text-[11px] text-[#737373] tnum">
          {loading && !rows.length ? '…' : `${total.toLocaleString()} requirements`}
          {anyFilter && (
            <button onClick={clearAll} className="ml-2 text-[#2563eb] hover:underline">
              Clear filters
            </button>
          )}
        </span>
        <ListSearch
          value={search}
          onChange={setSearch}
          placeholder="Search title, regulation, citation…"
        />
      </div>

      <Card className="p-0">
        {/* Header — a combobox filter on every level */}
        <div
          className="grid items-stretch divide-x divide-[#eaeaea] border-b border-[#eaeaea] bg-[#fafafa] rounded-t-lg"
          style={{ gridTemplateColumns: GRID }}
        >
          <HeaderComboFilter
            label="Regulator"
            value={regulator}
            onChange={setRegulator}
            options={jurOpts}
          />
          <HeaderComboFilter
            label="Market"
            value={market}
            onChange={setMarket}
            options={MARKET_OPTS}
          />
          <HeaderComboFilter
            label="Line of business"
            value={group}
            onChange={setGroup}
            options={GROUP_OPTS}
          />
          <HeaderComboFilter
            label="Regulation"
            value={regime}
            onChange={setRegime}
            options={regimeOpts}
          />
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373]">
            Requirement
          </div>
          <HeaderComboFilter
            label="Category"
            value={category[0] ? [catLabel(category[0])] : []}
            onChange={(v) => setCategory(v[0] ? [catLabelToToken.get(v[0]) ?? v[0]] : [])}
            options={catDisplayOpts}
          />
          <HeaderComboFilter label="Owner" value={owner} onChange={setOwner} options={ownerOpts} />
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373]">
            Plan
          </div>
        </div>

        <div className="rounded-b-lg overflow-hidden">
          {loading && !rows.length ? (
            <div className="py-4 px-3 text-[11px] text-[#a3a3a3] italic">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="py-4 px-3 text-[11px] text-[#a3a3a3] italic">
              No requirements match the current filters.
            </div>
          ) : (
            rows.map((r) => {
              const groups = lobGroups(r);
              return (
                <div
                  key={r.id}
                  onClick={() => navigate(`/regulations/requirement/${r.id}`)}
                  className="grid items-stretch divide-x divide-[#f0f0f0] border-b border-[#f5f5f5] last:border-0 cursor-pointer hover:bg-[#fafafa] transition-colors duration-100"
                  style={{ gridTemplateColumns: GRID }}
                >
                  <div className="px-2 py-1.5 min-w-0 text-[12px]">
                    <Link
                      to={`/regulations/${r.jurisdiction.code}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-[#171717] hover:underline"
                      title={`${r.jurisdiction.name} — open regulator page`}
                    >
                      {r.jurisdiction.name}
                    </Link>{' '}
                    <span className="text-[11px] text-[#a3a3a3] tnum">{r.jurisdiction.code}</span>
                  </div>
                  <div className="px-2 py-1.5 text-[12px] text-[#525252]">
                    {marketDisplay(r.markets)}
                  </div>
                  <div
                    className="px-2 py-1.5 text-[12px] text-[#525252] truncate"
                    title={groups.join(', ')}
                  >
                    {groups.length
                      ? groups.length > 1
                        ? `${groups.length} groups`
                        : groups[0]
                      : 'All lines'}
                  </div>
                  <div className="px-2 py-1.5 text-[12px] min-w-0 truncate">
                    {r.regime ? (
                      <Link
                        to={`/regulations/regulation/${encodeURIComponent(r.regime)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#171717] hover:underline"
                        title={`${r.regime} — open the regulation`}
                      >
                        {r.regime}
                      </Link>
                    ) : (
                      <span className="text-[#d4d4d4]">—</span>
                    )}
                  </div>
                  <div className="px-2 py-1.5 text-[12px] text-[#262626] min-w-0">
                    <span className="line-clamp-2 hover:underline">{r.title}</span>
                  </div>
                  <div className="px-2 py-1.5 text-[12px] text-[#525252] truncate">
                    {catLabel(r.category)}
                  </div>
                  <div
                    className="px-2 py-1.5 text-[12px] text-[#525252] truncate"
                    title={r.owner?.name}
                  >
                    {r.owner?.name ?? '—'}
                  </div>
                  <div className="px-2 py-1.5 text-[12px]">
                    <Link
                      to={`/work-library?type=regulation&id=${r.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11.5px] font-medium text-[#2563eb] hover:underline"
                    >
                      Plan ↗
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {rows.length < total && (
        <div ref={sentinel} className="py-3 text-center text-[11px] text-[#a3a3a3]">
          Loading more… ({rows.length.toLocaleString()} of {total.toLocaleString()})
        </div>
      )}
    </div>
  );
}
