import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

// One data-driven custom node for every drill level. The orchestrator decides
// whether a node is the focused "parent" (the open level) or a "child" the user
// can inspect / drill into; styling keys off the node type + variant.

export type DrillNodeType =
  | 'company' | 'domain' | 'division' | 'department' | 'valueStream' | 'subValueStream'
  | 'processStep' | 'application' | 'initiative' | 'role' | 'person' | 'task';

export type DrillNodeData = {
  variant: 'parent' | 'child';
  nodeType: DrillNodeType;
  name: string;
  subtitle?: string;
  badges?: Record<string, string | number | undefined | null>;
  illustrative?: boolean;
  selected?: boolean;
  hasChildren?: boolean;
};

// Muted, harmonized per-type accents (no rainbow).
const TYPE_ACCENT: Record<DrillNodeType, string> = {
  company: '#212f6c',
  domain: '#155e75',
  division: '#2945d6',
  department: '#3a5ff0',
  valueStream: '#0e7490',
  subValueStream: '#0891b2',
  processStep: '#64748b',
  application: '#7c3aed',
  initiative: '#b45309',
  role: '#2c5594',
  person: '#0f766e',
  task: '#475569',
};

const REGION_TONE: Record<string, string> = {
  Offshore: 'bg-amber-50 text-amber-700 border-amber-200',
  Nearshore: 'bg-sky-50 text-sky-700 border-sky-200',
  Onshore: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const EMP_TONE: Record<string, string> = {
  contractor: 'bg-violet-50 text-violet-700 border-violet-200',
  si_partner: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  badged: 'bg-slate-100 text-slate-600 border-slate-200',
};
const EMP_LABEL: Record<string, string> = { contractor: 'Contractor', si_partner: 'SI Partner', badged: 'Employee' };

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function DrillNodeImpl({ data }: NodeProps) {
  const d = data as DrillNodeData;
  const accent = TYPE_ACCENT[d.nodeType] ?? '#2945d6';
  const isParent = d.variant === 'parent';
  const isPerson = d.nodeType === 'person';

  const base = isParent
    ? 'bg-white shadow-pop'
    : 'bg-white shadow-card hover:shadow-float hover:-translate-y-0.5';
  const ring = d.selected
    ? 'ring-2 ring-accent-500 border-transparent'
    : 'border-slate-200/80';

  return (
    <div
      className={`group relative rounded-2xl border ${base} ${ring} transition-all duration-200 ease-out`}
      style={{ width: isParent ? 300 : 224, padding: isParent ? 16 : 12 }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, top: 0 }} isConnectable={false} />
      <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full" style={{ background: accent }} />

      <div className="pl-2.5">
        <div className="flex items-center gap-2">
          {isPerson ? (
            <span
              className="flex-shrink-0 grid place-items-center rounded-full text-white text-[11px] font-bold"
              style={{ width: 26, height: 26, background: accent }}
            >
              {initials(d.name)}
            </span>
          ) : (
            <span
              className="flex-shrink-0 rounded-md"
              style={{ width: 8, height: 8, background: accent, opacity: 0.9 }}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className={`truncate text-slate-900 ${isParent ? 'text-[15px] font-bold' : 'text-[13px] font-semibold'}`}>
              {d.name}
            </div>
            {d.subtitle && (
              <div className="truncate text-[11px] text-slate-400 leading-tight">{d.subtitle}</div>
            )}
          </div>
        </div>

        {(d.badges || d.illustrative) && (
          <div className="mt-2 flex flex-wrap items-center gap-1 pl-0.5">
            {d.badges?.employmentType && (
              <span className={`chip border ${EMP_TONE[String(d.badges.employmentType)] ?? EMP_TONE.badged}`}>
                {EMP_LABEL[String(d.badges.employmentType)] ?? String(d.badges.employmentType)}
              </span>
            )}
            {d.badges?.region && (
              <span className={`chip border ${REGION_TONE[String(d.badges.region)] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {String(d.badges.region)}
              </span>
            )}
            {d.badges?.status && <span className="chip-soft">{String(d.badges.status)}</span>}
            {d.badges?.roles != null && <span className="chip-soft">{String(d.badges.roles)} roles</span>}
            {d.illustrative && <span className="illustrative-badge">Illustrative</span>}
          </div>
        )}
      </div>

      {!isParent && (d.hasChildren ? (
        // Persistent affordance: this node drills deeper.
        <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-0.5 rounded-full bg-accent-50 border border-accent-200 text-accent-700 text-[9px] font-semibold px-2 leading-4 group-hover:bg-accent-600 group-hover:text-white group-hover:border-accent-600 transition-colors">
          Dig deeper <span className="text-[10px] leading-none">›</span>
        </span>
      ) : (
        // Leaf: detail only, no further drill.
        <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-slate-100 border border-slate-200 text-slate-400 text-[9px] px-2 leading-4">detail</span>
      ))}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, bottom: 0 }} isConnectable={false} />
    </div>
  );
}

// Faint band header used to cluster children into groups (e.g. Operating model
// vs Organization at the company level; Direct reports vs People at a role).
function GroupLabelImpl({ data }: NodeProps) {
  const d = data as { label: string };
  return (
    <div className="select-none pointer-events-none">
      <span className="inline-flex items-center gap-2 text-eyebrow uppercase text-slate-400 font-bold">
        <span className="h-px w-6 bg-slate-300" />{d.label}<span className="h-px w-6 bg-slate-300" />
      </span>
    </div>
  );
}

const Memoized = memo(DrillNodeImpl);
const MemoLabel = memo(GroupLabelImpl);
export default Memoized;
export const drillNodeTypes = { drill: Memoized, groupLabel: MemoLabel };
