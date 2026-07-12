/**
 * Box editor popup for the workspace board — double-clicking a box in edit
 * mode opens it (brown-field app · Normalize component · greenfield service),
 * and the v3 findings UI (PM-07 / 3-D) reuses it to create or reclassify a
 * finding: scope picker from the classification vocabulary, segment/geography
 * values (product domain), target component, plain summary and dead-code
 * flag. Fixture-sourced boards save through `onLocalPatch` until Agent 2's
 * findings endpoints land.
 */
import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type {
  ClassificationMeta,
  Domain,
  Finding,
  Layer,
  StageDetail,
} from '../../lib/rationalization';
import { Button, ErrorMessage, Input, Select, Textarea } from '../../components/ui';
import { createFinding, patchFinding, type BoardSource } from './data';

export type EditTarget =
  | { kind: 'app' | 'component' | 'service'; id: string }
  | { kind: 'finding'; id: string }
  | { kind: 'newFinding'; appId: string; layer: Layer };

type BoxField = {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  /** Render a select instead of a text input. */
  options?: { value: string; label: string }[];
};
type BoxConfig = {
  /** PATCH endpoint for the classic box kinds; finding kinds save via save(). */
  endpoint?: string;
  eyebrow: string;
  title: string;
  fields: BoxField[];
  values: Record<string, string>;
};

/** Extra context the finding editor needs (vocabulary + board). */
export type EditBoxContext = {
  domain: Domain;
  source: BoardSource;
  classification: ClassificationMeta;
  layers: Layer[];
  /** Local mutation fallback for fixture-sourced boards (PM-07). */
  onLocalPatch?: (
    findingId: string | null,
    patch: Partial<Finding>,
    cell?: { appId: string; layer: Layer },
  ) => void;
};

const findingFields = (detail: StageDetail, ctx: EditBoxContext): BoxField[] => {
  const scopeOptions = ctx.classification.order.map((t) => ({
    value: t,
    label: ctx.classification.byToken[t]?.label ?? t,
  }));
  const componentOptions = [
    { value: '', label: '— none —' },
    ...detail.components.map((c) => ({ value: c.layer, label: `${c.name} (${c.layer})` })),
  ];
  return [
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category', placeholder: 'e.g. Deductible structures' },
    { key: 'capdan', label: 'Classification / scope', options: scopeOptions },
    ...(ctx.domain === 'PRODUCT_MODEL'
      ? [
          { key: 'segmentValue', label: 'Segment value', placeholder: 'e.g. SMB Commercial' },
          { key: 'geographyValue', label: 'Geography value', placeholder: 'e.g. US-NY' },
        ]
      : []),
    { key: 'targetLayer', label: 'Target component', options: componentOptions },
    { key: 'plainSummary', label: 'Plain-language summary', multiline: true },
    {
      key: 'deadCode',
      label: 'Dead code',
      options: [
        { value: 'false', label: 'No' },
        { value: 'true', label: 'Yes — retire with sign-off' },
      ],
    },
  ];
};

function buildBoxConfig(
  target: EditTarget,
  detail: StageDetail,
  ctx: EditBoxContext,
): BoxConfig | null {
  const v = (s: string | null | undefined) => s ?? '';
  if (target.kind === 'finding') {
    const f = detail.findings.find((x) => x.id === target.id);
    if (!f) return null;
    return {
      eyebrow: `Finding · ${f.layer}`,
      title: 'Reclassify finding',
      fields: findingFields(detail, ctx),
      values: {
        name: f.name,
        category: v(f.category),
        capdan: f.capdan,
        segmentValue: v(f.segmentValue),
        geographyValue: v(f.geographyValue),
        targetLayer: v(f.targetLayer),
        plainSummary: v(f.plainSummary),
        deadCode: String(f.deadCode),
      },
    };
  }
  if (target.kind === 'newFinding') {
    return {
      eyebrow: `New finding · ${target.layer}`,
      title: 'Add finding',
      fields: findingFields(detail, ctx),
      values: {
        name: '',
        category: '',
        capdan: ctx.classification.order[0] ?? '',
        segmentValue: '',
        geographyValue: '',
        targetLayer: '',
        plainSummary: '',
        deadCode: 'false',
      },
    };
  }
  if (target.kind === 'app') {
    const a = detail.apps.find((x) => x.id === target.id);
    if (!a) return null;
    const sharedService = a.kind === 'SHARED_SERVICE';
    return {
      endpoint: `/rationalization/apps/${a.id}`,
      eyebrow: sharedService ? 'Shared service' : 'Brown-field · legacy app',
      title: sharedService ? 'Edit shared service' : 'Edit application',
      fields: [
        { key: 'name', label: 'Name' },
        { key: 'kind', label: 'Kind', placeholder: 'LEGACY | SHARED_SERVICE' },
        { key: 'techStack', label: 'Tech stack', placeholder: 'e.g. C# / .NET, SQL Server' },
        {
          key: 'disposition',
          label: 'Disposition',
          placeholder: 'Retain | Refactor | Replace | Retire',
        },
      ],
      values: {
        name: v(a.name),
        kind: v(a.kind),
        techStack: v(a.techStack),
        disposition: v(a.disposition),
      },
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
        { key: 'principle', label: 'Principle (rationale)', multiline: true },
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

/** The form → §6.2 finding patch (empty selects become nulls). */
export function findingPatch(form: Record<string, string>): Partial<Finding> {
  return {
    name: form.name?.trim(),
    category: form.category?.trim() || null,
    capdan: form.capdan,
    scope: form.capdan,
    segmentValue: form.segmentValue?.trim() || null,
    geographyValue: form.geographyValue?.trim() || null,
    targetLayer: form.targetLayer || null,
    plainSummary: form.plainSummary?.trim() || null,
    deadCode: form.deadCode === 'true',
  };
}

export function EditBoxModal({
  target,
  detail,
  ctx,
  onClose,
  onSaved,
}: {
  target: EditTarget;
  detail: StageDetail;
  ctx: EditBoxContext;
  onClose: () => void;
  onSaved: () => void;
}) {
  const cfg = useMemo(() => buildBoxConfig(target, detail, ctx), [target, detail, ctx]);
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
      if (target.kind === 'finding' || target.kind === 'newFinding') {
        const patch = findingPatch(form);
        const cell =
          target.kind === 'newFinding' ? { appId: target.appId, layer: target.layer } : undefined;
        if (ctx.source === 'fixture' && ctx.onLocalPatch) {
          // Demo board — Agent 2's findings endpoints aren't live yet.
          ctx.onLocalPatch(target.kind === 'finding' ? target.id : null, patch, cell);
        } else if (target.kind === 'finding') {
          await patchFinding(ctx.domain, target.id, patch);
        } else {
          await createFinding(ctx.domain, detail.id, {
            ...patch,
            appId: target.appId,
            layer: target.layer,
          });
        }
      } else {
        await api.patch(cfg!.endpoint!, form);
      }
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
              {f.options ? (
                <Select
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                >
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : f.multiline ? (
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
