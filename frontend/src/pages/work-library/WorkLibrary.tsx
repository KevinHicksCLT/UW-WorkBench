/**
 * Work Library — checklist/testing plans at the atomic level of work (L5 task
 * ProcessNodes, leaf Standards, Regulations) built from reusable generic
 * templates. Plans view: pick a work item, choose its checklist modules + test
 * pattern (dropdowns), fill the key/value matrix; generic keys are grayed and
 * removable (never addable), specific steps are free. Values are entity-backed
 * comboboxes (SOR → Applications, owner → Roles, …) — adding a new option
 * writes the owning table. Templates view (ADMIN): add/remove/rename templates
 * and their keys. Everything persists to the DB via /work-library.
 *
 * The building blocks live in pages/work-library/ (pure code motion split).
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useAuth } from '../../lib/auth';
import { LoadingState } from '../../components/ui';
import type { Plan, Subject, SubjectType, Template } from './shared';
import { PatternDropdown } from './controls';
import { PlanBlock } from './PlanBlock';
import { TiedBlock } from './TiedBlock';
import { TemplatesEditor } from './TemplatesEditor';

// ── Page ─────────────────────────────────────────────────────────────────

export default function WorkLibrary() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'templates' ? 'templates' : 'plans';
  const type = (params.get('type') as SubjectType) || 'task';
  const selectedId = params.get('id');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q), 250); return () => clearTimeout(t); }, [q]);

  const missingOnly = params.get('missing') === 'test';
  const { data: templatesData, refetch: refetchTemplates } = useApi<{ templates: Template[] }>('/work-library/templates');
  const { data: subjectsData, loading: subjectsLoading } = useApi<{ subjects: Subject[]; meta?: { total: number; missingTest: number } }>(
    `/work-library/subjects?type=${type}&q=${encodeURIComponent(debouncedQ)}${missingOnly && type === 'task' ? '&missing=test' : ''}`
  );
  const { data: plan, refetch: refetchPlan } = useApi<Plan>(selectedId ? `/work-library/plan/${type}/${selectedId}` : null);

  const templates = templatesData?.templates ?? [];
  const checklistTemplates = templates.filter((t) => t.kind === 'CHECKLIST');
  const testTemplates = templates.filter((t) => t.kind === 'TEST');

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v === null) next.delete(k); else next.set(k, v); }
    setParams(next, { replace: true });
  };

  // Optimistic pattern selection — the dropdowns reflect a toggle instantly
  // while the PUT + plan refetch land in the background.
  const [optimisticIds, setOptimisticIds] = useState<string[] | null>(null);
  useEffect(() => { setOptimisticIds(null); }, [selectedId]);
  const assigned = optimisticIds ?? plan?.assignedTemplateIds ?? [];
  const assignedChecklist = checklistTemplates.filter((t) => assigned.includes(t.id)).map((t) => t.id);
  const assignedTest = testTemplates.filter((t) => assigned.includes(t.id)).map((t) => t.id);

  const saveAssignments = (checklistIds: string[], testIds: string[]) => {
    if (!plan) return;
    const core = checklistTemplates.find((t) => t.isDefault);
    const ids = [...new Set([...(core ? [core.id] : []), ...checklistIds, ...testIds])];
    setOptimisticIds(ids);
    api.put(`/work-library/plan/${plan.subject.type}/${plan.subject.id}/templates`, { templateIds: ids })
      .then(() => refetchPlan())
      .finally(() => setOptimisticIds(null));
  };

  const checklistSections = plan?.sections.filter((s) => s.kind === 'CHECKLIST') ?? [];
  const testSections = plan?.sections.filter((s) => s.kind === 'TEST') ?? [];
  const checklistCustom = plan?.customRows.filter((r) => r.kind !== 'TEST') ?? [];
  const testCustom = plan?.customRows.filter((r) => r.kind === 'TEST') ?? [];

  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-[17px] font-semibold text-[#171717]">Work Library</h1>
        <div className="flex gap-0.5 rounded-lg bg-[#f0f1f3] p-0.5">
          {(['plans', 'templates'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setParam({ view: v === 'plans' ? null : v })}
              className={'px-3 py-1 rounded-md text-[12px] ' + (view === v ? 'bg-white border border-[#e5e5e5] font-medium text-[#171717]' : 'text-[#6b7785]')}
            >
              {v === 'plans' ? 'Plans' : 'Templates'}
            </button>
          ))}
        </div>
        {view === 'templates' && (
          <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-[#eaf2fd] text-[#1d4ed8]">Admin only</span>
        )}
      </div>

      <div className="rounded-2xl border border-[#e5e5e5] bg-white overflow-hidden">
        {view === 'templates' ? (
          <TemplatesEditor templates={templates} refetch={refetchTemplates} isAdmin={user?.role === 'ADMIN'} />
        ) : (
          <div className="grid grid-cols-[250px_minmax(0,1fr)] min-h-[480px]">
            <div className="border-r border-[#e5e5e5] p-2.5 overflow-auto">
              <div className="flex gap-0.5 rounded-md bg-[#f0f1f3] p-0.5 mb-2">
                {(['task', 'standard', 'regulation'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setParam({ type: t, id: null })}
                    className={'flex-1 py-1 rounded text-[11px] ' + (type === t ? 'bg-white border border-[#e5e5e5] font-medium text-[#171717]' : 'text-[#6b7785]')}
                  >
                    {t === 'task' ? 'Tasks' : t === 'standard' ? 'Standards' : 'Regs'}
                  </button>
                ))}
              </div>
              <input
                className="w-full rounded-md border border-[#e2e6ea] px-2 py-1.5 text-[12px] mb-2 focus:border-[#7aa7d9] focus:outline-none"
                placeholder={`Search ${type === 'task' ? 'tasks' : type === 'standard' ? 'standards' : 'regulations'}`}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {type === 'task' && subjectsData?.meta && (
                <button
                  onClick={() => setParam({ missing: missingOnly ? null : 'test', id: null })}
                  className={'w-full mb-2 rounded-md px-2 py-1.5 text-[11px] text-left border ' +
                    (missingOnly ? 'border-[#f0b4b4] bg-[#fdf2f2] text-[#b91c1c] font-medium' : 'border-[#e2e6ea] text-[#6b7785] hover:bg-[#fafafa]')}
                >
                  ✗ Missing testing pattern · {subjectsData.meta.missingTest.toLocaleString()} of {subjectsData.meta.total.toLocaleString()}
                  {missingOnly && <span className="float-right">clear</span>}
                </button>
              )}
              {subjectsLoading && <LoadingState baseClassName="px-1.5 py-1 text-[11px] text-[#a3a3a3]" />}
              {(subjectsData?.subjects ?? []).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setParam({ id: s.id })}
                  className={'block w-full text-left rounded-md px-2 py-1.5 mb-0.5 text-[12px] leading-snug ' +
                    (selectedId === s.id ? 'bg-[#eaf2fd] text-[#1d4ed8] font-medium' : 'text-[#525252] hover:bg-[#fafafa]')}
                >
                  {s.name}
                  {s.path && <span className="block text-[10px] text-[#a3a3a3]">{s.path}</span>}
                </button>
              ))}
            </div>
            <div className="p-4 overflow-auto">
              {!plan ? (
                <LoadingState
                  baseClassName="text-[13px] text-[#a3a3a3] pt-6 text-center"
                  message={selectedId ? 'Loading plan…' : 'Pick a work item to open its checklist and testing plan.'}
                />
              ) : (
                <>
                  <div className="mb-3">
                    <div className="text-[14px] font-semibold text-[#171717]">{plan.subject.name}</div>
                    {plan.subject.path && <div className="text-[11px] text-[#8a94a0]">{plan.subject.path}</div>}
                  </div>
                  <div className="flex flex-wrap gap-4 mb-4">
                    <PatternDropdown
                      label="Checklist pattern"
                      templates={checklistTemplates}
                      selectedIds={assignedChecklist}
                      multi
                      onChange={(ids) => saveAssignments(ids, assignedTest)}
                    />
                    <div>
                      <PatternDropdown
                        label="Testing pattern"
                        templates={testTemplates}
                        selectedIds={assignedTest}
                        multi={false}
                        onChange={(ids) => saveAssignments(assignedChecklist, ids)}
                      />
                      <div className="text-[10.5px] text-[#a3a3a3] mt-1">Switching patterns keeps saved values per item</div>
                    </div>
                  </div>
                  <PlanBlock
                    title="Checklist"
                    sections={checklistSections}
                    customRows={checklistCustom}
                    blockKind="CHECKLIST"
                    subject={plan.subject}
                    refetch={refetchPlan}
                  />
                  <PlanBlock
                    title="Testing"
                    sections={testSections}
                    customRows={testCustom}
                    blockKind="TEST"
                    subject={plan.subject}
                    refetch={refetchPlan}
                  />
                  {plan.subject.type === 'task' && (
                    <>
                      <TiedBlock
                        title="Standards tied to this task"
                        empty="No standards tied yet — use the picker above to tie one."
                        items={plan.standards}
                        scope="standard"
                        taskId={plan.subject.id}
                        refetch={refetchPlan}
                      />
                      <TiedBlock
                        title="Regulations tied to this task"
                        empty="No regulations tied yet — use the picker above to tie one."
                        items={plan.regulations}
                        scope="regulation"
                        taskId={plan.subject.id}
                        refetch={refetchPlan}
                      />
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
