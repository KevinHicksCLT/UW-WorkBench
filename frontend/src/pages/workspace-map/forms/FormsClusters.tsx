// E4 — AI Form Clustering.
// FR-4.1: cluster cards (similarity %, member forms, covered products,
// Consolidate CTA that opens the FR-5 workflow pre-filled with members).
// FR-4.2: cluster detail — side-by-side member comparison with differing
// sections highlighted and classified; "Ask about this comparison" pushes the
// context to the bottom-right assistant.

import { useMemo } from 'react';
import { Button, Select } from '../../../components/ui';
import { openAssistant, setAssistantDetail } from '../../../lib/assistantContext';
import { PRODUCT_NAME } from './mockData';
import { clusterGroups, decisionOf, type FormsStore } from './model';
import type { ClusterGroup } from './model';
import { STATE_NAME, type DiffKind, type FormRecord } from './types';
import { DecisionChip, SectionTitle } from './chrome';

/** FR-4.1 — the configurable display threshold (default ≥ 85%). */
const THRESHOLDS = [95, 90, 85, 80];

const DIFF_META: Record<DiffKind, { label: string; fg: string; bg: string; border: string }> = {
  statutory: { label: 'Statutory wording', fg: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  formatting: { label: 'Formatting only', fg: '#3730a3', bg: '#eef2ff', border: '#d6dcff' },
  product: { label: 'Product wording', fg: '#991b1b', bg: '#fee2e2', border: '#fecaca' },
};

export default function FormsClusters({
  store,
  focusClusterId,
  threshold,
  onThreshold,
  onFocus,
  onOpenForm,
  onConsolidate,
}: {
  store: FormsStore;
  focusClusterId: string | null;
  threshold: number;
  onThreshold: (t: number) => void;
  onFocus: (clusterId: string | null) => void;
  onOpenForm: (formId: string) => void;
  onConsolidate: (memberFormIds: string[]) => void;
}) {
  const groups = useMemo(
    () => clusterGroups().filter((g) => g.similarityPct >= threshold),
    [threshold],
  );
  const focus = groups.find((g) => g.clusterId === focusClusterId) ?? null;
  if (focus)
    return (
      <ClusterDetail
        group={focus}
        store={store}
        onBack={() => onFocus(null)}
        onOpenForm={onOpenForm}
        onConsolidate={onConsolidate}
      />
    );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#404040' }}>Similarity ≥</span>
        <Select
          aria-label="Similarity threshold"
          value={String(threshold)}
          onChange={(e) => onThreshold(Number(e.target.value))}
          style={{ width: 'auto', height: 28, fontSize: 12, padding: '0 26px 0 8px' }}
        >
          {THRESHOLDS.map((t) => (
            <option key={t} value={t}>
              {t}%
            </option>
          ))}
        </Select>
        <span style={{ fontSize: 12, color: '#404040' }}>
          {groups.length} cluster{groups.length === 1 ? '' : 's'} — AI-computed offline, stored on
          the model
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 12,
        }}
      >
        {groups.map((g) => (
          <ClusterCard
            key={g.clusterId}
            group={g}
            store={store}
            onOpen={() => onFocus(g.clusterId)}
            onOpenForm={onOpenForm}
            onConsolidate={onConsolidate}
          />
        ))}
      </div>
    </div>
  );
}

