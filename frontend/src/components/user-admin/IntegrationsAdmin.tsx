import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { Button, Card, ErrorMessage, Input, LinkButton, StatusPill } from '../ui';
import type { ApiKeyRow, CreatedApiKey } from './types';

// IntegrationsAdmin — User Admin → API Keys & Webhooks (SITE_ADMIN only):
// provisioning API keys (create / revoke; the raw key + webhook secret are
// shown exactly once, right after creation) plus static docs of the
// provisioning endpoints for IAM teams.

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <LinkButton
      className="text-[11px] font-medium flex-shrink-0"
      onClick={() => {
        navigator.clipboard?.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied' : label}
    </LinkButton>
  );
}

function SecretRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-0.5">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <code className="font-mono text-[12px] text-[#171717] bg-[#fafafa] border border-[#eaeaea] rounded px-2 py-1 break-all">
          {value}
        </code>
        <CopyButton value={value} label="Copy" />
      </div>
    </div>
  );
}

export default function IntegrationsAdmin() {
  const { confirm } = useDialogs();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [withSecret, setWithSecret] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<CreatedApiKey | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api
      .get<ApiKeyRow[]>('/users/api-keys')
      .then(setKeys)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const refetch = () => {
    api.invalidate('/users/api-keys');
    setRefreshKey((k) => k + 1);
  };

  const create = async () => {
    setCreating(true);
    setError('');
    try {
      const created = (await api.post('/users/api-keys', {
        name: name.trim(),
        withWebhookSecret: withSecret,
      })) as CreatedApiKey;
      setRevealed(created);
      setName('');
      setWithSecret(false);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (key: ApiKeyRow) => {
    const ok = await confirm({
      title: `Revoke "${key.name}"?`,
      message:
        'Integrations authenticating with this key stop working immediately. This cannot be undone.',
      confirmLabel: 'Revoke',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.post(`/users/api-keys/${key.id}/revoke`);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revoke failed');
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      {error && <ErrorMessage>{error}</ErrorMessage>}

      {revealed && (
        <Card className="p-4 border-[#16a34a]/40" data-testid="reveal-once">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-[#171717]">Key created: {revealed.name}</h3>
            <Button variant="secondary" onClick={() => setRevealed(null)}>
              Dismiss
            </Button>
          </div>
          <p className="text-[12px] text-[#be123c] font-medium mt-1 mb-3">
            Store these now — they are not shown again.
          </p>
          <div className="space-y-3">
            <SecretRow label="API key" value={revealed.key} />
            {revealed.webhookSecret && (
              <SecretRow label="Webhook secret" value={revealed.webhookSecret} />
            )}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-[#171717] mb-2">Create key</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="max-w-xs"
            placeholder="Key name (e.g. Okta provisioning)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Key name"
          />
          <label className="flex items-center gap-2 text-sm text-[#171717] cursor-pointer">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[#171717]"
              checked={withSecret}
              onChange={(e) => setWithSecret(e.target.checked)}
            />
            Include webhook secret
          </label>
          <Button disabled={creating || !name.trim()} onClick={() => void create()}>
            {creating ? 'Creating…' : 'Create key'}
          </Button>
        </div>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-2.5 border-b border-[#eaeaea] text-sm font-semibold text-[#171717]">
          API keys
        </div>
        {loading ? (
          <div className="px-4 py-3 text-[11px] text-[#a3a3a3] italic">Loading…</div>
        ) : keys.length === 0 ? (
          <div className="px-4 py-3 text-[11px] text-[#a3a3a3] italic">No API keys yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#eaeaea] bg-[#fafafa] text-left">
                  {['Name', 'Key', 'Created', 'Last used', 'Status', 'Webhook', ''].map((h, i) => (
                    <th
                      key={i}
                      className="px-3 py-1.5 font-semibold text-[10px] uppercase tracking-[0.10em] text-[#a3a3a3]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-[#f5f5f5] last:border-0">
                    <td className="px-3 py-1.5 text-[#171717]">{k.name}</td>
                    <td className="px-3 py-1.5 font-mono text-[#737373]">{k.keyPrefix}…</td>
                    <td className="px-3 py-1.5 text-[#737373] tnum">{fmtDate(k.createdAt)}</td>
                    <td className="px-3 py-1.5 text-[#737373] tnum">{fmtDate(k.lastUsedAt)}</td>
                    <td className="px-3 py-1.5">
                      <StatusPill tone={k.revokedAt ? 'slate' : 'green'}>
                        {k.revokedAt ? 'Revoked' : 'Active'}
                      </StatusPill>
                    </td>
                    <td className="px-3 py-1.5 text-[#737373]">
                      {k.hasWebhookSecret ? 'HMAC' : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {!k.revokedAt && (
                        <LinkButton
                          className="text-[11px] font-medium"
                          onClick={() => void revoke(k)}
                        >
                          Revoke
                        </LinkButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-[#171717] mb-1">Integration endpoints</h3>
        <p className="text-[12px] text-[#666666] mb-3">
          For IAM / identity teams wiring SCIM-style provisioning. Authenticate every call with the
          API key above.
        </p>
        <div className="space-y-3 text-[12px]">
          <div>
            <div className="font-medium text-[#171717] mb-1">Provision or update a user</div>
            <pre className="font-mono bg-[#fafafa] border border-[#eaeaea] rounded px-3 py-2 overflow-x-auto">
              {`PUT /api/provisioning/users/:externalId
Authorization: Bearer tbk_…`}
            </pre>
          </div>
          <div>
            <div className="font-medium text-[#171717] mb-1">Deactivate a user</div>
            <pre className="font-mono bg-[#fafafa] border border-[#eaeaea] rounded px-3 py-2 overflow-x-auto">
              {`DELETE /api/provisioning/users/:externalId
Authorization: Bearer tbk_…`}
            </pre>
          </div>
          <div>
            <div className="font-medium text-[#171717] mb-1">
              Event webhook (Okta-style envelope)
            </div>
            <pre className="font-mono bg-[#fafafa] border border-[#eaeaea] rounded px-3 py-2 overflow-x-auto">
              {`POST /api/provisioning/webhook
Authorization: Bearer tbk_…
X-Signature: <HMAC-SHA256 of the raw body, hex, keyed by the webhook secret>

{ "eventId": "…", "eventType": "user.created" | "user.updated" | "user.deactivated",
  "data": { "user": { … } } }`}
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
}
