// Authority Matrix (CAP-08, CAP-13) — authority as data. Grants bind to the
// Roles catalog (never user ids, ADR-03); re-issue creates version+1 with the
// prior retained (INV-3). Delegable grants are blocked until a bordereaux
// schedule is attached; the 90-day breach counter warns on delegated books.
// Below the grant sheet: the referral queue (INV-1 escalation chain).
import { useMemo, useState } from 'react';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { fmt } from '../../lib/format';
import { Sheet, SheetCell, type SheetCol } from '../../components/Sheet';
import { Button, Card, ErrorMessage, Input, Label, Select, StatusPill } from '../../components/ui';
import { errMsg, fmtDateTime, type AuthorityGrant, type ReferralCase } from './types';

const DASH = '—';

const grantCols: SheetCol<AuthorityGrant>[] = [
  { key: 'ref', label: 'Ref', width: '76px', hideable: false, value: (g) => g.ref },
  {
    key: 'version',
    label: 'Ver',
    width: '52px',
    align: 'center',
    filterable: false,
    value: (g) => String(g.version),
    render: (g) => <SheetCell text={`v${g.version}`} dim />,
  },
  { key: 'role', label: 'Role', width: 'minmax(150px,1.2fr)', value: (g) => g.role.displayValue },
  {
    key: 'premiumMax',
    label: 'Premium max',
    width: '104px',
    align: 'right',
    filterable: false,
    value: (g) => String(g.premiumMax),
    render: (g) => <SheetCell text={fmt.currency(g.premiumMax, { compact: true })} dim />,
  },
  {
    key: 'tivMax',
    label: 'TIV max',
    width: '96px',
    align: 'right',
    filterable: false,
    value: (g) => String(g.tivMax),
    render: (g) => <SheetCell text={fmt.currency(g.tivMax, { compact: true })} dim />,
  },
  {
    key: 'lobs',
    label: 'LOBs',
    width: 'minmax(100px,1fr)',
    values: (g) => g.lobs.split(',').map((t) => t.trim()),
  },
  {
    key: 'territories',
    label: 'Territories',
    width: 'minmax(100px,1fr)',
    value: (g) => g.territories,
    dim: true,
  },
  {
    key: 'delegable',
    label: 'Delegable',
    width: '90px',
    align: 'center',
    value: (g) => (g.delegable ? 'Yes' : 'No'),
    render: (g) =>
      g.delegable ? (
        <StatusPill tone={g.bordereauxAttached ? 'blue' : 'amber'}>
          {g.bordereauxAttached ? 'Yes · bordereaux' : 'Yes · no bordereaux'}
        </StatusPill>
      ) : (
        <SheetCell text="No" dim />
      ),
  },
  {
    key: 'breaches',
    label: 'Breaches 90d',
    width: '100px',
    align: 'center',
    hint: 'Delegated-book breach detections in the trailing 90 days (CAP-13)',
    filterable: false,
    value: (g) => String(g.breachCount90d),
    render: (g) =>
      g.breachCount90d > 0 ? (
        <StatusPill tone="amber">{String(g.breachCount90d)}</StatusPill>
      ) : (
        <SheetCell text="0" dim />
      ),
  },
  {
    key: 'status',
    label: 'Status',
    width: '104px',
    align: 'center',
    value: (g) => g.status,
    render: (g) => (
      <StatusPill tone={g.status === 'ACTIVE' ? 'green' : 'slate'}>{g.status}</StatusPill>
    ),
  },
];

