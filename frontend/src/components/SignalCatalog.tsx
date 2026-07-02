import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { withCompany } from '../lib/portfolio';
import { Sheet, SheetCell, type SheetCol } from './Sheet';
import { EmptyState, ErrorMessage } from './ui';

// SignalCatalog — the filterable inventory of every trackable signal/metric the
// operating model can measure, rendered in the canonical Sheet format (see
// components/Sheet.tsx): system-of-record signals (GitHub, Jira, ServiceNow,
// delivery analytics) plus the operating-model KPIs from the workbook.
// Clicking a row expands its description + provenance.
// Data: GET /explorer/telemetry-catalog.

type Signal = {
  id: string;
  kind: 'kpi' | 'system';
  type: string;
  name: string;
  description: string | null;
  source: string | null;
  sourceTokens: string[];
  category: string | null;
  framework: string | null;
  frequency: string | null;
  unit: string | null;
  direction: string;
  target: string | null;
  levels: string[];
  valueStreamName: string | null;
  domain: string | null;
  l3: string | null;
  ownerRole: string | null;
  ownerRoleId: string | null;
  provenance: string | null;
  calculation: string | null;
  unsourced: boolean;
};
type Filters = { types: string[]; sources: string[]; categories: string[] };
type Catalog = { signals: Signal[]; filters: Filters };

const LEVEL_CLASS: Record<string, string> = {
  Individual: 'bg-[#eef2ff] text-[#4338ca]',
  Role: 'bg-[#e0e7ff] text-[#3730a3]',
  Team: 'bg-[#ecfdf5] text-[#047857]',
  Department: 'bg-[#fef3c7] text-[#92400e]',
  Division: 'bg-[#fae8ff] text-[#86198f]',
  Company: 'bg-[#f1f5f9] text-[#334155]',
  Executive: 'bg-[#ffe4e6] text-[#9f1239]',
  Product: 'bg-[#e0f2fe] text-[#0369a1]',
};

function LevelChips({ levels }: { levels: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {levels.map((l) => (
        <span
          key={l}
          className={
            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ' +
            (LEVEL_CLASS[l] ?? 'bg-[#f5f5f5] text-[#525252]')
          }
        >
          {l}
        </span>
      ))}
    </div>
  );
}

export default function SignalCatalog({ companyId }: { companyId: string | null }) {
  const [data, setData] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .get<Catalog>(withCompany('/explorer/telemetry-catalog', companyId))
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [companyId]);

  const cols: SheetCol<Signal>[] = [
    {
      key: 'name',
      label: 'Signal',
      width: 'minmax(0,1.4fr)',
      value: (s) => s.name,
      render: (s) => (
        <>
          <span className="truncate text-[12px] text-[#171717]">{s.name}</span>
          {s.unsourced && (
            <span className="inline-flex items-center px-1 py-0.5 rounded bg-[#fef3c7] text-[9px] font-semibold text-[#92400e] uppercase tracking-wide flex-shrink-0">
              No source
            </span>
          )}
        </>
      ),
    },
    { key: 'type', label: 'Type', width: '90px', value: (s) => s.type, dim: true },
    {
      key: 'category',
      label: 'Category',
      width: '150px',
      value: (s) => s.category ?? '',
      dim: true,
    },
    {
      // 'Role' is dropped from the chips — it isn't a tracking level here.
      key: 'levels',
      label: 'Tracked at',
      width: 'minmax(0,1fr)',
      values: (s) => s.levels.filter((l) => l !== 'Role'),
      render: (s) => <LevelChips levels={s.levels.filter((l) => l !== 'Role')} />,
    },
    {
      key: 'frequency',
      label: 'Frequency',
      width: '110px',
      value: (s) => s.frequency ?? '',
      dim: true,
    },
    {
      key: 'target',
      label: 'Target',
      width: '110px',
      align: 'center',
      render: (s) => <SheetCell text={s.target ?? ((s.unit ?? '').trim() || '—')} dim />,
    },
    {
      key: 'owner',
      label: 'Value stream / Owner',
      width: 'minmax(0,1fr)',
      value: (s) => (s.kind === 'kpi' ? (s.valueStreamName ?? '') : 'All roles'),
      render: (s) =>
        s.kind === 'kpi' ? (
          <span
            className="truncate text-[12px] text-[#737373]"
            title={`${s.valueStreamName ?? ''}${s.ownerRole ? ` · ${s.ownerRole}` : ''}`}
          >
            {s.valueStreamName ?? '—'}
            {s.ownerRole &&
              (s.ownerRoleId ? (
                <Link
                  to={`/roles/${s.ownerRoleId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[#4338ca] hover:underline"
                >
                  {' '}
                  · {s.ownerRole}
                </Link>
              ) : (
                <span className="text-[#a3a3a3]"> · {s.ownerRole}</span>
              ))}
          </span>
        ) : (
          <span className="text-[12px] text-[#a3a3a3]">All roles</span>
        ),
    },
  ];

  if (error)
    return <ErrorMessage baseClassName="px-1 py-6 text-sm text-[#be123c]">{error}</ErrorMessage>;

  return (
    <div>
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-[#171717]">Trackable metrics</h2>
        <p className="text-[11px] text-[#666666] mt-0.5">
          Every signal the model can measure — system-of-record telemetry (GitHub, Jira, ServiceNow)
          and operating-model KPIs. Click a row for its description &amp; provenance.
        </p>
      </div>

      <Sheet
        rows={data?.signals ?? []}
        cols={cols}
        rowKey={(s) => s.id}
        loading={loading}
        unit="metrics"
        summarize={(v) =>
          `${v.filter((s) => s.kind === 'kpi').length} KPIs · ${v.filter((s) => s.kind === 'system').length} system`
        }
        expand={(s) => (
          <div className="space-y-1 text-[12px] text-[#525252]">
            {s.description && <div>{s.description}</div>}
            {s.provenance && (
              <div>
                <span className="font-semibold text-[#171717]">Source:</span> {s.provenance}
              </div>
            )}
            {s.calculation && (
              <div>
                <span className="font-semibold text-[#171717]">Calculation:</span> {s.calculation}
              </div>
            )}
            {!s.description && !s.provenance && !s.calculation && (
              <EmptyState
                baseClassName="text-[#a3a3a3] italic"
                message="No further detail for this signal."
              />
            )}
          </div>
        )}
      />
    </div>
  );
}
