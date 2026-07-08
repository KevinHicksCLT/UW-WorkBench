import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDialogs } from '../lib/dialogs';
import { can } from '../lib/permissions';
import RoleEditorDrawer from './RoleEditorDrawer';
import { type TaskValidation } from './TaskValidationControl';
import { DrawerShell, EmptyState, ErrorMessage, SkeletonLoader } from './ui';

// RoleDrawer — the QUICK PEEK at a role, opened from sidebar surfaces (e.g.
// the Organization explorer) as a slide-over so the user keeps their spot.
// Mirrors the role profile page at a glance — description, review progress,
// headline counts, value streams — and hands off to /roles/:id ("Open full
// profile") for the full deliverable/task/checklist drill-down.

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

  // Headline numbers, mirroring the profile page's stats strip.
  const processTaskCount = r?.processTasks?.length ?? 0;
  const reviewed = (r?.processTasks ?? []).filter(
    (t: ProcTask) => t.validation.status !== 'UNREVIEWED',
  ).length;
  const pct = processTaskCount === 0 ? 0 : Math.round((reviewed / processTaskCount) * 100);

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
          {/* Role description — same callout as the profile page. */}
          <div className="rounded-lg border border-[#e0e7ff] border-l-4 border-l-[#6366f1] bg-[#eef2ff] px-3.5 py-2.5 mb-4">
            <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#4338ca] mb-1">
              Role description
            </div>
            {r.description ? (
              <p className="text-[12px] text-[#3730a3] leading-relaxed">{r.description}</p>
            ) : (
              <p className="text-[12px] text-[#818cf8]">No description yet.</p>
            )}
          </div>

          {/* Headline stats — the profile page's strip, at a glance. */}
          <div className="flex items-center gap-5 flex-wrap rounded-lg border border-[#eaeaea] bg-white px-3.5 py-2.5 mb-4">
            <div>
              <div className="text-xl font-bold text-[#065f46] tnum leading-tight">{pct}%</div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
                Reviewed · {reviewed}/{processTaskCount}
              </div>
            </div>
            <div>
              <div className="text-base font-semibold text-[#171717] tnum leading-tight">
                {processTaskCount}
              </div>
              <div className="text-[11px] text-[#737373]">tasks assigned</div>
            </div>
            {typeof r.deliverableCount === 'number' && (
              <div>
                <div className="text-base font-semibold text-[#171717] tnum leading-tight">
                  {r.deliverableCount}
                </div>
                <div className="text-[11px] text-[#737373]">deliverables</div>
              </div>
            )}
            <div>
              <div className="text-base font-semibold text-[#171717] tnum leading-tight">
                {r.participation.length}
              </div>
              <div className="text-[11px] text-[#737373]">value streams</div>
            </div>
          </div>

          {/* Value-stream participation — compact list. */}
          <div className="mb-5">
            <SectionLabel>Value Streams ({r.participation.length})</SectionLabel>
            {r.participation.length === 0 ? (
              <Empty text="Not mapped to any value stream." />
            ) : (
              <div className="space-y-1.5">
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

          {/* Full drill-down (deliverables, numbered tasks, checklists,
              validation) lives on the profile page. */}
          <Link
            to={`/roles/${encodeURIComponent(roleId)}`}
            onClick={onClose}
            className="block w-full rounded-md bg-[#065f46] px-4 py-2.5 text-center text-[13px] font-semibold text-white hover:bg-[#047857] transition-colors duration-150"
          >
            Open full profile — deliverables, tasks &amp; review →
          </Link>
        </>
      )}
    </DrawerShell>
  );
}
