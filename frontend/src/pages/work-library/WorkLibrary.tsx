/**
 * Work Library — checklist/testing plans at the atomic level of work (L5 task
 * ProcessNodes, leaf Standards, Compliance items) built from reusable generic
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
import { can } from '../../lib/permissions';
import { LoadingState } from '../../components/ui';
import type { Plan, SubjectType, Template } from './shared';
import { PatternDropdown } from './controls';
import { PlanBlock } from './PlanBlock';
import { TiedBlock } from './TiedBlock';
import { TaskSkillBlock } from './TaskSkillBlock';
import { TemplatesEditor } from './TemplatesEditor';
import { SubjectPicker } from './SubjectPicker';

// ── Page ─────────────────────────────────────────────────────────────────

export default function WorkLibrary() {
  const { permissions } = useAuth();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'templates' ? 'templates' : 'plans';
  const type = (params.get('type') as SubjectType) || 'task';
  const selectedId = params.get('id');
  const missingOnly = params.get('missing') === 'test';
  const filters = {
    vs: params.get('vs') ?? '',
    l3: params.get('l3') ?? '',
    l4: params.get('l4') ?? '',
    dept: params.get('dept') ?? '',
    cat: params.get('cat') ?? '',
    reg: params.get('reg') ?? '',
    jur: params.get('jur') ?? '',
  };
  const { data: templatesData, refetch: refetchTemplates } = useApi<{ templates: Template[] }>(
    '/work-library/templates',
  );
  const { data: plan, refetch: refetchPlan } = useApi<Plan>(
    selectedId ? `/work-library/plan/${type}/${selectedId}` : null,
  );

  const templates = templatesData?.templates ?? [];
  const checklistTemplates = templates.filter((t) => t.kind === 'CHECKLIST');
  const testTemplates = templates.filter((t) => t.kind === 'TEST');

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  // Optimistic pattern selection — the dropdowns reflect a toggle instantly
  // while the PUT + plan refetch land in the background.
  const [optimisticIds, setOptimisticIds] = useState<string[] | null>(null);
  useEffect(() => {
    setOptimisticIds(null);
  }, [selectedId]);
  const assigned = optimisticIds ?? plan?.assignedTemplateIds ?? [];
  const assignedChecklist = checklistTemplates
    .filter((t) => assigned.includes(t.id))
    .map((t) => t.id);
  const assignedTest = testTemplates.filter((t) => assigned.includes(t.id)).map((t) => t.id);

  const saveAssignments = (checklistIds: string[], testIds: string[]) => {
    if (!plan) return;
    const core = checklistTemplates.find((t) => t.isDefault);
    const ids = [...new Set([...(core ? [core.id] : []), ...checklistIds, ...testIds])];
    setOptimisticIds(ids);
    api
      .put(`/work-library/plan/${plan.subject.type}/${plan.subject.id}/templates`, {
        templateIds: ids,
      })
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
              className={
                'px-3 py-1 rounded-md text-[12px] ' +
                (view === v
                  ? 'bg-white border border-[#e5e5e5] font-medium text-[#171717]'
                  : 'text-[#6b7785]')
              }
            >
              {v === 'plans' ? 'Plans' : 'Templates'}
            </button>
          ))}
        </div>
        {view === 'templates' && (
          <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-[#eaf2fd] text-[#1d4ed8]">
            Admin only
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-[#e5e5e5] bg-white overflow-hidden">
        {view === 'templates' ? (
          <TemplatesEditor
            templates={templates}
            refetch={refetchTemplates}
            isAdmin={can(permissions, 'work-library', 'update')}
          />
        ) : (
          <div className="grid grid-cols-[270px_minmax(0,1fr)] min-h-[480px]">
            <SubjectPicker
              type={type}
              selectedId={selectedId}
              missingOnly={missingOnly}
              filters={filters}
              setParam={setParam}
            />
            <div className="p-4 overflow-auto">
              {!plan ? (
                <LoadingState
                  baseClassName="text-[13px] text-[#a3a3a3] pt-6 text-center"
                  message={
                    selectedId
                      ? 'Loading plan…'
                      : 'Pick a work item to open its checklist and testing plan.'
                  }
                />
              ) : (
                <>
                  <div className="mb-3">
                    <div className="text-[14px] font-semibold text-[#171717]">
                      {plan.subject.name}
                    </div>
                    {plan.subject.path && (
                      <div className="text-[11px] text-[#8a94a0]">{plan.subject.path}</div>
                    )}
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
                      <div className="text-[10.5px] text-[#a3a3a3] mt-1">
                        Switching patterns keeps saved values per item
                      </div>
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
                      <TaskSkillBlock taskId={plan.subject.id} taskName={plan.subject.name} />
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
