import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useCompany } from '../lib/company';
import { useApi } from '../lib/useApi';
import { withCompany, Tile, SectionCard } from '../lib/portfolio';
import PageHeader from '../components/PageHeader';
import { Sheet, SheetCell, type SheetCol } from '../components/Sheet';
import { LinkChips, LinksEditor, type VsLink, type VsOption } from '../components/RequirementLinks';

// Regulations — the 50-state insurance regulatory baseline, three lenses:
//   States (default): the cross-state taxonomy matrix made live; row → detail.
//   Requirements: every discrete obligation across states, filterable,
//     with inline value-stream link editing (ADMIN/MANAGER).
//   Coverage: value-stream-first flip — which requirements/states touch each
//     stream, with the unmapped backlog surfaced for curation.

type JurisdictionRow = {
  id: string; code: string; name: string; regulatorName: string;
  filingPortal: string; filingPortalDetail: string | null;
  compactStatus: string; autoVerification: string; autoVerificationDetail: string | null;
  workersCompModel: string; workersCompDetail: string | null; apcd: string; sbs: string;
  priorityTier: string; profileDepth: string;
  lastReviewedAt: string | null; lastVerifiedAt: string | null; updatedAt: string;
  _count: { requirements: number; bulletins: number; rules: number; integrations: number; sources: number };
};

type RequirementRow = {
  id: string; category: string; title: string; requirement: string;
  lineOfBusiness: string; citation: string | null; obligationType: string;
  frequency: string | null; status: string; confidence: string;
  jurisdiction: { id: string; code: string; name: string; priorityTier: string };
  valueStreamLinks: VsLink[];
};

type Overview = {
  jurisdictionCount: number;
  flags: Record<string, Record<string, number>>;
  requirements: { total: number; mapped: number; unmapped: number; byCategory: Record<string, number>; byConfidence: Record<string, number> };
  coverageByValueStream: { valueStreamId: string; valueStream: string | null; requirementCount: number }[];
  bulletinCount: number; ruleCount: number; sourceCount: number;
  verifiedJurisdictions: number;
  valueStreams: VsOption[];
};

const TABS = ['States', 'Requirements', 'Coverage'] as const;
type Tab = (typeof TABS)[number];

// Flag display helpers — normalized token → short label + pill tone.
const FLAG_PILL: Record<string, string> = {
  SERFF: 'pill-slate', PROPRIETARY: 'pill-red', MIXED: 'pill-amber',
  MEMBER: 'pill-green', NON_MEMBER: 'pill-red',
  YES: 'pill-green', NO: 'pill-slate', PARTIAL: 'pill-amber', EMERGING: 'pill-amber', TRANSITIONING: 'pill-amber',
  EDI: 'pill-green', NON_EDI: 'pill-slate', MONOPOLISTIC_FUND: 'pill-blue', STATE_SPECIFIC: 'pill-amber',
};
// Acronyms stay uppercase when prettifying enum tokens.
const ACRONYMS = new Set(['SERFF', 'EDI', 'APCD', 'SBS']);
const flagLabel = (v: string) => v.split('_')
  .map((w, i) => (ACRONYMS.has(w) ? w : i === 0 ? w.toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : w.toLowerCase()))
  .join(' ')
  .replace('Non EDI', 'Non-EDI');
export function FlagPill({ value, detail }: { value: string; detail?: string | null }) {
  return <span className={FLAG_PILL[value] ?? 'pill-slate'} title={detail ?? undefined}>{flagLabel(value)}</span>;
}

const CATEGORY_LABEL: Record<string, string> = {
  PRODUCT_FILING: 'Product filing', LICENSING: 'Licensing', PREMIUM_TAX: 'Premium tax',
  SURPLUS_LINES: 'Surplus lines', WORKERS_COMP_REPORTING: "Workers' comp", AUTO_VERIFICATION: 'Auto verification',
  APCD_REPORTING: 'APCD', FINANCIAL_REPORTING: 'Financial reporting', MARKET_CONDUCT: 'Market conduct',
  DATA_CALL: 'Data call', CYBERSECURITY: 'Cybersecurity', OTHER: 'Other',
};
export const catLabel = (c: string) => CATEGORY_LABEL[c] ?? flagLabel(c);

