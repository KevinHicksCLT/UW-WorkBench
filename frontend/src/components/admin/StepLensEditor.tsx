// StepLensEditor — the guided "what the map sidebar shows" editor.
//
// The map sidebar's step lens (Supporting roles/employees · Deliverables ·
// Applications & systems) is assembled at query time from DB rows. This editor
// is shaped like the sidebar itself: drill Value stream → Sub-process → Step,
// then edit each sidebar section in place. Every write goes through the same
// audited generic admin CRUD (/admin/<entity>) — the DB stays the single
// source of truth; nothing is stored locally.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

type Row = Record<string, any>;
const withCompany = (path: string, companyId: string | null) =>
  companyId ? path + (path.includes('?') ? '&' : '?') + `companyId=${companyId}` : path;

const USAGE_TYPES = ['Execution', 'System of Record', 'Approval', 'Reporting', 'Support'];
const APPROVAL_TYPES = ['System Workflow', 'Manual Sign-off', 'E-Signature'];

// Section accents mirror the sidebar's hue ladder so what you edit here is
// visually the same thing you see on the map.
const ACCENT = { who: '#059669', deliverable: '#0070AD', app: '#1d4ed8' } as const;

function SectionCard({ title, accent, hint, children }: { title: string; accent: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white" style={{ borderLeft: `3px solid ${accent}` }}>
      <div className="px-4 pt-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#525252]">{title}</div>
        {hint && <div className="text-[11px] text-[#a3a3a3] mt-0.5">{hint}</div>}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function Select({ value, onChange, options, allowEmpty }: {
  value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; allowEmpty?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-[#e5e7eb] bg-white px-2 py-1.5 text-[12px] text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#171717]"
    >
      {allowEmpty != null && <option value="">{allowEmpty}</option>}
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1">{children}</label>
);

export default function StepLensEditor({ companyId, onNavigate }: {
  companyId: string | null;
  onNavigate?: (tab: string, section?: string) => void;
}) {
  const [streams, setStreams] = useState<Row[]>([]);
  const [apps, setApps] = useState<Row[]>([]);
  const [roles, setRoles] = useState<Row[]>([]);
  const [vsId, setVsId] = useState('');
  const [steps, setSteps] = useState<Row[]>([]);
  const [l4, setL4] = useState('');
  const [stepId, setStepId] = useState('');
  const [usages, setUsages] = useState<Row[]>([]);
  const [delivs, setDelivs] = useState<Row[]>([]);
  const [who, setWho] = useState({ leads: '', supporting: '' });
  const [saving, setSaving] = useState<string | null>(null);
  const [flash, setFlash] = useState('');

  const rows = (r: any): Row[] => r?.rows ?? [];

  // Reference data: streams for the picker, apps + roles for the selects.
  useEffect(() => {
    if (!companyId) return;
    api.get(withCompany('/admin/valueStream?limit=200', companyId)).then((r: any) => setStreams(rows(r)));
    api.get(withCompany('/admin/application?limit=200', companyId)).then((r: any) => setApps(rows(r)));
    Promise.all([
      api.get(withCompany('/admin/role?limit=200', companyId)),
      api.get(withCompany('/admin/role?limit=200&offset=200', companyId)),
    ]).then(([a, b]: any[]) => setRoles([...rows(a), ...rows(b)]));
  }, [companyId]);

  // Steps of the selected stream, grouped L4 → ordered steps.
  useEffect(() => {
    setL4(''); setStepId(''); setSteps([]);
    if (!companyId || !vsId) return;
    api.get(withCompany(`/admin/processStep?limit=200&f_valueStreamId=${vsId}`, companyId)).then((r: any) => setSteps(rows(r)));
  }, [companyId, vsId]);

  const l4s = useMemo(() => {
    const seen = new Map<string, number>();
    for (const s of steps) if (s.l4) seen.set(s.l4, (seen.get(s.l4) ?? 0) + 1);
    return [...seen.entries()];
  }, [steps]);
  const l4Steps = useMemo(
    () => steps.filter((s) => s.l4 === l4).sort((a, b) => a.stepNumber - b.stepNumber),
    [steps, l4],
  );
  const step = useMemo(() => steps.find((s) => s.id === stepId) ?? null, [steps, stepId]);

  // The selected step's lens rows. Bridge rows attach by step id OR by the
  // workbook Activity ID (the step's own code, or its L4 parent code).
  const loadLens = async (s: Row) => {
    const fetches = (slug: string) => {
      const qs = [`f_processStepId=${s.id}`];
      if (s.code) qs.push(`f_activityCode=${encodeURIComponent(s.code)}`);
      if (s.parentProcessId) qs.push(`f_activityCode=${encodeURIComponent(s.parentProcessId)}`);
      return Promise.all(qs.map((q) => api.get(withCompany(`/admin/${slug}?limit=200&${q}`, companyId))));
    };
    const [u, d] = await Promise.all([fetches('stepAppUsage'), fetches('stepDeliverable')]);
    const merge = (parts: any[]) => {
      const m = new Map<string, Row>();
      for (const p of parts) for (const r of rows(p)) m.set(r.id, r);
      return [...m.values()];
    };
    setUsages(merge(u));
    setDelivs(merge(d));
  };
  useEffect(() => {
    setUsages([]); setDelivs([]);
    if (step) { setWho({ leads: step.leads ?? '', supporting: step.supporting ?? '' }); void loadLens(step); }
  }, [stepId]); // eslint-disable-line

  const note = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 2500); };
  const patch = async (slug: string, id: string, data: Row) => {
    setSaving(id);
    try { await api.patch(withCompany(`/admin/${slug}/${id}`, companyId), data); note('Saved — the map sidebar reflects this on next load.'); }
    finally { setSaving(null); }
  };
  const remove = async (slug: string, id: string) => {
    if (!confirm('Delete this row?')) return;
    await api.delete(withCompany(`/admin/${slug}/${id}`, companyId));
    if (step) void loadLens(step);
  };

  const appOptions = apps.map((a) => ({ id: a.id, label: `${a.code ? a.code + ' · ' : ''}${a.name}` }));
  const roleOptions = roles.map((r) => ({ id: r.id, label: r.name })).sort((a, b) => a.label.localeCompare(b.label));

  const upd = (set: typeof setUsages) => (id: string, field: string, v: any) =>
    set((list) => list.map((r) => (r.id === id ? { ...r, [field]: v } : r)));
  const updUsage = upd(setUsages);
  const updDeliv = upd(setDelivs);

  return (
    <div>
      <p className="text-sm text-[#666666] mb-4 max-w-3xl">
        This edits exactly what the <strong>map sidebar</strong> shows for a process step — pick a value stream,
        a sub-process, and a step, then change each sidebar section below. Everything saves to the database
        (audited), and the sidebar reads it live.
      </p>

      {/* ── Drill: stream → sub-process → step ───────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <div>
          <Label>1 · Value stream (PL3)</Label>
          <Select value={vsId} onChange={setVsId} allowEmpty="Select a value stream…" options={streams.map((v) => ({ id: v.id, label: v.name }))} />
        </div>
        <div>
          <Label>2 · Sub-process (PL4)</Label>
          <Select value={l4} onChange={(v) => { setL4(v); setStepId(''); }} allowEmpty={vsId ? 'Select a sub-process…' : 'Pick a value stream first'} options={l4s.map(([name, n]) => ({ id: name, label: `${name} (${n} steps)` }))} />
        </div>
        <div>
          <Label>3 · Process step (PL5)</Label>
          <Select value={stepId} onChange={setStepId} allowEmpty={l4 ? 'Select a step…' : 'Pick a sub-process first'} options={l4Steps.map((s) => ({ id: s.id, label: `${s.stepNumber}. ${s.name}` }))} />
        </div>
      </div>

      {flash && <div className="mb-3 text-[12px] font-medium text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] rounded-md px-3 py-2">{flash}</div>}

      {!step ? (
        <div className="card-elevated p-8 text-center text-sm text-[#a3a3a3]">
          Pick a step above to edit its sidebar content. (The Value-stream and Sub-process levels of the sidebar
          aggregate from their steps, so editing steps edits every level.)
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {/* ── Who does the work ─────────────────────────────────────────── */}
          <SectionCard
            title="Supporting roles & employees"
            accent={ACCENT.who}
            hint="Comma-separated role names. Names resolve to the role inventory; the sidebar then shows those roles with their assigned people nested (executive outliers are filtered)."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Lead role(s)</Label>
                <input value={who.leads} onChange={(e) => setWho((w) => ({ ...w, leads: e.target.value }))} className="w-full rounded-md border border-[#e5e7eb] px-2 py-1.5 text-[12px]" />
              </div>
              <div>
                <Label>Supporting role(s)</Label>
                <input value={who.supporting} onChange={(e) => setWho((w) => ({ ...w, supporting: e.target.value }))} className="w-full rounded-md border border-[#e5e7eb] px-2 py-1.5 text-[12px]" />
              </div>
            </div>
            <button
              onClick={() => patch('processStep', step.id, { leads: who.leads || null, supporting: who.supporting || null })}
              disabled={saving === step.id}
              className="mt-3 rounded-md bg-[#171717] text-white px-3 py-1.5 text-[12px] font-semibold hover:bg-black disabled:opacity-50"
            >
              Save roles
            </button>
            <div className="mt-2 text-[11px] text-[#a3a3a3]">
              People are managed per role (assignments) — <button className="underline text-[#1d4ed8]" onClick={() => onNavigate?.('people', 'people')}>People</button>.
              Tasks &amp; checklists come from the role definitions — <button className="underline text-[#1d4ed8]" onClick={() => onNavigate?.('organization', 'roles')}>Roles &amp; responsibilities</button>.
            </div>
          </SectionCard>

          {/* ── Deliverables ──────────────────────────────────────────────── */}
          <SectionCard
            title="Deliverables & approvals"
            accent={ACCENT.deliverable}
            hint="What the step produces, the system of record it is memorialized in, and who approves it where — the sidebar's Deliverables chain."
          >
            <div className="space-y-3">
              {delivs.map((d) => (
                <div key={d.id} className="rounded-md border border-[#e5e7eb] bg-[#fafafa] p-3">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label>Deliverable</Label>
                      <input value={d.name ?? ''} onChange={(e) => updDeliv(d.id, 'name', e.target.value)} className="w-full rounded-md border border-[#e5e7eb] px-2 py-1.5 text-[12px]" />
                    </div>
                    <div>
                      <Label>System of record</Label>
                      <Select value={d.sorApplicationId ?? ''} onChange={(v) => updDeliv(d.id, 'sorApplicationId', v || null)} allowEmpty="—" options={appOptions} />
                    </div>
                    <div>
                      <Label>Approver role</Label>
                      <Select value={d.approverRoleId ?? ''} onChange={(v) => updDeliv(d.id, 'approverRoleId', v || null)} allowEmpty="—" options={roleOptions} />
                    </div>
                    <div>
                      <Label>Approval system</Label>
                      <Select value={d.approvalApplicationId ?? ''} onChange={(v) => updDeliv(d.id, 'approvalApplicationId', v || null)} allowEmpty="—" options={appOptions} />
                    </div>
                    <div>
                      <Label>Approval type</Label>
                      <Select value={d.approvalType ?? ''} onChange={(v) => updDeliv(d.id, 'approvalType', v || null)} allowEmpty="—" options={APPROVAL_TYPES.map((t) => ({ id: t, label: t }))} />
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button onClick={() => patch('stepDeliverable', d.id, { name: d.name, sorApplicationId: d.sorApplicationId, approverRoleId: d.approverRoleId, approvalApplicationId: d.approvalApplicationId, approvalType: d.approvalType, illustrative: false })} disabled={saving === d.id} className="rounded-md bg-[#171717] text-white px-3 py-1.5 text-[12px] font-semibold hover:bg-black disabled:opacity-50">Save</button>
                    <button onClick={() => remove('stepDeliverable', d.id)} className="rounded-md border border-[#fecaca] text-[#b91c1c] px-3 py-1.5 text-[12px] font-semibold hover:bg-[#fef2f2]">Delete</button>
                    {d.illustrative && <span className="text-[9.5px] font-medium uppercase tracking-wide text-[#a3a3a3] bg-white border border-[#eaeaea] rounded px-1.5 py-0.5">Illustrative — saving marks it real</span>}
                  </div>
                </div>
              ))}
              <button
                onClick={async () => {
                  await api.post(withCompany('/admin/stepDeliverable', companyId), { activityCode: step.code ?? step.parentProcessId ?? '', processStepId: step.id, name: `${step.name} output`, illustrative: false });
                  void loadLens(step);
                }}
                className="rounded-md border border-[#dbe7ff] bg-[#f5f8ff] text-[#1d4ed8] px-3 py-1.5 text-[12px] font-semibold hover:bg-[#eaf1ff]"
              >
                + Add deliverable
              </button>
            </div>
          </SectionCard>

          {/* ── Applications ──────────────────────────────────────────────── */}
          <SectionCard
            title="Applications & systems"
            accent={ACCENT.app}
            hint="Which application the step runs on and how — the sidebar's Applications & systems section."
          >
            <div className="space-y-2">
              {usages.map((u) => (
                <div key={u.id} className="rounded-md border border-[#e5e7eb] bg-[#fafafa] p-2.5 grid gap-2 sm:grid-cols-[1fr_180px_auto_auto_auto] sm:items-end">
                  <div>
                    <Label>Application</Label>
                    <Select value={u.applicationId ?? ''} onChange={(v) => updUsage(u.id, 'applicationId', v)} options={appOptions} />
                  </div>
                  <div>
                    <Label>Usage</Label>
                    <Select value={u.usageType ?? ''} onChange={(v) => updUsage(u.id, 'usageType', v)} options={USAGE_TYPES.map((t) => ({ id: t, label: t }))} />
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-[#525252] pb-1.5">
                    <input type="checkbox" checked={!!u.isPrimary} onChange={(e) => updUsage(u.id, 'isPrimary', e.target.checked)} />
                    Primary
                  </label>
                  <button onClick={() => patch('stepAppUsage', u.id, { applicationId: u.applicationId, usageType: u.usageType, isPrimary: u.isPrimary, illustrative: false })} disabled={saving === u.id} className="rounded-md bg-[#171717] text-white px-3 py-1.5 text-[12px] font-semibold hover:bg-black disabled:opacity-50">Save</button>
                  <button onClick={() => remove('stepAppUsage', u.id)} className="rounded-md border border-[#fecaca] text-[#b91c1c] px-3 py-1.5 text-[12px] font-semibold hover:bg-[#fef2f2]">Delete</button>
                </div>
              ))}
              <button
                onClick={async () => {
                  await api.post(withCompany('/admin/stepAppUsage', companyId), { activityCode: step.code ?? step.parentProcessId ?? '', processStepId: step.id, applicationId: apps[0]?.id, usageType: 'Execution', isPrimary: false, illustrative: false });
                  void loadLens(step);
                }}
                className="rounded-md border border-[#dbe7ff] bg-[#f5f8ff] text-[#1d4ed8] px-3 py-1.5 text-[12px] font-semibold hover:bg-[#eaf1ff]"
              >
                + Add application
              </button>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
