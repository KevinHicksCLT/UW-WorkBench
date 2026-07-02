import { useState } from 'react';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import EntityList from './EntityList';
import type { AdminEntity } from '../../lib/adminTypes';
import { Button, Card, ErrorMessage, Input, Label } from '../ui';

// Company onboarding + profile management. Lists the tenant's companies (with the
// active one marked), lets an admin spin up a brand-new company in one step
// (POST /companies seeds the two root tree nodes), switch the active company, and
// edit company profiles. After onboarding, a prompt offers to build the new
// company out with the AI assistant.

export default function CompanyOnboard({
  companyEntity,
  onRequestAi,
}: {
  companyEntity: AdminEntity | null;
  onRequestAi: () => void;
}) {
  const { companies, companyId, setCompanyId, refresh } = useCompany();
  const [name, setName] = useState('');
  const [seedRoots, setSeedRoots] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const create = async () => {
    const v = name.trim();
    if (!v) return;
    setCreating(true);
    setError('');
    try {
      const co = await api.post('/companies', { name: v, seedRoots });
      setName('');
      refresh();
      setCompanyId(co.id);
      setJustCreated(co.name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Onboard new */}
      <Card variant="elevated" className="p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-1">Onboard a new company</h3>
        <p className="text-sm text-[#666666] mb-4 max-w-2xl">
          Creates an isolated company workspace. We seed the root of the value-stream and
          organization hierarchies so you can start building immediately — by hand in the tabs
          above, or with the AI assistant.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <Label>Company name</Label>
            <Input
              placeholder="e.g. Northwind Mutual"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-[#525252] pb-2.5">
            <input
              type="checkbox"
              checked={seedRoots}
              onChange={(e) => setSeedRoots(e.target.checked)}
              className="h-4 w-4 rounded border-[#d4d4d4]"
            />
            Seed hierarchy roots
          </label>
          <Button disabled={creating || !name.trim()} onClick={create}>
            {creating ? 'Creating…' : 'Create company'}
          </Button>
        </div>
        {error && <ErrorMessage className="mt-3">{error}</ErrorMessage>}
        {justCreated && (
          <div className="mt-4 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-sm text-[#166534]">
              <span className="font-medium">{justCreated}</span> is ready and now active. Build it
              out next.
            </div>
            <Button className="text-xs" onClick={onRequestAi}>
              Build with AI ✦
            </Button>
          </div>
        )}
      </Card>

      {/* Existing companies */}
      <div>
        <h3 className="text-sm font-semibold text-[#171717] mb-2">Companies in this workspace</h3>
        <Card variant="elevated" className="overflow-hidden mb-4">
          <table className="w-full text-sm">
            <tbody>
              {companies.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa]"
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-[#171717]">{c.name}</span>
                    {c.id === companyId && (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[#166534] bg-[#dcfce7] px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {c.id !== companyId && (
                      <button
                        onClick={() => setCompanyId(c.id)}
                        className="text-xs font-medium text-[#0070AD] hover:text-[#005a8c]"
                      >
                        Make active
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Edit profiles */}
      {companyEntity && (
        <div>
          <h3 className="text-sm font-semibold text-[#171717] mb-2">Edit company profile</h3>
          <EntityList entity={companyEntity} companyId={companyId} />
        </div>
      )}
    </div>
  );
}
