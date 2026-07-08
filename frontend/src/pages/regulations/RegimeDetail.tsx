import { Link, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useRegisterCrumb } from '../../lib/breadcrumbs';
import { BackButton } from '../../components/ui';
import { regimeHelp } from './Regulations';
import { RequirementsTable } from './RequirementsTable';

// Regulation (regime) page — /regulations/regulation/:regime. One named
// regulation (GDPR, SERFF, NAIC RBC, …) and every atomic requirement it
// imposes, across jurisdictions and lines. The list is the shared server-driven
// paginated table filtered by regime (single source of truth = the DB).

export default function RegimeDetail() {
  const { regime } = useParams();
  const name = regime ? decodeURIComponent(regime) : '';
  useRegisterCrumb(name || 'Regulation');

  return (
    <div>
      <PageHeader
        eyebrow="Regulations · Regulation"
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
      <p className="text-sm text-[#525252] leading-relaxed mb-5 max-w-3xl">{regimeHelp(name)}</p>

      <RequirementsTable baseParams={{ regime: name }} />
    </div>
  );
}
