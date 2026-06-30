import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import { useApi } from '../lib/useApi';
import { withCompany, Tile } from '../lib/portfolio';
import PageHeader from '../components/PageHeader';
import SkillViewer from '../components/SkillViewer';
import { skillLabel } from '../lib/skills';
import { Sheet, SheetCell, type SheetCol } from '../components/Sheet';
import { type VsLink } from '../components/RequirementLinks';

// Regulations — three lenses:
//   International: non-US / supranational regulators (EU/GDPR today).
//   Federal: the federal/national securities regime (FINRA/SEC/MSRB).
//   States (default): ONE table — the cross-state taxonomy matrix, where each
//     state row expands to that state's requirements (with regime CCPA/NYDFS,
//     category) and its value-stream coverage. States + Requirements + Coverage,
//     all in one table.

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
  frequency: string | null; status: string; confidence: string; agentSkill: string | null;
  jurisdiction: { id: string; code: string; name: string; priorityTier: string };
  valueStreamLinks: VsLink[];
};

type Overview = {
  jurisdictionCount: number;
  flags: Record<string, Record<string, number>>;
  requirements: { total: number; mapped: number; unmapped: number; byCategory: Record<string, number>; byConfidence: Record<string, number> };
  bulletinCount: number; ruleCount: number; sourceCount: number;
  verifiedJurisdictions: number;
};

const TABS = ['International', 'Federal', 'States'] as const;
type Tab = (typeof TABS)[number];

// Regulator-grouped lens shapes (GET /regulations/federal and /international).
type RegulatorReq = { id: string; title: string; agentSkill?: string | null };
type Regulator = {
  id: string; code: string; name: string; regulatorName: string;
  regulatorWebsite: string | null; level: string; summary: string | null;
  lastVerifiedAt: string | null; updatedAt: string;
  requirements: RegulatorReq[];
};
type RegulatorGroup = { country: string; countryCode: string; regulators: Regulator[] };

// Flag display helpers — normalized token → short label + pill tone.
const FLAG_PILL: Record<string, string> = {
  SERFF: 'pill-slate', PROPRIETARY: 'pill-red', MIXED: 'pill-amber',
  MEMBER: 'pill-green', NON_MEMBER: 'pill-red',
  YES: 'pill-green', NO: 'pill-slate', PARTIAL: 'pill-amber', EMERGING: 'pill-amber', TRANSITIONING: 'pill-amber',
  EDI: 'pill-green', NON_EDI: 'pill-slate', MONOPOLISTIC_FUND: 'pill-blue', STATE_SPECIFIC: 'pill-amber',
};
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
  DATA_CALL: 'Data call', CYBERSECURITY: 'Cybersecurity', DATA_PRIVACY: 'Data privacy', OTHER: 'Other',
};
export const catLabel = (c: string) => CATEGORY_LABEL[c] ?? flagLabel(c);

