import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../../lib/api';
import { useApi } from '../../../lib/useApi';
import { STATE_NAMES } from '../../../lib/usStates';
import type { SpineFilters } from './SpineFilterBar';

// The NAMED normalized policy bar — shared by the grid and detail faces. The
// team creates a policy from the current board scope (name + target edition +
// jurisdictions, filters snapshotted), selects it, and every decision made
// while it is active lands on it. "View" opens the policy: its scope and the
// accumulated decisions, grouped by model component.

const LOGO_BLUE = '#0070AD';

export interface NormalizationTarget {
  id: string;
  name: string;
  versionToken: string | null;
  states: string[] | null;
  decisionCount: number;
}

export interface TargetDecision {
  lobId: string;
  lobName: string;
  component: string;
  groupKey: string;
  status: string;
  comment: string | null;
  decidedBy: string | null;
  decidedAt: string;
}

const STATUS_META: Record<string, { label: string; tone: string }> = {
  APPROVED: { label: 'Standardized', tone: '#4f46e5' },
  HELD: { label: 'Retained', tone: '#0f766e' },
  RETIRED: { label: 'Retired', tone: '#dc2626' },
};

/** The policy view — the grid's counterpart of the detail face's greenfield
 *  column: what the named policy covers and every decision folded into it. */
