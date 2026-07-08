import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Button, Input, Select, StatusPill } from './ui';
import type { PillTone } from './ui';

// TaskValidationControl — the "do I actually do this task?" attestation on a
// role↔task link (NodeRole). One control, reused by every surface that lists a
// role's tasks (role drawer, full profile task summary, deliverable groupings),
// all reading/writing the same single source of truth in the DB:
//   ✓ I do this        → CONFIRMED
//   ↷ Someone else does → REASSIGNED (another role, an application, a third party)
//   ✕ We don't do this  → NOT_PERFORMED

export type ReassignKind = 'role' | 'application' | 'externalParty';
export type TaskValidation = {
  status: 'UNREVIEWED' | 'CONFIRMED' | 'REASSIGNED' | 'NOT_PERFORMED';
  note: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  reassignedTo: { kind: ReassignKind; id: string; name: string } | null;
};

export const UNREVIEWED: TaskValidation = {
  status: 'UNREVIEWED',
  note: null,
  validatedBy: null,
  validatedAt: null,
  reassignedTo: null,
};

const KIND_LABEL: Record<ReassignKind, string> = {
  role: 'Another role',
  application: 'An application',
  externalParty: 'A third party',
};

const STATUS_META: Record<TaskValidation['status'], { label: string; tone: PillTone }> = {
  UNREVIEWED: { label: 'Needs review', tone: 'red' },
  CONFIRMED: { label: 'Confirmed', tone: 'green' },
  REASSIGNED: { label: 'Reassigned', tone: 'amber' },
  NOT_PERFORMED: { label: 'Not performed', tone: 'red' },
};

/** Read-only pill for surfaces that show but don't edit validation state. */
export function ValidationPill({ validation }: { validation: TaskValidation }) {
  const meta = STATUS_META[validation.status];
  return (
    <StatusPill tone={meta.tone} className="flex-shrink-0" title={validation.note ?? undefined}>
      {validation.status === 'REASSIGNED' && validation.reassignedTo
        ? `→ ${validation.reassignedTo.name}`
        : meta.label}
    </StatusPill>
  );
}

type Target = { id: string; name: string; detail: string | null };

function ReassignPicker({
  onPick,
  onCancel,
}: {
  onPick: (kind: ReassignKind, target: Target) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<ReassignKind>('role');
  const [q, setQ] = useState('');
  const [targets, setTargets] = useState<Target[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let stale = false;
    const query = q.trim() ? `&q=${encodeURIComponent(q.trim())}` : '';
    api
      .get<{ targets: Target[] }>(`/roles/validation-targets?kind=${kind}${query}`)
      .then((d) => {
        if (!stale) setTargets(d.targets);
      })
      .catch((e: Error) => {
        if (!stale) setError(e.message);
      });
    return () => {
      stale = true;
    };
  }, [kind, q]);

  return (
    <div className="mt-1.5 rounded-md border border-[#eaeaea] bg-[#fafafa] p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Select
          value={kind}
          onChange={(e) => setKind(e.target.value as ReassignKind)}
          className="!text-[11px] !py-1"
          aria-label="Who does it instead?"
        >
          {(Object.keys(KIND_LABEL) as ReassignKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </Select>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="!text-[11px] !py-1"
          aria-label="Search reassignment targets"
        />
        <Button variant="ghost" className="!px-2 !py-1 !text-[11px]" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {error ? (
        <div className="text-[11px] text-red-600">{error}</div>
      ) : (
        <div className="max-h-40 overflow-y-auto">
          {targets.map((t) => (
            <button
              key={t.id}
              onClick={() => onPick(kind, t)}
              className="w-full text-left rounded px-1.5 py-1 text-[12px] text-[#171717] hover:bg-[#f0f4ff]"
            >
              {t.name}
              {t.detail && <span className="text-[#a3a3a3]"> · {t.detail}</span>}
            </button>
          ))}
          {!targets.length && (
            <div className="text-[11px] text-[#a3a3a3] px-1.5 py-1">No matches.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TaskValidationControl({
  nodeRoleId,
  validation,
  onChange,
}: {
  nodeRoleId: string;
  validation: TaskValidation;
  onChange: (next: TaskValidation) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const patch = async (body: {
    status: TaskValidation['status'];
    reassignTo?: { kind: ReassignKind; id: string };
  }) => {
    setBusy(true);
    setError('');
    try {
      const res = (await api.patch(`/roles/task-links/${nodeRoleId}/validation`, body)) as {
        link: { nodeRoleId: string; validation: TaskValidation };
      };
      onChange(res.link.validation);
      setPicking(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const seg = (
    label: string,
    active: boolean,
    onClick: () => void,
    title: string,
    activeClass: string,
  ) => (
    <button
      onClick={onClick}
      disabled={busy}
      title={title}
      className={`px-2.5 py-1 text-[12px] rounded transition-colors duration-150 disabled:opacity-50 ${
        active ? activeClass : 'text-[#404040] font-medium hover:bg-[#f5f5f5]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <ValidationPill validation={validation} />
        <div className="flex items-center rounded-md border border-[#d4d4d4] bg-white shadow-sm">
          {seg(
            '✓ I perform this',
            validation.status === 'CONFIRMED',
            () => patch({ status: validation.status === 'CONFIRMED' ? 'UNREVIEWED' : 'CONFIRMED' }),
            'Confirm this role performs the task',
            'bg-emerald-50 text-emerald-700 font-semibold',
          )}
          {seg(
            '↷ Reassign',
            validation.status === 'REASSIGNED',
            () => setPicking((v) => !v),
            'Reassign to another role, an application, or a third party',
            'bg-amber-50 text-amber-700 font-semibold',
          )}
          {seg(
            '✕ Not performed',
            validation.status === 'NOT_PERFORMED',
            () =>
              patch({
                status: validation.status === 'NOT_PERFORMED' ? 'UNREVIEWED' : 'NOT_PERFORMED',
              }),
            'This task is not performed at all',
            'bg-red-50 text-red-700 font-semibold',
          )}
        </div>
      </div>
      {error && <div className="text-[11px] text-red-600 mt-1">{error}</div>}
      {picking && (
        <ReassignPicker
          onCancel={() => setPicking(false)}
          onPick={(kind, target) =>
            patch({ status: 'REASSIGNED', reassignTo: { kind, id: target.id } })
          }
        />
      )}
    </div>
  );
}
