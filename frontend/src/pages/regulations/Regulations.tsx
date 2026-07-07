import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { useApi } from '../../lib/useApi';
import { withCompany, Tile } from '../../lib/portfolio';
import { useRegisterCrumb } from '../../lib/breadcrumbs';
import { Sheet, type SheetCol } from '../../components/Sheet';
import { StatusPill } from '../../components/ui';
import { type VsLink } from '../../components/RequirementLinks';
import { RegOverviewDrawer, type DrillKind } from './OverviewDrawers';

type RoleRef = { id: string; name: string };

// Regulations — three lenses, each a FLAT table where every row is ONE atomic
// regulation (no drill-down): the named regulation/regime, the single obligation
// it produces, its accountable owner, contributors, and the value-stream
// processes it governs.
//   International: non-US / supranational regulators (EU/GDPR today).
//   Federal: the federal / national securities regime (FINRA/SEC/MSRB).
//   State (default): the 50-state (+DC) insurance regulatory baseline.

type RequirementRow = {
  id: string;
  category: string;
  title: string;
  requirement: string;
  lineOfBusiness: string;
  citation: string | null;
  obligationType: string;
  frequency: string | null;
  status: string;
  confidence: string;
  agentSkill: string | null;
  regime: string | null;
  jurisdiction: {
    id: string;
    code: string;
    name: string;
    priorityTier: string;
    regulatorType: string;
  };
  valueStreamLinks: VsLink[];
  owner: RoleRef | null;
  contributors: RoleRef[];
};

export type Overview = {
  jurisdictionCount: number;
  flags: Record<string, Record<string, number>>;
  requirements: {
    total: number;
    mapped: number;
    unmapped: number;
    byCategory: Record<string, number>;
    byConfidence: Record<string, number>;
  };
  coverageByValueStream: {
    valueStreamId: string;
    valueStream: string | null;
    requirementCount: number;
  }[];
  bulletinCount: number;
  ruleCount: number;
  sourceCount: number;
  verifiedJurisdictions: number;
};

// Provenance legend for the Confidence pill/column (SCRUM-40/42) — shared by
// the overview drawer, the table hint, and the state-detail pills.
export const CONFIDENCE_HELP: Record<string, string> = {
  BASELINE: 'sourced from the 50-state baseline research document, not yet independently verified',
  DERIVED: 'decomposed or inferred from a broader regime or grouped requirement',
  VERIFIED: 'confirmed against the official regulator source',
  STALE: 'the source has changed since last verification — needs re-review',
};

// What each obligation type means (SCRUM-42/77) — filing gates are the
// critical blockers; informational rows are monitoring-only.
export const OBLIGATION_HELP: Record<string, string> = {
  FILING_GATE: 'Blocks a transaction until the regulator approves the filing',
  ONGOING: 'Continuous obligation — always in force',
  EVENT_DRIVEN: 'Fires when a triggering event occurs',
  INFORMATIONAL: 'Monitoring-only — no direct action required',
};
const OBLIGATION_TONE: Record<string, 'amber' | 'blue' | 'green' | 'slate'> = {
  FILING_GATE: 'amber',
  ONGOING: 'blue',
  EVENT_DRIVEN: 'green',
  INFORMATIONAL: 'slate',
};
const CONFIDENCE_TONE: Record<string, 'green' | 'amber' | 'red' | 'slate'> = {
  VERIFIED: 'green',
  DERIVED: 'amber',
  STALE: 'red',
  BASELINE: 'slate',
};

const TABS = ['International', 'Federal', 'State'] as const;
type Tab = (typeof TABS)[number];

// regulatorType → which lens a regulation belongs to.
const LENS_TYPE: Record<Tab, (t: string) => boolean> = {
  International: (t) => t === 'INTERNATIONAL',
  Federal: (t) => t === 'FEDERAL_SECURITIES',
  State: (t) => t !== 'INTERNATIONAL' && t !== 'FEDERAL_SECURITIES',
};

