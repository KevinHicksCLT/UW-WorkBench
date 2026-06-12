// aiAdoption.ts — the "Active AI" autonomy-spectrum vocabulary.
//
// Code-level definitions only: the four AI modes (the heat-map columns) and the
// adoption-level → traffic-light colour scale. The per-stream CONTENT — adoption
// levels and the concrete use cases behind each mode — lives in the DB
// (NodeAiAdoption, served by /explorer/value-stream-adoption and edited in
// Data Admin → Telemetry → AI adoption). The authored profiles formerly
// hardcoded here were exported to backend/data/ai-adoption-usecases.json and
// seeded by backend/scripts/seed-adoption-usecases.ts.

// ── Autonomy spectrum — the heat-map columns ────────────────────────────────
export type AiMode = {
  key: 'assistant' | 'augmented' | 'workflow' | 'agent';
  label: string;
  short: string;
  desc: string;
};

export const MODES: AiMode[] = [
  {
    key: 'assistant',
    label: 'AI Assistant',
    short: 'Assist',
    desc: 'In-the-moment help — users ask AI to draft, summarise, look up and explain as they work.',
  },
  {
    key: 'augmented',
    label: 'AI Augmented',
    short: 'Augment',
    desc: 'AI drafts whole work products (letters, assessments, reports); a reviewer checks and approves.',
  },
  {
    key: 'workflow',
    label: 'Workflow Agent',
    short: 'Workflow',
    desc: 'A scoped agent runs a defined multi-step task end-to-end, pausing at a human gate.',
  },
  {
    key: 'agent',
    label: 'Autonomous Agent',
    short: 'Autonomous',
    desc: 'A multi-step agent handles a whole sub-process within authority; users approve the outcomes.',
  },
];

// ── Adoption level = the traffic light ──────────────────────────────────────
// The level itself is the RAG signal: red (early/behind) → green (embedded/ahead).
// Index 0–4 maps directly to a colour, so leaders and laggards read at a glance
// without any separate maturity indicator.
export type HeatStop = { name: string; short: string; bg: string; fg: string };

export const HEAT: HeatStop[] = [
  { name: 'Not used',  short: '—',        bg: '#f5f5f5', fg: '#a3a3a3' }, // grey
  { name: 'Piloting',  short: 'Pilot',    bg: '#fee2e2', fg: '#b91c1c' }, // red
  { name: 'Emerging',  short: 'Emerging', bg: '#fef3c7', fg: '#b45309' }, // amber
  { name: 'Scaling',   short: 'Scaling',  bg: '#bbf7d0', fg: '#15803d' }, // light green
  { name: 'Embedded',  short: 'Embedded', bg: '#16a34a', fg: '#ffffff' }, // green
];

// ── Consistent role-utilization + efficiency derivations ────────────────────
// Roles utilizing is COUNT-first so the count and the % can never contradict
// (with N=1 you get 0/1 or 1/1, i.e. 0% or 100% — coarse but honest).
const SHARE = [0, 0.12, 0.35, 0.6, 0.85];

export function rolesUsing(level: number, roleCount: number): { count: number; pct: number } {
  if (level <= 0 || roleCount <= 0) return { count: 0, pct: 0 };
  const count = Math.min(roleCount, Math.max(1, Math.round(roleCount * SHARE[level])));
  return { count, pct: Math.round((100 * count) / roleCount) };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const EFF_BASE = [0, 9, 14, 21, 29];

export function efficiencyGain(streamName: string, modeKey: AiMode['key'], level: number): number {
  if (level <= 0) return 0;
  return EFF_BASE[level] + (hash(streamName + ':' + modeKey) % 6); // +0..5 stable jitter
}