function lastUpdated(r: { lastVerifiedAt: string | null; updatedAt: string }) {
  const d = new Date(r.lastVerifiedAt ?? r.updatedAt);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function Regulations() {
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const [tab, setTab] = useState<Tab>('States');
  const [viewSkill, setViewSkill] = useState<string | null>(null);

  const { data: overview } = useApi<Overview>(companyId ? withCompany('/regulations/overview', companyId) : null);
  const { data: jurisdictions, loading: jLoading } = useApi<JurisdictionRow[]>(companyId ? withCompany('/regulations/jurisdictions', companyId) : null);
  const { data: federal, loading: fLoading } = useApi<{ groups: RegulatorGroup[] }>(companyId ? withCompany('/regulations/federal', companyId) : null);
  const { data: international, loading: iLoading } = useApi<{ groups: RegulatorGroup[] }>(companyId ? withCompany('/regulations/international', companyId) : null);

  const [requirements, setRequirements] = useState<RequirementRow[] | null>(null);
  useEffect(() => {
    if (!companyId) return;
    api.get(withCompany('/regulations/requirements', companyId)).then(setRequirements).catch(() => setRequirements([]));
  }, [companyId]);

  return (
    <div>
      <PageHeader
        title="Regulations"
        subtitle="The 50-state (+DC) insurance regulatory baseline plus the federal/national (FINRA/SEC/MSRB) and international (EU/GDPR) regimes — regulators, obligations, filing systems, and where each requirement applies in the operating model."
      />

      {/* Headline tiles — compact strip */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          <Tile compact label="Jurisdictions" value={overview.jurisdictionCount} hint={`${overview.flags.priorityTier?.PRIORITY ?? 0} priority states`} />
          <Tile compact label="Active requirements" value={overview.requirements.total} hint={`${overview.flags.profileDepth?.FULL_PROFILE ?? 0} states with full profiles`} />
          <Tile compact label="Compliance rules" value={overview.ruleCount} hint="machine-readable" />
          <Tile compact label="Monitored sources" value={overview.sourceCount} hint={`${overview.bulletinCount} bulletins`} />
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

      {tab === 'International' && <RegulatorLens groups={international?.groups ?? []} loading={iLoading} unit="regulators" emptyText="No international regulators on file." onOpen={(code) => navigate(`/regulations/${code}`)} onSkill={setViewSkill} />}
      {tab === 'Federal' && <RegulatorLens groups={federal?.groups ?? []} loading={fLoading} unit="regulators" emptyText="No federal / national regulators on file." onOpen={(code) => navigate(`/regulations/${code}`)} onSkill={setViewSkill} />}
      {tab === 'States' && (
        <StatesLens
          rows={jurisdictions ?? []}
          loading={jLoading || requirements === null}
          requirements={requirements ?? []}
          onOpen={(code) => navigate(`/regulations/${code}`)}
        />
      )}

      {viewSkill && <SkillViewer skill={viewSkill} onClose={() => setViewSkill(null)} />}
    </div>
  );
}

// ── States lens — one table; each state row expands to its requirements + coverage ─
function StatesLens({ rows, loading, requirements, onOpen }: {
  rows: JurisdictionRow[]; loading: boolean; requirements: RequirementRow[];
  onOpen: (code: string) => void;
}) {
  const byCode = new Map<string, RequirementRow[]>();
  for (const r of requirements) {
    const k = r.jurisdiction.code;
    if (!byCode.has(k)) byCode.set(k, []);
    byCode.get(k)!.push(r);
  }
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
    { key: 'wc', label: "Workers' comp", width: '140px', value: (r) => flagLabel(r.workersCompModel), render: (r) => <FlagPill value={r.workersCompModel} detail={r.workersCompDetail} /> },
    { key: 'apcd', label: 'APCD', width: '100px', value: (r) => flagLabel(r.apcd), render: (r) => <FlagPill value={r.apcd} /> },
    { key: 'sbs', label: 'SBS', width: '100px', value: (r) => flagLabel(r.sbs), render: (r) => <FlagPill value={r.sbs} /> },
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
      unit="states"
      summarize={(v) => `${v.filter((r) => r.priorityTier === 'PRIORITY').length} priority states`}
      expand={(r) => <StateRequirements name={r.name} reqs={byCode.get(r.code) ?? []} onOpen={() => onOpen(r.code)} />}
    />
  );
}

// A state's requirements + value-stream coverage, shown inline under its row as a
// clean, aligned sub-table (plain text, no tags).
const REQ_GRID = 'grid grid-cols-[minmax(0,2fr)_180px_minmax(0,1.6fr)] gap-3';
function StateRequirements({ name, reqs, onOpen }: { name: string; reqs: RequirementRow[]; onOpen: () => void }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{reqs.length} requirement{reqs.length === 1 ? '' : 's'}</span>
        <span className="flex-1" />
        <button onClick={(e) => { e.stopPropagation(); onOpen(); }} className="text-[11px] text-[#0070AD] hover:underline">View full {name} profile</button>
      </div>
      {reqs.length === 0 ? (
        <div className="text-xs text-[#a3a3a3] italic">No requirements on file for {name}.</div>
      ) : (
        <div>
          <div className={`${REQ_GRID} text-[10px] font-semibold uppercase tracking-[0.07em] text-[#a3a3a3] pb-1.5 border-b border-[#eaeaea]`}>
            <span>Requirement</span><span>Category</span><span>Value streams</span>
          </div>
          {reqs.map((r) => (
            <div key={r.id} className={`${REQ_GRID} py-1.5 text-sm border-b border-[#f5f5f5] last:border-0`}>
              <span className="text-[#262626] truncate" title={r.requirement}>{r.title}</span>
              <span className="text-[#525252] truncate">{catLabel(r.category)}</span>
              <span className="text-[#525252] truncate" title={r.valueStreamLinks.map((l) => l.valueStream.name).join(', ')}>
                {r.valueStreamLinks.length ? r.valueStreamLinks.map((l) => l.valueStream.name).join(', ') : <span className="text-[#d4d4d4]">—</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Regulator-grouped lens (International + Federal) ────────────────────────────
type RegulatorRow = Regulator & { country: string };

function RegulatorLens({ groups, loading, unit, emptyText, onOpen, onSkill }: {
  groups: RegulatorGroup[]; loading: boolean; unit: string; emptyText: string;
  onOpen: (code: string) => void; onSkill: (s: string) => void;
}) {
  const rows: RegulatorRow[] = groups.flatMap((g) => g.regulators.map((r) => ({ ...r, country: g.country })));
  const skillsOf = (r: Regulator) => [...new Set(r.requirements.map((q) => q.agentSkill).filter((s): s is string => !!s))];
  const cols: SheetCol<RegulatorRow>[] = [
    {
      key: 'regulator', label: 'Regulator', width: 'minmax(0,1.2fr)', value: (r) => r.regulatorName,
      render: (r) => (
        <>
          <span className="truncate text-[12px] font-medium text-[#171717]">{r.regulatorName}</span>
          <span className="text-[11px] text-[#a3a3a3] tnum flex-shrink-0">{r.code}</span>
        </>
      ),
    },
    { key: 'level', label: 'Level', width: 'minmax(0,1fr)', value: (r) => r.level, render: (r) => <span className="pill-slate">{r.level}</span> },
    { key: 'country', label: 'Country / region', width: '160px', value: (r) => r.country, dim: true },
    {
      key: 'reqs', label: 'Reqs', width: '60px', value: (r) => String(r.requirements.length), filterable: false,
      render: (r) => <span className="text-[12px] text-[#737373] tnum">{r.requirements.length}</span>,
    },
    { key: 'updated', label: 'Last updated', width: '110px', value: (r) => lastUpdated(r), filterable: false, sortable: false, dim: true },
  ];
  return (
    <Sheet
      rows={rows}
      cols={cols}
      rowKey={(r) => r.id}
      loading={loading}
      unit={unit}
      emptyText={emptyText}
      summarize={(v) => `${v.reduce((s, r) => s + r.requirements.length, 0)} requirements`}
      expand={(r) => {
        const skills = skillsOf(r);
        return (
          <div className="text-sm text-[#525252] leading-relaxed">
            {r.summary && <p className="mb-2">{r.summary}</p>}
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">{skills.map((s) => <SkillChip key={s} skill={s} onOpen={onSkill} />)}</div>
            )}
            <button onClick={(e) => { e.stopPropagation(); onOpen(r.code); }} className="text-[11px] text-[#0070AD] hover:underline">View full regulator profile →</button>
          </div>
        );
      }}
    />
  );
}

// Agent-skill / regime chip — reuses the Standards SkillViewer.
function SkillChip({ skill, onOpen }: { skill: string; onOpen: (s: string) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(skill); }}
      className="inline-flex items-center gap-1.5 flex-shrink-0 text-xs font-medium text-[#0070AD] bg-[#eef6fb] hover:bg-[#e0f0fb] px-2.5 py-1 rounded-md transition-colors"
      title={`Regime skill: ${skill} — view & download`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.6L19.5 9l-4.6 3.3 1.8 5.7L12 14.7 7.3 18l1.8-5.7L4.5 9l5.6-.4z" /></svg>
      {skillLabel(skill)}
      <span className="text-[#0070AD]/50">· view</span>
    </button>
  );
}
