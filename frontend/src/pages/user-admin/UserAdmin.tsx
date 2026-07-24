import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useViewState } from '../../lib/viewState';
import { useCompany } from '../../lib/company';
import PageHeader from '../../components/PageHeader';
import UsersAdmin from '../../components/user-admin/UsersAdmin';
import PermissionSetsAdmin from '../../components/user-admin/PermissionSetsAdmin';
import UserImportAdmin from '../../components/user-admin/UserImportAdmin';
import IntegrationsAdmin from '../../components/user-admin/IntegrationsAdmin';

// ─── User Admin ──────────────────────────────────────────────────────────────
// Accounts, user types & permission sets, spreadsheet import, and provisioning
// integrations (API keys + webhook). The route is user-admin gated; the Types
// and Integrations sections are additionally SITE_ADMIN-only (their endpoints
// enforce the same). Deep-linkable via ?view= (same pattern as /admin).

type ViewKey = 'users' | 'types' | 'import' | 'integrations';

const SUBTITLES: Record<ViewKey, string> = {
  users: 'Every account in the tenant — who they are, where they sit, and what they may touch.',
  types: 'The default permission set each user type starts from. Per-user overrides layer on top.',
  import:
    'Bulk create or update users from a spreadsheet. Dry-run first; nothing writes until you commit.',
  integrations: 'API keys and the provisioning webhook for IAM systems (Okta, Entra, …).',
};

export default function UserAdmin() {
  const { user } = useAuth();
  const { company } = useCompany();
  const isSiteAdmin = user?.role === 'SITE_ADMIN';

  const sections = useMemo(() => {
    const all: { key: ViewKey; label: string }[] = [
      { key: 'users', label: 'Users' },
      { key: 'types', label: 'User Types & Permissions' },
      { key: 'import', label: 'Import' },
      { key: 'integrations', label: 'API Keys & Webhooks' },
    ];
    // Types + Integrations are SITE_ADMIN-only surfaces (their endpoints 403
    // for everyone else) — hide them rather than render dead sections.
    return isSiteAdmin ? all : all.filter((s) => s.key === 'users' || s.key === 'import');
  }, [isSiteAdmin]);

  // Deep-linkable view (e.g. /user-admin?view=integrations); defaults to Users.
  // Persisted per session (lib/viewState); an explicit ?view= deep link wins
  // over the restored value.
  const [searchParams] = useSearchParams();
  const initialView = searchParams.get('view');
  const [view, setView] = useViewState<ViewKey>(
    'userAdmin.view',
    sections.some((s) => s.key === initialView) ? (initialView as ViewKey) : 'users',
    !initialView,
  );

  return (
    <div>
      <PageHeader title="User Admin" subtitle={SUBTITLES[view]} eyebrow={company?.name} />

      <div className="inline-flex rounded-lg border border-[#eaeaea] p-0.5 mb-5">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setView(s.key)}
            className={
              'px-3 py-1 text-sm font-medium rounded-md transition-colors ' +
              (view === s.key ? 'bg-[#171717] text-white' : 'text-[#525252] hover:text-[#171717]')
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {view === 'types' && isSiteAdmin ? (
        <PermissionSetsAdmin />
      ) : view === 'import' ? (
        <UserImportAdmin />
      ) : view === 'integrations' && isSiteAdmin ? (
        <IntegrationsAdmin />
      ) : (
        <UsersAdmin />
      )}
    </div>
  );
}
