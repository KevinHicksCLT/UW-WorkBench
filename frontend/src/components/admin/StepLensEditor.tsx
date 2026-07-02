// StepLensEditor — the guided "what the map sidebar shows" editor.
//
// The map sidebar's step lens (Supporting roles · Deliverables ·
// Applications & systems) is assembled at query time from DB rows. This editor
// is shaped like the sidebar itself AND level-aware like the map: pick a value
// stream and the stream-level content appears prefilled; drill to a
// sub-process or a single step and the same sections narrow to that scope —
// editable at every depth. Every write goes through the same audited generic
// admin CRUD (/admin/<entity>) — the DB stays the single source of truth.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { Card, EmptyState, LoadingState } from '../ui';
import {
  ACCENT, APPROVAL_TYPES, USAGE_TYPES, withCompany,
  SectionCard, Select, Label, StepChip, SubProcessDetailCard,
  type Row,
} from './step-lens/parts';

export default function StepLensEditor({ companyId, onNavigate }: {
  companyId: string | null;
  onNavigate?: (tab: string, section?: string) => void;
}) {
  const dialogs = useDialogs();
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

  const rows = (r: { rows?: Row[] } | null | undefined): Row[] => r?.rows ?? [];
  // Page through a table (the generic endpoint caps at 200/page).
  const fetchAll = async (slug: string): Promise<Row[]> => {
    const out: Row[] = [];
    for (let offset = 0; offset < 4000; offset += 200) {
      const r = await api.get(withCompany(`/admin/${slug}?limit=200&offset=${offset}`, companyId));
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
    api.get(withCompany('/admin/valueStream?limit=200', companyId)).then((r) => setStreams(rows(r)));
    api.get(withCompany('/admin/application?limit=200', companyId)).then((r) => setApps(rows(r)));
    Promise.all([
      api.get(withCompany('/admin/role?limit=200', companyId)),
      api.get(withCompany('/admin/role?limit=200&offset=200', companyId)),
    ]).then(([a, b]) => setRoles([...rows(a), ...rows(b)]));
    void reloadBridges();
  }, [companyId]);

  // Steps of the selected stream.
  const loadSteps = () => {
    if (!companyId || !vsId) { setSteps([]); return; }
    api.get(withCompany(`/admin/processStep?limit=200&f_valueStreamId=${vsId}`, companyId)).then((r) => setSteps(rows(r)));
  };
  useEffect(() => {
    setL4(''); setStepId(''); setSteps([]);
    loadSteps();
  }, [companyId, vsId]);

  // The L4 sub-process detail record (inputs/outputs/hand-offs/notes shown in
  // the map sidebar at PL4). undefined = nothing selected / loading, null = the
  // selected sub-process has no detail row yet.
  const [l4Row, setL4Row] = useState<Row | null | undefined>(undefined);
  const loadL4Row = () => {
    setL4Row(undefined);
    if (!companyId || !vsId || !l4) return;
    api.get(withCompany(`/admin/subValueStream?limit=200&f_valueStreamId=${vsId}&f_level=4`, companyId))
      .then((r) => setL4Row(rows(r).find((x: Row) => x.name === l4) ?? null));
  };
  useEffect(() => { loadL4Row(); }, [companyId, vsId, l4]);

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
  const usages = useMemo(() => allUsage.filter(inScope), [allUsage, scopeIds, scopeCodes]);
  const delivs = useMemo(() => allDelivs.filter(inScope), [allDelivs, scopeIds, scopeCodes]);

  const stepContext = (r: Row): string => {
    const s = r.processStepId ? stepById.get(r.processStepId) : undefined;
    if (s) return `step ${s.stepNumber} · ${s.name}`;
    return r.activityCode ? `all steps of ${r.activityCode}` : '—';
  };

  const note = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 2500); };
  const patch = async (slug: string, id: string, data: Record<string, unknown>) => {
    setSaving(id);
    try { await api.patch(withCompany(`/admin/${slug}/${id}`, companyId), data); note('Saved — the map sidebar reflects this on next load.'); }
    finally { setSaving(null); }
  };
  const remove = async (slug: string, id: string) => {
    if (!(await dialogs.confirm({ title: 'Delete this row?', danger: true, message: 'This cannot be undone.' }))) return;
    await api.delete(withCompany(`/admin/${slug}/${id}`, companyId));
    void reloadBridges();
  };

  // ── The steps themselves (rename on blur, delete, add) ─────────────────────
  const [newStepName, setNewStepName] = useState('');
  const renameStep = async (s: Row, name: string) => {
    if (!name || name === s.name) return;
    await patch('processStep', s.id, { name });
    loadSteps();
  };
  const removeStep = async (s: Row) => {
    const ok = await dialogs.confirm({
      title: `Delete step ${s.stepNumber} "${s.name}"?`,
      danger: true,
      message: 'Its application and deliverable rows below are deleted with it. This cannot be undone.',
    });
    if (!ok) return;
    await api.delete(withCompany(`/admin/processStep/${s.id}`, companyId));
    if (stepId === s.id) setStepId('');
    loadSteps();
    void reloadBridges();
  };
  const addNewStep = async () => {
    const name = newStepName.trim();
    if (!name) return;
    const sibs = l4 ? steps.filter((s) => s.l4 === l4) : steps;
    const proto = l4 ? sibs[0] : null;
    await api.post(withCompany('/admin/processStep', companyId), {
      valueStreamId: vsId,
      name,
      stepNumber: Math.max(0, ...sibs.map((s) => s.stepNumber)) + 1,
      l4: l4 || null,
      l3: proto?.l3 ?? null,
      parentProcessId: proto?.parentProcessId ?? null,
    });
    setNewStepName('');
    note('Step added.');
    loadSteps();
  };

  // ── L4 sub-process detail (the PL4 sidebar narrative) ──────────────────────
  const saveL4Detail = async (data: Record<string, unknown>) => {
    if (!l4Row) return;
    await patch('subValueStream', l4Row.id, data);
    loadL4Row();
  };
  const createL4Detail = async () => {
    await api.post(withCompany('/admin/subValueStream', companyId), { valueStreamId: vsId, level: 4, name: l4 });
    note('Detail record created — fill it in below.');
    loadL4Row();
  };

  const appOptions = apps.map((a) => ({ id: a.id, label: `${a.code ? a.code + ' · ' : ''}${a.name}` }));
  const roleOptions = roles.map((r) => ({ id: r.id, label: r.name })).sort((a, b) => a.label.localeCompare(b.label));
  const stepOptions = scopeSteps.map((s) => ({ id: s.id, label: `${s.stepNumber}. ${s.name}` }));

  const updUsage = (id: string, field: string, v: unknown) => setAllUsage((list) => list.map((r) => (r.id === id ? { ...r, [field]: v } : r)));
  const updDeliv = (id: string, field: string, v: unknown) => setAllDelivs((list) => list.map((r) => (r.id === id ? { ...r, [field]: v } : r)));

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
        <Card variant="elevated" className="p-8 text-center text-sm text-[#a3a3a3]">
          Pick a value stream to see and edit its sidebar content. Drilling deeper narrows the scope, just like the map.
        </Card>
      ) : (
        <div className="space-y-4 max-w-4xl">
          <div className="text-[12px] text-[#525252]">Editing <strong>{scopeLabel}</strong>. The sidebar at this level aggregates everything below.</div>

          {/* ── The steps themselves ──────────────────────────────────────── */}
          <SectionCard
            title="Process steps"
            accent={ACCENT.steps}
            hint="The sequenced steps at this scope — rename, remove, or add one. Per-step roles, deliverables, and applications are edited in the sections below."
          >
            <div className="space-y-1.5">
              {scopeSteps.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="text-[11px] text-[#a3a3a3] w-7 text-right flex-shrink-0">{s.stepNumber}.</span>
                  {!l4 && s.l4 && <span className="flex-shrink-0"><StepChip text={s.l4} /></span>}
                  <input
                    key={s.id + ':' + s.name}
                    defaultValue={s.name}
                    onBlur={(e) => void renameStep(s, e.target.value.trim())}
                    className="flex-1 rounded-md border border-[#e5e7eb] px-2 py-1.5 text-[12px]"
                  />
                  <button onClick={() => void removeStep(s)} className="flex-shrink-0 rounded-md border border-[#fecaca] text-[#b91c1c] px-2.5 py-1.5 text-[12px] font-semibold hover:bg-[#fef2f2]">Delete</button>
                </div>
              ))}
              {scopeSteps.length === 0 && <EmptyState baseClassName="text-[12px] text-[#a3a3a3] italic" message="No steps at this scope yet — add the first one below." />}
              {!stepId && (
                <div className="flex items-center gap-2 pt-1.5">
                  <span className="w-7 flex-shrink-0" />
                  <input
                    value={newStepName}
                    onChange={(e) => setNewStepName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void addNewStep(); }}
                    placeholder={l4 ? `New step in "${l4}"…` : 'New step name…'}
                    className="flex-1 rounded-md border border-dashed border-[#cbd5e1] px-2 py-1.5 text-[12px]"
                  />
                  <button onClick={() => void addNewStep()} disabled={!newStepName.trim()} className="flex-shrink-0 rounded-md border border-[#dbe7ff] bg-[#f5f8ff] text-[#1d4ed8] px-3 py-1.5 text-[12px] font-semibold hover:bg-[#eaf1ff] disabled:opacity-40">+ Add step</button>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── Sub-process detail (PL4 narrative) ───────────────────────── */}
          {l4 && !stepId && (
            <SectionCard
              title="Sub-process detail"
              accent={ACCENT.detail}
              hint="The narrative the sidebar shows for this sub-process — its inputs, outputs, upstream/downstream hand-offs, and notes."
            >
              {l4Row === undefined ? (
                <LoadingState baseClassName="text-[12px] text-[#a3a3a3]" />
              ) : l4Row === null ? (
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-[#a3a3a3] italic">This sub-process has no detail record yet.</span>
                  <button onClick={() => void createL4Detail()} className="rounded-md border border-[#dbe7ff] bg-[#f5f8ff] text-[#1d4ed8] px-3 py-1.5 text-[12px] font-semibold hover:bg-[#eaf1ff]">Create it</button>
                </div>
              ) : (
                <SubProcessDetailCard key={l4Row.id} row={l4Row} saving={saving === l4Row.id} onSave={(d) => void saveL4Detail(d)} />
              )}
            </SectionCard>
          )}

          {/* ── Who does the work ─────────────────────────────────────────── */}
          <SectionCard
            title="Supporting roles"
            accent={ACCENT.who}
            hint="Comma-separated role names per step. Names resolve to the role inventory; the sidebar shows those roles (executive outliers are filtered)."
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
