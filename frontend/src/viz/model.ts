// model.ts — Shared types + domain-color constants for the operating-model map.
// These were previously scattered across now-removed view files (DrillNode /
// ColumnBoard / ProcessFlow); consolidated here as the single source of truth.

// ── Domain colours (the three CEO domains) ──────────────────────────────────
export const DOMAIN_HEX: Record<string, string> = {
  'Core Business': '#0d9488',
  'IT': '#4f46e5',
  'Corporate Function': '#7c3aed',
};
export const DOMAIN_BG: Record<string, string> = {
  'Core Business': '#f0fdfa',
  'IT': '#eef2ff',
  'Corporate Function': '#f5f3ff',
};
export const DOMAIN_BORDER: Record<string, string> = {
  'Core Business': '#99f6e4',
  'IT': '#c7d2fe',
  'Corporate Function': '#ddd6fe',
};
export const DOMAIN_TEXT: Record<string, string> = {
  'Core Business': '#0f766e',
  'IT': '#4338ca',
  'Corporate Function': '#6d28d9',
};

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
export type FlowStep = {
  id: string;
  step: number;
  name: string;
  subSteps: string[];
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
