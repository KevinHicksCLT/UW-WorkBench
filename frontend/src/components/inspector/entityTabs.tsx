/**
 * Inspector entity tabs — Tasks (children drill), Roles (+RACI), Applications
 * (+usage) and Deliverables, each with associate/create + detach in edit mode.
 * Extracted verbatim from Inspector.tsx.
 */
import { api } from '../../lib/api';
import { AddPicker, DetachBtn, Empty, LinkOut, Select } from './atoms';
import {
  RACI,
  type AfterFn,
  type AppDetail,
  type AppRollup,
  type DelivDetail,
  type DelivRollup,
  type Payload,
  type PropTextFn,
  type Relation,
  type RoleDetail,
  type RoleRollup,
} from './types';

// ── Tasks (children / drill) ────────────────────────────────────────────────
export function TasksTab({
  data,
  onRetarget,
}: {
  data: Payload;
  onRetarget: (id: string) => void;
}) {
  if (data.detail) return null; // leaf — nothing to drill
  if (!data.children.length) return <Empty text="No steps recorded here." />;
  return (
    <div>
      <div className="flex flex-col gap-1">
        {data.children.map((c, i) => (
          <button
            key={c.id}
            onClick={() => onRetarget(c.id)}
            className="text-left rounded-md border border-[#eaeaea] px-2.5 py-1.5 hover:bg-[#f5f8ff] hover:border-[#dbe7ff] flex items-center gap-2"
          >
            <span className="text-[9px] text-[#a3a3a3] tabular-nums">{i + 1}</span>
            <span className="text-[12px] text-[#171717] flex-1 min-w-0 truncate">{c.name}</span>
            <span className="text-[#a3a3a3] text-[11px]">↗</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Roles ──────────────────────────────────────────────────────────────────
export function RolesTab({
  data,
  edit,
  onNav,
  after,
  propText,
}: {
  data: Payload;
  edit: boolean;
  onNav: (p: string) => void;
  after: AfterFn;
  propText: PropTextFn;
}) {
  const add = async (
    choice: { id?: string; newName?: string },
    relation: Relation = 'Participant',
  ) => {
    const r = await api.post(`/inspector/${data.id}/roles`, {
      roleId: choice.id,
      newRoleName: choice.newName,
      relation,
    });
    const nodeRoleId = r.role.nodeRoleId;
    after(`${r.role.name} added`, propText(r.propagation), async () => {
      await api.delete(`/inspector/roles/${nodeRoleId}`);
      after('Removed', 'Reverted across the app');
    });
  };
  return (
    <div>
      {edit && (
        <div className="flex justify-end mb-2">
          <AddPicker label="Associate / add role" kind="roles" onPick={(c) => add(c)} />
        </div>
      )}
      {!data.roles.length && (
        <Empty text={edit ? 'Add the first role above.' : 'No roles resolved here.'} />
      )}
      <div className="flex flex-col gap-1.5">
        {/* One row per ROLE — a role linked as both Owner and Participant shows
            once with both tags (the underlying NodeRole rows stay separate). */}
        {[
          ...data.roles
            .reduce((m, r) => {
              const e = m.get(r.roleId) ?? {
                roleId: r.roleId,
                name: r.name,
                relations: [] as Relation[],
                links: [] as RoleDetail[],
                tasks: 0,
                raci: null as string | null,
              };
              if (!e.relations.includes(r.relation)) e.relations.push(r.relation);
              if ('nodeRoleId' in r) {
                e.links.push(r as RoleDetail);
                e.raci = e.raci ?? (r as RoleDetail).raci ?? null;
              } else e.tasks = Math.max(e.tasks, (r as RoleRollup).tasks);
              m.set(r.roleId, e);
              return m;
            }, new Map<string, { roleId: string; name: string; relations: Relation[]; links: RoleDetail[]; tasks: number; raci: string | null }>())
            .values(),
        ].map((r) => {
          const owner = r.relations.includes('Owner');
          const tag = [...r.relations].sort((a) => (a === 'Owner' ? -1 : 1)).join(' · ');
          const single = r.links.length === 1 ? r.links[0] : null;
          return (
            <div
              key={r.roleId}
              className="rounded-lg bg-[#f7fbf8] border border-[#cbead9] px-2.5 py-2 flex items-center gap-2"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: owner ? '#1e9e6a' : '#7fc9a6' }}
              />
              <span className="text-[12.5px] font-semibold text-[#15603f] flex-1 min-w-0 truncate">
                {r.name}
              </span>
              {single && edit ? (
                <>
                  <Select
                    value={single.relation}
                    w={108}
                    options={['Owner', 'Participant']}
                    onChange={async (v) => {
                      await api.patch(`/inspector/roles/${single.nodeRoleId}`, { relation: v });
                      after('Updated', 'Saved to the single record');
                    }}
                  />
                  <Select
                    value={single.raci ?? ''}
                    w={122}
                    options={['', ...RACI]}
                    onChange={async (v) => {
                      await api.patch(`/inspector/roles/${single.nodeRoleId}`, { raci: v || null });
                      after('Updated', 'Saved to the single record');
                    }}
                  />
                </>
              ) : (
                <span className="text-[10px] text-[#15603f] bg-white border border-[#cbead9] rounded px-1.5 py-0.5">
                  {tag}
                  {!r.links.length && r.tasks ? ` · ${r.tasks} tasks` : ''}
                  {r.raci ? ` · ${r.raci}` : ''}
                </span>
              )}
              {/* Role-holder attestation (NodeRole.validationStatus) — set from the
                  role views; surfaced here so the task shows the same truth. */}
              {single?.validationStatus === 'CONFIRMED' && (
                <span
                  className="text-[10px] text-[#15603f]"
                  title="Validated: this role confirmed it performs the task"
                >
                  ✓
                </span>
              )}
              {single?.validationStatus === 'REASSIGNED' && (
                <span
                  className="text-[10px] text-[#b45309]"
                  title="Validated: reassigned to another doer"
                >
                  ↷
                </span>
              )}
              {single?.validationStatus === 'NOT_PERFORMED' && (
                <span className="text-[10px] text-[#b91c1c]" title="Validated: not performed">
                  ✕
                </span>
              )}
              <LinkOut
                onClick={() => onNav(`/organization?role=${encodeURIComponent(r.roleId)}`)}
              />
              {r.links.length > 0 && edit && (
                <DetachBtn
                  onClick={async () => {
                    for (const l of r.links) await api.delete(`/inspector/roles/${l.nodeRoleId}`);
                    after('Detached', 'The role itself is kept');
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Applications ──────────────────────────────────────────────────────────────
export function AppsTab({
  data,
  edit,
  onNav,
  after,
  propText,
}: {
  data: Payload;
  edit: boolean;
  onNav: (p: string) => void;
  after: AfterFn;
  propText: PropTextFn;
}) {
  const add = async (choice: { id?: string; newName?: string }, usageType = 'performed') => {
    const r = await api.post(`/inspector/${data.id}/applications`, {
      applicationId: choice.id,
      newAppName: choice.newName,
      usageType,
    });
    const usageId = r.application.usageId;
    after(`${r.application.name} added`, propText(r.propagation), async () => {
      await api.delete(`/inspector/applications/${usageId}`);
      after('Removed', 'Reverted across the app');
    });
  };
  return (
    <div>
      {edit && (
        <div className="flex justify-end mb-2">
          <AddPicker
            label="Associate / add application"
            kind="applications"
            onPick={(c) => add(c)}
          />
        </div>
      )}
      {!data.applications.length && (
        <Empty
          text={edit ? 'Add the first application above.' : 'No applications recorded here.'}
        />
      )}
      <div className="flex flex-col gap-1.5">
        {data.applications.map((a) => {
          const isDetail = 'usageId' in a;
          return (
            <div
              key={isDetail ? (a as AppDetail).usageId : (a as AppRollup).appId}
              className="rounded-lg bg-[#eff5ff] border border-[#d4e2fc] px-2.5 py-2 flex items-center gap-2"
            >
              <span className="text-[12.5px] font-semibold text-[#1d4ed8] flex-1 min-w-0 truncate">
                {a.name}
              </span>
              {isDetail && edit ? (
                <Select
                  value={(a as AppDetail).usageType}
                  w={132}
                  options={['performed', 'memorialized']}
                  onChange={async (v) => {
                    await api.patch(`/inspector/applications/${(a as AppDetail).usageId}`, {
                      usageType: v,
                    });
                    after('Updated', 'Saved to the single record');
                  }}
                />
              ) : (
                // "performed" is the default usage — only surface the notable tags.
                (a.usageType !== 'performed' || (!isDetail && (a as AppRollup).tasks > 0)) && (
                  <span className="text-[10px] text-[#1d4ed8] bg-white border border-[#d4e2fc] rounded px-1.5 py-0.5">
                    {[
                      a.usageType === 'performed' ? null : a.usageType,
                      !isDetail && (a as AppRollup).tasks
                        ? `${(a as AppRollup).tasks} tasks`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )
              )}
              <LinkOut
                onClick={() => onNav(`/applications?focus=${encodeURIComponent(a.appId)}`)}
              />
              {isDetail && edit && (
                <DetachBtn
                  onClick={async () => {
                    await api.delete(`/inspector/applications/${(a as AppDetail).usageId}`);
                    after('Detached', 'The application is kept in the catalog');
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Deliverables tab — flat list with associate/add + detach (edit at a step).
export function DeliverablesTab({
  data,
  edit,
  onNav,
  after,
}: {
  data: Payload;
  edit: boolean;
  onNav: (p: string) => void;
  after: AfterFn;
}) {
  const add = async (choice: { id?: string; newName?: string }) => {
    const r = await api.post(`/inspector/${data.id}/deliverables`, {
      deliverableId: choice.id,
      newTitle: choice.newName,
    });
    const linkId = r.deliverable.linkId;
    after(`${r.deliverable.title} added`, 'Now in Deliverables & this step', async () => {
      await api.delete(`/inspector/deliverables/${linkId}`);
      after('Removed', 'Reverted');
    });
  };
  return (
    <div>
      {edit && (
        <div className="flex justify-end mb-2">
          <AddPicker label="Associate / add deliverable" kind="deliverables" onPick={add} />
        </div>
      )}
      {!data.deliverables.length && (
        <Empty
          text={edit ? 'Add the first deliverable above.' : 'No deliverables recorded here.'}
        />
      )}
      <div className="flex flex-col gap-1.5">
        {data.deliverables.map((d) => {
          const isDetail = 'linkId' in d;
          return (
            <div
              key={isDetail ? (d as DelivDetail).linkId : (d as DelivRollup).deliverableId}
              className="rounded-lg bg-[#e9f7ef] border border-[#cbead9] px-2.5 py-2 flex items-center gap-2"
            >
              <span className="text-[12.5px] font-bold text-[#196f3d] flex-1 min-w-0 truncate">
                {d.title}
              </span>
              <LinkOut onClick={() => onNav('/deliverables')} />
              {isDetail && edit && (
                <DetachBtn
                  onClick={async () => {
                    await api.delete(`/inspector/deliverables/${(d as DelivDetail).linkId}`);
                    after('Detached', 'The deliverable is kept');
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
