import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

// One data-driven custom node for every drill level. The orchestrator decides
// whether a node is the focused "parent" (the open level) or a "child" the user
// can inspect / drill into; styling keys off the node type + variant.

export type DrillNodeType =
  | 'company' | 'domain' | 'division' | 'department' | 'valueStream' | 'subValueStream'
  | 'processStep' | 'application' | 'initiative' | 'role' | 'person' | 'task';

// CEO domain hues (frozen — match the three architect tokens exactly).
export const DOMAIN_HEX: Record<string, string> = {
  'Core Business': '#0d9488',    // domain-core-600 (teal)
  'IT': '#4f46e5',               // domain-it-600 (indigo)
  'Corporate Function': '#7c3aed', // domain-corp-600 (violet)
};

export const DOMAIN_BG: Record<string, string> = {
  'Core Business': '#f0fdfa',    // domain-core-50
  'IT': '#eef2ff',               // domain-it-50
  'Corporate Function': '#f5f3ff', // domain-corp-50
};

export const DOMAIN_BORDER: Record<string, string> = {
  'Core Business': '#99f6e4',    // domain-core-200
  'IT': '#c7d2fe',               // domain-it-200
  'Corporate Function': '#ddd6fe', // domain-corp-200
};

export const DOMAIN_TEXT: Record<string, string> = {
  'Core Business': '#0f766e',    // domain-core-700
  'IT': '#4338ca',               // domain-it-700
  'Corporate Function': '#6d28d9', // domain-corp-700
};

export type DrillNodeData = {
  variant: 'parent' | 'child';
  nodeType: DrillNodeType;
  name: string;
  subtitle?: string;
  badges?: Record<string, string | number | undefined | null>;
  illustrative?: boolean;
  selected?: boolean;
  hasChildren?: boolean;
  // CEO domain for division/department nodes; colors the accent bar and chip.
  domainCategory?: string;
  // Ownership gap signal (sub-value-stream nodes). hasOwner=false = loss signal.
  hasOwner?: boolean;
};

