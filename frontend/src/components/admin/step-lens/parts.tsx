/**
 * Building blocks of the StepLensEditor — the loose admin row shape, constants
 * (usage/approval types, section accents), the section card / select / label /
 * chip atoms, and the L4 sub-process detail editor. Extracted verbatim from
 * StepLensEditor.tsx.
 */
import { useState } from 'react';

// Loose row shape shared by every table this editor touches (steps, bridge
// rows, streams, apps, roles). Fields are typed where the code reads them.
export type Row = {
  id: string;
  name: string;
  stepNumber: number;
  code?: string | null;
  parentProcessId?: string | null;
  l3?: string | null;
  l4?: string | null;
  leads?: string | null;
  supporting?: string | null;
  processStepId?: string | null;
  activityCode?: string | null;
  applicationId?: string | null;
  usageType?: string | null;
  isPrimary?: boolean;
  sorApplicationId?: string | null;
  approverRoleId?: string | null;
  approvalApplicationId?: string | null;
  approvalType?: string | null;
} & Record<string, unknown>;
export const withCompany = (path: string, companyId: string | null) =>
  companyId ? path + (path.includes('?') ? '&' : '?') + `companyId=${companyId}` : path;

export const USAGE_TYPES = ['Execution', 'System of Record', 'Approval', 'Reporting', 'Support'];
export const APPROVAL_TYPES = ['System Workflow', 'Manual Sign-off', 'E-Signature'];

// Section accents mirror the sidebar's hue ladder so what you edit here is
// visually the same thing you see on the map.
export const ACCENT = { steps: '#7c3aed', detail: '#b45309', who: '#059669', deliverable: '#0070AD', app: '#1d4ed8' } as const;

export function SectionCard({ title, accent, hint, children }: { title: string; accent: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white" style={{ borderLeft: `3px solid ${accent}` }}>
      <div className="px-4 pt-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#525252]">{title}</div>
        {hint && <div className="text-[11px] text-[#a3a3a3] mt-0.5">{hint}</div>}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

export function Select({ value, onChange, options, allowEmpty }: {
  value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; allowEmpty?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-[#e5e7eb] bg-white px-2 py-1.5 text-[12px] text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#171717]"
    >
      {allowEmpty != null && <option value="">{allowEmpty}</option>}
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

export const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1">{children}</label>
);

export const StepChip = ({ text }: { text: string }) => (
  <span className="text-[9.5px] font-medium text-[#0369a1] bg-[#f0f9ff] border border-[#bae6fd] rounded px-1.5 py-0.5">{text}</span>
);

// Editable inputs/outputs/hand-offs/notes of one L4 SubValueStream row.
export function SubProcessDetailCard({ row, saving, onSave }: { row: Row; saving: boolean; onSave: (data: Record<string, unknown>) => void }) {
  const FIELDS: [string, string][] = [
    ['inputs', 'Inputs'], ['outputs', 'Outputs'],
    ['upstream', 'Upstream hand-off'], ['downstream', 'Downstream hand-off'],
    ['notes', 'Notes'],
  ];
  const [d, setD] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map(([k]) => [k, (row[k] as string | null | undefined) ?? ''])));
  return (
    <div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {FIELDS.map(([k, label]) => (
          <div key={k} className={k === 'notes' ? 'sm:col-span-2' : ''}>
            <Label>{label}</Label>
            <textarea
              value={d[k]}
              onChange={(e) => setD((x) => ({ ...x, [k]: e.target.value }))}
              className="w-full rounded-md border border-[#e5e7eb] px-2 py-1.5 text-[12px] min-h-[56px]"
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => onSave(Object.fromEntries(FIELDS.map(([k]) => [k, d[k] || null])))}
        disabled={saving}
        className="mt-2.5 rounded-md bg-[#171717] text-white px-3 py-1.5 text-[12px] font-semibold hover:bg-black disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}
