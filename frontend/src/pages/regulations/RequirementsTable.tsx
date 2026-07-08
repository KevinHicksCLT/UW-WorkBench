import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { withCompany } from '../../lib/portfolio';
import { HeaderComboFilter } from '../../components/Sheet';
import { ListSearch } from '../../components/sheet/headerControls';
import { type VsLink } from '../../components/RequirementLinks';
import { catLabel, lobGroups, marketDisplay } from './Regulations';

// Server-driven requirements list. The catalog is tens of thousands of rows, so
// filtering happens in the API (single source of truth = the DB) and the list
// lazy-loads one page at a time on scroll — rendered as a single continuous
// list, never a huge client-side table. Per-column combobox filters (the same
// control the Sheet uses) sit in the header; their options come from a cheap
// distinct-values endpoint scoped to the lens.

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
const MARKET_PARAM: Record<string, string> = { Personal: 'PERSONAL', Commercial: 'COMMERCIAL' };

/**
 * @param baseParams query params always applied (e.g. `{ lens: 'state' }` or `{ regime: 'GDPR' }`).
 */
export function RequirementsTable({ baseParams }: { baseParams: Record<string, string> }) {
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const [filters, setFilters] = useState<Filters>({
    categories: [],
    regimes: [],
    jurisdictions: [],
  });

  // Selected values (single-pick comboboxes → first entry used).
  const [regulator, setRegulator] = useState<string[]>([]);
  const [market, setMarket] = useState<string[]>([]);
  const [group, setGroup] = useState<string[]>([]);
  const [regime, setRegime] = useState<string[]>([]);
  const [category, setCategory] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  const [rows, setRows] = useState<ReqRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const baseKey = JSON.stringify(baseParams);

  // Distinct filter options for this lens.
  useEffect(() => {
    if (!companyId) return;
    const params = new URLSearchParams(baseParams);
    api
      .get<Filters>(withCompany(`/regulations/requirement-filters?${params.toString()}`, companyId))
      .then(setFilters)
      .catch(() => setFilters({ categories: [], regimes: [], jurisdictions: [] }));
  }, [companyId, baseKey]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const nameToCode = useMemo(
    () => new Map(filters.jurisdictions.map((j) => [j.name, j.code])),
    [filters.jurisdictions],
  );

  // The active query params from the current filter selection.
  const queryParams = useCallback(
    (pageNum: number) => {
      const p = new URLSearchParams({
        ...baseParams,
        page: String(pageNum),
        pageSize: String(PAGE_SIZE),
      });
      if (regulator[0]) p.set('state', nameToCode.get(regulator[0]) ?? regulator[0]);
      if (market[0] === 'Both') p.set('market', 'BOTH');
      else if (market[0] && MARKET_PARAM[market[0]]) p.set('market', MARKET_PARAM[market[0]]);
      if (group[0]) p.set('group', group[0]);
      if (regime[0]) p.set('regime', regime[0]);
      if (category[0]) p.set('category', category[0]);
      if (debounced) p.set('search', debounced);
      return p;
    },
    [baseKey, regulator, market, group, regime, category, debounced, nameToCode],
  );

  const filterKey = JSON.stringify([
    baseKey,
    regulator,
    market,
    group,
    regime,
    category,
    debounced,
  ]);

  // Reset + load page 1 whenever a filter changes.
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
      .catch(() => {
        if (active) {
          setRows([]);
          setTotal(0);
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [companyId, filterKey]);

  // Lazy-load the next page when the sentinel scrolls into view.
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !companyId) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting || loadingMore.current) return;
      if (rows.length >= total) return;
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
    debounced
  );
  const clearAll = () => {
    setRegulator([]);
    setMarket([]);
    setGroup([]);
    setRegime([]);
    setCategory([]);
    setSearch('');
  };

  const jurOpts = useMemo(
    () => ['All', ...filters.jurisdictions.map((j) => j.name)],
    [filters.jurisdictions],
  );
  const regimeOpts = useMemo(() => ['All', ...filters.regimes], [filters.regimes]);
  // Category combobox shows friendly labels but filters by token — map both ways.
  const catLabelToToken = useMemo(
    () => new Map(filters.categories.map((c) => [catLabel(c), c])),
    [filters.categories],
  );
  const catDisplayOpts = useMemo(
    () => ['All', ...filters.categories.map(catLabel).sort()],
    [filters.categories],
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

      <div className="rounded-xl border border-[#eaeaea] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead className="bg-[#fafafa] border-b border-[#eaeaea]">
              <tr className="align-top">
                <th className="text-left">
                  <HeaderComboFilter
                    label="Regulator"
                    value={regulator}
                    onChange={setRegulator}
                    options={jurOpts}
                  />
                </th>
                <th className="text-left">
                  <HeaderComboFilter
                    label="Market"
                    value={market}
                    onChange={setMarket}
                    options={MARKET_OPTS}
                  />
                </th>
                <th className="text-left">
                  <HeaderComboFilter
                    label="Line of business"
                    value={group}
                    onChange={setGroup}
                    options={GROUP_OPTS}
                  />
                </th>
                <th className="text-left">
                  <HeaderComboFilter
                    label="Regulation"
                    value={regime}
                    onChange={setRegime}
                    options={regimeOpts}
                  />
                </th>
                <th className="px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373]">
                  Requirement
                </th>
                <th className="text-left">
                  <HeaderComboFilter
                    label="Category"
                    value={category[0] ? [catLabel(category[0])] : []}
                    onChange={(v) => setCategory(v[0] ? [catLabelToToken.get(v[0]) ?? v[0]] : [])}
                    options={catDisplayOpts}
                  />
                </th>
                <th className="px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373]">
                  Owner
                </th>
                <th className="px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373] w-[52px]">
                  Plan
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && !rows.length ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-[#a3a3a3] text-xs">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-[#a3a3a3] text-xs">
                    No requirements match the filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const groups = lobGroups(r);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/regulations/requirement/${r.id}`)}
                      className="border-t border-[#f1f1f1] hover:bg-[#fafafa] cursor-pointer align-top"
                    >
                      <td className="px-3 py-2">
                        <Link
                          to={`/regulations/${r.jurisdiction.code}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-[#171717] hover:underline"
                          title={`${r.jurisdiction.name} — open regulator page`}
                        >
                          {r.jurisdiction.name}
                        </Link>{' '}
                        <span className="text-[11px] text-[#a3a3a3] tnum">
                          {r.jurisdiction.code}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[#525252]">{marketDisplay(r.markets)}</td>
                      <td className="px-3 py-2 text-[#525252]">
                        {groups.length
                          ? groups.length > 2
                            ? `${groups.length} groups`
                            : groups.join(', ')
                          : 'All lines'}
                      </td>
                      <td className="px-3 py-2">
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
                      </td>
                      <td className="px-3 py-2 text-[#262626] max-w-[360px]">
                        <span className="line-clamp-2 hover:underline">{r.title}</span>
                      </td>
                      <td className="px-3 py-2 text-[#525252]">{catLabel(r.category)}</td>
                      <td className="px-3 py-2 text-[#525252]">{r.owner?.name ?? '—'}</td>
                      <td className="px-3 py-2">
                        <Link
                          to={`/work-library?type=regulation&id=${r.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11.5px] font-medium text-[#2563eb] hover:underline"
                        >
                          Plan ↗
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Lazy-load sentinel */}
        {rows.length < total && (
          <div ref={sentinel} className="py-3 text-center text-[11px] text-[#a3a3a3]">
            Loading more… ({rows.length.toLocaleString()} of {total.toLocaleString()})
          </div>
        )}
      </div>
    </div>
  );
}
