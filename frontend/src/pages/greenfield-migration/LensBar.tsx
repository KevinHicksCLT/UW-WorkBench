/**
 * The workspace's selector row: the PM-04 domain segmented control
 * (Application ↔ Product Model Rationalization), the WR-01 inspection-mode
 * switch and per-mode multi-select — BOTH driven by vocabulary MODE rows
 * (3-A: no hardcoded mode/view arrays) — then the board picker.
 * Single-application mode keeps the original L3 → L4 lens cascade; every
 * other shape lists the filtered boards in one grouped "Board" select.
 * Product modes (Legacy Product Models / Segment / Geography) filter through
 * one multi-select fed by GET /product-models (PM-05 client half). The row
 * actions (findings view toggle, Edit board, + New…) live here too.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui';
import { lensModeOf, type Domain, type StageListItem } from '../../lib/rationalization';
import { lensTokens, lensScore, LensField, LENS_SELECT_CLS, type LensL3 } from './lens';
import { MultiSelect, type MultiSelectOption } from './MultiSelect';

/** Which entity the app-domain lens filters boards by (WR-01). */
export type LensMode = 'applications' | 'valueStreams' | 'roles';

/** Stage list row + the lens FKs GET /rationalization now returns (WR-01). */
export type StageRow = StageListItem & {
  applicationId: string | null;
  valueStreamNodeId: string | null;
};

export type SegmentOption = { value: string; label: string };

/** PM-04 domain options — the frozen §6.2 domain enum (control, not vocab). */
export const DOMAIN_OPTIONS: SegmentOption[] = [
  { value: 'APPLICATION', label: 'Application Rationalization' },
  { value: 'PRODUCT_MODEL', label: 'Product Model Rationalization' },
];

/** Parse the `?domain=` deep-link value (Agent 4's Portfolio.tsx seam). */
export const parseDomainParam = (v: string | null): Domain | null =>
  v === 'product-models' || v === 'PRODUCT_MODEL'
    ? 'PRODUCT_MODEL'
    : v === 'applications' || v === 'APPLICATION'
      ? 'APPLICATION'
      : null;

// Shared segmented-control chrome (same visual family as Components|Behavior).
const SEGMENT_GROUP_CLS =
  'flex h-7 rounded-md border border-[#eaeaea] overflow-hidden flex-shrink-0';
