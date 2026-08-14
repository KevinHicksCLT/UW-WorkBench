// Majesco Billing — billing application tab (MAJESCO-BILL).
// Two surfaces: the live catalog registration (Majesco Billing's Application
// row + its NodeAppUsage footprint, from the applications API) and the static
// screen → process map (screenMap.ts, mirrored from the mapping doc). The
// registration is applied by backend/scripts/add-majesco-billing.ts; until it
// has run, the profile card shows a not-registered notice and the screen map
// still renders (it is documentation, not data).
import { useSearchParams, Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { Card, EmptyState, LoadingState, ErrorMessage } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { AREA_LABELS, COVERAGE_SUMMARY, SCREEN_GROUPS, type BillingArea } from './screenMap';

const APP_NAME = 'Majesco Billing';

type AppListItem = { id: string; name: string };
type AppDetail = {
  id: string;
  name: string;
  kind: string | null;
  category: string | null;
  vendor: string | null;
  criticality: string | null;
  ownershipModel: string | null;
  description: string | null;
  stats: { taskUsages: number; nodes: number; performed: number; memorialized: number };
  valueStreams: { name: string; count: number }[];
  divisions: { name: string; count: number }[];
  roles: { id: string; name: string; count: number }[];
};

const TAB_DEFS = [
  { key: 'overview', label: 'Overview' },
  { key: 'screens', label: 'Screen → Process Map' },
] as const;
type TabKey = (typeof TAB_DEFS)[number]['key'];

const areaPill = (area: BillingArea) =>
  area === 'BCR'
    ? 'bg-[#eef4ff] text-[#1d4ed8] border-[#d5e3ff]'
    : 'bg-[#f2fbf5] text-[#15803d] border-[#d3f0dc]';

function EvidencePill({ evidence, note }: { evidence: 'Confirmed' | 'Inferred'; note?: string }) {
  return (
    <span
      title={note}
      className={
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ' +
        (evidence === 'Confirmed'
          ? 'bg-[#f2fbf5] text-[#15803d] border-[#d3f0dc]'
          : 'bg-[#fafafa] text-[#666666] border-[#eaeaea]')
      }
    >
      {evidence}
      {note ? '*' : ''}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[#a3a3a3]">{label}</div>
      <div className="text-lg font-semibold text-[#171717]">{value}</div>
    </div>
  );
}

function Overview() {
  const list = useApi<{ applications: AppListItem[] }>('/applications');
  const appId = list.data?.applications.find((a) => a.name === APP_NAME)?.id ?? null;
  const detail = useApi<AppDetail>(appId ? `/applications/${appId}` : null);

  if (list.loading || detail.loading) return <LoadingState message="Loading billing profile…" />;
  if (list.error) return <ErrorMessage>{list.error}</ErrorMessage>;

  if (!appId) {
    return (
      <Card className="p-8 text-center">
        <EmptyState
          baseClassName="text-sm text-[#a3a3a3]"
          message="Majesco Billing is not registered in the application catalog yet — run backend/scripts/add-majesco-billing.ts, then reload."
        />
      </Card>
    );
  }
  if (detail.error) return <ErrorMessage>{detail.error}</ErrorMessage>;
  const app = detail.data;
  if (!app) return null;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold text-[#171717]">{app.name}</h2>
          <span className="text-xs text-[#666666]">
            {[app.vendor, app.category, app.kind, app.ownershipModel].filter(Boolean).join(' · ')}
          </span>
          {app.criticality && (
            <span className="inline-flex items-center rounded-full border border-[#f5d0d0] bg-[#fdf2f2] px-2 py-0.5 text-[11px] font-medium text-[#b91c1c]">
              {app.criticality} criticality
            </span>
          )}
          <Link
            to={`/applications?focus=${app.id}`}
            className="text-xs text-[#2563eb] hover:underline"
          >
            Open in Applications catalog →
          </Link>
        </div>
        {app.description && (
          <p className="mt-3 max-w-4xl text-sm leading-6 text-[#444444]">{app.description}</p>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-[#171717]">Process footprint</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Task links" value={app.stats.taskUsages} />
          <Stat label="Process nodes" value={app.stats.nodes} />
          <Stat label="Performed" value={app.stats.performed} />
          <Stat label="Roles touched" value={app.roles.length} />
        </div>
        {app.valueStreams.length > 0 && (
          <div className="mt-4 text-sm text-[#444444]">
            <span className="font-medium text-[#171717]">Value streams: </span>
            {app.valueStreams.map((v) => `${v.name} (${v.count})`).join(', ')}
          </div>
        )}
        {app.divisions.length > 0 && (
          <div className="mt-1 text-sm text-[#444444]">
            <span className="font-medium text-[#171717]">Divisions: </span>
            {app.divisions.map((d) => `${d.name} (${d.count})`).join(', ')}
          </div>
        )}
      </Card>
    </div>
  );
}

function ScreenMap() {
  return (
    <div className="space-y-5">
      <Card className="p-4 text-sm text-[#444444]">
        <p>{COVERAGE_SUMMARY}</p>
        <div className="mt-2 flex flex-col gap-1 text-xs text-[#666666]">
          <span>
            <span
              className={
                'mr-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ' +
                areaPill('BCR')
              }
            >
              BCR
            </span>
            {AREA_LABELS.BCR}
          </span>
          <span>
            <span
              className={
                'mr-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ' +
                areaPill('PBRA')
              }
            >
              PBRA
            </span>
            {AREA_LABELS.PBRA}
          </span>
        </div>
      </Card>

      {SCREEN_GROUPS.map((g) => (
        <Card key={g.group} className="overflow-hidden">
          <div className="border-b border-[#eaeaea] bg-[#fafafa] px-4 py-2 text-sm font-semibold text-[#171717]">
            {g.group}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-[#a3a3a3]">
                  <th className="px-4 py-2 font-medium">Screen</th>
                  <th className="px-4 py-2 font-medium">Evidence</th>
                  <th className="px-4 py-2 font-medium">Area</th>
                  <th className="px-4 py-2 font-medium">L4 sub-process</th>
                  <th className="px-4 py-2 font-medium">L5 task</th>
                </tr>
              </thead>
              <tbody>
                {g.screens.flatMap((s) =>
                  (s.mappings.length > 0 ? s.mappings : [null]).map((m, i) => (
                    <tr key={`${s.name}-${i}`} className="border-t border-[#f0f0f0] align-top">
                      <td className="px-4 py-2 text-[#171717]">{i === 0 ? s.name : ''}</td>
                      <td className="px-4 py-2">
                        {i === 0 && <EvidencePill evidence={s.evidence} note={s.evidenceNote} />}
                      </td>
                      {m ? (
                        <>
                          <td className="px-4 py-2">
                            <span
                              className={
                                'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ' +
                                areaPill(m.area)
                              }
                            >
                              {m.area}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-[#444444]">{m.l4}</td>
                          <td className="px-4 py-2 text-[#444444]">{m.l5}</td>
                        </>
                      ) : (
                        <td colSpan={3} className="px-4 py-2 text-[#666666] italic">
                          {s.evidenceNote ?? 'No direct task mapping.'}
                        </td>
                      )}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function MajescoBilling() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: TabKey = TAB_DEFS.some((t) => t.key === raw) ? (raw as TabKey) : 'overview';

  return (
    <div>
      <PageHeader
        title="Majesco Billing"
        subtitle="Enterprise billing and receivables for commercial P&C — screen inventory mapped onto the Billing, Collections & Receivables and Premium Billing & Receivables Accounting subtrees"
        dense
      />

      <div className="border-b border-[#eaeaea] mb-5 overflow-x-auto">
        <nav className="flex gap-6 whitespace-nowrap" aria-label="Majesco Billing tabs">
          {TAB_DEFS.map((t) => (
            <button
              key={t.key}
              onClick={() => setParams({ tab: t.key })}
              className={
                'relative inline-flex items-center h-10 -mb-px px-0.5 text-sm border-b-2 transition-colors duration-150 ' +
                (tab === t.key
                  ? 'text-[#171717] font-semibold border-[#171717]'
                  : 'text-[#666666] font-medium border-transparent hover:text-[#171717]')
              }
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'overview' && <Overview />}
      {tab === 'screens' && <ScreenMap />}
    </div>
  );
}
