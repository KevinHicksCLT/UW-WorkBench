/**
 * Work Library left-hand subject picker — type toggle (Tasks / Standards /
 * Compliance), search, per-type filters fed by /work-library/subject-facets
 * (value stream for tasks, area + category for standards, regulation +
 * jurisdiction for compliance items), match counts, and the result list
 * grouped by its first path segment. Compliance items list in execution
 * order (their C-sequence). Selection and filters live in the URL.
 */
import { useEffect, useState } from 'react';
import { useApi } from '../../lib/useApi';
import { LoadingState, EmptyState, Select } from '../../components/ui';
import type { Subject, SubjectType } from './shared';

type Facets = {
  valueStreams?: { id: string; name: string }[];
  l3Areas?: { id: string; name: string }[];
  l4Subs?: { id: string; name: string }[];
  departments?: string[];
  categories?: string[];
  regulations?: { id: string; name: string }[];
  jurisdictions?: { id: string; name: string }[];
};

const FILTER_PARAMS = ['vs', 'l3', 'l4', 'dept', 'cat', 'reg', 'jur'] as const;
type FilterKey = (typeof FILTER_PARAMS)[number];

const filterSelect = 'w-full text-[11px] py-1 px-1.5 mb-1.5';

export function SubjectPicker({
  type,
  selectedId,
  missingOnly,
  filters,
  setParam,
}: {
  type: SubjectType;
  selectedId: string | null;
  missingOnly: boolean;
  filters: Record<FilterKey, string>;
  setParam: (patch: Record<string, string | null>) => void;
}) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    setQ('');
    setDebouncedQ('');
  }, [type]);

  const facetQuery = new URLSearchParams({ type });
  if (type === 'task') {
    if (filters.vs) facetQuery.set('vs', filters.vs);
    if (filters.l3) facetQuery.set('l3', filters.l3);
  }
  const { data: facetsData } = useApi<{ facets: Facets }>(
    `/work-library/subject-facets?${facetQuery.toString()}`,
  );
  const facets = facetsData?.facets ?? {};

  const query = new URLSearchParams({ type, q: debouncedQ });
  if (missingOnly && type === 'task') query.set('missing', 'test');
  if (type === 'task') {
    if (filters.vs) query.set('vs', filters.vs);
    if (filters.l3) query.set('l3', filters.l3);
    if (filters.l4) query.set('l4', filters.l4);
  }
  if (type === 'standard') {
    if (filters.dept) query.set('department', filters.dept);
    if (filters.cat) query.set('category', filters.cat);
  }
  if (type === 'compliance') {
    if (filters.reg) query.set('regulationId', filters.reg);
    if (filters.jur) query.set('jurisdictionId', filters.jur);
  }
  const { data: subjectsData, loading } = useApi<{
    subjects: Subject[];
    meta?: { total: number; missingTest?: number; matching?: number };
  }>(`/work-library/subjects?${query.toString()}`);

  const subjects = subjectsData?.subjects ?? [];
  const meta = subjectsData?.meta;
  // Group results by path segment — one level deeper than the deepest
  // process filter applied, so headers stay informative as you drill.
  const groupDepth = type === 'task' ? (filters.l4 ? -1 : filters.l3 ? 2 : filters.vs ? 1 : 0) : 0;
  const groups = new Map<string, Subject[]>();
  for (const s of subjects) {
    const label = groupDepth < 0 ? '' : (s.path?.split(' › ')[groupDepth] ?? '');
    const list = groups.get(label);
    if (list) list.push(s);
    else groups.set(label, [s]);
  }
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  const setFilter = (key: FilterKey, value: string) => setParam({ [key]: value || null });
  const clearAll = () => {
    setQ('');
    setParam(Object.fromEntries(FILTER_PARAMS.map((k) => [k, null])));
  };
  const anyFilter = FILTER_PARAMS.some((k) => filters[k]) || q !== '';

  const optionList = (values: string[], all: string) => (
    <>
      <option value="">{all}</option>
      {values.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </>
  );

  return (
    <div className="border-r border-[#e5e5e5] p-2.5 overflow-auto">
      <div className="flex gap-0.5 rounded-md bg-[#f0f1f3] p-0.5 mb-2">
        {(['task', 'standard', 'compliance'] as const).map((t) => (
          <button
            key={t}
            onClick={() =>
              setParam({
                type: t,
                id: null,
                missing: null,
                ...Object.fromEntries(FILTER_PARAMS.map((k) => [k, null])),
              })
            }
            className={
              'flex-1 py-1 rounded text-[11px] ' +
              (type === t
                ? 'bg-white border border-[#e5e5e5] font-medium text-[#171717]'
                : 'text-[#6b7785]')
            }
          >
            {t === 'task' ? 'Tasks' : t === 'standard' ? 'Standards' : 'Compliance'}
          </button>
        ))}
      </div>
      <input
        className="w-full rounded-md border border-[#e2e6ea] px-2 py-1.5 text-[12px] mb-1.5 focus:border-[#7aa7d9] focus:outline-none"
        placeholder={`Search ${type === 'task' ? 'tasks' : type === 'standard' ? 'standards' : 'compliance items'}`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {type === 'task' && (
        <>
          <Select
            className={filterSelect}
            aria-label="Filter by value stream"
            value={filters.vs}
            onChange={(e) => setParam({ vs: e.target.value || null, l3: null, l4: null })}
          >
            <option value="">All value streams</option>
            {(facets.valueStreams ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
          {filters.vs && (
            <Select
              className={filterSelect}
              aria-label="Filter by area"
              value={filters.l3}
              onChange={(e) => setParam({ l3: e.target.value || null, l4: null })}
            >
              <option value="">All areas</option>
              {(facets.l3Areas ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          )}
          {filters.l3 && (
            <Select
              className={filterSelect}
              aria-label="Filter by sub-process"
              value={filters.l4}
              onChange={(e) => setFilter('l4', e.target.value)}
            >
              <option value="">All sub-processes</option>
              {(facets.l4Subs ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          )}
        </>
      )}
      {type === 'standard' && (
        <>
          <Select
            className={filterSelect}
            aria-label="Filter by area"
            value={filters.dept}
            onChange={(e) => setFilter('dept', e.target.value)}
          >
            {optionList(facets.departments ?? [], 'All areas')}
          </Select>
          <Select
            className={filterSelect}
            aria-label="Filter by category"
            value={filters.cat}
            onChange={(e) => setFilter('cat', e.target.value)}
          >
            {optionList(facets.categories ?? [], 'All categories')}
          </Select>
        </>
      )}
      {type === 'compliance' && (
        <>
          <Select
            className={filterSelect}
            aria-label="Filter by regulation"
            value={filters.reg}
            onChange={(e) => setFilter('reg', e.target.value)}
          >
            <option value="">All regulations</option>
            {(facets.regulations ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Select
            className={filterSelect}
            aria-label="Filter by jurisdiction"
            value={filters.jur}
            onChange={(e) => setFilter('jur', e.target.value)}
          >
            <option value="">All jurisdictions</option>
            {(facets.jurisdictions ?? []).map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </Select>
        </>
      )}
      {type === 'task' && meta?.missingTest !== undefined && (
        <button
          onClick={() => setParam({ missing: missingOnly ? null : 'test', id: null })}
          className={
            'w-full mb-1.5 rounded-md px-2 py-1.5 text-[11px] text-left border ' +
            (missingOnly
              ? 'border-[#f0b4b4] bg-[#fdf2f2] text-[#b91c1c] font-medium'
              : 'border-[#e2e6ea] text-[#6b7785] hover:bg-[#fafafa]')
          }
        >
          ✗ Missing testing pattern · {meta.missingTest.toLocaleString()} of{' '}
          {meta.total.toLocaleString()}
          {missingOnly && <span className="float-right">clear</span>}
        </button>
      )}
      {meta?.matching !== undefined && (
        <div className="flex items-baseline justify-between px-0.5 mb-1">
          <span className="text-[10px] text-[#8a94a0]">
            {subjects.length < meta.matching
              ? `First ${subjects.length} of ${meta.matching.toLocaleString()} matches`
              : `${meta.matching.toLocaleString()} match${meta.matching === 1 ? '' : 'es'}`}
          </span>
          {anyFilter && (
            <button className="text-[10px] text-[#1d4ed8] hover:underline" onClick={clearAll}>
              clear
            </button>
          )}
        </div>
      )}
      {loading && <LoadingState baseClassName="px-1.5 py-1 text-[11px] text-[#a3a3a3]" />}
      {!loading && !subjects.length && (
        <EmptyState
          baseClassName="px-1.5 py-2 text-[11px] text-[#a3a3a3]"
          message="No matches — adjust the search or filters."
        />
      )}
      {sortedGroups.map(([label, items]) => (
        <div key={label || '·'}>
          {label && (
            <div className="px-1.5 pt-1.5 pb-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#a3a3a3]">
              {label}
            </div>
          )}
          {items.map((s) => (
            <button
              key={s.id}
              onClick={() => setParam({ id: s.id })}
              className={
                'block w-full text-left rounded-md px-2 py-1.5 mb-0.5 text-[12px] leading-snug ' +
                (selectedId === s.id
                  ? 'bg-[#eaf2fd] text-[#1d4ed8] font-medium'
                  : 'text-[#525252] hover:bg-[#fafafa]')
              }
            >
              {s.name}
              {s.path && <span className="block text-[10px] text-[#a3a3a3]">{s.path}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
