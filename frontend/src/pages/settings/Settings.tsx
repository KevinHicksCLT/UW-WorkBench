import { useCompany } from '../../lib/company';
import PageHeader from '../../components/PageHeader';
import StartPageCard from '../../components/settings/StartPageCard';
import NotificationCard from '../../components/settings/NotificationCard';
import DashboardCard from '../../components/settings/DashboardCard';

// Personal settings — every preference here auto-saves to the per-user store
// (see lib/preferences). Available to every signed-in user regardless of
// permissions; the start-page picker only offers pages the user can read.
export default function Settings() {
  const { company } = useCompany();
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle="Your personal preferences — start page, notifications, and dashboard layout. Changes save automatically."
        eyebrow={company?.name}
        dense
      />
      <div className="space-y-3">
        <StartPageCard />
        <NotificationCard />
        <DashboardCard />
      </div>
    </div>
  );
}
