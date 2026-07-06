/**
 * Box editor popup for the Application Rationalization board — double-clicking
 * any box in edit mode opens this popup. It resolves the box to its underlying
 * record (brown-field app · CAPDAN component · green-field service) and edits
 * the right fields against the matching PATCH endpoint. Extracted verbatim
 * from GreenfieldMigration.tsx.
 */
import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { StageDetail } from '../../lib/rationalization';
import { Button, ErrorMessage, Input, Textarea } from '../../components/ui';

type BoxField = { key: string; label: string; placeholder?: string; multiline?: boolean };
type BoxConfig = {
  endpoint: string;
  eyebrow: string;
  title: string;
  fields: BoxField[];
  values: Record<string, string>;
};

function buildBoxConfig(
  target: { kind: string; id: string },
  detail: StageDetail,
): BoxConfig | null {
  const v = (s: string | null | undefined) => s ?? '';
  if (target.kind === 'app') {
    const a = detail.apps.find((x) => x.id === target.id);
    if (!a) return null;
    return {
      endpoint: `/rationalization/apps/${a.id}`,
      eyebrow: 'Brown-field · legacy app',
      title: 'Edit application',
      fields: [
        { key: 'name', label: 'Name' },
        { key: 'techStack', label: 'Tech stack', placeholder: 'e.g. C# / .NET, SQL Server' },
        {
          key: 'disposition',
          label: 'Disposition',
          placeholder: 'Retain | Refactor | Replace | Retire',
        },
      ],
      values: { name: v(a.name), techStack: v(a.techStack), disposition: v(a.disposition) },
    };
  }
  if (target.kind === 'component') {
    const c = detail.components.find((x) => x.id === target.id);
    if (!c) return null;
    return {
      endpoint: `/rationalization/components/${c.id}`,
      eyebrow: `Normalize · ${c.layer}`,
      title: 'Edit normalize box',
      fields: [
        { key: 'name', label: 'Name' },
        { key: 'destination', label: 'Destination', placeholder: 'greenfield target' },
        { key: 'targetTech', label: 'Target tech' },
        { key: 'pattern', label: 'Pattern', placeholder: 'e.g. Strangler facade' },
        { key: 'principle', label: 'Principle (CAPDAN rationale)', multiline: true },
      ],
      values: {
        name: v(c.name),
        destination: v(c.destination),
        targetTech: v(c.targetTech),
        pattern: v(c.pattern),
        principle: v(c.principle),
      },
    };
  }
  const m = detail.microservices.find((x) => x.id === target.id);
  if (!m) return null;
  return {
    endpoint: `/rationalization/microservices/${m.id}`,
    eyebrow: 'Greenfield · target service',
    title: 'Edit service',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'kind', label: 'Kind', placeholder: 'Microservice | Application' },
      { key: 'status', label: 'Status', placeholder: 'Planned | Building | Live' },
      { key: 'techStack', label: 'Tech stack' },
      { key: 'ownerRole', label: 'Owner role' },
    ],
    values: {
      name: v(m.name),
      kind: v(m.kind),
      status: v(m.status),
      techStack: v(m.techStack),
      ownerRole: v(m.ownerRole),
    },
  };
}

export function EditBoxModal({
  target,
  detail,
  onClose,
  onSaved,
}: {
  target: { kind: 'app' | 'component' | 'service'; id: string };
  detail: StageDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const cfg = useMemo(() => buildBoxConfig(target, detail), [target, detail]);
  const [form, setForm] = useState<Record<string, string>>(() => cfg?.values ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!cfg) return null;

  async function save() {
    if (!(form.name ?? '').trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.patch(cfg!.endpoint, form);
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={() => !saving && onClose()}
        aria-hidden="true"
      />
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-[460px] max-h-[88vh] overflow-y-auto rounded-xl border border-[#eaeaea] bg-white shadow-xl p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#4f46e5]">
              {cfg.eyebrow}
            </div>
            <h3 className="text-[16px] font-bold text-[#171717] mt-0.5">{cfg.title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-shrink-0 p-1.5 -mr-1.5 rounded-md text-[#a3a3a3] hover:text-[#171717] hover:bg-[#fafafa]"
            aria-label="Close"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="space-y-2.5">
          {cfg.fields.map((f, i) => (
            <div key={f.key}>
              <label className="block text-[11px] font-medium text-[#525252] mb-1">{f.label}</label>
              {f.multiline ? (
                <Textarea
                  rows={2}
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              ) : (
                <Input
                  autoFocus={i === 0}
                  value={form[f.key] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
        {error && (
          <ErrorMessage baseClassName="text-[12px] text-[#be123c] mt-2">{error}</ErrorMessage>
        )}
        <div className="flex items-center justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving} className="text-sm">
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="text-sm">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </>
  );
}
