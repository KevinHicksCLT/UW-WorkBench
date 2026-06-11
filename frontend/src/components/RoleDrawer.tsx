import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { PARTICIPATION_CLASS } from '../lib/format';

// RoleDrawer — the role's full detail (inputs & deliverables, process tasks,
// responsibilities, value-stream participation and the people in the role),
// rendered as a wide slide-over wherever the user already is. Replaces the
// retired role page (OrgTable's RoleDetailView): role links across the app and
// the sidebar's "View full details" button open this instead of navigating.
// Clicking a person swaps the drawer to their detail (back button returns) —
// the person view that previously lived behind the role page.

// ── Shapes (from GET /roles/:id — same payload the old page consumed) ─────────
type Person = { id: string; name: string; title: string | null; region: string | null; employmentType: string; vendor: string | null; allocationPct: number; isPrimary: boolean };
type RoleParticipation = { valueStreamId: string; valueStreamName: string; participationType: string; subStream: string | null; inputs: string | null; outputs: string | null };
type Grouped = { category: string; items: string[] };
type ServerIoRow = { valueStreamId: string; valueStreamName: string; domain: string | null; l3: string | null; l4: string | null; inputs: string[]; deliverables: string[] };
type ProcTask = { valueStreamId: string; valueStreamName: string; l3: string | null; l4: string | null; stepNumber: number; name: string; relation: 'Lead' | 'Support'; outputs: string | null };
type RoleDetailData = {
  id: string; name: string; roleFamily: string | null; roleLevel: string | null;
  division?: { id: string; name: string }; department?: { id: string; name: string };
  participation: RoleParticipation[]; people: Person[]; responsibilities: Grouped[];
  ioRows?: ServerIoRow[]; deliverableCount?: number; inputCount?: number; processTasks?: ProcTask[];
};

// ── Person detail shapes (from GET /explorer/person/:id) ──────────────────────
type PersonMetric = { name: string; unit: string; target: number | null; direction: string; latest: number | null; latestPeriod: string | null; onTarget: boolean | null; history: { period: string; value: number }[] };
type PersonSignal = { name: string; unit: string; latest: number | null; latestPeriod: string | null; history: { period: string; value: number }[] };
type AppUsage = { appName: string; category: string | null; usagePct: number; rank: number };
type PersonData = {
  person: { id: string; name: string; title: string | null; location: string | null; region: string | null; employmentType: string; vendor: string | null };
  valueStreams: { id: string; name: string; participationType: string }[];
  metrics: PersonMetric[];
  signals: PersonSignal[];
  apps: AppUsage[];
};

// Split a workbook I/O field (comma / semicolon / newline separated) into the
// discrete items that read as a list instead of a single cramped text blob.
function splitItems(value: string | null): string[] {
  if (!value) return [];
  return value.split(/[;,\n]+/).map((s) => s.trim()).filter(Boolean);
}

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#374151] mb-2">{children}</div>
);

const Empty = ({ text }: { text: string }) => (
  <div className="text-sm text-[#a3a3a3] italic">{text}</div>
);

