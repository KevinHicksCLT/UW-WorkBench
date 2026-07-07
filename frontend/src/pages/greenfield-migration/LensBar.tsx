/**
 * WR-01 tri-mode inspection lens bar — the workspace's selector row, extracted
 * from GreenfieldMigration.tsx. Makes Kevin's three inspection choices
 * explicit: a segmented mode switch (Applications | Value streams | Roles), a
 * per-mode multi-select filter, then the board picker. Single-application mode
 * keeps the original L3 → L4 lens cascade (name-token matching, unchanged);
 * every other shape lists the filtered boards in one application-grouped
 * "Board" select. The row actions (findings view toggle, Edit board, + New…)
 * live here too.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui';
import type { FindingView, StageListItem } from '../../lib/rationalization';
import { lensTokens, lensScore, LensField, LENS_SELECT_CLS, type LensL3 } from './lens';
import { MultiSelect, type MultiSelectOption } from './MultiSelect';

/** Which entity the lens filters boards by (WR-01). */
export type LensMode = 'applications' | 'valueStreams' | 'roles';

/** Stage list row + the lens FKs GET /rationalization now returns (WR-01). */
export type StageRow = StageListItem & {
  applicationId: string | null;
  valueStreamNodeId: string | null;
};

const MODES: { value: LensMode; label: string }[] = [
  { value: 'applications', label: 'Applications' },
  { value: 'valueStreams', label: 'Value streams' },
  { value: 'roles', label: 'Roles' },
];

// WR-06 anatomy lens options for the segmented control.
const VIEWS: { value: FindingView; label: string }[] = [
  { value: 'COMPONENT', label: 'Components' },
  { value: 'BEHAVIOR', label: 'Behavior' },
];

// Shared segmented-control chrome (same visual family as Components|Behavior).
const SEGMENT_GROUP_CLS =
  'flex h-7 rounded-md border border-[#eaeaea] overflow-hidden flex-shrink-0';
const segmentCls = (active: boolean) =>
  `px-2.5 text-[12px] font-medium ${
    active ? 'bg-[#171717] text-white' : 'bg-white text-[#525252] hover:bg-[#fafafa]'
  }`;

export type LensBarProps = {
  mode: LensMode;
  onModeChange: (mode: LensMode) => void;
  /** Distinct (applicationId ?? label) pairs from the unfiltered stage list. */
  appOptions: MultiSelectOption[];
  selApps: string[];
  onAppsChange: (ids: string[]) => void;
  selStreams: string[];
  onStreamsChange: (ids: string[]) => void;
  selRoles: string[];
  onRolesChange: (ids: string[]) => void;
  /** The filtered stages (mode filter applied + sorted) the picker operates on. */
  stages: StageRow[];
  selectedId: string | null;
  onSelectStage: (id: string) => void;
  /** True when the classic single-application L3/L4 cascade should render. */
  cascade: boolean;
  view: FindingView;
  onViewChange: (view: FindingView) => void;
  hasDetail: boolean;
  editing: boolean;
  saving: boolean;
  onStartEdit: () => void;
  onExitEdit: () => void;
  onNew: () => void;
  /** Tooltip for the + New… button (selected stage · progress). */
  newTitle: string;
};

