// model.ts — Shared types + domain-color constants for the operating-model map.
// These were previously scattered across now-removed view files (DrillNode /
// ColumnBoard / ProcessFlow); consolidated here as the single source of truth.

// ── Domain colours (the three CEO domains) ──────────────────────────────────
// A confident, professional palette: royal blue (Core Business), teal (IT),
// amber/gold (Corporate Function). Saturated 600-level accents with clean tinted
// backgrounds — crisp and premium, not washed-out.
export const DOMAIN_HEX: Record<string, string> = {
  'Core Business': '#2563eb',
  'IT': '#0d9488',
  'Corporate Function': '#d97706',
};
export const DOMAIN_BG: Record<string, string> = {
  'Core Business': '#eef3ff',
  'IT': '#ecfdf7',
  'Corporate Function': '#fff7ed',
};
export const DOMAIN_BORDER: Record<string, string> = {
  'Core Business': '#c3d7fb',
  'IT': '#a7e8d8',
  'Corporate Function': '#fdd9a8',
};
export const DOMAIN_TEXT: Record<string, string> = {
  'Core Business': '#1d4ed8',
  'IT': '#0f766e',
  'Corporate Function': '#b45309',
};

// ── Uniform card size ────────────────────────────────────────────────────────
// Every node card (company, domain, division, value stream, step) renders at the
// SAME width/height so the map reads as one consistent grid. The height is sized
// to fit the worst-case content (a 2–3 line name + a badge/tag row) without
// clipping. Both the card components (MapNode) and the layout math (MapCanvas)
// import these — keep them as the single source of truth.
export const CARD_W = 220;
export const CARD_H = 96;

// ── Node focus state (drives the dim/focus/expand CSS classes) ───────────────
export type NodeFocusState = 'neutral' | 'dimmed' | 'focused' | 'expanded';

// ── Division summary (from /explorer/overview) ──────────────────────────────
export type DivisionSummary = {
  id: string;
  name: string;
  higherCategory: string | null;
  roles: number;
};

// ── Division process flow (from /explorer/division/:id/flow) ────────────────
// A sub-step is an L4 Sub-Process; its `l5` are the L5 Process Steps (v15).
export type FlowSubStep = { id: string; name: string; step: number; l5: { id: string; name: string; step: number }[] };
export type FlowStep = {
  id: string;
  step: number;
  name: string;
  subSteps: FlowSubStep[];
  inputs: string | null;
  outputs: string | null;
  upstream: string | null;
  downstream: string | null;
  roles: string[];
  categories: string[];
  primaryCategory: string | null;
  crossDomain: boolean;
  unowned: boolean;
};

export type FlowValueStream = {
  id: string;
  name: string;
  participationType: string;
};

export type DivisionFlow = {
  division: { id: string; name: string; higherCategory: string | null };
  valueStreams: FlowValueStream[];
  selectedId: string | null;
  selected: {
    id: string;
    name: string;
    steps: FlowStep[];
  } | null;
};
