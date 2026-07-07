import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDialogs } from '../lib/dialogs';
import { can } from '../lib/permissions';
import RoleEditorDrawer from './RoleEditorDrawer';
import TaskValidationControl, { type TaskValidation } from './TaskValidationControl';
import { DrawerShell, EmptyState, ErrorMessage, SkeletonLoader } from './ui';

// RoleDrawer — the role's full detail (inputs & deliverables, process tasks,
// responsibilities and value-stream participation), rendered as a wide
// slide-over wherever the user already is. Replaces the retired role page
// (OrgTable's RoleDetailView): role links across the app and the sidebar's
// "View full details" button open this instead of navigating.

// ── Shapes (from GET /roles/:id — same payload the old page consumed) ─────────
type RoleParticipation = {
  valueStreamId: string;
  valueStreamName: string;
  participationType: string;
  subStream: string | null;
  inputs: string | null;
  outputs: string | null;
};
type Grouped = { category: string; items: string[] };
type ServerIoRow = {
  valueStreamId: string;
  valueStreamName: string;
  domain: string | null;
  l3: string | null;
  l4: string | null;
  inputs: string[];
  deliverables: string[];
};
type ProcTask = {
  nodeRoleId: string;
  valueStreamId: string;
  valueStreamName: string;
  l3: string | null;
  l4: string | null;
  stepNumber: number;
  name: string;
  outputs: string | null;
  validation: TaskValidation;
};
type RoleDetailData = {
  id: string;
  name: string;
  description: string | null;
  roleFamily: string | null;
  roleLevel: string | null;
  division?: { id: string; name: string };
  department?: { id: string; name: string };
  participation: RoleParticipation[];
  responsibilities: Grouped[];
  ioRows?: ServerIoRow[];
  deliverableCount?: number;
  inputCount?: number;
  processTasks?: ProcTask[];
};

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#374151] mb-2">
    {children}
  </div>
);

const Empty = ({ text }: { text: string }) => (
  <EmptyState baseClassName="text-sm text-[#a3a3a3] italic" message={text} />
);

