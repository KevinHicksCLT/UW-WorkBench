import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { can } from '../../lib/permissions';
import { useCompany } from '../../lib/company';
import { withCompany, SectionCard } from '../../lib/portfolio';
import PageHeader from '../../components/PageHeader';
import AssistantMarkdown from '../../components/AssistantMarkdown';
import {
  LinkChips,
  LinksEditor,
  type VsLink,
  type VsOption,
} from '../../components/RequirementLinks';
import { catLabel } from '../regulations/Regulations';
import { BackButton, ErrorMessage, LoadingState, StatusPill } from '../../components/ui';

// State detail — /regulations/:code. Regulator identity + taxonomy flags in the
// header; sections for the compliance profile (FULL_PROFILE states), the
// requirement list (with the inline value-stream link editor), integration
// systems, bulletins, machine-readable compliance rules, and monitored sources.

type RoleRef = { id: string; name: string };
type Requirement = {
  id: string;
  category: string;
  title: string;
  requirement: string;
  lineOfBusiness: string;
  citation: string | null;
  citationUrl: string | null;
  obligationType: string;
  frequency: string | null;
  status: string;
  confidence: string;
  regime: string | null;
  sourceNote: string | null;
  valueStreamLinks: VsLink[];
  owner: RoleRef | null;
  contributors: RoleRef[];
};
type Detail = {
  id: string;
  code: string;
  name: string;
  regulatorType: string;
  regulatorName: string;
  regulatorWebsite: string | null;
  filingPortal: string;
  filingPortalDetail: string | null;
  compactStatus: string;
  autoVerification: string;
  autoVerificationDetail: string | null;
  workersCompModel: string;
  workersCompDetail: string | null;
  apcd: string;
  sbs: string;
  statutoryAuthority: string | null;
  summaryRegulator: string | null;
  summaryStatutes: string | null;
  summaryIntegration: string | null;
  executiveSummary: string | null;
  operatingModel: string | null;
  priorityTier: string;
  profileDepth: string;
  lastReviewedAt: string | null;
  lastVerifiedAt: string | null;
  updatedAt: string;
  requirements: Requirement[];
  integrations: {
    id: string;
    usage: string;
    scope: string;
    notes: string | null;
    system: {
      id: string;
      name: string;
      kind: string;
      operator: string;
      website: string | null;
      description: string | null;
    };
  }[];
  bulletins: {
    id: string;
    reference: string;
    title: string;
    summary: string | null;
    url: string | null;
    issuedDate: string | null;
    discoveredVia: string;
  }[];
  rules: {
    id: string;
    ruleCode: string;
    category: string;
    description: string | null;
    ruleJson: unknown;
    origin: string;
    active: boolean;
  }[];
  sources: {
    id: string;
    name: string;
    url: string;
    sourceType: string;
    authority: string;
    monitor: boolean;
    checkTier: string;
    healthStatus: string;
  }[];
};

const USAGE_PILL: Record<string, string> = {
  REQUIRED: 'pill-green',
  ACCEPTED: 'pill-blue',
  TRANSITIONING: 'pill-amber',
  NOT_USED: 'pill-slate',
};

// Spelled-out filing facts — plain-English values for the state taxonomy
// codes, limited to what matters when applying a requirement here.
const FILING_PORTAL_TEXT: Record<string, string> = {
  SERFF: 'File electronically through SERFF (the NAIC filing system)',
  PROPRIETARY: "File through the state's own portal — SERFF not accepted",
  MIXED: "SERFF for most filings, plus the state's own portal for some",
};
const COMPACT_TEXT: Record<string, string> = {
  MEMBER: 'Member — one IIPRC filing covers life/annuity products here and in other member states',
  NON_MEMBER: 'Not a member — life/annuity products must be filed with this state separately',
};
const WC_TEXT: Record<string, string> = {
  EDI: 'Report claims electronically (IAIABC EDI — FROI/SROI)',
  NON_EDI: 'Report claims manually or via the state portal — no EDI mandate',
  MIXED: 'EDI for some reports, manual/portal for others',
  MONOPOLISTIC_FUND: "Coverage only through the state's monopolistic fund — no private market",
  STATE_SPECIFIC: 'State-specific reporting arrangement — check the requirements below',
};
const AUTO_TEXT: Record<string, string> = {
  YES: 'Insured vehicles must be reported to the state verification system',
  NO: 'No continuous verification reporting required',
  PARTIAL: 'Verification reporting required in limited cases',
  EMERGING: 'Verification program being introduced — watch for reporting duties',
  TRANSITIONING: 'Verification program changing — reporting duties in flux',
};
const APCD_TEXT: Record<string, string> = {
  YES: 'Health claims must be submitted to the state all-payer claims database',
  NO: 'No all-payer claims database mandate',
  PARTIAL: 'Limited all-payer claims database reporting',
  EMERGING: 'All-payer claims database being introduced',
};

