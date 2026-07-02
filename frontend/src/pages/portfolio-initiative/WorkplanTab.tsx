/**
 * Workplan tab of the Portfolio Initiative page — the activity/milestone
 * timeline plus the Activity (FB-19 dependencies) and Milestone modals.
 * Extracted verbatim from PortfolioInitiative.tsx.
 */
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { fmt } from '../../lib/format';
import { Button, Card, EmptyState, ErrorMessage, Input, Label, Select, StatusPill } from '../../components/ui';
import {
  Modal, makeTimelineScale, TimelineAxis, TimelineGrid, ACTIVITY_STATUS_COLOR, ACTIVITY_STATUS_LABEL,
  type Initiative, type Milestone, type Activity,
} from '../../lib/portfolio';

// ── WORKPLAN (timeline) ──────────────────────────────────────────────────
export function WorkplanTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const dialogs = useDialogs();
  const [showCreateM, setShowCreateM] = useState(false);
  const [showCreateA, setShowCreateA] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  const dates = [
    ...init.activities.flatMap((a) => [a.startDate, a.endDate]),
    ...init.milestones.map((m) => m.dueDate),
  ];
  const scale = makeTimelineScale(dates.length ? dates : [init.startDate, init.dueDate])!;

  async function toggle(m: Milestone) {
    await api.patch(`/portfolio/initiatives/milestones/${m.id}`, { status: m.status === 'DONE' ? 'PENDING' : 'DONE' });
    reload();
  }

  return (
    <Card variant="elevated" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-[#171717]">Workplan timeline</h3>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="text-xs" onClick={() => setShowCreateA(true)}>+ Activity</Button>
          <Button variant="secondary" className="text-xs" onClick={() => setShowCreateM(true)}>+ Milestone</Button>
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-[11px] text-[#525252]">
        {Object.entries(ACTIVITY_STATUS_LABEL).map(([k, label]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: ACTIVITY_STATUS_COLOR[k] }} />
            {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-2 h-2 rotate-45 bg-[#171717]" /> Milestone</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-2 h-2 rotate-45 bg-[#b45309]" /> Gate</span>
      </div>

      {/* axis */}
      <div className="flex gap-3 border-b border-[#eaeaea] pb-0.5 mb-1">
        <div className="w-48 flex-shrink-0" />
        <div className="flex-1 min-w-0"><TimelineAxis scale={scale} /></div>
      </div>

      {init.activities.length === 0 && init.milestones.length === 0 ? (
        <EmptyState baseClassName="text-sm text-[#a3a3a3] py-3" message="No activities or milestones yet." />
      ) : (
        <div className="flex gap-3">
          <div className="w-48 flex-shrink-0">
            {init.activities.map((a) => {
              const depTypeLabel = DEP_TYPES.find((t) => t.key === a.dependencyType)?.label;
              return (
                <div key={a.id} className="h-10 flex flex-col justify-center cursor-pointer hover:bg-[#fafafa] rounded px-1 min-w-0" onClick={() => setEditing(a)}>
                  <div className="text-sm font-medium text-[#171717] truncate leading-tight">{a.name}</div>
                  {a.assignedTo && <div className="text-[10px] text-[#666666] truncate leading-tight">{a.assignedTo}</div>}
                  {a.dependencyLabel && <div className="text-[10px] text-[#a3a3a3] truncate leading-tight">depends on {depTypeLabel ? `${depTypeLabel.toLowerCase()}: ` : ''}{a.dependencyLabel}</div>}
                </div>
              );
            })}
            {init.milestones.map((m) => (
              <div key={m.id} className="h-10 flex items-center gap-2 px-1 min-w-0">
                <input type="checkbox" checked={m.status === 'DONE'} onChange={() => toggle(m)} className="w-3.5 h-3.5 accent-[#171717] flex-shrink-0" />
                <span className={'text-sm truncate ' + (m.status === 'DONE' ? 'line-through text-[#a3a3a3]' : 'text-[#171717]')}>{m.name}</span>
                {m.isGate && <StatusPill tone="blue" className="text-[10px] flex-shrink-0">GATE</StatusPill>}
                <button
                  className="ml-auto text-[10px] text-[#be123c] hover:underline flex-shrink-0"
                  onClick={async () => { if (!(await dialogs.confirm({ title: 'Delete milestone?', danger: true, message: `"${m.name}" will be deleted.` }))) { return; } await api.delete(`/portfolio/initiatives/milestones/${m.id}`); reload(); }}
                >del</button>
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-0 relative">
            <TimelineGrid scale={scale} />
            {init.activities.map((a) => {
              const left = scale.pct(a.startDate);
              const width = Math.max(1.2, scale.pct(a.endDate) - left);
              return (
                <div key={a.id} className="h-10 relative cursor-pointer" onClick={() => setEditing(a)}>
                  <div
                    className="absolute top-2.5 h-5 rounded"
                    title={`${a.name} — ${fmt.date(a.startDate)} → ${fmt.date(a.endDate)} (${ACTIVITY_STATUS_LABEL[a.status] ?? a.status})`}
                    style={{ left: `${left}%`, width: `${width}%`, backgroundColor: ACTIVITY_STATUS_COLOR[a.status] ?? '#a3a3a3' }}
                  />
                </div>
              );
            })}
            {init.milestones.map((m) => (
              <div key={m.id} className="h-10 relative">
                <div
                  className="absolute top-3.5 w-3 h-3 rotate-45"
                  title={`${m.name} — due ${fmt.date(m.dueDate)}`}
                  style={{ left: `calc(${scale.pct(m.dueDate)}% - 6px)`, backgroundColor: m.isGate ? '#b45309' : '#171717', opacity: m.status === 'DONE' ? 0.35 : 1 }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreateM && <CreateMilestoneModal initId={init.id} onClose={() => setShowCreateM(false)} onCreated={() => { setShowCreateM(false); reload(); }} />}
      {(showCreateA || editing) && (
        <ActivityModal
          init={init}
          activity={editing}
          onClose={() => { setShowCreateA(false); setEditing(null); }}
          onSaved={() => { setShowCreateA(false); setEditing(null); reload(); }}
        />
      )}
    </Card>
  );
}

// Dependency types (FB-19). LIST types resolve their value from the company's
// data; FREE_TEXT types (no canonical list) accept a typed-in value.
const DEP_TYPES = [
  { key: 'TEAM', label: 'Team', optionsKey: 'TEAM' },
  { key: 'ROLE', label: 'Role', optionsKey: 'ROLE' },
  { key: 'PERSON', label: 'Person', optionsKey: null },
  { key: 'PROJECT', label: 'Project', optionsKey: 'PROJECT' },
  { key: 'CHANGE_APPROVAL', label: 'Change Control Approval', optionsKey: null },
] as const;
type DepType = (typeof DEP_TYPES)[number]['key'];
type DepOptions = Record<string, { id: string; name: string }[]>;

// Create (activity == null) or edit a workplan activity.
function ActivityModal({ init, activity, onClose, onSaved }: { init: Initiative; activity: Activity | null; onClose: () => void; onSaved: () => void }) {
  const dialogs = useDialogs();
  const [form, setForm] = useState({
    name: activity?.name ?? '',
    startDate: (activity?.startDate ?? init.startDate).slice(0, 10),
    endDate: (activity?.endDate ?? init.dueDate).slice(0, 10),
    status: activity?.status ?? 'PLANNED',
    assignedTo: activity?.assignedTo ?? '',
    dependencyType: (activity?.dependencyType ?? '') as DepType | '',
    dependencyRefId: activity?.dependencyRefId ?? '',
    dependencyLabel: activity?.dependencyLabel ?? '',
  });
  const [options, setOptions] = useState<DepOptions>({});
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/portfolio/dependency-options?companyId=${init.companyId}`).then(setOptions).catch(() => {});
  }, [init.companyId]);

  const typeDef = DEP_TYPES.find((t) => t.key === form.dependencyType);
  const isList = !!typeDef?.optionsKey;
  const valueOptions = typeDef?.optionsKey ? (options[typeDef.optionsKey] ?? []) : [];

  function setType(t: DepType | '') {
    // Reset the chosen value whenever the type changes.
    setForm((f) => ({ ...f, dependencyType: t, dependencyRefId: '', dependencyLabel: '' }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Mandatory-field validation.
    if (!form.name.trim()) return setError('Name is required.');
    if (!form.startDate || !form.endDate) return setError('Start and end dates are required.');
    if (form.endDate < form.startDate) return setError('End date must be on or after the start date.');
    if (form.dependencyType) {
      if (isList && !form.dependencyRefId) return setError(`Select a ${typeDef!.label.toLowerCase()} for the dependency.`);
      if (!isList && !form.dependencyLabel.trim()) return setError(`Enter the ${typeDef!.label.toLowerCase()} this activity depends on.`);
    }
    setError('');
    const dep = {
      dependencyType: form.dependencyType || null,
      dependencyRefId: form.dependencyType && isList ? (form.dependencyRefId || null) : null,
      dependencyLabel: form.dependencyType ? (form.dependencyLabel.trim() || null) : null,
      dependsOnId: null,
    };
    try {
      if (activity) {
        await api.patch(`/portfolio/initiatives/activities/${activity.id}`, {
          name: form.name, startDate: form.startDate, endDate: form.endDate, status: form.status,
          assignedTo: form.assignedTo.trim() || null, ...dep,
        });
      } else {
        await api.post(`/portfolio/initiatives/${init.id}/activities`, {
          name: form.name, startDate: form.startDate, endDate: form.endDate,
          assignedTo: form.assignedTo.trim() || null, ...dep,
        });
      }
      onSaved();
    } catch (err) { setError((err as Error).message); }
  }

  async function remove() {
    if (!activity || !(await dialogs.confirm({ title: 'Delete this activity?', danger: true, message: `"${activity.name}" will be removed from the workplan.` }))) return;
    try { await api.delete(`/portfolio/initiatives/activities/${activity.id}`); onSaved(); }
    catch (err) { setError((err as Error).message); }
  }

  return (
    <Modal title={activity ? 'Edit Activity' : 'New Activity'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start</Label>
            <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
          <div><Label>End</Label>
            <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required /></div>
        </div>
        <div><Label>Assigned to</Label>
          <Input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} placeholder="e.g. Jane Smith" /></div>
        {activity && (
          <div><Label>Status</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="PLANNED">Planned</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="DONE">Done</option>
            </Select></div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Depends on</Label>
            <Select value={form.dependencyType} onChange={(e) => setType(e.target.value as DepType | '')}>
              <option value="">— none —</option>
              {DEP_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Select>
          </div>
          <div>
            <Label>{typeDef ? typeDef.label : 'Value'}</Label>
            {!form.dependencyType ? (
              <Select disabled><option>— select a type —</option></Select>
            ) : isList ? (
              <Select
                value={form.dependencyRefId}
                onChange={(e) => {
                  const opt = valueOptions.find((o) => o.id === e.target.value);
                  setForm((f) => ({ ...f, dependencyRefId: e.target.value, dependencyLabel: opt?.name ?? '' }));
                }}
              >
                <option value="">— select {typeDef!.label.toLowerCase()} —</option>
                {valueOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            ) : (
              <Input
                value={form.dependencyLabel}
                onChange={(e) => setForm({ ...form, dependencyLabel: e.target.value })}
                placeholder={form.dependencyType === 'PERSON' ? 'e.g. Jane Smith' : 'e.g. CR-1042'}
              />
            )}
          </div>
        </div>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="flex justify-between gap-2 pt-2">
          <div>{activity && <button type="button" className="text-xs text-[#be123c] hover:underline" onClick={remove}>Delete activity</button>}</div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button>{activity ? 'Save' : 'Create'}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function CreateMilestoneModal({ initId, onClose, onCreated }: { initId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), isGate: false });
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required.');
    if (!form.dueDate) return setError('Due date is required.');
    setError('');
    try { await api.post(`/portfolio/initiatives/${initId}/milestones`, form); onCreated(); }
    catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal title="New Milestone" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><Label>Due date</Label>
          <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required /></div>
        <label className="flex items-center gap-2 text-sm text-[#525252]">
          <input type="checkbox" className="accent-[#171717]" checked={form.isGate} onChange={(e) => setForm({ ...form, isGate: e.target.checked })} />
          Stage-gate milestone
        </label>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button>Create</Button>
        </div>
      </form>
    </Modal>
  );
}
