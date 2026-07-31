// FR-5.3 — Unify-States decision dialog. Names the multistate target form,
// picks the region, lists the member state sections, and on confirm creates
// the target record + marks every member UNIFY (model.ts enforces the
// no-duplicate-name rule and returns the error to display).

import { useMemo, useState } from 'react';
import { Button, Input, Label, Select } from '../../../components/ui';
import { DEFAULT_REGIONS } from './mockData';
import { formById } from './model';
import { STATE_NAME } from './types';

export default function UnifyDialog({
  memberFormIds,
  onCancel,
  onUnify,
}: {
  memberFormIds: string[];
  onCancel: () => void;
  /** Returns an error message to display, or null on success. */
  onUnify: (title: string, region: string, reason: string) => string | null;
}) {
  const members = useMemo(
    () => memberFormIds.map((id) => formById.get(id)).filter((f) => f !== undefined),
    [memberFormIds],
  );
  const states = [...new Set(members.map((m) => m.state).filter((s): s is string => !!s))];
  // Default the region to the one covering most member states.
  const defaultRegion =
    DEFAULT_REGIONS.map((r) => ({
      name: r.name,
      hits: states.filter((s) => r.states.includes(s)).length,
    })).sort((a, b) => b.hits - a.hits)[0]?.name ?? DEFAULT_REGIONS[0].name;
  const [title, setTitle] = useState(
    defaultRegion ? `${defaultRegion} Amendment` : 'Multistate Amendment',
  );
  const [region, setRegion] = useState(defaultRegion);
  const [reason, setReason] = useState(
    'State requirements consolidated into one multistate form with state-specific rule sections.',
  );
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!title.trim()) return setError('The target form needs a name.');
    const err = onUnify(title.trim(), region, reason.trim());
    setError(err);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Unify states into a multistate form"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.25)' }}
        onClick={onCancel}
      />
      <div
        style={{
          position: 'relative',
          width: 460,
          maxWidth: '94vw',
          background: '#fff',
          border: '1px solid #eaeaea',
          borderRadius: 14,
          boxShadow: '0 12px 40px rgba(0,0,0,.18)',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#171717' }}>
          Unify {members.length} state forms into one multistate form
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label htmlFor="unify-title">Target form name</Label>
          <Input
            id="unify-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Western States Amendment"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label htmlFor="unify-region">Region</Label>
          <Select id="unify-region" value={region} onChange={(e) => setRegion(e.target.value)}>
            {DEFAULT_REGIONS.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name} ({r.states.join(', ')})
              </option>
            ))}
          </Select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label htmlFor="unify-reason">Reason</Label>
          <Input id="unify-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>

        <div
          style={{
            border: '1px solid #eaeaea',
            borderRadius: 10,
            background: '#fafafa',
            padding: '8px 10px',
            fontSize: 12,
            color: '#262626',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          <span style={{ fontWeight: 700, color: '#171717' }}>Member state rule sections</span>
          {members.map((m) => (
            <span key={m.formId}>
              {m.state ? (STATE_NAME[m.state] ?? m.state) : 'Countrywide'} — {m.formId} · {m.title}
            </span>
          ))}
        </div>

        {error && (
          <p style={{ margin: 0, fontSize: 12, color: '#991b1b', fontWeight: 600 }}>{error}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" className="text-xs" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="text-xs" onClick={submit}>
            Create unified form
          </Button>
        </div>
      </div>
    </div>
  );
}