export function LensBar({
  mode,
  onModeChange,
  appOptions,
  selApps,
  onAppsChange,
  selStreams,
  onStreamsChange,
  selRoles,
  onRolesChange,
  stages,
  selectedId,
  onSelectStage,
  cascade,
  view,
  onViewChange,
  hasDetail,
  editing,
  saving,
  onStartEdit,
  onExitEdit,
  onNew,
  newTitle,
}: LensBarProps) {
  // The canonical lens tree. Its top level ("divisions") is the levelNumber-2
  // value-stream nodes — their ids match StageRow.valueStreamNodeId and the
  // server's ?valueStreamIds filter — and feeds the VS multi-select; the nested
  // valueStreams/areas power the L3 → L4 cascade.
  const [lensTree, setLensTree] = useState<LensL3[]>([]);
  const [vsOptions, setVsOptions] = useState<MultiSelectOption[]>([]);
  useEffect(() => {
    api
      .get<{
        divisions: {
          id: string;
          name: string;
          valueStreams: { id: string; name: string; areas: { id: string; name: string }[] }[];
        }[];
      }>('/explorer/tree')
      .then((t) => {
        const seen = new Set<string>();
        const l3s: LensL3[] = [];
        for (const d of t.divisions)
          for (const vs of d.valueStreams) {
            if (seen.has(vs.name)) continue;
            seen.add(vs.name);
            l3s.push({
              id: vs.id,
              name: vs.name,
              l4s: vs.areas.map((a) => ({ id: a.id, name: a.name })),
            });
          }
        setLensTree(l3s.sort((a, b) => a.name.localeCompare(b.name)));
        setVsOptions(
          t.divisions
            .map(({ id, name }) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch(() => {
        // cascade + VS filter degrade to the remaining dropdowns only
        setLensTree([]);
        setVsOptions([]);
      });
  }, []);

  // Role options — fetched lazily the first time the Roles lens is opened
  // (~300 roles; the multi-select popover is searchable). GET /roles returns
  // one row per role×checklist item, so dedupe by roleId.
  const [roleOptions, setRoleOptions] = useState<MultiSelectOption[] | null>(null);
  useEffect(() => {
    if (mode !== 'roles' || roleOptions !== null) return;
    api
      .get<{ rows: { roleId: string; role: string }[] }>('/roles')
      .then(({ rows }) => {
        const seen = new Map<string, string>();
        for (const r of rows) if (!seen.has(r.roleId)) seen.set(r.roleId, r.role);
        setRoleOptions(
          [...seen]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch(() => setRoleOptions([]));
  }, [mode, roleOptions]);

  // ── L3 → L4 lens cascade (single-application mode only) ───────────────────
  const [selL3, setSelL3] = useState('');
  // '' (placeholder) | an L4 id | `stage:<id>` for an unmatched application lens.
  const [selL4, setSelL4] = useState('');

  // Match each stage (lens) of the selected application to its closest L4.
  const lensIndex = useMemo(() => {
    const byStage = new Map<string, { l3Id: string; l4Id: string }>();
    const byL4 = new Map<string, string>(); // l4Id → stageId (first match wins)
    if (!cascade) return { byStage, byL4 };
    for (const s of stages) {
      const st = lensTokens(`${s.name} ${s.businessProcess ?? ''}`);
      let best: { l3Id: string; l4Id: string; score: number } | null = null;
      for (const l3 of lensTree) {
        const l3t = lensTokens(l3.name);
        for (const l4 of l3.l4s) {
          const score = lensScore(st, lensTokens(l4.name), l3t);
          if (score > 0 && (!best || score > best.score))
            best = { l3Id: l3.id, l4Id: l4.id, score };
        }
      }
      if (best && !byL4.has(best.l4Id)) {
        byStage.set(s.id, { l3Id: best.l3Id, l4Id: best.l4Id });
        byL4.set(best.l4Id, s.id);
      }
    }
    return { byStage, byL4 };
  }, [cascade, stages, lensTree]);

  // Only L3 value streams / L4 processes that resolve to an existing analysis
  // board (a matched stage) are offered in the cascade — everything else is hidden.
  const boardTree = useMemo(
    () =>
      lensTree
        .map((l3) => ({ ...l3, l4s: l3.l4s.filter((l4) => lensIndex.byL4.has(l4.id)) }))
        .filter((l3) => l3.l4s.length > 0),
    [lensTree, lensIndex],
  );

  // Reflect the selected stage back into the dropdowns (app switch, load, …).
  useEffect(() => {
    if (!cascade || lensTree.length === 0 || !selectedId) return;
    const mapped = lensIndex.byStage.get(selectedId);
    if (mapped) {
      setSelL3(mapped.l3Id);
      setSelL4(mapped.l4Id);
    } else {
      setSelL3((p) => (boardTree.some((x) => x.id === p) ? p : (boardTree[0]?.id ?? '')));
      setSelL4(`stage:${selectedId}`);
    }
  }, [cascade, selectedId, lensIndex, lensTree, boardTree]);

  const onPickL3 = useCallback(
    (id: string) => {
      setSelL3(id);
      // Every listed L4 has a board — selecting a stream opens its first one.
      const next = boardTree.find((x) => x.id === id)?.l4s[0];
      setSelL4(next?.id ?? '');
      const stage = next ? lensIndex.byL4.get(next.id) : undefined;
      if (stage) onSelectStage(stage);
    },
    [boardTree, lensIndex, onSelectStage],
  );

  const onPickL4 = useCallback(
    (v: string) => {
      setSelL4(v);
      if (v.startsWith('stage:')) {
        onSelectStage(v.slice(6));
        return;
      }
      const stage = lensIndex.byL4.get(v);
      if (stage) onSelectStage(stage);
    },
    [lensIndex, onSelectStage],
  );

  const curL3 = boardTree.find((x) => x.id === selL3);
  const unmappedStages = stages.filter((s) => !lensIndex.byStage.has(s.id));

  // Board select (multi/cross-app views) — filtered stages grouped by application.
  const boardGroups = useMemo(() => {
    const groups = new Map<string, StageRow[]>();
    for (const s of stages) {
      const key = s.application ?? 'Unassigned';
      const bucket = groups.get(key);
      if (bucket) bucket.push(s);
      else groups.set(key, [s]);
    }
    return [...groups.entries()];
  }, [stages]);

  return (
    <div className="flex flex-wrap items-end gap-2 mb-3">
      {/* WR-01 mode switch — which entity the lens filters boards by. */}
      <div role="group" aria-label="Inspection lens" className={SEGMENT_GROUP_CLS}>
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onModeChange(m.value)}
            aria-pressed={mode === m.value}
            className={segmentCls(mode === m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Per-mode multi-select filter. */}
      {mode === 'applications' && (
        <LensField label="Applications" interactive>
          <MultiSelect
            label="Applications"
            options={appOptions}
            selected={selApps}
            onChange={onAppsChange}
            emptyLabel="All applications"
          />
        </LensField>
      )}
      {mode === 'valueStreams' && (
        <LensField label="Value streams" interactive>
          <MultiSelect
            label="Value streams"
            options={vsOptions}
            selected={selStreams}
            onChange={onStreamsChange}
            emptyLabel="All value streams"
          />
        </LensField>
      )}
      {mode === 'roles' && (
        <LensField label="Roles" interactive>
          <MultiSelect
            label="Roles"
            options={roleOptions ?? []}
            selected={selRoles}
            onChange={onRolesChange}
            searchable
            emptyLabel="All roles"
            loading={roleOptions === null}
          />
        </LensField>
      )}

      {/* Board picker: the classic L3/L4 cascade for a single application, or
          one application-grouped Board select for every other filter shape. */}
      {cascade
        ? lensTree.length > 0 &&
          stages.length > 0 && (
            <>
              {boardTree.length > 0 && (
                <LensField label="Value stream (L3)">
                  <select
                    value={selL3}
                    onChange={(e) => onPickL3(e.target.value)}
                    className={LENS_SELECT_CLS}
                  >
                    {boardTree.map((l3) => (
                      <option key={l3.id} value={l3.id}>
                        {l3.name}
                      </option>
                    ))}
                  </select>
                </LensField>
              )}
              <LensField label="Process (L4)">
                <select
                  value={selL4}
                  onChange={(e) => onPickL4(e.target.value)}
                  className={LENS_SELECT_CLS}
                >
                  {selL4 === '' && <option value="">Select a process…</option>}
                  {(curL3?.l4s ?? []).map((l4) => (
                    <option key={l4.id} value={l4.id}>
                      {l4.name}
                    </option>
                  ))}
                  {unmappedStages.length > 0 && (
                    <optgroup label="Application lenses">
                      {unmappedStages.map((s) => (
                        <option key={s.id} value={`stage:${s.id}`}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </LensField>
            </>
          )
        : stages.length > 0 && (
            <LensField label="Board">
              <select
                value={selectedId ?? ''}
                onChange={(e) => onSelectStage(e.target.value)}
                className={LENS_SELECT_CLS}
              >
                {boardGroups.map(([app, rows]) => (
                  <optgroup key={app} label={app}>
                    {rows.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </LensField>
          )}

      <div className="flex-1" />
      {/* WR-02: actions live on the selector row — no separate status bar,
          so the board reclaims the vertical space. */}
      {/* WR-06: anatomy lens — which findings feed the legacy cells. */}
      {hasDetail && (
        <div role="group" aria-label="Findings view" className={SEGMENT_GROUP_CLS}>
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => onViewChange(v.value)}
              aria-pressed={view === v.value}
              className={segmentCls(view === v.value)}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
      {hasDetail &&
        (editing ? (
          <Button
            variant="ghost"
            onClick={onExitEdit}
            disabled={saving}
            className="text-[12px] flex-shrink-0"
          >
            Exit
          </Button>
        ) : (
          <Button variant="secondary" onClick={onStartEdit} className="text-[12px] flex-shrink-0">
            Edit board
          </Button>
        ))}
      <Button
        variant="secondary"
        onClick={onNew}
        className="text-[12px] flex-shrink-0"
        title={newTitle}
      >
        + New…
      </Button>
    </div>
  );
}