// "Last updated" cell — the stored lastVerifiedAt, else the stored updatedAt.
// Date only, never the live clock: the value must not change between renders.
function lastUpdated(r: JurisdictionRow) {
  const d = new Date(r.lastVerifiedAt ?? r.updatedAt);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function Regulations() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companyId } = useCompany();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [tab, setTab] = useState<Tab>('States');

  const { data: overview } = useApi<Overview>(companyId ? withCompany('/regulations/overview', companyId) : null);
  const { data: jurisdictions, loading: jLoading } = useApi<JurisdictionRow[]>(companyId ? withCompany('/regulations/jurisdictions', companyId) : null);

  // Requirements are edited in place (VS links), so they live in state.
  const [requirements, setRequirements] = useState<RequirementRow[] | null>(null);
  useEffect(() => {
    if (!companyId) return;
    api.get(withCompany('/regulations/requirements', companyId)).then(setRequirements).catch(() => setRequirements([]));
  }, [companyId]);
  const patchLinks = (id: string, links: VsLink[]) =>
    setRequirements((prev) => prev?.map((r) => (r.id === id ? { ...r, valueStreamLinks: links } : r)) ?? prev);

  return (
    <div>
      <PageHeader
        title="Regulations"
        subtitle="The 50-state (+DC) insurance regulatory baseline — regulators, obligations, filing systems, and where each requirement applies in the operating model."
      />

      {/* Headline tiles */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          <Tile label="Jurisdictions" value={overview.jurisdictionCount} hint={`${overview.flags.priorityTier?.PRIORITY ?? 0} priority states`} />
          <Tile label="Active requirements" value={overview.requirements.total} hint={`${overview.flags.profileDepth?.FULL_PROFILE ?? 0} states with full profiles`} />
          <Tile label="Compliance rules" value={overview.ruleCount} hint="machine-readable, per state" />
          <Tile label="Monitored sources" value={overview.sourceCount} hint={`${overview.bulletinCount} bulletins on file`} />
        </div>
      )}

      {/* Lens tabs */}
      <div className="flex items-center gap-1 mb-4" role="tablist" aria-label="Regulations lenses">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={
              'rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ' +
              (tab === t ? 'bg-[#171717] text-white font-medium' : 'text-[#666666] font-medium hover:text-[#171717] hover:bg-[#f5f5f5]')
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'States' && (
        <StatesLens rows={jurisdictions ?? []} loading={jLoading} onOpen={(code) => navigate(`/regulations/${code}`)} />
      )}
      {tab === 'Requirements' && (
        <RequirementsLens
          rows={requirements ?? []}
          valueStreams={overview?.valueStreams ?? []}
          canEdit={canEdit}
          onLinksSaved={patchLinks}
          onOpenState={(code) => navigate(`/regulations/${code}`)}
        />
      )}
      {tab === 'Coverage' && (
        <CoverageLens rows={requirements ?? []} valueStreams={overview?.valueStreams ?? []} onOpenState={(code) => navigate(`/regulations/${code}`)} />
      )}
    </div>
  );
}

