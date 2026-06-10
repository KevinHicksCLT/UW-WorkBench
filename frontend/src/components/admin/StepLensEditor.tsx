// StepLensEditor — the guided "what the map sidebar shows" editor.
//
// The map sidebar's step lens (Supporting roles/employees · Deliverables ·
// Applications & systems) is assembled at query time from DB rows. This editor
// is shaped like the sidebar itself AND level-aware like the map: pick a value
// stream and the stream-level content appears prefilled; drill to a
// sub-process or a single step and the same sections narrow to that scope —
// editable at every depth. Every write goes through the same audited generic
// admin CRUD (/admin/<entity>) — the DB stays the single source of truth.
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

const StepChip = ({ text }: { text: string }) => (
  <span className="text-[9.5px] font-medium text-[#0369a1] bg-[#f0f9ff] border border-[#bae6fd] rounded px-1.5 py-0.5">{text}</span>
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
  const [allUsage, setAllUsage] = useState<Row[]>([]);
  const [allDelivs, setAllDelivs] = useState<Row[]>([]);
  // Per-step lead/supporting edits, keyed by step id (prefilled from the DB).
  const [who, setWho] = useState<Record<string, { leads: string; supporting: string }>>({});
  const [addStep, setAddStep] = useState<Record<'usage' | 'deliv', string>>({ usage: '', deliv: '' });
  const [saving, setSaving] = useState<string | null>(null);
  const [flash, setFlash] = useState('');

  const rows = (r: any): Row[] => r?.rows ?? [];
  // Page through a table (the generic endpoint caps at 200/page).
  const fetchAll = async (slug: string): Promise<Row[]> => {
    const out: Row[] = [];
    for (let offset = 0; offset < 4000; offset += 200) {
      const r: any = await api.get(withCompany(`/admin/${slug}?limit=200&offset=${offset}`, companyId));
      out.push(...rows(r));
      if (out.length >= (r?.total ?? 0)) break;
    }
    return out;
  };
  const reloadBridges = async () => {
    const [u, d] = await Promise.all([fetchAll('stepAppUsage'), fetchAll('stepDeliverable')]);
    setAllUsage(u);
    setAllDelivs(d);
  };

  // Reference data once per company; bridge rows for the whole company so any
  // scope (stream / L4 / step) filters instantly client-side.
  useEffect(() => {
    if (!companyId) return;
    api.get(withCompany('/admin/valueStream?limit=200', companyId)).then((r: any) => setStreams(rows(r)));
    api.get(withCompany('/admin/application?limit=200', companyId)).then((r: any) => setApps(rows(r)));
    Promise.all([
      api.get(withCompany('/admin/role?limit=200', companyId)),
      api.get(withCompany('/admin/role?limit=200&offset=200', companyId)),
    ]).then(([a, b]: any[]) => setRoles([...rows(a), ...rows(b)]));
    void reloadBridges();
  }, [companyId]); // eslint-disable-line

  // Steps of the selected stream.
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

  // ── The editing scope: stream → L4 → single step ───────────────────────────
  const scopeSteps = useMemo(() => {
    let list = steps;
    if (l4) list = list.filter((s) => s.l4 === l4);
    if (stepId) list = list.filter((s) => s.id === stepId);
    return [...list].sort((a, b) => (a.l4 ?? '').localeCompare(b.l4 ?? '') || a.stepNumber - b.stepNumber);
  }, [steps, l4, stepId]);

  useEffect(() => {
    // Prefill the per-step role fields from what's already there.
    const w: typeof who = {};
    for (const s of scopeSteps) w[s.id] = { leads: s.leads ?? '', supporting: s.supporting ?? '' };
    setWho(w);
    setAddStep({ usage: scopeSteps[0]?.id ?? '', deliv: scopeSteps[0]?.id ?? '' });
  }, [scopeSteps]);

  const stepById = useMemo(() => new Map(scopeSteps.map((s) => [s.id, s] as const)), [scopeSteps]);
  const scopeIds = useMemo(() => new Set(scopeSteps.map((s) => s.id)), [scopeSteps]);
  const scopeCodes = useMemo(() => new Set(scopeSteps.flatMap((s) => [s.code, s.parentProcessId]).filter(Boolean)), [scopeSteps]);
  const inScope = (r: Row) => (r.processStepId && scopeIds.has(r.processStepId)) || (r.activityCode && scopeCodes.has(r.activityCode));
  const usages = useMemo(() => allUsage.filter(inScope), [allUsage, scopeIds, scopeCodes]); // eslint-disable-line
  const delivs = useMemo(() => allDelivs.filter(inScope), [allDelivs, scopeIds, scopeCodes]); // eslint-disable-line

  const stepContext = (r: Row): string => {
    const s = r.processStepId ? stepById.get(r.processStepId) : undefined;
    if (s) return `step ${s.stepNumber} · ${s.name}`;
    return r.activityCode ? `all steps of ${r.activityCode}` : '—';
  };

  const note = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 2500); };
  const patch = async (slug: string, id: string, data: Row) => {
    setSaving(id);
    try { await api.patch(withCompany(`/admin/${slug}/${id}`, companyId), data); note('Saved — the map sidebar reflects this on next load.'); }
    finally { setSaving(null); }
  };
  const remove = async (slug: string, id: string) => {
    if (!confirm('Delete this row?')) return;
    await api.delete(withCompany(`/admin/${slug}/${id}`, companyId));
    void reloadBridges();
  };

  const appOptions = apps.map((a) => ({ id: a.id, label: `${a.code ? a.code + ' · ' : ''}${a.name}` }));
  const roleOptions = roles.map((r) => ({ id: r.id, label: r.name })).sort((a, b) => a.label.localeCompare(b.label));
  const stepOptions = scopeSteps.map((s) => ({ id: s.id, label: `${s.stepNumber}. ${s.name}` }));

  const updUsage = (id: string, field: string, v: any) => setAllUsage((list) => list.map((r) => (r.id === id ? { ...r, [field]: v } : r)));
  const updDeliv = (id: string, field: string, v: any) => setAllDelivs((list) => list.map((r) => (r.id === id ? { ...r, [field]: v } : r)));

  const scopeLabel = stepId
    ? `this step (Process Level 5)`
    : l4
      ? `the "${l4}" sub-process — ${scopeSteps.length} steps (Process Level 4)`
      : vsId
        ? `the whole value stream — ${scopeSteps.length} steps (Process Level 3)`
        : '';

  return (
    <div>
      <p className="text-sm text-[#666666] mb-4 max-w-3xl">
        This edits exactly what the <strong>map sidebar</strong> shows. Pick a value stream and its sidebar
        content appears below, prefilled from the database; drill to a sub-process or a single step to narrow
        the same sections to that level. Every save is audited and the sidebar reads it live.
      </p>

      {/* ── Drill: stream → sub-process → step (deeper levels optional) ───── */}
      <div className="grid gap-3 sm:grid-cols-3 mb-3">
        <div>
          <Label>1 · Value stream (PL3)</Label>
          <Select value={vsId} onChange={setVsId} allowEmpty="Select a value stream…" options={streams.map((v) => ({ id: v.id, label: v.name }))} />
        </div>
        <div>
          <Label>2 · Sub-process (PL4) — optional</Label>
          <Select value={l4} onChange={(v) => { setL4(v); setStepId(''); }} allowEmpty={vsId ? 'Whole value stream' : 'Pick a value stream first'} options={l4s.map(([name, n]) => ({ id: name, label: `${name} (${n} steps)` }))} />
        </div>
        <div>
          <Label>3 · Process step (PL5) — optional</Label>
          <Select value={stepId} onChange={setStepId} allowEmpty={l4 ? 'Whole sub-process' : 'Pick a sub-process first'} options={steps.filter((s) => s.l4 === l4).sort((a, b) => a.stepNumber - b.stepNumber).map((s) => ({ id: s.id, label: `${s.stepNumber}. ${s.name}` }))} />
        </div>
      </div>

      {flash && <div className="mb-3 text-[12px] font-medium text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] rounded-md px-3 py-2">{flash}</div>}

      {!vsId ? (
        <div className="card-elevated p-8 text-center text-sm text-[#a3a3a3]">
          Pick a value stream to see and edit its sidebar content. Drilling deeper narrows the scope, just like the map.
        </div>
      ) : (
        <div className="space-y-4 max-w-4xl">
          <div className="text-[12px] text-[#525252]">Editing <strong>{scopeLabel}</strong>. The sidebar at this level aggregates everything below.</div>

          {/* ── Who does the work ─────────────────────────────────────────── */}
          <SectionCard
            title="Supporting roles & employees"
            accent={ACCENT.who}
            hint="Comma-separated role names per step. Names resolve to the role inventory; the sidebar shows those roles with their assigned people nested (executive outliers are filtered)."
          >
            <div className="space-y-2">
              {scopeSteps.map((s) => (
                <div key={s.id} className="rounded-md border border-[#e5e7eb] bg-[#fafafa] p-2.5">
                  {!stepId && <div className="mb-1.5"><StepChip text={`${!l4 ? `${s.l4} · ` : ''}step ${s.stepNumber} · ${s.name}`} /></div>}
                  <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <div>
                      <Label>Lead role(s)</Label>
                      <input value={who[s.id]?.leads ?? ''} onChange={(e) => setWho((w) => ({ ...w, [s.id]: { ...w[s.id], leads: e.target.value } }))} className="w-full rounded-md border border-[#e5e7eb] px-2 py-1.5 text-[12px]" />
                    </div>
                    <div>
                      <Label>Supporting role(s)</Label>
                      <input value={who[s.id]?.supporting ?? ''} onChange={(e) => setWho((w) => ({ ...w, [s.id]: { ...w[s.id], supporting: e.target.value } }))} className="w-full rounded-md border border-[#e5e7eb] px-2 py-1.5 text-[12px]" />
                    </div>
                    <button
                      onClick={() => patch('processStep', s.id, { leads: who[s.id]?.leads || null, supporting: who[s.id]?.supporting || null })}
                      disabled={saving === s.id}
                      className="rounded-md bg-[#171717] text-white px-3 py-1.5 text-[12px] font-semibold hover:bg-black disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-[#a3a3a3]">
              People are managed per role (assignments) — <button className="underline text-[#1d4ed8]" onClick={() => onNavigate?.('people', 'people')}>People</button>.
              Tasks &amp; checklists come from the role definitions — <button className="underline text-[#1d4ed8]" onClick={() => onNavigate?.('organization', 'roles')}>Roles &amp; responsibilities</button>.
            </div>
          </SectionCard>

          {/* ── Deliverables ──────────────────────────────────────────────── */}
          <SectionCard
            title="Deliverables & approvals"
            accent={ACCENT.deliverable}
            hint="What each step produces, the system of record it is memorialized in, and who approves it where — the sidebar's Deliverables chain."
          >
            <div className="space-y-3">
              {delivs.map((d) => (
                <div key={d.id} className="rounded-md border border-[#e5e7eb] bg-[#fafafa] p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 flex-wrap">
                    <StepChip text={stepContext(d)} />
                    {d.illustrative && <span className="text-[9.5px] font-medium uppercase tracking-wide text-[#a3a3a3] bg-white border border-[#eaeaea] rounded px-1.5 py-0.5">Illustrative — saving marks it real</span>}
                  </div>
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
                  </div>
                </div>
              ))}
              <div className="flex items-end gap-2 flex-wrap">
                {!stepId && (
                  <div className="min-w-[260px]">
                    <Label>Add to step</Label>
                    <Select value={addStep.deliv} onChange={(v) => setAddStep((a) => ({ ...a, deliv: v }))} options={stepOptions} />
                  </div>
                )}
                <button
                  onClick={async () => {
                    const target = stepById.get(stepId || addStep.deliv);
                    if (!target) return;
                    await api.post(withCompany('/admin/stepDeliverable', companyId), { activityCode: target.code ?? target.parentProcessId ?? '', processStepId: target.id, name: `${target.name} output`, illustrative: false });
                    void reloadBridges();
                  }}
                  className="rounded-md border border-[#dbe7ff] bg-[#f5f8ff] text-[#1d4ed8] px-3 py-1.5 text-[12px] font-semibold hover:bg-[#eaf1ff]"
                >
                  + Add deliverable
                </button>
              </div>
            </div>
          </SectionCard>

          {/* ── Applications ──────────────────────────────────────────────── */}
          <SectionCard
            title="Applications & systems"
            accent={ACCENT.app}
            hint="Which application each step runs on and how — the sidebar's Applications & systems section."
          >
            <div className="space-y-2">
              {usages.map((u) => (
                <div key={u.id} className="rounded-md border border-[#e5e7eb] bg-[#fafafa] p-2.5">
                  <div className="mb-1.5 flex items-center gap-1.5 flex-wrap">
                    <StepChip text={stepContext(u)} />
                    {u.illustrative && <span className="text-[9.5px] font-medium uppercase tracking-wide text-[#a3a3a3] bg-white border border-[#eaeaea] rounded px-1.5 py-0.5">Illustrative — saving marks it real</span>}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto_auto_auto] sm:items-end">
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
                </div>
              ))}
              <div className="flex items-end gap-2 flex-wrap">
                {!stepId && (
                  <div className="min-w-[260px]">
                    <Label>Add to step</Label>
                    <Select value={addStep.usage} onChange={(v) => setAddStep((a) => ({ ...a, usage: v }))} options={stepOptions} />
                  </div>
                )}
                <button
                  onClick={async () => {
                    const target = stepById.get(stepId || addStep.usage);
                    if (!target) return;
                    await api.post(withCompany('/admin/stepAppUsage', companyId), { activityCode: target.code ?? target.parentProcessId ?? '', processStepId: target.id, applicationId: apps[0]?.id, usageType: 'Execution', isPrimary: false, illustrative: false });
                    void reloadBridges();
                  }}
                  className="rounded-md border border-[#dbe7ff] bg-[#f5f8ff] text-[#1d4ed8] px-3 py-1.5 text-[12px] font-semibold hover:bg-[#eaf1ff]"
                >
                  + Add application
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
