import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import PageHeader from '../../components/PageHeader';
import { Sheet, SheetCell, type SheetCol } from '../../components/Sheet';
import { Chip, ErrorMessage } from '../../components/ui';

// External Interactions — read-only view of the external dependency rows
// (vendors, regulators, partners ↔ internal owner roles ↔ value streams),
// rendered in the canonical Sheet format (see components/Sheet.tsx). Clicking a
// row opens a right-hand drawer with its full detail (division/function, inputs,
// outputs, frequency, notes). Data: GET /external-interactions.

type Interaction = {
  id: string;
  partyType: string;
  externalRole: string;
  internalRoleId: string | null;
  internalRoleName: string | null;
  divisionFunction: string | null;
  interactionType: string | null;
  inputs: string | null;
  outputs: string | null;
  relatedValueStream: string | null;
  dependencyType: string | null;
  frequency: string | null;
  notes: string | null;
};

const DASH = '—';

export default function External() {
  const { data, error, loading } = useApi<Interaction[]>('/external-interactions');
  const navigate = useNavigate();
  const items = data ?? [];
  const [selected, setSelected] = useState<Interaction | null>(null);

  const cols: SheetCol<Interaction>[] = [
    { key: 'party', label: 'External party', width: 'minmax(0,1.2fr)', value: (i) => i.externalRole },
    { key: 'type', label: 'Party type', width: '130px', value: (i) => i.partyType, dim: true },
    { key: 'vs', label: 'Value stream', width: 'minmax(0,1fr)', value: (i) => i.relatedValueStream ?? DASH, dim: true },
    {
      key: 'owner', label: 'Internal owner', width: 'minmax(0,1fr)', value: (i) => i.internalRoleName ?? DASH, dim: true,
      render: (i) => (
        <SheetCell
          text={i.internalRoleName ?? DASH}
          dim={!i.internalRoleId}
          onClick={i.internalRoleId ? () => navigate(`/roles/${i.internalRoleId}`) : undefined}
        />
      ),
    },
    { key: 'interaction', label: 'Interaction', width: 'minmax(0,1fr)', value: (i) => i.interactionType ?? DASH, dim: true },
    { key: 'dependency', label: 'Dependency', width: '150px', value: (i) => i.dependencyType ?? DASH, dim: true },
  ];

  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  return (
    <div>
      <PageHeader
        title="Third-Parties"
        subtitle="External parties the operating model depends on — who they touch internally, across which value streams."
      />

      <Sheet
        rows={items}
        cols={cols}
        rowKey={(i) => i.id}
        loading={loading}
        unit="third parties"
        onRowClick={(i) => setSelected(i)}
        summarize={(v) => `${new Set(v.map((i) => i.partyType)).size} party types · ${new Set(v.map((i) => i.relatedValueStream).filter(Boolean)).size} value streams`}
      />

      {selected && (
        <InteractionDrawer
          item={selected}
          onClose={() => setSelected(null)}
          onRole={(id) => { setSelected(null); navigate(`/roles/${id}`); }}
          onValueStream={(name) => { setSelected(null); navigate(`/overview?vs=${encodeURIComponent(name)}`); }}
        />
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">{label}</div>
      <div className="text-sm text-[#171717]">{children}</div>
    </div>
  );
}

// Per-party-type accent colour (header band + pill). Falls back to slate.
const PARTY_COLOR: Record<string, { bg: string; text: string; bar: string }> = {
  'Application Vendor': { bg: '#eef4ff', text: '#1d4ed8', bar: '#3b82f6' },
  Vendor: { bg: '#eef2ff', text: '#4338ca', bar: '#6366f1' },
  'Service Provider': { bg: '#ecfdf5', text: '#047857', bar: '#10b981' },
  'Capital Partner': { bg: '#fffbeb', text: '#b45309', bar: '#f59e0b' },
  'Distribution Partner': { bg: '#f0fdf4', text: '#15803d', bar: '#22c55e' },
  'Professional Services': { bg: '#f5f3ff', text: '#6d28d9', bar: '#8b5cf6' },
  'Rating Agency': { bg: '#fdf4ff', text: '#a21caf', bar: '#d946ef' },
  Regulator: { bg: '#fef2f2', text: '#b91c1c', bar: '#ef4444' },
  Customer: { bg: '#fff1f2', text: '#be123c', bar: '#f43f5e' },
};
const partyColor = (t: string) => PARTY_COLOR[t] ?? { bg: '#f5f5f5', text: '#525252', bar: '#a3a3a3' };

// A real value vs. an empty "—" / null. The seed writes nulls; guard against the
// literal dash too.
const has = (v: string | null) => !!v && v.trim() !== '' && v.trim() !== DASH;

// Plain-English "what they do at the company", synthesised from the structured
// fields (there is no free-text description field). Pulls the original third-party
// category out of the provenance note when present.
function describe(item: Interaction): string {
  const cat = item.notes?.match(/Third-party type:([^.]+)\./i)?.[1]?.trim();
  const kind = cat ?? item.partyType;
  const act = has(item.interactionType) ? item.interactionType!.toLowerCase() : null;
  const parts = [`${item.externalRole} engages with the company as a ${kind.toLowerCase()}`];
  if (act) parts.push(`providing ${act}`);
  if (has(item.relatedValueStream)) parts.push(`for the ${item.relatedValueStream} value stream`);
  if (has(item.frequency)) parts.push(`on a ${item.frequency!.toLowerCase()} basis`);
  return parts.join(' ') + '.';
}

// Right-hand slide-over with the full interaction detail.
function InteractionDrawer({ item, onClose, onRole, onValueStream }: { item: Interaction; onClose: () => void; onRole: (id: string) => void; onValueStream: (name: string) => void }) {
  const c = partyColor(item.partyType);
  // Interaction + Value stream jump to the value-stream list filtered to this
  // party's stream (the interaction lives within that stream).
  const vs = has(item.relatedValueStream) ? item.relatedValueStream! : null;
  const jump = vs ? () => onValueStream(vs) : undefined;
  const linkCls = 'text-left text-[#0070AD] hover:underline';
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="bg-white h-full w-full max-w-md shadow-2xl border-l border-[#eaeaea] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#eaeaea] sticky top-0 bg-white flex items-start justify-between gap-3" style={{ borderTop: `3px solid ${c.bar}` }}>
          <div className="min-w-0">
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.10em] px-2 py-0.5 rounded-full mb-1.5" style={{ background: c.bg, color: c.text }}>
              {item.partyType}
            </span>
            <h2 className="text-[16px] font-bold text-[#171717] leading-snug">{item.externalRole}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1 flex-shrink-0 text-[#a3a3a3] hover:text-[#171717] w-7 h-7 rounded-md hover:bg-[#fafafa] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* What they do at the company */}
          <div className="rounded-lg p-3.5 text-sm leading-relaxed" style={{ background: c.bg, color: '#171717' }}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.10em] mb-1" style={{ color: c.text }}>What they do at the company</div>
            {describe(item)}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {has(item.interactionType) && (
              <Section label="Interaction">
                {jump ? <button onClick={jump} className={linkCls} title="Open in the value-stream list">{item.interactionType}</button> : item.interactionType}
              </Section>
            )}
            {has(item.dependencyType) && <Section label="Dependency"><Chip style={{ background: c.bg, color: c.text, borderColor: c.bg }}>{item.dependencyType}</Chip></Section>}
            {vs && (
              <Section label="Value stream">
                <button onClick={jump} className={linkCls} title="Open in the value-stream list">{vs}</button>
              </Section>
            )}
            {has(item.frequency) && <Section label="Frequency">{item.frequency}</Section>}
          </div>

          {has(item.divisionFunction) && <Section label="Division / function">{item.divisionFunction}</Section>}

          <Section label="Internal owner">
            {item.internalRoleId ? (
              <button onClick={() => onRole(item.internalRoleId!)} className="text-[#0070AD] hover:underline">{item.internalRoleName}</button>
            ) : (
              <span className="text-[#a3a3a3] italic">Unassigned</span>
            )}
          </Section>
        </div>
      </aside>
    </div>
  );
}