// Flag display helpers — normalized token → short label + pill tone. Kept here
// (with FlagPill) because RegulationDetail imports both for the state flag strip.
const FLAG_PILL: Record<string, string> = {
  SERFF: 'pill-slate',
  PROPRIETARY: 'pill-red',
  MIXED: 'pill-amber',
  MEMBER: 'pill-green',
  NON_MEMBER: 'pill-red',
  YES: 'pill-green',
  NO: 'pill-slate',
  PARTIAL: 'pill-amber',
  EMERGING: 'pill-amber',
  TRANSITIONING: 'pill-amber',
  EDI: 'pill-green',
  NON_EDI: 'pill-slate',
  MONOPOLISTIC_FUND: 'pill-blue',
  STATE_SPECIFIC: 'pill-amber',
};
const ACRONYMS = new Set(['SERFF', 'EDI', 'APCD', 'SBS']);
const flagLabel = (v: string) =>
  v
    .split('_')
    .map((w, i) =>
      ACRONYMS.has(w)
        ? w
        : i === 0
          ? w.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
          : w.toLowerCase(),
    )
    .join(' ')
    .replace('Non EDI', 'Non-EDI');
export function FlagPill({ value, detail }: { value: string; detail?: string | null }) {
  return (
    <span className={FLAG_PILL[value] ?? 'pill-slate'} title={detail ?? undefined}>
      {flagLabel(value)}
    </span>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  PRODUCT_FILING: 'Product filing',
  LICENSING: 'Licensing',
  PREMIUM_TAX: 'Premium tax',
  SURPLUS_LINES: 'Surplus lines',
  WORKERS_COMP_REPORTING: "Workers' comp",
  AUTO_VERIFICATION: 'Auto verification',
  APCD_REPORTING: 'APCD',
  FINANCIAL_REPORTING: 'Financial reporting',
  MARKET_CONDUCT: 'Market conduct',
  DATA_CALL: 'Data call',
  CYBERSECURITY: 'Cybersecurity',
  DATA_PRIVACY: 'Data privacy',
  OTHER: 'Other',
};
export const catLabel = (c: string) => CATEGORY_LABEL[c] ?? flagLabel(c);

const dash = <span className="text-[#d4d4d4]">—</span>;

export default function Regulations() {
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const [tab, setTab] = useState<Tab>('State');
  const [drill, setDrill] = useState<DrillKind | null>(null);
  useRegisterCrumb('Regulations');

  const { data: overview } = useApi<Overview>(
    companyId ? withCompany('/regulations/overview', companyId) : null,
  );

  const [requirements, setRequirements] = useState<RequirementRow[] | null>(null);
  useEffect(() => {
    if (!companyId) return;
    api
      .get<RequirementRow[]>(withCompany('/regulations/requirements', companyId))
      .then(setRequirements)
      .catch(() => setRequirements([]));
  }, [companyId]);

  const rows = (requirements ?? []).filter((r) => LENS_TYPE[tab](r.jurisdiction.regulatorType));

  // Lens tabs — segmented control, same format as the Value Streams / Org view
  // toggle. Rendered inside the Sheet totals strip (leading), so the totals sit
  // to the right of the selector on one row.
  const tabs = (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-[#eaeaea] bg-white p-0.5"
      role="tablist"
      aria-label="Regulations lenses"
    >
      {TABS.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={tab === t}
          onClick={() => setTab(t)}
          className={
            'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ' +
            (tab === t ? 'bg-[#171717] text-white' : 'text-[#525252] hover:text-[#171717]')
          }
        >
          {t}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {/* Headline tiles — compact strip; each card drills into a detail drawer (SCRUM-45). */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          <Tile
            compact
            label="Jurisdictions"
            value={overview.jurisdictionCount}
            hint={`${overview.flags.priorityTier?.PRIORITY ?? 0} priority states`}
            onClick={() => setDrill('jurisdictions')}
          />
          <Tile
            compact
            label="Active regulations"
            value={overview.requirements.total}
            hint={`${overview.requirements.mapped} mapped to value streams`}
            onClick={() => setDrill('regulations')}
          />
          <Tile
            compact
            label="Compliance rules"
            value={overview.ruleCount}
            hint="machine-readable"
            onClick={() => setDrill('rules')}
          />
          <Tile
            compact
            label="Monitored sources"
            value={overview.sourceCount}
            hint={`${overview.bulletinCount} bulletins`}
            onClick={() => setDrill('sources')}
          />
        </div>
      )}
      {drill && overview && (
        <RegOverviewDrawer kind={drill} overview={overview} onClose={() => setDrill(null)} />
      )}

      <RegulationTable
        rows={rows}
        loading={requirements === null}
        firstLabel={tab === 'State' ? 'State' : 'Regulator'}
        emptyText={`No ${tab === 'State' ? 'state' : tab.toLowerCase()} regulations on file.`}
        onOpen={(code) => navigate(`/regulations/${code}`)}
        leading={tabs}
      />
    </div>
  );
}

// ── Flat regulation table — one atomic regulation per row, no expand ────────────
function RegulationTable({
  rows,
  loading,
  firstLabel,
  emptyText,
  onOpen,
  leading,
}: {
  rows: RequirementRow[];
  loading: boolean;
  firstLabel: string;
  emptyText: string;
  onOpen: (code: string) => void;
  leading?: React.ReactNode;
}) {
  const cols: SheetCol<RequirementRow>[] = [
    {
      key: 'juris',
      label: firstLabel,
      width: '140px',
      align: 'center',
      value: (r) => r.jurisdiction.name,
      hint: 'Issuing jurisdiction — the state, federal, or international regulator behind the obligation',
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <span
            className="truncate text-[12px] font-medium text-[#171717]"
            title={r.jurisdiction.name}
          >
            {r.jurisdiction.name}
          </span>
          <span className="text-[11px] text-[#a3a3a3] tnum flex-shrink-0">
            {r.jurisdiction.code}
          </span>
        </span>
      ),
    },
    {
      key: 'regime',
      label: 'Regulation',
      width: '120px',
      align: 'center',
      value: (r) => r.regime ?? '',
      hint: 'Named regulation / regime (e.g. GDPR, CCPA-CPRA, NYDFS-500) — where one applies',
      render: (r) =>
        r.regime ? <span className="truncate text-[12px] text-[#171717]">{r.regime}</span> : dash,
    },
    {
      key: 'obligation',
      label: 'Obligation',
      width: 'minmax(0,2fr)',
      align: 'center',
      value: (r) => r.title,
      hint: 'The single atomic obligation this regulation produces — hover a row for the full requirement text',
      render: (r) => (
        <span
          className="truncate text-[12px] text-[#262626]"
          title={`${r.title}\n\n${r.requirement}`}
        >
          {r.title}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: '100px',
      align: 'center',
      value: (r) => flagLabel(r.obligationType),
      hint: 'How the obligation binds — Filing gate: blocks a transaction until approved · Ongoing: always in force · Event-driven: fires on a trigger · Informational: monitoring-only',
      render: (r) => (
        <StatusPill
          tone={OBLIGATION_TONE[r.obligationType] ?? 'slate'}
          title={OBLIGATION_HELP[r.obligationType]}
        >
          {flagLabel(r.obligationType)}
        </StatusPill>
      ),
    },
    {
      key: 'confidence',
      label: 'Confidence',
      width: '96px',
      align: 'center',
      value: (r) => flagLabel(r.confidence),
      hint: 'Provenance of the entry — Baseline: from the 50-state baseline research · Derived: decomposed from a broader regime · Verified: confirmed against the official source · Stale: needs re-verification',
      render: (r) => (
        <StatusPill
          tone={CONFIDENCE_TONE[r.confidence] ?? 'slate'}
          title={CONFIDENCE_HELP[r.confidence]}
        >
          {flagLabel(r.confidence)}
        </StatusPill>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      width: '130px',
      align: 'center',
      value: (r) => catLabel(r.category),
      hint: 'Compliance domain — used for grouping and filtering',
      render: (r) => (
        <span className="truncate text-[12px] text-[#525252]">{catLabel(r.category)}</span>
      ),
    },
    {
      key: 'lob',
      label: 'Line of business',
      width: '110px',
      align: 'center',
      value: (r) => flagLabel(r.lineOfBusiness),
      hint: 'Which insurance line the obligation applies to — All means every line the company writes; filter here to cut cross-line noise',
      render: (r) =>
        r.lineOfBusiness === 'ALL' ? (
          <span className="text-[12px] text-[#a3a3a3]">All lines</span>
        ) : (
          <span className="truncate text-[12px] text-[#525252]">{flagLabel(r.lineOfBusiness)}</span>
        ),
    },
    {
      key: 'vstreams',
      label: 'Value streams',
      width: 'minmax(0,1fr)',
      align: 'center',
      values: (r) =>
        r.valueStreamLinks.length
          ? r.valueStreamLinks.map((l) => l.valueStream.name)
          : ['Unmapped'],
      hint: 'Value streams whose tasks this regulation governs — every active regulation should be mapped to the streams it applies to (edit links on the jurisdiction page)',
      render: (r) =>
        r.valueStreamLinks.length ? (
          <span
            className="truncate text-[12px] text-[#525252]"
            title={r.valueStreamLinks.map((l) => l.valueStream.name).join(', ')}
          >
            {r.valueStreamLinks.map((l) => l.valueStream.name).join(', ')}
          </span>
        ) : (
          <StatusPill
            tone="amber"
            title="Not yet mapped to any value stream — open the jurisdiction page and use edit links"
          >
            Unmapped
          </StatusPill>
        ),
    },
    {
      key: 'owner',
      label: 'Owner',
      width: 'minmax(0,1fr)',
      align: 'center',
      value: (r) => r.owner?.name ?? '',
      hint: 'The role accountable for meeting this obligation',
      render: (r) => (
        <span className="truncate text-[12px] text-[#525252]" title={r.owner?.name}>
          {r.owner ? r.owner.name : dash}
        </span>
      ),
    },
    {
      key: 'contributors',
      label: 'Contributors',
      width: 'minmax(0,1.3fr)',
      align: 'center',
      values: (r) => r.contributors.map((c) => c.name),
      hint: 'Roles that participate in fulfilling the obligation alongside the owner',
      render: (r) => (
        <span
          className="truncate text-[12px] text-[#525252]"
          title={r.contributors.map((c) => c.name).join(', ')}
        >
          {r.contributors.length ? r.contributors.map((c) => c.name).join(', ') : dash}
        </span>
      ),
    },
    {
      key: 'plan',
      label: 'Plan',
      width: '64px',
      align: 'center',
      value: () => '',
      hint: 'Checklist & testing plan for this regulation in the Work Library',
      render: (r) => (
        <Link
          to={`/work-library?type=regulation&id=${r.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[11.5px] font-medium text-[#2563eb] hover:underline"
        >
          Plan ↗
        </Link>
      ),
    },
  ];
  return (
    <Sheet
      sheetKey="regulations"
      rows={rows}
      cols={cols}
      rowKey={(r) => r.id}
      loading={loading}
      unit="regulations"
      emptyText={emptyText}
      defaultSort={{ col: 'juris', dir: 1 }}
      summarize={(v) =>
        `${new Set(v.map((r) => r.jurisdiction.code)).size} jurisdictions · ${v.filter((r) => r.valueStreamLinks.length).length} mapped`
      }
      onRowClick={(r) => onOpen(r.jurisdiction.code)}
      leading={leading}
    />
  );
}