const referralCols: SheetCol<ReferralCase>[] = [
  { key: 'sub', label: 'Submission', width: '110px', value: (r) => r.submission?.ref ?? DASH },
  {
    key: 'reason',
    label: 'Reason',
    width: 'minmax(200px,2fr)',
    filterable: false,
    sortable: false,
    value: (r) => r.reason,
    render: (r) => <SheetCell text={r.reason} dim title={r.reason} />,
  },
  {
    key: 'escalatedTo',
    label: 'Escalated to',
    width: 'minmax(140px,1fr)',
    value: (r) => r.escalatedToRole?.displayValue ?? DASH,
  },
  {
    key: 'sla',
    label: 'SLA due',
    width: '120px',
    filterable: false,
    value: (r) => r.slaDueAt,
    render: (r) => (
      <span
        className={
          'truncate text-[12px] ' +
          (r.slaBreached ? 'text-[#be123c] font-medium' : 'text-[#737373]')
        }
      >
        {fmtDateTime(r.slaDueAt)}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    width: '100px',
    align: 'center',
    value: (r) => r.status,
    render: (r) => (
      <StatusPill
        tone={r.status === 'OPEN' ? 'amber' : r.status === 'APPROVED' ? 'green' : 'slate'}
      >
        {r.status}
      </StatusPill>
    ),
  },
  {
    key: 'resolvedBy',
    label: 'Resolved by',
    width: 'minmax(140px,1fr)',
    value: (r) => r.resolvedBy ?? DASH,
    dim: true,
  },
];

type GrantForm = {
  ref: string;
  roleId: string;
  customRoleId: string;
  premiumMax: string;
  tivMax: string;
  lobs: string;
  territories: string;
  delegable: boolean;
  bordereauxAttached: boolean;
};

const EMPTY_GRANT: GrantForm = {
  ref: '',
  roleId: '',
  customRoleId: '',
  premiumMax: '',
  tivMax: '',
  lobs: 'CP',
  territories: 'US',
  delegable: false,
  bordereauxAttached: false,
};

export default function AuthorityMatrix() {
  const dialogs = useDialogs();
  const grants = useApi<AuthorityGrant[]>('/uw/authority/grants');
  const referrals = useApi<ReferralCase[]>('/uw/referrals');
  // Grants bind to the Roles catalog. The role picker is fed from the roles
  // already present on existing grants (the starter pack seeds a full
  // authority ladder); a free-text role id covers roles with no grant yet.
  const roleOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const g of grants.data ?? []) {
      if (!seen.has(g.role.id)) seen.set(g.role.id, g.role.displayValue);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [grants.data]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<GrantForm>(EMPTY_GRANT);
  const [busy, setBusy] = useState(false);

  async function issue() {
    if (form.ref && !/^AG-\d{2,3}$/.test(form.ref)) {
      await dialogs.alert(
        'Ref must match AG-## (leave blank to mint a new grant family; supply an existing ref to re-issue v+1).',
      );
      return;
    }
    const roleId = form.customRoleId.trim() || form.roleId;
    if (!roleId) {
      await dialogs.alert(
        'Pick the role this grant binds to — authority binds to roles, never user ids (ADR-03).',
      );
      return;
    }
    const premiumMax = Number(form.premiumMax);
    const tivMax = Number(form.tivMax);
    if (
      !premiumMax ||
      premiumMax <= 0 ||
      !tivMax ||
      tivMax <= 0 ||
      Number.isNaN(premiumMax) ||
      Number.isNaN(tivMax)
    ) {
      await dialogs.alert('Premium max and TIV max must both be positive numbers.');
      return;
    }
    if (form.delegable && !form.bordereauxAttached) {
      await dialogs.alert(
        'Delegable grants are blocked until a bordereaux schedule is attached (CAP-13).',
      );
      return;
    }
    setBusy(true);
    try {
      const created = (await api.post('/uw/authority/grants', {
        ref: form.ref || undefined,
        roleId,
        premiumMax,
        tivMax,
        lobs: form.lobs.trim(),
        territories: form.territories.trim(),
        delegable: form.delegable,
        bordereauxAttached: form.bordereauxAttached,
      })) as AuthorityGrant;
      await dialogs.alert({
        title: `Issued ${created.ref} v${created.version}`,
        message:
          created.version > 1
            ? 'Re-issue created a new version — the prior version is retained as SUPERSEDED (INV-3).'
            : 'New grant family issued against the Roles catalog.',
      });
      setForm(EMPTY_GRANT);
      setShowForm(false);
      grants.refetch();
    } catch (e) {
      await dialogs.alert({ title: 'Issue blocked', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {grants.error && (
        <ErrorMessage className="mb-3">Failed to load grants: {grants.error}</ErrorMessage>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <p className="text-[11px] text-[#737373]">
          Authority is data — grants bind to the Roles catalog, never user ids (ADR-03) · re-issue
          creates v+1 (INV-3)
        </p>
        <div className="flex-1" />
        <Button className="text-xs" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close form' : 'Issue / re-issue grant'}
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 mb-4">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <Label htmlFor="ag-ref">Ref (blank = new family)</Label>
              <Input
                id="ag-ref"
                value={form.ref}
                onChange={(e) => setForm((f) => ({ ...f, ref: e.target.value }))}
                placeholder="AG-31"
              />
            </div>
            <div>
              <Label htmlFor="ag-role">Role (from existing grants)</Label>
              <Select
                id="ag-role"
                value={form.roleId}
                onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
              >
                <option value="">Select a role…</option>
                {roleOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ag-role-id">Or role id (free text)</Label>
              <Input
                id="ag-role-id"
                value={form.customRoleId}
                onChange={(e) => setForm((f) => ({ ...f, customRoleId: e.target.value }))}
                placeholder="paste a Roles-catalog id"
              />
              <p className="mt-1 text-[10px] text-[#a3a3a3]">
                Overrides the select — for roles with no grant yet.
              </p>
            </div>
            <div>
              <Label htmlFor="ag-premium">Premium max (USD)</Label>
              <Input
                id="ag-premium"
                type="number"
                min={0}
                value={form.premiumMax}
                onChange={(e) => setForm((f) => ({ ...f, premiumMax: e.target.value }))}
                placeholder="500000"
              />
            </div>
            <div>
              <Label htmlFor="ag-tiv">TIV max (USD)</Label>
              <Input
                id="ag-tiv"
                type="number"
                min={0}
                value={form.tivMax}
                onChange={(e) => setForm((f) => ({ ...f, tivMax: e.target.value }))}
                placeholder="50000000"
              />
            </div>
            <div>
              <Label htmlFor="ag-lobs">LOBs (comma list)</Label>
              <Input
                id="ag-lobs"
                value={form.lobs}
                onChange={(e) => setForm((f) => ({ ...f, lobs: e.target.value }))}
                placeholder="CP, GL"
              />
            </div>
            <div>
              <Label htmlFor="ag-terr">Territories (comma list)</Label>
              <Input
                id="ag-terr"
                value={form.territories}
                onChange={(e) => setForm((f) => ({ ...f, territories: e.target.value }))}
                placeholder="NC, SC"
              />
            </div>
            <div className="flex items-end gap-4 sm:col-span-2">
              <label className="flex items-center gap-2 text-[12px] text-[#171717]">
                <input
                  type="checkbox"
                  className="accent-[#171717]"
                  checked={form.delegable}
                  onChange={(e) => setForm((f) => ({ ...f, delegable: e.target.checked }))}
                />
                Delegable
              </label>
              <label className="flex items-center gap-2 text-[12px] text-[#171717]">
                <input
                  type="checkbox"
                  className="accent-[#171717]"
                  checked={form.bordereauxAttached}
                  onChange={(e) => setForm((f) => ({ ...f, bordereauxAttached: e.target.checked }))}
                />
                Bordereaux schedule attached
              </label>
            </div>
          </div>
          {form.delegable && !form.bordereauxAttached && (
            <p className="mt-2 text-[11px] font-medium text-[#b45309]">
              Delegable grants require an attached bordereaux schedule (CAP-13).
            </p>
          )}
          <div className="mt-3">
            <Button className="text-xs" disabled={busy} onClick={issue}>
              Issue grant
            </Button>
          </div>
        </Card>
      )}

      <Sheet
        sheetKey="uw.authority"
        rows={grants.data ?? []}
        cols={grantCols}
        rowKey={(g) => g.id}
        loading={grants.loading}
        unit="grant versions"
        defaultSort={{ col: 'ref', dir: 1 }}
        emptyText="No authority grants issued yet — import a starter pack from the Packs tab to seed an authority ladder."
        summarize={(v) =>
          `${new Set(v.map((g) => g.ref)).size} families · ${v.filter((g) => g.status === 'ACTIVE').length} active`
        }
      />

      <h3 className="text-sm font-semibold text-[#171717] mt-6 mb-2">Referral queue</h3>
      {referrals.error && (
        <ErrorMessage className="mb-3">Failed to load referrals: {referrals.error}</ErrorMessage>
      )}
      <Sheet
        sheetKey="uw.referrals"
        rows={referrals.data ?? []}
        cols={referralCols}
        rowKey={(r) => r.id}
        loading={referrals.loading}
        unit="referrals"
        defaultSort={{ col: 'sla', dir: 1 }}
        emptyText="No referral cases — decisions that breach authority open one automatically."
        summarize={(v) => `${v.filter((r) => r.status === 'OPEN').length} open`}
      />
    </div>
  );
}