/** One filing fact — label + plain-English value (+ optional state detail). */
function FilingFact({
  name,
  value,
  detail,
}: {
  name: string;
  value: string;
  detail?: string | null;
}) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="w-40 flex-shrink-0 text-xs text-[#a3a3a3]">{name}</span>
      <span className="text-[#262626]" title={detail ?? undefined}>
        {value}
      </span>
    </div>
  );
}
const label = (v: string) =>
  v
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

export default function RegulationDetail() {
  const { code } = useParams();
  const { permissions } = useAuth();
  const { companyId } = useCompany();
  const canEdit = can(permissions, 'regulations', 'update');

  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [openRule, setOpenRule] = useState<string | null>(null);
  const [valueStreams, setValueStreams] = useState<VsOption[]>([]);

  useEffect(() => {
    if (!companyId || !code) return;
    api
      .get<Detail>(withCompany(`/regulations/jurisdictions/${code}`, companyId))
      .then(setDetail)
      .catch((e) => setError(e.message));
    api
      .get<{ valueStreams?: VsOption[] }>(withCompany('/regulations/overview', companyId))
      .then((o) => setValueStreams(o.valueStreams ?? []))
      .catch(() => {});
  }, [companyId, code]);

  if (error) {
    return (
      <div>
        <PageHeader title="Regulations" />
        <ErrorMessage>
          {error === 'Not found' ? `No jurisdiction "${code}" found.` : error}
        </ErrorMessage>
        <Link to="/regulations" className="text-sm text-[#4338ca] underline">
          Back to Regulations
        </Link>
      </div>
    );
  }
  if (!detail) return <LoadingState />;

  const patchLinks = (id: string, links: VsLink[]) =>
    setDetail(
      (prev) =>
        prev && {
          ...prev,
          requirements: prev.requirements.map((r) =>
            r.id === id ? { ...r, valueStreamLinks: links } : r,
          ),
        },
    );

  // Only US state insurance regulators carry the state taxonomy flags and
  // state-only sections (filing facts, integrations, agent rules, sources).
  // Federal agencies and international regulators hide them.
  const isFederal = detail.regulatorType !== 'STATE_INSURANCE_REGULATOR';

  return (
    <div>
      <PageHeader
        eyebrow="Regulations"
        title={detail.name}
        subtitle={
          detail.regulatorName +
          (detail.statutoryAuthority ? ` · ${detail.statutoryAuthority}` : '')
        }
        actions={
          <div className="flex items-center gap-2">
            <BackButton />
            {detail.regulatorWebsite && (
              <a
                href={detail.regulatorWebsite}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150"
              >
                Regulator site ↗
              </a>
            )}
            <Link
              to="/regulations"
              className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150"
            >
              {isFederal ? 'All regulations' : 'All states'}
            </Link>
          </div>
        }
      />

      {/* Filing facts — what you need to know to comply in this state, spelled
          out (research-metadata flags like SBS/priority/profile depth are
          intentionally not shown). */}
      {isFederal ? (
        detail.summaryRegulator && (
          <div className="mb-6 text-sm text-[#525252] leading-relaxed">
            {detail.summaryRegulator}
          </div>
        )
      ) : (
        <div className="mb-6 space-y-1.5">
          <FilingFact
            name="Product filing"
            value={FILING_PORTAL_TEXT[detail.filingPortal] ?? label(detail.filingPortal)}
            detail={detail.filingPortalDetail}
          />
          <FilingFact
            name="Insurance Compact"
            value={COMPACT_TEXT[detail.compactStatus] ?? label(detail.compactStatus)}
          />
          <FilingFact
            name="Workers' comp claims"
            value={WC_TEXT[detail.workersCompModel] ?? label(detail.workersCompModel)}
            detail={detail.workersCompDetail}
          />
          <FilingFact
            name="Auto verification"
            value={AUTO_TEXT[detail.autoVerification] ?? label(detail.autoVerification)}
            detail={detail.autoVerificationDetail}
          />
          <FilingFact
            name="Health claims (APCD)"
            value={APCD_TEXT[detail.apcd] ?? label(detail.apcd)}
          />
          <div className="text-xs text-[#a3a3a3]">
            {detail.lastVerifiedAt &&
              `Verified ${new Date(detail.lastVerifiedAt).toLocaleDateString()} · `}
            Updated {new Date(detail.updatedAt).toLocaleDateString()}
          </div>
        </div>
      )}

      <div className="space-y-5">
        {detail.executiveSummary && (
          <SectionCard title="Executive summary">
            <AssistantMarkdown content={detail.executiveSummary} />
            {detail.operatingModel && (
              <details className="mt-3">
                <summary className="text-xs font-medium text-[#666666] cursor-pointer hover:text-[#171717]">
                  Operating model detail
                </summary>
                <div className="mt-2">
                  <AssistantMarkdown content={detail.operatingModel} />
                </div>
              </details>
            )}
          </SectionCard>
        )}

        <SectionCard title={`Requirements (${detail.requirements.length})`}>
          <div className="-mx-5 -mb-5 rounded-b-lg overflow-hidden">
            {detail.requirements.map((r, i) => (
              <div
                key={r.id}
                className={
                  'px-5 py-2.5 border-b border-[#f0f0f0] last:border-0 ' +
                  (i % 2 ? 'bg-[#f6f6f6]' : 'bg-white')
                }
              >
                <Link
                  to={`/regulations/requirement/${r.id}`}
                  className="text-sm font-medium text-[#171717] hover:underline"
                >
                  {r.title}
                </Link>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {r.regime && (
                    <Link to={`/regulations/regulation/${encodeURIComponent(r.regime)}`}>
                      <StatusPill
                        tone="blue"
                        className="hover:underline"
                        title="Open regulation page"
                      >
                        {r.regime}
                      </StatusPill>
                    </Link>
                  )}
                  <StatusPill tone="slate">{catLabel(r.category)}</StatusPill>
                  {r.lineOfBusiness !== 'ALL' && (
                    <StatusPill tone="slate">{label(r.lineOfBusiness)}</StatusPill>
                  )}
                  <LinkChips links={r.valueStreamLinks} />
                  {canEdit && (
                    <button
                      onClick={() => setEditing(editing === r.id ? null : r.id)}
                      className="text-[11px] text-[#666666] hover:text-[#171717] underline decoration-[#d4d4d4] transition-colors duration-100"
                    >
                      {editing === r.id ? 'close' : 'edit links'}
                    </button>
                  )}
                </div>
                <p className="text-sm text-[#525252] leading-relaxed mt-1.5">{r.requirement}</p>
                <div className="flex flex-wrap gap-x-4 mt-1 text-xs text-[#a3a3a3]">
                  {r.owner && (
                    <span>
                      Owner:{' '}
                      <Link to={`/roles/${r.owner.id}`} className="text-[#525252] hover:underline">
                        {r.owner.name}
                      </Link>
                    </span>
                  )}
                  {r.contributors.length > 0 && (
                    <span>
                      Contributors:{' '}
                      {r.contributors.map((c, i) => (
                        <span key={c.id}>
                          {i > 0 && ', '}
                          <Link to={`/roles/${c.id}`} className="text-[#525252] hover:underline">
                            {c.name}
                          </Link>
                        </span>
                      ))}
                    </span>
                  )}
                  {r.citation && <span>Citation: {r.citation}</span>}
                  {r.frequency && <span>Frequency: {r.frequency}</span>}
                </div>
                {editing === r.id && (
                  <>
                    {/* What editing applicability actually does (SCRUM-40). */}
                    <p className="text-[11px] text-[#a3a3a3] mt-2 leading-relaxed">
                      Linking a value stream applies this regulation to every task under it;
                      removing a link withdraws it. Task lists, the Inspector&apos;s Governance tab,
                      and the coverage rollups all update from those task links.
                    </p>
                    <LinksEditor
                      requirementId={r.id}
                      links={r.valueStreamLinks}
                      valueStreams={valueStreams}
                      onSaved={(links) => {
                        patchLinks(r.id, links);
                        setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {!isFederal && (
          <SectionCard title={`Integration & electronic systems (${detail.integrations.length})`}>
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[#525252] border-b border-[#eaeaea]">
                    <th className="py-2 pr-3">System</th>
                    <th className="py-2 pr-3">Kind</th>
                    <th className="py-2 pr-3 text-center">Usage</th>
                    <th className="py-2 pr-3">Scope</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.integrations.map((i) => (
                    <tr key={i.id} className="border-b border-[#f5f5f5]">
                      <td
                        className="py-2 pr-3 font-medium text-[#171717]"
                        title={i.system.description ?? undefined}
                      >
                        {i.system.website ? (
                          <a
                            href={i.system.website}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {i.system.name}
                          </a>
                        ) : (
                          i.system.name
                        )}
                      </td>
                      <td className="py-2 pr-3 text-[#525252]">
                        {label(i.system.kind)} · {i.system.operator}
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <span className={USAGE_PILL[i.usage] ?? 'pill-slate'}>
                          {label(i.usage)}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-[#525252]">{i.scope}</td>
                      <td className="py-2 text-[#a3a3a3] text-xs">{i.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {/* Agent rules — machine-readable controls (state-derived today). */}
        {detail.rules.length > 0 && (
          <SectionCard title={`Agent rules (${detail.rules.length})`}>
            <p className="text-xs text-[#a3a3a3] mb-3">
              Machine-readable rules derived from this regulator&apos;s requirements — encoded so
              agents can run compliance checks against them. A requirement states the legal
              obligation; an agent rule is the checkable control for it. Automated execution is a
              future phase.
            </p>
            <div className="divide-y divide-[#f5f5f5]">
              {detail.rules.map((r) => (
                <div key={r.id} className="py-2">
                  <button
                    className="flex items-center gap-2 w-full text-left group"
                    onClick={() => setOpenRule(openRule === r.id ? null : r.id)}
                    aria-expanded={openRule === r.id}
                    title="Expand the machine-readable rule"
                  >
                    <span className="text-sm font-medium tnum text-[#171717] group-hover:underline">
                      {r.ruleCode}
                    </span>
                    <span className="flex-1" />
                    <span className="text-[#a3a3a3] text-xs">{openRule === r.id ? '▾' : '▸'}</span>
                  </button>
                  {r.description && (
                    <p className="text-xs text-[#525252] mt-0.5">{r.description}</p>
                  )}
                  {openRule === r.id && (
                    <pre className="mt-2 rounded-lg bg-[#fafafa] border border-[#eaeaea] p-3 text-[11px] text-[#262626] overflow-x-auto">
                      {JSON.stringify(r.ruleJson, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Regulatory sources — shown for every regulator (state, federal, international). */}
        <SectionCard title={`Regulatory sources (${detail.sources.length})`}>
          <p className="text-xs text-[#a3a3a3] mb-2">
            The official sites and feeds this regulator&apos;s requirements come from — including
            the pages where it posts bulletins and notices. Automated monitoring is a future phase —
            nothing is polled today.
          </p>
          {detail.sources.length === 0 ? (
            <p className="text-sm text-[#a3a3a3]">No sources on file for this regulator yet.</p>
          ) : (
            <div className="divide-y divide-[#f5f5f5]">
              {detail.sources.map((s) => (
                <div key={s.id} className="flex items-center gap-2 py-2 text-sm">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[#171717] hover:underline truncate"
                  >
                    {s.name} ↗
                  </a>
                  <StatusPill tone="slate">{label(s.sourceType)}</StatusPill>
                  <StatusPill tone={s.authority === 'OFFICIAL_REGULATOR' ? 'green' : 'blue'}>
                    {label(s.authority)}
                  </StatusPill>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