export default function RoleDrawer({
  roleId,
  onClose,
  onMutated,
}: {
  roleId: string;
  onClose: () => void;
  /** Notified after this role is amended or removed, so hosts can refresh. */
  onMutated?: () => void;
}) {
  const [r, setR] = useState<RoleDetailData | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const { permissions } = useAuth();
  const dialogs = useDialogs();

  const load = useCallback(() => {
    setError('');
    api
      .get<RoleDetailData>(`/roles/${roleId}`)
      .then(setR)
      .catch((e: Error) => setError(e.message));
  }, [roleId]);

  useEffect(() => {
    setR(null);
    load();
  }, [load]);

  // SCRUM-34 — amend/remove the role right where the user is looking at it.
  const canUpdate = can(permissions, 'roles', 'update');
  const canDelete = can(permissions, 'roles', 'delete');

  const removeRole = async () => {
    try {
      const impact = await api.get<{
        removedLinks: { tasks: number; deliverables: number };
        unassigned: { checklistItems: number; ownedStandards: number; reports: number };
      }>(`/roles/${encodeURIComponent(roleId)}/impact`);
      const bits = [
        impact.removedLinks.tasks && `${impact.removedLinks.tasks} task link(s)`,
        impact.removedLinks.deliverables &&
          `${impact.removedLinks.deliverables} deliverable link(s)`,
        impact.unassigned.checklistItems &&
          `${impact.unassigned.checklistItems} responsibility item(s) left unassigned`,
        impact.unassigned.ownedStandards &&
          `${impact.unassigned.ownedStandards} owned standard(s) left unowned`,
        impact.unassigned.reports &&
          `${impact.unassigned.reports} report(s) left without a manager`,
      ].filter(Boolean);
      const ok = await dialogs.confirm({
        title: `Remove ${r?.name ?? 'this role'}?`,
        message: bits.length
          ? `This removes the role and ${bits.join(', ')}.`
          : 'This role has no links — it will be removed cleanly.',
        confirmLabel: 'Remove role',
        danger: true,
      });
      if (!ok) return;
      await api.delete(`/roles/${encodeURIComponent(roleId)}`);
      onMutated?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Process tasks — the L5 steps the role leads/supports — grouped by value stream.
  const taskGroups = useMemo(() => {
    const groups = new Map<string, { vsId: string; vsName: string; tasks: ProcTask[] }>();
    for (const t of r?.processTasks ?? []) {
      const g = groups.get(t.valueStreamId) ?? {
        vsId: t.valueStreamId,
        vsName: t.valueStreamName,
        tasks: [],
      };
      g.tasks.push(t);
      groups.set(t.valueStreamId, g);
    }
    return [...groups.values()].sort((a, b) => a.vsName.localeCompare(b.vsName));
  }, [r]);
  const processTaskCount = r?.processTasks?.length ?? 0;

  // A validation decision comes back from the PATCH — fold it into the loaded
  // payload so the pill/control reflect the stored state without a refetch.
  const setTaskValidation = (nodeRoleId: string, v: TaskValidation) =>
    setR((cur) =>
      cur
        ? {
            ...cur,
            processTasks: cur.processTasks?.map((t) =>
              t.nodeRoleId === nodeRoleId ? { ...t, validation: v } : t,
            ),
          }
        : cur,
    );

  return (
    <DrawerShell
      onClose={onClose}
      width={720}
      maxWidth="94vw"
      header={
        <div className="min-w-0 flex items-start gap-2.5 flex-1">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">
              Role
            </div>
            <div className="text-[15px] font-bold text-[#171717] leading-snug">
              {r?.name ?? 'Loading…'}
            </div>
            <div className="text-[11px] text-[#a3a3a3] mt-0.5">
              {[r?.roleFamily, r?.department?.name, r?.division?.name].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className="flex-shrink-0 mt-0.5 flex items-center gap-1.5">
            {canUpdate && (
              <button
                onClick={() => setEditing(true)}
                className="rounded-md border border-[#eaeaea] bg-white px-2.5 py-1 text-[11px] font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150"
              >
                ✎ Amend
              </button>
            )}
            {canDelete && (
              <button
                onClick={removeRole}
                className="rounded-md border border-[#f3d1d1] bg-white px-2.5 py-1 text-[11px] font-medium text-[#b91c1c] hover:border-[#e5a3a3] transition-colors duration-150"
              >
                Remove
              </button>
            )}
            {/* The drawer is the quick peek; the profile page is the full drill-down. */}
            <Link
              to={`/roles/${encodeURIComponent(roleId)}`}
              onClick={onClose}
              className="rounded-md border border-[#eaeaea] bg-white px-2.5 py-1 text-[11px] font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150"
            >
              Open full profile →
            </Link>
          </div>
        </div>
      }
      after={
        editing && r ? (
          <RoleEditorDrawer
            role={{
              id: r.id,
              name: r.name,
              description: r.description,
              roleFamily: r.roleFamily,
              roleLevel: r.roleLevel,
            }}
            onClose={() => setEditing(false)}
            onSaved={() => {
              load();
              onMutated?.();
            }}
          />
        ) : null
      }
    >
      {error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : !r ? (
        <SkeletonLoader count={5} height={48} className="space-y-2" />
      ) : (
        <>
          {/* Value-stream participation — compact chips up top so the long
                  sections below don't bury where the role plays. */}
          <div className="mb-6">
            <SectionLabel>Value-Stream Participation ({r.participation.length})</SectionLabel>
            {r.participation.length === 0 ? (
              <Empty text="Not mapped to any value stream." />
            ) : (
              <div className="space-y-1.5">
                {/* Plain list — the old Lead/Core/Support participation tag was
                    retired everywhere else and is intentionally absent here. */}
                {r.participation.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/overview?focus=${p.valueStreamId}`}
                        className="text-sm text-brand-700 hover:underline"
                      >
                        {p.valueStreamName}
                      </Link>
                      {p.subStream && (
                        <div className="text-xs text-slate-400 truncate">{p.subStream}</div>
                      )}
                    </div>
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
            <p className="text-xs text-slate-400 -mt-1 mb-3">
              The process steps tied to this role, by value stream. Validate each one: confirm you
              do it, hand it to whoever (or whatever) actually does, or mark it not done at all.
            </p>
            {processTaskCount === 0 ? (
              <Empty text="No process steps tie to this role." />
            ) : (
              <div className="space-y-4">
                {taskGroups.map((g) => (
                  <div key={g.vsId}>
                    <Link
                      to={`/overview?focus=${g.vsId}`}
                      className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:underline"
                    >
                      {g.vsName} ({g.tasks.length})
                    </Link>
                    <ul className="mt-1.5 divide-y divide-slate-100">
                      {g.tasks.map((t) => (
                        <li key={t.nodeRoleId} className="py-2 first:pt-0">
                          <div className="text-[13px] text-slate-700 break-words">{t.name}</div>
                          {t.outputs && (
                            <div className="text-[11px] text-[#a3a3a3] mt-0.5 break-words">
                              → {t.outputs}
                            </div>
                          )}
                          <div className="mt-1">
                            <TaskValidationControl
                              nodeRoleId={t.nodeRoleId}
                              validation={t.validation}
                              onChange={(v) => setTaskValidation(t.nodeRoleId, v)}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </DrawerShell>
  );
}
