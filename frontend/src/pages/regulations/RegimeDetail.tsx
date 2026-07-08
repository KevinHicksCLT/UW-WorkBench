import { Link, useParams } from 'react-router-dom';
import { useCompany } from '../../lib/company';
import { useApi } from '../../lib/useApi';
import { withCompany, Tile } from '../../lib/portfolio';
import PageHeader from '../../components/PageHeader';
import { useRegisterCrumb } from '../../lib/breadcrumbs';
import { BackButton } from '../../components/ui';
import { catLabel, regimeHelp } from './Regulations';
import { RequirementsTable } from './RequirementsTable';

// Regulation (regime) profile — /regulations/regulation/:regime. The complete
// profile of one named regulation (GDPR, FINRA Rule 2111, NAIC Model Audit
// Rule…): what it is, headline stats, the jurisdictions/markets/categories it
// spans, and every atomic requirement it imposes (the shared server-driven
// table filtered by regime). Single source of truth = the DB.

type Profile = {
  requirements: number;
  jurisdictions: { code: string; name: string }[];
  categories: string[];
  markets: { personal: number; commercial: number; both: number };
  level: string;
};

const marketSummary = (m: Profile['markets']): string => {
  const parts: string[] = [];
  if (m.both) parts.push('both markets');
  if (m.personal) parts.push('personal-only');
  if (m.commercial) parts.push('commercial-only');
  return parts.join(' · ') || '—';
};

export default function RegimeDetail() {
  const { regime } = useParams();
  const { companyId } = useCompany();
  const name = regime ? decodeURIComponent(regime) : '';
  useRegisterCrumb(name || 'Regulation');

  const { data: p } = useApi<Profile>(
    companyId && name
      ? withCompany(`/regulations/regime-profile?regime=${encodeURIComponent(name)}`, companyId)
      : null,
  );

  return (
    <div>
      <PageHeader
        eyebrow={p ? `Regulations · ${p.level}` : 'Regulations · Regulation'}
        title={name}
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
      <p className="text-sm text-[#525252] leading-relaxed mb-4 max-w-3xl">{regimeHelp(name)}</p>

      {/* Headline profile stats */}
      {p && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          <Tile
            compact
            label="Requirements"
            value={p.requirements.toLocaleString()}
            hint="atomic obligations"
          />
          <Tile
            compact
            label={p.level === 'State' ? 'Jurisdictions' : 'Regulators'}
            value={p.jurisdictions.length}
            hint={p.jurisdictions
              .slice(0, 3)
              .map((j) => j.name)
              .join(', ')}
          />
          <Tile compact label="Markets" value={marketSummary(p.markets)} />
          <Tile
            compact
            label="Categories"
            value={p.categories.length}
            hint={p.categories.slice(0, 3).map(catLabel).join(', ')}
          />
        </div>
      )}

      <RequirementsTable baseParams={{ regime: name }} variant="list" />
    </div>
  );
}
