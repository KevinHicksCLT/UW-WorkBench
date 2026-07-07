import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCompany } from '../../lib/company';
import { useApi } from '../../lib/useApi';
import { withCompany, Tile, SectionCard } from '../../lib/portfolio';
import PageHeader from '../../components/PageHeader';
import { useRegisterCrumb } from '../../lib/breadcrumbs';
import { BackButton, EmptyState, Input, LoadingState, StatusPill } from '../../components/ui';
import { type VsLink } from '../../components/RequirementLinks';
import { catLabel, regimeHelp } from './Regulations';

// Regulation (regime) page — /regulations/regulation/:regime. One named
// regulation (GDPR, CCPA-CPRA, SERFF, NYDFS-500, …) and every atomic
// requirement it imposes, across jurisdictions. Data comes from the same
// /regulations/requirements endpoint the main table uses (single source of
// truth) — filtered server-side by regime.

type ReqRow = {
  id: string;
  title: string;
  requirement: string;
  category: string;
  lineOfBusiness: string;
  obligationType: string;
  jurisdiction: { code: string; name: string };
  valueStreamLinks: VsLink[];
  owner: { id: string; name: string } | null;
};

const label = (v: string) =>
  v
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

export default function RegimeDetail() {
  const { regime } = useParams();
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const name = regime ? decodeURIComponent(regime) : '';
  useRegisterCrumb(name || 'Regulation');
  const [query, setQuery] = useState('');
  const [mappedOnly, setMappedOnly] = useState(false);

  const { data: rows, loading } = useApi<ReqRow[]>(
    companyId && name
      ? withCompany(`/regulations/requirements?regime=${encodeURIComponent(name)}`, companyId)
      : null,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (mappedOnly && !r.valueStreamLinks.length) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.requirement.toLowerCase().includes(q) ||
        r.jurisdiction.name.toLowerCase().includes(q) ||
        catLabel(r.category).toLowerCase().includes(q)
      );
    });
  }, [rows, query, mappedOnly]);

  if (loading || !rows) return <LoadingState />;

  const jurisdictions = new Set(rows.map((r) => r.jurisdiction.code));
  const mapped = rows.filter((r) => r.valueStreamLinks.length).length;

  return (
    <div>
      <PageHeader
        eyebrow="Regulations · Regulation"
        title={name}
        subtitle={`${rows.length} requirements across ${jurisdictions.size} jurisdiction${jurisdictions.size === 1 ? '' : 's'}`}
        actions={
          <div className="flex items-center gap-2">
            <BackButton />
            <Link
              to="/regulations"
              className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150"
            >
              All regulations
            </Link>
          </div>
        }
      />

      {/* What this regulation IS — static copy keyed by regime name. */}
      <p className="text-sm text-[#525252] leading-relaxed mb-5 max-w-3xl">{regimeHelp(name)}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
        <Tile
          compact
          label="Requirements"
          value={rows.length}
          onClick={() => setMappedOnly(false)}
        />
        <Tile compact label="Jurisdictions" value={jurisdictions.size} />
        <Tile
          compact
          label="Mapped"
          value={mapped}
          hint="linked to value streams"
          onClick={() => setMappedOnly(true)}
        />
      </div>

      <SectionCard
        title={`${mappedOnly ? 'Mapped requirements' : 'Requirements'} (${filtered.length})`}
        actions={
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search requirements…"
            aria-label="Search requirements"
            className="max-w-xs"
          />
        }
      >
        {rows.length === 0 && (
          <EmptyState message="No requirements recorded for this regulation." />
        )}
        {rows.length > 0 && filtered.length === 0 && (
          <EmptyState message="No requirements match." />
        )}
        <div className="divide-y divide-[#f5f5f5]">
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => navigate(`/regulations/requirement/${r.id}`)}
              className="w-full text-left py-2.5 hover:bg-[#fafafa] -mx-2 px-2 rounded-md transition-colors duration-100 group"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#171717] group-hover:underline truncate">
                  {r.title}
                </span>
                <span className="text-[11px] text-[#a3a3a3] flex-shrink-0">
                  {r.jurisdiction.name}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <StatusPill tone="slate">{catLabel(r.category)}</StatusPill>
                <StatusPill tone="slate">
                  {r.lineOfBusiness === 'ALL' ? 'All lines' : label(r.lineOfBusiness)}
                </StatusPill>
                {r.obligationType === 'FILING_GATE' && (
                  <StatusPill tone="amber">Filing gate</StatusPill>
                )}
                {r.owner && (
                  <span className="text-xs text-[#a3a3a3]">
                    Owner:{' '}
                    <span
                      className="text-[#525252] hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/roles/${r.owner!.id}`);
                      }}
                    >
                      {r.owner.name}
                    </span>
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