const segmentCls = (active: boolean) =>
  `px-2.5 text-[12px] font-medium ${
    active ? 'bg-[#171717] text-white' : 'bg-white text-[#525252] hover:bg-[#fafafa]'
  }`;

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SegmentOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div role="group" aria-label={label} className={SEGMENT_GROUP_CLS}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={segmentCls(value === o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type LensBarProps = {
  /** PM-04 domain switch — options provided by the shell (frozen DTO enum). */
  domain: Domain;
  domainOptions: SegmentOption[];
  onDomainChange: (d: Domain) => void;
  /** MODE vocabulary rows for the active domain (3-A). */
  modeOptions: SegmentOption[];
  modeToken: string;
  onModeToken: (token: string) => void;
  /** App-domain filters (WR-01). */
  appOptions: MultiSelectOption[];
  selApps: string[];
  onAppsChange: (ids: string[]) => void;
  selStreams: string[];
  onStreamsChange: (ids: string[]) => void;
  selRoles: string[];
  onRolesChange: (ids: string[]) => void;
  /** Product-domain filter for the active mode (models / segments / geos). */
  productOptions: MultiSelectOption[];
  productSelected: string[];
  onProductSelected: (ids: string[]) => void;
  /** The filtered stages (mode filter applied + sorted) the picker operates on. */
  stages: StageRow[];
  selectedId: string | null;
  onSelectStage: (id: string) => void;
  /** True when the classic single-application L3/L4 cascade should render. */
  cascade: boolean;
  /** VIEW vocabulary rows (empty → domain has no view axis, toggle hidden). */
  viewOptions: SegmentOption[];
  view: string;
  onViewChange: (view: string) => void;
  hasDetail: boolean;
  editing: boolean;
  saving: boolean;
  onStartEdit: () => void;
  onExitEdit: () => void;
  onNew: () => void;
  /** Tooltip for the + New… button (selected stage · progress). */
  newTitle: string;
};

export function LensBar(props: LensBarProps) {
  const {
    domain,
    domainOptions,
    onDomainChange,
    modeOptions,
    modeToken,
    onModeToken,
    stages,
    selectedId,
    onSelectStage,
    cascade,
  } = props;
  const modeKey = lensModeOf(modeToken);
  const isProducts = domain === 'PRODUCT_MODEL';

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
    if (isProducts || modeKey !== 'roles' || roleOptions !== null) return;
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
  }, [isProducts, modeKey, roleOptions]);

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
  // board (a matched stage) are offered in the cascade.
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

  const activeModeLabel = modeOptions.find((m) => m.value === modeToken)?.label ?? modeToken;

  return (
    <div className="flex flex-wrap items-end gap-2 mb-3">
      {/* PM-04: which rationalization domain the workspace inspects. */}
      <Segmented
        label="Rationalization domain"
        options={domainOptions}
        value={domain}
        onChange={(v) => onDomainChange(v as Domain)}
      />

      {/* WR-01 mode switch — vocabulary MODE rows for the active domain. */}
      <Segmented
        label="Inspection lens"
        options={modeOptions}
        value={modeToken}
        onChange={onModeToken}
      />

      {/* Per-mode multi-select filter. */}
      {isProducts ? (
        <LensField label={activeModeLabel} interactive>
          <MultiSelect
            label={activeModeLabel}
            options={props.productOptions}
            selected={props.productSelected}
            onChange={props.onProductSelected}
            emptyLabel={`All ${activeModeLabel.toLowerCase()}`}
          />
        </LensField>
      ) : (
        <>
          {modeKey === 'applications' && (
            <LensField label="Applications" interactive>
              <MultiSelect
                label="Applications"
                options={props.appOptions}
                selected={props.selApps}
                onChange={props.onAppsChange}
                emptyLabel="All applications"
              />
            </LensField>
          )}
          {modeKey === 'valueStreams' && (
            <LensField label="Value streams" interactive>
              <MultiSelect
                label="Value streams"
                options={vsOptions}
                selected={props.selStreams}
                onChange={props.onStreamsChange}
                emptyLabel="All value streams"
              />
            </LensField>
          )}
          {modeKey === 'roles' && (
            <LensField label="Roles" interactive>
              <MultiSelect
                label="Roles"
                options={roleOptions ?? []}
                selected={props.selRoles}
                onChange={props.onRolesChange}
                searchable
                emptyLabel="All roles"
                loading={roleOptions === null}
              />
            </LensField>
          )}
        </>
      )}

      {/* Board picker: the classic L3/L4 cascade for a single application, or
          one grouped Board select for every other filter shape. */}
      {cascade && !isProducts
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
      {/* WR-02: actions live on the selector row — no separate status bar. */}
      {/* WR-06: anatomy lens — VIEW vocabulary rows (hidden when the domain
          defines none, e.g. product models). */}
      {props.hasDetail && (
        <Segmented
          label="Findings view"
          options={props.viewOptions}
          value={props.view}
          onChange={props.onViewChange}
        />
      )}
      {props.hasDetail &&
        !isProducts &&
        (props.editing ? (
          <Button
            variant="ghost"
            onClick={props.onExitEdit}
            disabled={props.saving}
            className="text-[12px] flex-shrink-0"
          >
            Exit
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={props.onStartEdit}
            className="text-[12px] flex-shrink-0"
          >
            Edit board
          </Button>
        ))}
      {/* Board layout editing + "+ New…" stay app-domain until the product
          workspace CRUD endpoints land (Agent 2). */}
      {!isProducts && (
        <Button
          variant="secondary"
          onClick={props.onNew}
          className="text-[12px] flex-shrink-0"
          title={props.newTitle}
        >
          + New…
        </Button>
      )}
    </div>
  );
}