function ClusterCard({
  group: g,
  store,
  onOpen,
  onOpenForm,
  onConsolidate,
}: {
  group: ClusterGroup;
  store: FormsStore;
  onOpen: () => void;
  onOpenForm: (formId: string) => void;
  onConsolidate: (memberFormIds: string[]) => void;
}) {
  const allDecided = g.members.every((m) => decisionOf(m, store) !== 'UNDECIDED');
  return (
    <div
      style={{
        border: '1px solid #eaeaea',
        borderRadius: 12,
        background: '#fff',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        style={{
          font: 'inherit',
          border: 'none',
          background: 'none',
          padding: 0,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#171717' }}>
          {g.state ? `${STATE_NAME[g.state] ?? g.state} Forms` : `${g.lineOfBusiness} Forms`} —{' '}
          {g.clusterId}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#166534' }}>
          {g.similarityPct}% similar · savings potential {g.savings}
        </span>
      </button>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {g.members.map((m) => (
          <button
            key={m.formId}
            type="button"
            onClick={() => onOpenForm(m.formId)}
            style={{
              font: 'inherit',
              border: '1px solid #eaeaea',
              borderRadius: 999,
              background: '#fafafa',
              padding: '2px 10px',
              fontSize: 11.5,
              fontWeight: 600,
              color: '#1d4ed8',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {m.formId}
            <DecisionChip status={decisionOf(m, store)} />
          </button>
        ))}
      </div>
      <span style={{ fontSize: 11.5, color: '#404040' }}>
        Products: {g.productIds.map((p) => PRODUCT_NAME[p] ?? p).join(', ')}
      </span>
      <div>
        <Button
          className="text-xs"
          onClick={() => onConsolidate(g.members.map((m) => m.formId))}
          disabled={allDecided}
        >
          {allDecided ? 'All members decided' : 'Consolidate…'}
        </Button>
      </div>
    </div>
  );
}

// ── FR-4.2 — cluster detail & diff ──────────────────────────────────────────

function ClusterDetail({
  group: g,
  store,
  onBack,
  onOpenForm,
  onConsolidate,
}: {
  group: ClusterGroup;
  store: FormsStore;
  onBack: () => void;
  onOpenForm: (formId: string) => void;
  onConsolidate: (memberFormIds: string[]) => void;
}) {
  const headings = useMemo(
    () => [...new Set(g.members.flatMap((m) => m.sections.map((s) => s.heading)))],
    [g],
  );
  const askAssistant = () => {
    const diffs = g.members
      .flatMap((m) =>
        m.sections
          .filter((s) => s.diff)
          .map((s) => `${m.formId} "${s.heading}" differs (${s.diff})`),
      )
      .join('; ');
    setAssistantDetail(
      `Comparing forms cluster ${g.clusterId} (${g.similarityPct}% similar): ` +
        `${g.members.map((m) => m.formId).join(', ')}. Differences: ${diffs || 'none recorded'}.`,
    );
    openAssistant();
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            font: 'inherit',
            border: 'none',
            background: 'none',
            padding: 0,
            color: '#1d4ed8',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 12.5,
          }}
        >
          ‹ All clusters
        </button>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#171717' }}>
          {g.clusterId} — {g.similarityPct}% similar
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button variant="secondary" className="text-xs" onClick={askAssistant}>
            Ask about this comparison
          </Button>
          <Button className="text-xs" onClick={() => onConsolidate(g.members.map((m) => m.formId))}>
            Consolidate…
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', alignItems: 'flex-start' }}>
        {g.members.map((m) => (
          <FormColumn
            key={m.formId}
            form={m}
            headings={headings}
            store={store}
            onOpenForm={onOpenForm}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#171717' }}>
          Difference classes:
        </span>
        {Object.values(DIFF_META).map((m) => (
          <span
            key={m.label}
            style={{
              display: 'inline-flex',
              padding: '1px 8px',
              borderRadius: 999,
              background: m.bg,
              border: `1px solid ${m.border}`,
              color: m.fg,
              fontSize: 10.5,
              fontWeight: 600,
            }}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** One form rendered as a section column — shared by the cluster diff and the
 *  matrix cell comparison (FR-3.1 cell click reuses this diff surface). */
export function FormColumn({
  form: f,
  headings,
  store,
  onOpenForm,
}: {
  form: FormRecord;
  headings: string[];
  store: FormsStore;
  onOpenForm: (formId: string) => void;
}) {
  return (
    <div
      style={{
        flex: '1 1 280px',
        minWidth: 260,
        border: '1px solid #eaeaea',
        borderRadius: 12,
        background: '#fff',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <SectionTitle right={<DecisionChip status={decisionOf(f, store)} />}>
        <button
          type="button"
          onClick={() => onOpenForm(f.formId)}
          style={{
            font: 'inherit',
            border: 'none',
            background: 'none',
            padding: 0,
            color: '#1d4ed8',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {f.formId}
        </button>
      </SectionTitle>
      {headings.map((h) => {
        const s = f.sections.find((x) => x.heading === h);
        if (!s)
          return (
            <div
              key={h}
              style={{
                border: '1px dashed #e5e5e5',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 11.5,
                color: '#525252',
              }}
            >
              — no "{h}" section —
            </div>
          );
        const m = s.diff ? DIFF_META[s.diff] : null;
        return (
          <div
            key={h}
            style={{
              border: `1px solid ${m ? m.border : '#eaeaea'}`,
              borderRadius: 8,
              background: m ? m.bg : '#fff',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#171717' }}>{s.heading}</span>
              {m && (
                <span style={{ fontSize: 10, fontWeight: 700, color: m.fg, whiteSpace: 'nowrap' }}>
                  {m.label}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#262626', lineHeight: 1.45 }}>{s.text}</p>
          </div>
        );
      })}
    </div>
  );
}