// ── States lens ───────────────────────────────────────────────────────────────
function StatesLens({ rows, loading, onOpen }: { rows: JurisdictionRow[]; loading: boolean; onOpen: (code: string) => void }) {
  const cols: SheetCol<JurisdictionRow>[] = [
    {
      key: 'state', label: 'State', width: 'minmax(0,1.2fr)', value: (r) => r.name,
      render: (r) => (
        <>
          <span className="truncate text-[12px] font-medium text-[#171717]">{r.name}</span>
          <span className="text-[11px] text-[#a3a3a3] tnum flex-shrink-0">{r.code}</span>
          {r.priorityTier === 'PRIORITY' && <span className="pill-amber flex-shrink-0">Priority</span>}
          {r.profileDepth === 'FULL_PROFILE' && <span className="pill-blue flex-shrink-0" title="Full compliance profile from the source document">Profile</span>}
        </>
      ),
    },
    { key: 'filingPortal', label: 'Filing portal', width: '130px', value: (r) => flagLabel(r.filingPortal), render: (r) => <FlagPill value={r.filingPortal} detail={r.filingPortalDetail} /> },
    { key: 'compact', label: 'Compact', width: '130px', value: (r) => flagLabel(r.compactStatus), render: (r) => <FlagPill value={r.compactStatus} /> },
    { key: 'wc', label: "Workers' comp", width: '150px', value: (r) => flagLabel(r.workersCompModel), render: (r) => <FlagPill value={r.workersCompModel} detail={r.workersCompDetail} /> },
    { key: 'apcd', label: 'APCD', width: '110px', value: (r) => flagLabel(r.apcd), render: (r) => <FlagPill value={r.apcd} /> },
    { key: 'sbs', label: 'SBS', width: '110px', value: (r) => flagLabel(r.sbs), render: (r) => <FlagPill value={r.sbs} /> },
    {
      key: 'reqs', label: 'Reqs', width: '60px', value: (r) => String(r._count.requirements), filterable: false,
      render: (r) => <span className="text-[12px] text-[#737373] tnum">{r._count.requirements}</span>,
    },
    { key: 'updated', label: 'Last updated', width: '110px', value: (r) => lastUpdated(r), filterable: false, sortable: false, dim: true },
  ];
  return (
    <Sheet
      rows={rows}
      cols={cols}
      rowKey={(r) => r.id}
      loading={loading}
      onRowClick={(r) => onOpen(r.code)}
      summarize={(v) => `${v.filter((r) => r.priorityTier === 'PRIORITY').length} priority states`}
    />
  );
}

// ── Requirements lens ─────────────────────────────────────────────────────────
function RequirementsLens({ rows, valueStreams, canEdit, onLinksSaved, onOpenState }: {
  rows: RequirementRow[];
  valueStreams: VsOption[];
  canEdit: boolean;
  onLinksSaved: (id: string, links: VsLink[]) => void;
  onOpenState: (code: string) => void;
}) {
  const cols: SheetCol<RequirementRow>[] = [
    {
      key: 'state', label: 'State', width: '80px', value: (r) => r.jurisdiction.code,
      render: (r) => <SheetCell text={r.jurisdiction.code} title={r.jurisdiction.name} onClick={() => onOpenState(r.jurisdiction.code)} />,
    },
    { key: 'title', label: 'Requirement', width: 'minmax(0,1.6fr)', value: (r) => r.title },
    { key: 'category', label: 'Category', width: '140px', value: (r) => catLabel(r.category), dim: true },
    { key: 'lob', label: 'Line of business', width: '140px', value: (r) => flagLabel(r.lineOfBusiness), dim: true },
    {
      key: 'obligation', label: 'Obligation', width: '130px', value: (r) => flagLabel(r.obligationType),
      render: (r) => r.obligationType === 'FILING_GATE'
        ? <span className="pill-amber">Filing gate</span>
        : <SheetCell text={flagLabel(r.obligationType)} dim />,
    },
    {
      key: 'confidence', label: 'Confidence', width: '120px', value: (r) => flagLabel(r.confidence),
      render: (r) => (
        <span className={r.confidence === 'VERIFIED' ? 'pill-green' : r.confidence === 'STALE' ? 'pill-red' : r.confidence === 'BASELINE' ? 'pill-slate' : 'pill-amber'}>
          {flagLabel(r.confidence)}
        </span>
      ),
    },
    {
      key: 'links', label: 'Value streams', width: 'minmax(0,1fr)',
      values: (r) => (r.valueStreamLinks.length ? r.valueStreamLinks.map((l) => l.valueStream.name) : ['— Unmapped —']),
      render: (r) => <span className="min-w-0 truncate"><LinkChips links={r.valueStreamLinks} /></span>,
    },
  ];
  return (
    <Sheet
      rows={rows}
      cols={cols}
      rowKey={(r) => r.id}
      summarize={(v) => `${new Set(v.map((r) => r.jurisdiction.code)).size} states · ${v.filter((r) => !r.valueStreamLinks.length).length} unmapped`}
      expand={(r) => <RequirementExpand r={r} valueStreams={valueStreams} canEdit={canEdit} onLinksSaved={onLinksSaved} />}
    />
  );
}

