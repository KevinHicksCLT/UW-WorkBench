/**
 * TOC (default view) support for the Work page — the work rolled up by a
 * switchable grouping. The volume is high, so users can re-group on the fly;
 * each group definition maps to the List column it filters, so picking a TOC
 * row jumps to the List pre-filtered to that group. The chosen grouping is
 * remembered per tab in the per-user preference store (work.toc.group.<tab>);
 * the old localStorage bridge.* values are migrated by PreferencesProvider.
 */
import { useEffect, useMemo, useState } from 'react';
import { useBackHandler } from '../../lib/navBack';
import { usePreferences } from '../../lib/preferences';
import { useOnChange, useViewState } from '../../lib/viewState';
import type { TocRow } from '../../components/TocView';

export type WorkGroup = { key: string; label: string; unit: string; col: string };

const D_GROUPS: WorkGroup[] = [
  { key: 'valueStream', label: 'Value Stream', unit: 'value streams', col: 'valueStream' },
  { key: 'role', label: 'Role', unit: 'roles', col: 'roles' },
];
const T_GROUPS: WorkGroup[] = [
  { key: 'valueStream', label: 'Value Stream', unit: 'value streams', col: 'valueStream' },
  { key: 'division', label: 'Org', unit: 'divisions', col: 'division' },
  { key: 'deliverable', label: 'Deliverable', unit: 'deliverables', col: 'deliverable' },
  { key: 'role', label: 'Role', unit: 'roles', col: 'role' },
];

// Structural slices of the Work page's row types — just the fields the
// grouping accessors read.
type DeliverableSlice = { id: string; valueStreamName: string | null; roles: string[] };
type TaskSlice = {
  division: string | null;
  deliverableTitle: string | null;
  owner: string | null;
  deliverableId: string | null;
};

export function useWorkToc(
  tab: 'deliverables' | 'tasks',
  deliverables: DeliverableSlice[],
  tasks: TaskSlice[],
  dash: string,
) {
  const groups = tab === 'deliverables' ? D_GROUPS : T_GROUPS;
  const { prefs, update } = usePreferences();
  const prefKey = `work.toc.group.${tab}`;
  const saved = typeof prefs[prefKey] === 'string' ? (prefs[prefKey] as string) : null;

  // Persisted per session and per tab (lib/viewState) so returning to the tab
  // restores the exact view / drilled group / pre-filter left behind.
  const [view, setView] = useViewState<'toc' | 'list' | 'drill'>(`work.${tab}.view`, 'toc');
  const [groupBy, setGroupBy] = useState<string>(saved ?? 'valueStream');
  const [preFilter, setPreFilter] = useViewState<{ col: string; value: string } | null>(
    `work.${tab}.preFilter`,
    null,
  );
  // The group value being drilled into (view === 'drill').
  const [drillValue, setDrillValue] = useViewState<string | null>(`work.${tab}.drillValue`, null);
  // Reset on a tab SWITCH only (useOnChange skips mount, which would wipe the
  // restored state).
  useOnChange(tab, () => {
    setView('toc');
    setPreFilter(null);
    setDrillValue(null);
  });

  // The header's back button steps a drilled group back to the TOC
  // (lib/navBack); otherwise it falls through to history.
  useBackHandler(() => {
    if (view !== 'drill') return false;
    setView('toc');
    setDrillValue(null);
    return true;
  });
  // Sync the grouping when the tab switches or the async preference load lands
  // (kept separate from the view reset so a background save can't yank the
  // user out of a drilled-in list).
  useEffect(() => {
    setGroupBy(saved ?? 'valueStream');
  }, [tab, saved]);
  function pickGroup(key: string) {
    setGroupBy(key);
    update({ [prefKey]: key });
  }

  const group = groups.find((g) => g.key === groupBy) ?? groups[0];

  const vsByDeliverable = useMemo(
    () => new Map(deliverables.map((d) => [d.id, d.valueStreamName ?? dash])),
    [deliverables, dash],
  );

  // Values a row belongs to under the active grouping — multi-valued for
  // deliverable roles (one deliverable counts once per assigned role). Each
  // accessor mirrors the matching List column's filter value exactly.
  const valuesOf = useMemo(
    () =>
      (row: DeliverableSlice | TaskSlice): string[] => {
        if (tab === 'deliverables') {
          const d = row as DeliverableSlice;
          if (group.key === 'role') return d.roles?.length ? d.roles : [dash];
          return [d.valueStreamName ?? dash];
        }
        const t = row as TaskSlice;
        if (group.key === 'division') return [t.division ?? dash];
        if (group.key === 'deliverable') return [t.deliverableTitle ?? dash];
        if (group.key === 'role') return [t.owner ?? dash];
        return [t.deliverableId ? (vsByDeliverable.get(t.deliverableId) ?? dash) : dash];
      },
    [tab, group, vsByDeliverable, dash],
  );

  // Clicking a TOC row drills into that group (Standards-style descent).
  const tocRows = useMemo<TocRow[]>(() => {
    const rows: (DeliverableSlice | TaskSlice)[] = tab === 'deliverables' ? deliverables : tasks;
    const counts = new Map<string, number>();
    for (const r of rows) for (const v of valuesOf(r)) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({
        id: name,
        name,
        count,
        onClick: () => {
          setDrillValue(name);
          setView('drill');
        },
      }));
  }, [tab, deliverables, tasks, valuesOf]);

  /** Whether a row belongs to the drilled-into group value. */
  const inDrill = (row: DeliverableSlice | TaskSlice) =>
    drillValue != null && valuesOf(row).includes(drillValue);

  return {
    view,
    setView,
    preFilter,
    setPreFilter,
    drillValue,
    setDrillValue,
    inDrill,
    group,
    groups,
    pickGroup,
    tocRows,
  };
}

/** Quick re-grouping chips shown on the TOC strip. */
export function WorkGroupPicker({
  groups,
  activeKey,
  onPick,
}: {
  groups: WorkGroup[];
  activeKey: string;
  onPick: (key: string) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[#737373]">
      Group by
      {groups.map((g) => (
        <button
          key={g.key}
          type="button"
          onClick={() => onPick(g.key)}
          className={
            'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-150 ' +
            (activeKey === g.key
              ? 'border-[#171717] bg-[#171717] text-white'
              : 'border-[#eaeaea] bg-white text-[#525252] hover:border-[#a3a3a3]')
          }
        >
          {g.label}
        </button>
      ))}
    </span>
  );
}