// Muted, harmonized per-type accents (no rainbow).
const TYPE_ACCENT: Record<DrillNodeType, string> = {
  company: '#212f6c',
  domain: '#155e75',
  division: '#0d9488',      // default teal — overridden by domainCategory
  department: '#0d9488',    // default teal — overridden by domainCategory
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

// Participation type — how a role relates to a value stream.
const PART_TONE: Record<string, string> = {
  Lead: 'bg-domain-core-50 text-domain-core-700 border-domain-core-200',
  Core: 'bg-accent-50 text-accent-700 border-accent-200',
  Control: 'bg-overlap-50 text-overlap-700 border-overlap-200',
  Oversight: 'bg-slate-100 text-slate-600 border-slate-200',
  Support: 'bg-slate-100 text-slate-400 border-slate-200',
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function DrillNodeImpl({ data }: NodeProps) {
  const d = data as DrillNodeData;
  // Domain color wins for division/department if the category is known.
  const domainAccent = d.domainCategory ? DOMAIN_HEX[d.domainCategory] : undefined;
  const accent = domainAccent ?? TYPE_ACCENT[d.nodeType] ?? '#2945d6';
  const isParent = d.variant === 'parent';
  const isPerson = d.nodeType === 'person';

  const base = isParent
    ? 'bg-white shadow-pop'
    : 'bg-white shadow-card hover:shadow-float hover:-translate-y-0.5';
  const ring = d.selected
    ? 'ring-2 ring-accent-500 border-transparent'
    : 'border-slate-200/80';

  // Domain chip label and styles — only shown on child division nodes.
  const showDomainChip = !isParent && d.domainCategory && (d.nodeType === 'division' || d.nodeType === 'department');
  const domainChipStyle = d.domainCategory
    ? { background: DOMAIN_BG[d.domainCategory], color: DOMAIN_TEXT[d.domainCategory], borderColor: DOMAIN_BORDER[d.domainCategory] }
    : undefined;

  return (
    <div
      className={`group relative rounded-2xl border ${base} ${ring} transition-all duration-200 ease-out`}
      style={{ width: isParent ? 300 : 224, padding: isParent ? 16 : 12 }}
    >
      <Handle id="t" type="target" position={Position.Top} style={{ opacity: 0, top: 0 }} isConnectable={false} />
      <Handle id="l" type="target" position={Position.Left} style={{ opacity: 0, left: 0 }} isConnectable={false} />
      {/* Domain-colored accent bar */}
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

        {(d.badges || d.illustrative || showDomainChip || d.hasOwner === false) && (
          <div className="mt-2 flex flex-wrap items-center gap-1 pl-0.5">
            {/* Domain attribution chip — appears on division/department children */}
            {showDomainChip && (
              <span
                className="chip border text-[10px] font-semibold"
                style={domainChipStyle}
              >
                {d.domainCategory}
              </span>
            )}
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
            {d.badges?.participationType && (
              <span className={`chip border ${PART_TONE[String(d.badges.participationType)] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {String(d.badges.participationType)}
              </span>
            )}
            {d.badges?.status && <span className="chip-soft">{String(d.badges.status)}</span>}
            {d.badges?.roles != null && <span className="chip-soft">{String(d.badges.roles)} roles</span>}
            {/* Ownership gap (loss signal) — sub-value-stream with no owning role */}
            {d.hasOwner === false && (
              <span className="chip border border-loss-200 bg-loss-50 text-loss-700 inline-flex items-center gap-1">
                <span className="dot-loss" style={{ width: 6, height: 6 }} />
                No owner
              </span>
            )}
            {d.illustrative && <span className="illustrative-badge">Illustrative</span>}
          </div>
        )}
      </div>

      {!isParent && (d.hasChildren ? (
        // Persistent affordance: clicking this drills deeper (data-drill is
        // detected by the canvas click handler to drill instead of inspect).
        <span data-drill="1" className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-0.5 rounded-full bg-accent-50 border border-accent-200 text-accent-700 text-[9px] font-semibold px-2 leading-4 group-hover:bg-accent-600 group-hover:text-white group-hover:border-accent-600 transition-colors">
          Dig deeper <span className="text-[10px] leading-none">›</span>
        </span>
      ) : (
        // Leaf: detail only, no further drill.
        <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-slate-100 border border-slate-200 text-slate-400 text-[9px] px-2 leading-4">detail</span>
      ))}
      <Handle id="b" type="source" position={Position.Bottom} style={{ opacity: 0, bottom: 0 }} isConnectable={false} />
      <Handle id="r" type="source" position={Position.Right} style={{ opacity: 0, right: 0 }} isConnectable={false} />
    </div>
  );
}

// Faint band header used to cluster children into groups. When a domainColor
// is supplied (for the CEO top-level org split) the rule and label use it.
function GroupLabelImpl({ data }: NodeProps) {
  const d = data as { label: string; domainColor?: string; isDomainGroup?: boolean };
  const color = d.domainColor;
  return (
    <div className="select-none pointer-events-none">
      <span
        className="inline-flex items-center gap-2 text-eyebrow uppercase font-bold"
        style={color ? { color } : { color: '#94a3b8' }}
      >
        {color ? (
          <span className="h-px w-6 rounded-full" style={{ background: color, opacity: 0.5 }} />
        ) : (
          <span className="h-px w-6 bg-slate-300" />
        )}
        {d.label}
        {color ? (
          <span className="h-px w-6 rounded-full" style={{ background: color, opacity: 0.5 }} />
        ) : (
          <span className="h-px w-6 bg-slate-300" />
        )}
      </span>
    </div>
  );
}

const Memoized = memo(DrillNodeImpl);
const MemoLabel = memo(GroupLabelImpl);
export default Memoized;
export const drillNodeTypes = { drill: Memoized, groupLabel: MemoLabel };
