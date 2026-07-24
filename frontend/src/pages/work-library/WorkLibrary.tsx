/**
 * Work Library — sub-task / sub-task testing plans at the atomic level of work
 * (L5 task ProcessNodes, leaf Standards, Compliance items). Pick a work item,
 * fill its numbered sub-task and sub-task testing steps; values are
 * entity-backed comboboxes (SOR → Applications, owner → Roles, …) — adding a
 * new option writes the owning table. Everything persists to the DB via
 * /work-library. Generic templates and the pattern pickers are intentionally
 * NOT surfaced here (the data stays in the DB and the API).
 *
 * The building blocks live in pages/work-library/ (pure code motion split).
 */
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { LoadingState } from '../../components/ui';
import type { Plan, SubjectType } from './shared';
import { PlanBlock } from './PlanBlock';
import { TiedBlock } from './TiedBlock';
import { TaskSkillBlock } from './TaskSkillBlock';
import { SubjectPicker } from './SubjectPicker';

// ── Page ─────────────────────────────────────────────────────────────────

export default function WorkLibrary() {
  const [params, setParams] = useSearchParams();
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
  const { data: plan, refetch: refetchPlan } = useApi<Plan>(
    selectedId ? `/work-library/plan/${type}/${selectedId}` : null,
  );

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  const checklistCustom = plan?.customRows.filter((r) => r.kind !== 'TEST') ?? [];
  const testCustom = plan?.customRows.filter((r) => r.kind === 'TEST') ?? [];

  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-[17px] font-semibold text-[#171717]">Work Library</h1>
      </div>

      <div className="rounded-2xl border border-[#e5e5e5] bg-white overflow-hidden">
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
                  selectedId ? 'Loading plan…' : 'Pick a work item to open its sub-task plan.'
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
                <PlanBlock
                  title="Sub-tasks"
                  customRows={checklistCustom}
                  blockKind="CHECKLIST"
                  subject={plan.subject}
                  refetch={refetchPlan}
                />
                <PlanBlock
                  title="Sub-task testing"
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
      </div>
    </div>
  );
}