// Expansion panel for a requirement row: full text, citation, frequency, and
// (ADMIN/MANAGER) the inline value-stream links editor.
function RequirementExpand({ r, valueStreams, canEdit, onLinksSaved }: {
  r: RequirementRow; valueStreams: VsOption[]; canEdit: boolean; onLinksSaved: (id: string, links: VsLink[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="text-sm text-[#525252] leading-relaxed">
      {r.requirement}
      {r.citation && <div className="mt-1 text-xs text-[#a3a3a3]">Citation: {r.citation}</div>}
      {r.frequency && <div className="text-xs text-[#a3a3a3]">Frequency: {r.frequency}</div>}
      {canEdit && !editing && (
        <button onClick={() => setEditing(true)} className="mt-2 text-[11px] text-[#666666] hover:text-[#171717] underline decoration-[#d4d4d4] transition-colors duration-100">
          edit links
        </button>
      )}
      {editing && (
        <LinksEditor
          requirementId={r.id}
          links={r.valueStreamLinks}
          valueStreams={valueStreams}
          onSaved={(links) => { onLinksSaved(r.id, links); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// ── Coverage lens ─────────────────────────────────────────────────────────────
function CoverageLens({ rows, valueStreams, onOpenState }: {
  rows: RequirementRow[];
  valueStreams: VsOption[];
  onOpenState: (code: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const byStream = useMemo(() => {
    const map = new Map<string, RequirementRow[]>();
    for (const r of rows) for (const l of r.valueStreamLinks) {
      if (!map.has(l.valueStreamId)) map.set(l.valueStreamId, []);
      map.get(l.valueStreamId)!.push(r);
    }
    return map;
  }, [rows]);
  const unmapped = useMemo(() => rows.filter((r) => r.valueStreamLinks.length === 0), [rows]);
  // Streams with requirements first (by count), then untouched streams.
  const ordered = useMemo(() => [...valueStreams].sort((a, b) => (byStream.get(b.id)?.length ?? 0) - (byStream.get(a.id)?.length ?? 0) || a.name.localeCompare(b.name)), [valueStreams, byStream]);

  const Group = ({ id, name, reqs, tone }: { id: string; name: string; reqs: RequirementRow[]; tone?: 'warn' }) => {
    const states = [...new Set(reqs.map((r) => r.jurisdiction.code))];
    const expanded = open === id;
    return (
      <div className="border-b border-[#f5f5f5] last:border-0">
        <button
          className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-[#fafafa] transition-colors duration-100"
          onClick={() => setOpen(expanded ? null : id)}
          aria-expanded={expanded}
        >
          <span className={`text-sm font-medium ${tone === 'warn' ? 'text-[#be123c]' : 'text-[#171717]'}`}>{name}</span>
          <span className={reqs.length === 0 ? 'pill-slate' : tone === 'warn' ? 'pill-red' : 'pill-blue'}>{reqs.length} requirement{reqs.length === 1 ? '' : 's'}</span>
          {states.length > 0 && <span className="text-[11px] text-[#a3a3a3]">{states.length} state{states.length === 1 ? '' : 's'}</span>}
          <span className="flex-1" />
          <span className="text-[#a3a3a3] text-xs">{expanded ? '▾' : '▸'}</span>
        </button>
        {expanded && reqs.length > 0 && (
          <div className="pb-3 pl-1">
            {reqs.map((r) => (
              <div key={r.id + id} className="flex items-center gap-2 py-1 text-sm">
                <button onClick={() => onOpenState(r.jurisdiction.code)} className="w-9 flex-shrink-0 text-[11px] font-semibold tnum text-[#4338ca] hover:underline text-left">{r.jurisdiction.code}</button>
                <span className="text-[#262626] truncate">{r.title}</span>
                <span className="pill-slate flex-shrink-0">{catLabel(r.category)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <SectionCard title="Coverage by value stream">
      {unmapped.length > 0 && <Group id="__unmapped" name="Unmapped requirements" reqs={unmapped} tone="warn" />}
      {ordered.map((vs) => <Group key={vs.id} id={vs.id} name={vs.name} reqs={byStream.get(vs.id) ?? []} />)}
    </SectionCard>
  );
}
