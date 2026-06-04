import { useParams, Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';
import { PARTICIPATION_CLASS } from '../lib/format';

export default function RoleDetail() {
  const { id } = useParams();
  const { data: r, error, loading } = useApi<any>(`/roles/${id}`);

  if (loading) return <div className="text-slate-500">Loading role…</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!r) return null;

  const crumbs: { label: string; to?: string }[] = [{ label: 'Overview', to: '/' }];
  if (r.division) crumbs.push({ label: r.division.name, to: `/divisions/${r.division.id}` });
  if (r.department) crumbs.push({ label: r.department.name, to: `/departments/${r.department.id}` });
  crumbs.push({ label: r.name });

  return (
    <div>
      <PageHeader
        title={r.name}
        subtitle={[r.roleFamily, r.department?.name, r.division?.name].filter(Boolean).join(' · ') || 'Checklist-only role (not placed in the org chart)'}
        breadcrumbs={crumbs}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h3 className="font-semibold text-slate-900 mb-3">Value-Stream Participation ({r.participation.length})</h3>
            {r.participation.length === 0 ? (
              <div className="text-sm text-slate-500 italic">Not mapped to any value stream.</div>
            ) : (
              <div className="space-y-1.5">
                {r.participation.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
                    <div className="min-w-0">
                      <Link to={`/overview?focus=${p.valueStreamId}`} className="text-sm text-brand-700 hover:underline">{p.valueStreamName}</Link>
                      {p.subStream && <div className="text-xs text-slate-400 truncate">{p.subStream}</div>}
                    </div>
                    <span className={`${PARTICIPATION_CLASS[p.participationType] || 'pill-slate'} flex-shrink-0`}>{p.participationType}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <InputsDeliverables rows={r.ioRows ?? []} inputCount={r.inputCount ?? 0} deliverableCount={r.deliverableCount ?? 0} />

          <Tasks tasks={r.processTasks ?? []} />

          <Grouped
            title={`Responsibilities (${(r.responsibilities ?? []).reduce((n: number, g: any) => n + g.items.length, 0)})`}
            groups={r.responsibilities}
          />
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="font-semibold text-slate-900 mb-3">Details</h3>
            <dl className="text-sm space-y-2">
              <Row label="Division" value={r.division ? <Link className="text-brand-700 hover:underline" to={`/divisions/${r.division.id}`}>{r.division.name}</Link> : '—'} />
              <Row label="Department" value={r.department ? <Link className="text-brand-700 hover:underline" to={`/departments/${r.department.id}`}>{r.department.name}</Link> : '—'} />
              <Row label="Role family" value={r.roleFamily || '—'} />
            </dl>
          </div>
          {r.externalInteractions.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-slate-900 mb-3">External Interactions</h3>
              <ul className="text-sm space-y-2">
                {r.externalInteractions.map((e: any) => (
                  <li key={e.id}>
                    <div className="font-medium text-slate-800">{e.externalRole}</div>
                    <div className="text-xs text-slate-400">{e.partyType}{e.interactionType ? ` · ${e.interactionType}` : ''}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type IoRow = { valueStreamId: string; valueStreamName: string; l4: string | null; inputs: string[]; deliverables: string[] };

// Lowest-level inputs the role consumes and deliverables it produces, grouped by
// value stream + L4 sub-process (resolved on read from the I/O inventory).
function InputsDeliverables({ rows, inputCount, deliverableCount }: { rows: IoRow[]; inputCount: number; deliverableCount: number }) {
  return (
    <div className="card">
      <h3 className="font-semibold text-slate-900 mb-3">Inputs &amp; Deliverables ({inputCount} in · {deliverableCount} out)</h3>
      {rows.length === 0 ? (
        <div className="text-sm text-slate-500 italic">No inputs or deliverables mapped.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="pb-3 border-b border-slate-100 last:border-0 last:pb-0">
              <Link to={`/overview?focus=${row.valueStreamId}`} className="text-sm text-brand-700 hover:underline">{row.valueStreamName}</Link>
              {row.l4 && <div className="text-xs text-slate-400 mb-1.5">{row.l4}</div>}
              {row.inputs.length > 0 && (
                <ChipRow label="Inputs" items={row.inputs} />
              )}
              {row.deliverables.length > 0 && (
                <ChipRow label="Deliverables" items={row.deliverables} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChipRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex flex-wrap items-baseline gap-1.5 mt-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mr-1">{label}</span>
      {items.map((it, i) => <span key={i} className="chip-soft">{it}</span>)}
    </div>
  );
}

type ProcTask = { valueStreamId: string; valueStreamName: string; l4: string | null; name: string; relation: 'Lead' | 'Support'; outputs: string | null };

// Lowest-level process steps the role leads or supports, grouped by value stream.
function Tasks({ tasks }: { tasks: ProcTask[] }) {
  const byStream = new Map<string, { valueStreamId: string; valueStreamName: string; tasks: ProcTask[] }>();
  for (const t of tasks) {
    let g = byStream.get(t.valueStreamId);
    if (!g) { g = { valueStreamId: t.valueStreamId, valueStreamName: t.valueStreamName, tasks: [] }; byStream.set(t.valueStreamId, g); }
    g.tasks.push(t);
  }
  return (
    <div className="card">
      <h3 className="font-semibold text-slate-900 mb-3">Tasks ({tasks.length})</h3>
      {tasks.length === 0 ? (
        <div className="text-sm text-slate-500 italic">No process tasks mapped.</div>
      ) : (
        [...byStream.values()].map((g) => (
          <div key={g.valueStreamId} className="mb-3 last:mb-0">
            <Link to={`/overview?focus=${g.valueStreamId}`} className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1 inline-block hover:underline">{g.valueStreamName} ({g.tasks.length})</Link>
            <ul className="space-y-1.5">
              {g.tasks.map((t, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className={`${t.relation === 'Lead' ? 'pill-blue' : 'pill-slate'} flex-shrink-0 mt-0.5`}>{t.relation}</span>
                  <div className="min-w-0">
                    <div className="text-sm text-slate-700">{t.name}</div>
                    {t.l4 && <div className="text-xs text-slate-400">{t.l4}</div>}
                    {t.outputs && <div className="text-xs text-slate-400 italic">→ {t.outputs}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

function Grouped({ title, groups }: { title: string; groups: { category: string; items: string[] }[] }) {
  return (
    <div className="card">
      <h3 className="font-semibold text-slate-900 mb-3">{title}</h3>
      {groups.length === 0 ? (
        <div className="text-sm text-slate-500 italic">None.</div>
      ) : (
        groups.map((g) => (
          <div key={g.category} className="mb-3 last:mb-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{g.category} ({g.items.length})</div>
            <ul className="list-disc list-inside text-sm text-slate-700 space-y-0.5">
              {g.items.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500 flex-shrink-0">{label}</dt>
      <dd className="font-medium text-slate-800 text-right">{value}</dd>
    </div>
  );
}
