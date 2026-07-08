import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { withCompany } from '../../lib/portfolio';
import { LoadingState, Select } from '../../components/ui';
import { type VsLink } from '../../components/RequirementLinks';
import { catLabel, lobGroups, marketDisplay } from './Regulations';

// Server-driven, paginated requirements table. The catalog is tens of thousands
// of rows, so filtering/sorting/paging happen in the API (single source of
// truth = the DB) and only one bounded page is ever in the browser. Shared by
// the Regulations page (per-lens) and the regime page (fixed regime filter).

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

const MARKETS = ['PERSONAL', 'COMMERCIAL'];
const GROUPS = [
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

/**
 * @param baseParams query params always applied (e.g. `{ lens: 'state' }` or
 *   `{ regime: 'GDPR' }`). Filters + search + page are layered on top.
 * @param categories category tokens for the Category dropdown (from overview).
 */
export function RequirementsTable({
  baseParams,
  categories,
}: {
  baseParams: Record<string, string>;
  categories: string[];
}) {
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const [market, setMarket] = useState('');
  const [group, setGroup] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const pageSize = 100;

  // Debounce the free-text search.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  // Any filter change resets to page 1.
  const baseKey = JSON.stringify(baseParams);
  useEffect(() => setPage(1), [market, group, category, debounced, baseKey]);

  const firstLoad = useRef(true);
  useEffect(() => {
    if (!companyId) return;
    const params = new URLSearchParams({
      ...baseParams,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (market) params.set('market', market);
    if (group) params.set('group', group);
    if (category) params.set('category', category);
    if (debounced) params.set('search', debounced);
    setLoading(true);
    api
      .get<Page>(withCompany(`/regulations/requirements?${params.toString()}`, companyId))
      .then(setData)
      .catch(() => setData({ rows: [], total: 0, page: 1, pageSize }))
      .finally(() => {
        setLoading(false);
        firstLoad.current = false;
      });
  }, [companyId, baseKey, market, group, category, debounced, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const anyFilter = !!(market || group || category || debounced);
  const catOptions = useMemo(
    () => [...categories].sort((a, b) => catLabel(a).localeCompare(catLabel(b))),
    [categories],
  );

  return (
    <div>
      {/* Toolbar — server-side filters + search + result count */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-[11px] text-[#737373] tnum">
          {data ? `${data.total.toLocaleString()} requirements` : '…'}
        </span>
        <Select
          value={market}
          onChange={(e) => setMarket(e.target.value)}
          aria-label="Filter by market"
          className="text-xs py-1 w-[110px]"
        >
          <option value="">All markets</option>
          {MARKETS.map((m) => (
            <option key={m} value={m}>
              {m === 'PERSONAL' ? 'Personal' : 'Commercial'}
            </option>
          ))}
        </Select>
        <Select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          aria-label="Filter by line-of-business group"
          className="text-xs py-1 w-[150px]"
        >
          <option value="">All lines</option>
          {GROUPS.map((gp) => (
            <option key={gp} value={gp}>
              {gp}
            </option>
          ))}
        </Select>
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
          className="text-xs py-1 w-[150px]"
        >
          <option value="">All categories</option>
          {catOptions.map((c) => (
            <option key={c} value={c}>
              {catLabel(c)}
            </option>
          ))}
        </Select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, regulation, citation…"
          aria-label="Search requirements"
          className="flex-1 min-w-[180px] max-w-xs rounded border border-[#eaeaea] bg-white px-2 py-1 text-xs text-[#171717] placeholder:text-[#a3a3a3] focus:outline-none focus:border-[#d4d4d4]"
        />
        {anyFilter && (
          <button
            onClick={() => {
              setMarket('');
              setGroup('');
              setCategory('');
              setSearch('');
            }}
            className="text-[11px] text-[#2563eb] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="rounded-xl border border-[#eaeaea] overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-[#fafafa] text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-[#737373]">
                <th className="px-3 py-2 font-semibold">Regulator</th>
                <th className="px-3 py-2 font-semibold">Market</th>
                <th className="px-3 py-2 font-semibold">Line of business</th>
                <th className="px-3 py-2 font-semibold">Regulation</th>
                <th className="px-3 py-2 font-semibold">Requirement</th>
                <th className="px-3 py-2 font-semibold">Category</th>
                <th className="px-3 py-2 font-semibold">Owner</th>
                <th className="px-3 py-2 font-semibold w-[52px]">Plan</th>
              </tr>
            </thead>
            <tbody>
              {loading && (!data || firstLoad.current) ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6">
                    <LoadingState />
                  </td>
                </tr>
              ) : data && data.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-[#a3a3a3]">
                    No requirements match the filters.
                  </td>
                </tr>
              ) : (
                data?.rows.map((r) => {
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
      </div>

      {/* Pagination */}
      {data && data.total > pageSize && (
        <div className="flex items-center justify-between mt-2 text-[11px] text-[#525252]">
          <span className="tnum">
            Page {data.page.toLocaleString()} of {totalPages.toLocaleString()} ·{' '}
            {data.total.toLocaleString()} total
          </span>
          <div className="flex items-center gap-1">
            <PageBtn
              label="‹ Prev"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            />
            <PageBtn
              label="Next ›"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PageBtn({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-[#eaeaea] bg-white px-2 py-1 text-[11px] text-[#171717] hover:border-[#d4d4d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
    >
      {label}
    </button>
  );
}
