import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useRegisterCrumb } from '../../lib/breadcrumbs';
import { BackButton } from '../../components/ui';
import { RequirementsTable } from './RequirementsTable';

// Compliance bucket — /regulations/compliance. Requirements the user has
// flagged as a compliance practice the company actually follows, cutting
// across the International/Federal/State lenses (no lens param).

export default function Compliance() {
  useRegisterCrumb('Compliance');

  return (
    <div>
      <PageHeader
        eyebrow="Regulations"
        title="Compliance"
        subtitle="Requirements flagged as a compliance practice this company follows"
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
      <RequirementsTable baseParams={{ complianceFlagged: '1' }} variant="list" />
    </div>
  );
}
