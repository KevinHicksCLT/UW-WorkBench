import { Card } from '../../components/ui';
import ApplicationRationalization from '../greenfield-migration/GreenfieldMigration';

// Workspace — the Application Rationalization Workspace, full width. No page
// title: the nav + breadcrumb already say "Workspace" (WR feedback 2026-07-06).
// D7.2: the Portfolio, Programs, Risks and RAID Log views moved to Home (D1.5)
// as dashboard widgets; their detail pages live under Home too
// (/programs/:id, /initiatives/:id and /raid — old /portfolio/* links redirect).

export default function Portfolio() {
  return (
    <Card variant="elevated" className="p-4 border-l-[3px] border-l-[#4f46e5]">
      <ApplicationRationalization embedded />
    </Card>
  );
}