// A vertical list of I/O items for one table cell. Inputs ("in") read as a plain
// bulleted list; deliverables ("out") get a doc glyph so they stand apart as the
// owned work products — even though they share a row with their inputs.
function ItemList({ items, tone }: { items: string[]; tone: 'in' | 'out' }) {
  if (items.length === 0) return <span className="text-xs text-[#a3a3a3] italic">—</span>;
  return (
    <ul className="space-y-1.5 min-w-0">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-1.5 text-[13px] text-slate-700">
          <span className={`mt-0.5 flex-shrink-0 ${tone === 'out' ? 'text-emerald-500' : 'text-slate-300'}`} aria-hidden="true">
            {tone === 'out' ? <DocIcon /> : <Dot />}
          </span>
          <span className="min-w-0 break-words">{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Dot() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h6" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

// 6-month sparkline of a metric's readings.
function MiniTrend({ history }: { history: { period: string; value: number }[] }) {
  if (history.length < 2) return <div className="w-20 flex-shrink-0" />;
  const vals = history.map((h) => h.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  return (
    <div className="w-20 h-8 flex items-end gap-0.5 flex-shrink-0" title={history.map((h) => `${h.period}: ${h.value}`).join('\n')}>
      {history.map((h, i) => (
        <div key={i} className="flex-1 bg-[#e5e5e5] rounded-sm" style={{ height: `${20 + ((h.value - min) / span) * 80}%` }} />
      ))}
    </div>
  );
}

function DRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500 flex-shrink-0">{label}</dt>
      <dd className="font-medium text-slate-800 text-right">{value}</dd>
    </div>
  );
}

const Skeleton = () => (
  <div className="space-y-2">
    {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton rounded-md" style={{ height: 48 }} />)}
  </div>
);

// ── Person view (in-drawer) — everything the old person page showed ──────────
function PersonBody({ d }: { d: PersonData }) {
  return (
    <>
      {/* Location & employment */}
      <div className="mb-6">
        <SectionLabel>Location</SectionLabel>
        <dl className="text-sm space-y-2">
          <DRow label="Location" value={d.person.location || '—'} />
          <DRow label="Region" value={d.person.region || '—'} />
          <DRow label="Employment" value={d.person.employmentType === 'badged' ? 'Badged employee' : (d.person.employmentType === 'si_partner' ? 'SI partner' : 'Contractor')} />
          {d.person.vendor && <DRow label="Vendor" value={d.person.vendor} />}
        </dl>
      </div>

      {/* Digital productivity signals (illustrative) */}
      <div className="mb-6">
        <SectionLabel>Digital Productivity · latest {d.signals[0]?.latestPeriod ?? ''}</SectionLabel>
        {d.signals.length === 0 ? <Empty text="No signals." /> : (
          <div className="space-y-3">
            {d.signals.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[#171717] truncate">{s.name}</div>
                  <div className="text-xs text-[#a3a3a3]">{s.unit}</div>
                </div>
                <MiniTrend history={s.history} />
                <div className="w-12 text-right text-sm font-semibold text-[#171717] tnum flex-shrink-0">{s.latest ?? '—'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance vs the role's relevant KPIs */}
      <div className="mb-6">
        <SectionLabel>Performance Metrics ({d.metrics.length}) · latest {d.metrics[0]?.latestPeriod ?? ''}</SectionLabel>
        {d.metrics.length === 0 ? <Empty text="No performance metrics tracked." /> : (
          <div className="space-y-3">
            {d.metrics.map((m) => (
              <div key={m.name} className="flex items-center gap-3 border-b border-slate-100 last:border-0 pb-3 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[#171717] truncate">{m.name}</div>
                  <div className="text-xs text-[#a3a3a3]">
                    {m.target != null ? `Target ${m.direction === 'down' ? '≤' : '≥'} ${m.target}${m.unit === '%' ? '%' : ` ${m.unit}`}` : 'No target'}
                  </div>
                </div>
                <MiniTrend history={m.history} />
                <div className="w-24 text-right flex-shrink-0">
                  <div className="text-sm font-semibold text-[#171717] tnum">{m.latest != null ? `${m.latest}${m.unit === '%' ? '%' : ` ${m.unit}`}` : '—'}</div>
                  {m.onTarget != null && (
                    <span className={m.onTarget ? 'pill-green' : 'pill-red'}>{m.onTarget ? 'On target' : 'Off target'}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Most used apps */}
      {d.apps.length > 0 && (
        <div className="mb-6">
          <SectionLabel>Most Used Apps</SectionLabel>
          <div className="space-y-2">
            {d.apps.map((a) => (
              <div key={a.appName}>
                <div className="flex items-center justify-between gap-2 text-sm mb-0.5">
                  <span className="text-[#171717] truncate flex items-center gap-1.5">{a.appName}{a.rank === 1 && <span className="chip-soft">Top</span>}</span>
                  <span className="tnum text-xs text-[#a3a3a3] flex-shrink-0">{a.usagePct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                  <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${a.usagePct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Value streams this person works in */}
      {d.valueStreams.length > 0 && (
        <div>
          <SectionLabel>Value Streams</SectionLabel>
          <div className="space-y-1.5">
            {d.valueStreams.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2 text-sm">
                <Link to={`/overview?focus=${v.id}`} className="text-[#171717] hover:underline truncate">{v.name}</Link>
                <span className={`${PARTICIPATION_CLASS[v.participationType] || 'pill-slate'} flex-shrink-0`}>{v.participationType}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function RoleDrawer({ roleId, onClose }: { roleId: string; onClose: () => void }) {
  const [r, setR] = useState<RoleDetailData | null>(null);
  const [error, setError] = useState('');
  // In-drawer person drill: set = show that person's detail, back returns to the role.
  const [personId, setPersonId] = useState<string | null>(null);
  const [person, setPerson] = useState<PersonData | null>(null);
  const [personError, setPersonError] = useState('');

  useEffect(() => {
    setR(null); setError(''); setPersonId(null);
    api.get(`/roles/${roleId}`).then(setR).catch((e: Error) => setError(e.message));
  }, [roleId]);

  useEffect(() => {
    if (!personId) { setPerson(null); return; }
    setPerson(null); setPersonError('');
    api.get(`/explorer/person/${personId}`).then(setPerson).catch((e: Error) => setPersonError(e.message));
  }, [personId]);

  // Inputs & deliverables, related per (value stream, sub-process), at the LOWEST
  // level. Prefer the server's role-resolved I/O inventory (one row per L4
  // sub-process); fall back to the coarse value-stream participation I/O for roles
  // the inventory doesn't tag. "Outputs" and "deliverables" are the same thing, so
  // they show once — as deliverables — paired with the inputs that feed them.
  const ioRows = useMemo(() => {
    if (!r) return [] as { vsId: string; vsName: string; sub: string | null; inputs: string[]; deliverables: string[] }[];
    if (r.ioRows && r.ioRows.length) {
      return r.ioRows.map((x) => ({ vsId: x.valueStreamId, vsName: x.valueStreamName, sub: x.l4 ?? x.l3 ?? null, inputs: x.inputs, deliverables: x.deliverables }));
    }
    return r.participation.map((p) => ({ vsId: p.valueStreamId, vsName: p.valueStreamName, sub: p.subStream, inputs: splitItems(p.inputs), deliverables: splitItems(p.outputs) }));
  }, [r]);
  const deliverableCount = r?.deliverableCount ?? ioRows.reduce((a, row) => a + row.deliverables.length, 0);
  const inputCount = r?.inputCount ?? ioRows.reduce((a, row) => a + row.inputs.length, 0);

  // Process tasks — the L5 steps the role leads/supports — grouped by value stream.
  const taskGroups = useMemo(() => {
    const groups = new Map<string, { vsId: string; vsName: string; tasks: ProcTask[] }>();
    for (const t of r?.processTasks ?? []) {
      const g = groups.get(t.valueStreamId) ?? { vsId: t.valueStreamId, vsName: t.valueStreamName, tasks: [] };
      g.tasks.push(t); groups.set(t.valueStreamId, g);
    }
    return [...groups.values()].sort((a, b) => a.vsName.localeCompare(b.vsName));
  }, [r]);
  const processTaskCount = r?.processTasks?.length ?? 0;
  const respCount = r?.responsibilities.reduce((a, g) => a + g.items.length, 0) ?? 0;

  const personMode = personId !== null;

  return (
    <div className="absolute inset-0 z-30 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop dims the canvas; click to dismiss. */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <aside className="relative h-full bg-white border-l border-[#eaeaea] shadow-2xl flex flex-col" style={{ width: 720, maxWidth: '94vw' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#eaeaea] flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0 flex items-start gap-2.5">
            {personMode && (
              <button onClick={() => setPersonId(null)} aria-label="Back to role" title="Back to role"
                className="mt-0.5 flex-shrink-0 text-[#525252] hover:text-[#171717] w-6 h-6 rounded-md hover:bg-[#fafafa] flex items-center justify-center">
                <svg width="15" height="15" viewBox="0 0 13 13" fill="none"><path d="M11 6.5H2M6 2.5l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            )}
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">{personMode ? 'Individual' : 'Role'}</div>
              <div className="text-[15px] font-bold text-[#171717] leading-snug">
                {personMode ? (person?.person.name ?? 'Loading…') : (r?.name ?? 'Loading…')}
              </div>
              <div className="text-[11px] text-[#a3a3a3] mt-0.5">
                {personMode
                  ? [person?.person.title, person && (person.person.employmentType !== 'badged' ? (person.person.vendor ?? person.person.employmentType) : 'Employee')].filter(Boolean).join(' · ')
                  : [r?.roleFamily, r?.department?.name, r?.division?.name].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1 flex-shrink-0 text-[#a3a3a3] hover:text-[#171717] w-7 h-7 rounded-md hover:bg-[#fafafa] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {personMode ? (
            personError ? <div className="text-sm text-[#be123c]">{personError}</div>
            : !person ? <Skeleton />
            : <PersonBody d={person} />
          ) : error ? (
            <div className="text-sm text-[#be123c]">{error}</div>
          ) : !r ? (
            <Skeleton />
          ) : (
            <>
              {/* Value-stream participation — compact chips up top so the long
                  sections below don't bury where the role plays. */}
              <div className="mb-6">
                <SectionLabel>Value-Stream Participation ({r.participation.length})</SectionLabel>
                {r.participation.length === 0 ? <Empty text="Not mapped to any value stream." /> : (
                  <div className="space-y-1.5">
                    {r.participation.map((p, i) => (
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

              {/* People in the role — click through to their in-drawer detail. */}
              <div className="mb-6">
                <SectionLabel>Users in Role ({r.people.length})</SectionLabel>
                {r.people.length === 0 ? <Empty text="No people assigned yet." /> : (
                  <div className="space-y-0.5">
                    {r.people.map((pp) => (
                      <button key={pp.id} onClick={() => setPersonId(pp.id)}
                        className="w-full flex items-center justify-between gap-2 text-sm py-1 px-1.5 -mx-1.5 rounded-md hover:bg-[#fafafa] transition-colors duration-150 text-left group">
                        <span className="min-w-0">
                          <span className="text-[#171717] truncate group-hover:underline">{pp.name}</span>
                          {pp.title && <span className="block text-xs text-[#a3a3a3] truncate">{pp.title}</span>}
                        </span>
                        <span className="flex items-center gap-1.5 flex-shrink-0 text-[11px] text-[#a3a3a3]">
                          {pp.employmentType !== 'badged' && <span className="chip-soft">{pp.vendor ?? pp.employmentType}</span>}
                          {pp.region && <span>{pp.region}</span>}
                          <span className="tnum">{pp.allocationPct}%</span>
                          <Chevron />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Inputs & Deliverables — every input the role receives and
                  deliverable it produces, at the LOWEST (sub-process) level, drawn
                  from the role-tagged I/O inventory and related per value stream /
                  L4. "Outputs" and "deliverables" are the same list, so they show
                  once — as deliverables — paired with their inputs. No repetition. */}
              <div className="mb-6">
                <SectionLabel>Inputs &amp; Deliverables</SectionLabel>
                <p className="text-xs text-slate-400 -mt-1 mb-3">
                  {deliverableCount} deliverable{deliverableCount === 1 ? '' : 's'} and {inputCount} input{inputCount === 1 ? '' : 's'} across {ioRows.length} sub-process{ioRows.length === 1 ? '' : 'es'} — the role's lowest-level work products and what feeds them.
                </p>
                {ioRows.length === 0 ? <Empty text="Not mapped to any value stream." /> : (
                  <div>
                    {/* Header row */}
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)] gap-3 pb-2 border-b border-slate-200">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">Value stream · sub-process</div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">Receives (inputs)</div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">Deliverables</div>
                    </div>
                    {/* Body rows */}
                    {ioRows.map((row, i) => (
                      <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)] gap-3 py-3 border-b border-slate-100 last:border-0 items-start">
                        <div className="min-w-0">
                          <Link to={`/overview?focus=${row.vsId}`} className="text-[13px] font-medium text-brand-700 hover:underline break-words">{row.vsName}</Link>
                          {row.sub && <div className="text-xs text-slate-400 mt-0.5 break-words">{row.sub}</div>}
                        </div>
                        <ItemList items={row.inputs} tone="in" />
                        <ItemList items={row.deliverables} tone="out" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Process Tasks — the L5 process steps this role leads or supports,
                  tied back to the role. These are its lowest-level activities; each
                  yields the output shown. */}
              <div className="mb-6">
                <SectionLabel>Process Tasks ({processTaskCount})</SectionLabel>
                <p className="text-xs text-slate-400 -mt-1 mb-3">The process steps this role leads or supports — its lowest-level activities, by value stream.</p>
                {processTaskCount === 0 ? <Empty text="No process steps tie to this role." /> : (
                  <div className="space-y-4">
                    {taskGroups.map((g) => (
                      <div key={g.vsId}>
                        <Link to={`/overview?focus=${g.vsId}`} className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:underline">{g.vsName} ({g.tasks.length})</Link>
                        <ul className="mt-1.5 divide-y divide-slate-100">
                          {g.tasks.map((t, i) => (
                            <li key={i} className="flex items-start gap-2.5 py-2 first:pt-0">
                              <span className={`${t.relation === 'Lead' ? 'pill-blue' : 'pill-slate'} mt-0.5 flex-shrink-0`}>{t.relation}</span>
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] text-slate-700 break-words">{t.name}</div>
                                {t.outputs && <div className="text-[11px] text-[#a3a3a3] mt-0.5 break-words">→ {t.outputs}</div>}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Responsibilities (merged checklist + role tasks), by category. */}
              <div>
                <SectionLabel>Responsibilities ({respCount})</SectionLabel>
                {r.responsibilities.length === 0 ? <Empty text="No responsibilities recorded." /> : (
                  r.responsibilities.map((g) => (
                    <div key={g.category} className="mb-4 last:mb-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{g.category} ({g.items.length})</div>
                      <ul className="space-y-1.5">
                        {g.items.map((it, i) => (
                          <li key={i} className="flex gap-2 text-[13px] text-slate-700 leading-snug">
                            <span className="mt-[7px] h-1 w-1 rounded-full bg-slate-300 flex-shrink-0" aria-hidden="true" />
                            <span className="min-w-0 break-words">{it}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
