import PageHeader from '../components/PageHeader';
import { Card } from '../components/ui';
import ApplicationRationalization from './GreenfieldMigration';

// Workspace — the Application Rationalization Workspace, full width.
// D7.2: the Portfolio, Programs, Risks and RAID Log views moved to Home (D1.5)
// as dashboard widgets; their detail pages live under Home too
// (/programs/:id, /initiatives/:id and /raid — old /portfolio/* links redirect).

export default function Portfolio() {
  return (
    <div>
      <PageHeader title="Workspace" />
      <Card variant="elevated" className="p-4 border-l-[3px] border-l-[#4f46e5]">
        <ApplicationRationalization embedded />
      </Card>
    </div>
  );
}