function PolicyModal({ targetId, onClose }: { targetId: string; onClose: () => void }) {
  const { data } = useApi<{
    name: string;
    versionToken: string | null;
    states: string[] | null;
    createdBy: string | null;
    decisions: TargetDecision[];
  }>(`/product-spine/targets/${targetId}`);
  const byComponent = useMemo(() => {
    const m = new Map<string, TargetDecision[]>();
    for (const d of data?.decisions ?? []) {
      const list = m.get(d.component) ?? [];
      list.push(d);
      m.set(d.component, list);
    }
    return m;
  }, [data]);
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.4)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 70,
      }}
    >
      <div
        role="dialog"
        aria-label={data?.name ?? 'Normalized policy'}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 860,
          maxWidth: 'calc(100% - 48px)',
          maxHeight: 'calc(100vh - 120px)',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(15,23,42,.3)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #eaeaea' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: LOGO_BLUE, letterSpacing: 0.5 }}>
            NORMALIZED POLICY
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#171717', flex: 1 }}>
              {data?.name ?? '…'}
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              style={{
                font: 'inherit',
                fontSize: 14,
                color: '#525252',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: '#525252', marginTop: 2 }}>
            {data?.versionToken ? `Edition ${data.versionToken} · ` : ''}
            {data?.states?.length
              ? `${data.states.length} jurisdiction${data.states.length === 1 ? '' : 's'}: ${data.states.slice(0, 14).join(', ')}${data.states.length > 14 ? '…' : ''}`
              : 'Jurisdictions: all in scope'}
            {data?.createdBy ? ` · created by ${data.createdBy}` : ''}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 16px 16px' }}>
          {data && data.decisions.length === 0 && (
            <div style={{ fontSize: 12.5, color: '#737373', padding: '14px 0' }}>
              No decisions folded in yet — select this policy on the board, then every Retain /
              Standardize / Retire sign-off lands here automatically.
            </div>
          )}
          {[...byComponent.entries()].map(([component, list]) => (
            <div key={component} style={{ marginTop: 10 }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: '#111827',
                  padding: '4px 0',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                {component} ({list.length})
              </div>
              {list.map((d) => {
                const meta = STATUS_META[d.status] ?? { label: d.status, tone: '#525252' };
                return (
                  <div
                    key={`${d.lobId}:${d.groupKey}`}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'baseline',
                      padding: '5px 0',
                      borderBottom: '1px solid #f5f5f5',
                    }}
                  >
                    <span style={{ flex: 1, fontSize: 12.5, color: '#171717', minWidth: 0 }}>
                      {d.groupKey.split('::').pop()}
                      <span style={{ color: '#94a3b8', fontSize: 11 }}> · {d.lobName}</span>
                      {d.comment && (
                        <span style={{ display: 'block', fontSize: 11, color: '#525252' }}>
                          {d.comment}
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#fff',
                        background: meta.tone,
                        borderRadius: 999,
                        padding: '1px 9px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Create dialog — name + target edition + jurisdictions; the current board
 *  filters are snapshotted onto the policy. */
function CreateModal({
  filters,
  scopeStates,
  onCreated,
  onClose,
}: {
  filters: SpineFilters;
  /** Jurisdictions offered by the current scope (defaults to all selected). */
  scopeStates: string[];
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [versionToken, setVersionToken] = useState('v-next');
  const [states, setStates] = useState<string[]>(scopeStates);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!name.trim()) return setError('Give the policy a name.');
    setBusy(true);
    setError('');
    try {
      const r = (await api.post('/product-spine/targets', {
        name: name.trim(),
        versionToken: versionToken.trim() || undefined,
        filters: filters as unknown as Record<string, string[]>,
        states,
      })) as { id: string };
      onCreated(r.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
      setBusy(false);
    }
  };
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.4)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 110,
      }}
    >
      <div
        role="dialog"
        aria-label="New normalized policy"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: 'calc(100% - 48px)',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(15,23,42,.3)',
          padding: 16,
        }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#171717' }}>
          New normalized policy
        </div>
        <div style={{ fontSize: 11.5, color: '#525252', marginTop: 2, lineHeight: 1.4 }}>
          Captures the current board scope. Decisions made while it is selected fold into it.
        </div>
        <label style={{ display: 'block', fontSize: 11, color: '#404040', marginTop: 10 }}>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Consolidated Homeowners Multi-State Policy"
            style={{
              font: 'inherit',
              fontSize: 12.5,
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
              marginTop: 3,
              border: '1px solid #d4d4d4',
              borderRadius: 7,
              padding: '6px 9px',
            }}
          />
        </label>
        <label style={{ display: 'block', fontSize: 11, color: '#404040', marginTop: 8 }}>
          Target edition / version
          <input
            value={versionToken}
            onChange={(e) => setVersionToken(e.target.value)}
            style={{
              font: 'inherit',
              fontSize: 12.5,
              display: 'block',
              width: 140,
              marginTop: 3,
              border: '1px solid #d4d4d4',
              borderRadius: 7,
              padding: '6px 9px',
            }}
          />
        </label>
        <div style={{ fontSize: 11, color: '#404040', marginTop: 8 }}>
          Jurisdictions ({states.length ? `${states.length} selected` : 'all in scope'})
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            marginTop: 4,
            maxHeight: 110,
            overflowY: 'auto',
          }}
        >
          {scopeStates.map((s) => {
            const on = states.includes(s);
            return (
              <button
                key={s}
                type="button"
                title={STATE_NAMES[s] ?? s}
                onClick={() => setStates((cur) => (on ? cur.filter((x) => x !== s) : [...cur, s]))}
                style={{
                  font: 'inherit',
                  fontSize: 10.5,
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: 5,
                  border: `1px solid ${on ? LOGO_BLUE : '#d4d4d4'}`,
                  background: on ? LOGO_BLUE : '#fff',
                  color: on ? '#fff' : '#404040',
                  cursor: 'pointer',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
        {error && <div style={{ fontSize: 11.5, color: '#991b1b', marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              font: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: 7,
              border: '1px solid #e5e5e5',
              background: '#fff',
              color: '#525252',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            style={{
              font: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 14px',
              borderRadius: 7,
              border: 'none',
              background: LOGO_BLUE,
              color: '#fff',
              cursor: 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Creating…' : 'Create policy'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function TargetBar({
  filters,
  scopeStates,
  activeTargetId,
  onSelect,
}: {
  filters: SpineFilters;
  scopeStates: string[];
  activeTargetId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { data: targets, refetch } = useApi<NormalizationTarget[]>('/product-spine/targets');
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(false);
  const active = targets?.find((t) => t.id === activeTargetId) ?? null;
  // A stale persisted selection (deleted policy) silently clears.
  useEffect(() => {
    if (targets && activeTargetId && !targets.some((t) => t.id === activeTargetId)) onSelect(null);
  }, [targets, activeTargetId, onSelect]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <span style={{ fontSize: 11, color: '#525252', whiteSpace: 'nowrap' }}>
        Normalized policy
      </span>
      <select
        value={activeTargetId ?? ''}
        onChange={(e) => onSelect(e.target.value || null)}
        style={{
          font: 'inherit',
          fontSize: 11.5,
          height: 26,
          border: '1px solid #d4d4d4',
          borderRadius: 6,
          background: '#fff',
          color: '#171717',
          maxWidth: 240,
        }}
      >
        <option value="">— none selected —</option>
        {(targets ?? []).map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.versionToken ? ` (${t.versionToken})` : ''} · {t.decisionCount} decisions
          </option>
        ))}
      </select>
      {active && (
        <button
          type="button"
          onClick={() => setViewing(true)}
          title="open this normalized policy — scope + every decision folded into it"
          style={{
            font: 'inherit',
            fontSize: 11,
            fontWeight: 700,
            height: 26,
            padding: '0 10px',
            borderRadius: 6,
            border: `1px solid ${LOGO_BLUE}`,
            background: '#fff',
            color: LOGO_BLUE,
            cursor: 'pointer',
          }}
        >
          View
        </button>
      )}
      <button
        type="button"
        onClick={() => setCreating(true)}
        title="create a named normalized policy from the current scope"
        style={{
          font: 'inherit',
          fontSize: 11,
          fontWeight: 700,
          height: 26,
          padding: '0 10px',
          borderRadius: 6,
          border: 'none',
          background: LOGO_BLUE,
          color: '#fff',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        + New
      </button>
      {creating && (
        <CreateModal
          filters={filters}
          scopeStates={scopeStates}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            refetch();
            onSelect(id);
          }}
        />
      )}
      {viewing && activeTargetId && (
        <PolicyModal targetId={activeTargetId} onClose={() => setViewing(false)} />
      )}
    </div>
  );
}
