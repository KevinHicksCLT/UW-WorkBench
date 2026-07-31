// Forms Rationalization — the derivation layer + decision store. Every number
// the views show is COMPUTED here from the form records + decision records
// (spec §3: derived metrics are never hand-entered). The store is
// localStorage-backed so demo decisions survive a reload; swapping it for a
// backend API later changes nothing above this module.

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_REGIONS, MATRIX_BY_STATE, MOCK_FORMS } from './mockData';
import type { MatrixRow } from './mockData';
import { US_STATES } from './types';
import type {
  ExistenceReason,
  FormClassification,
  FormDecision,
  FormDecisionStatus,
  FormRecord,
  StateStatus,
  UnifiedForm,
} from './types';

// ── Decision store (FR-5.x) ─────────────────────────────────────────────────

export interface FormsStore {
  decisions: Record<string, FormDecision>;
  classifications: Record<string, FormClassification>;
  unified: UnifiedForm[];
}

const STORE_KEY = 'forms.rationalization.v1';
const EMPTY_STORE: FormsStore = { decisions: {}, classifications: {}, unified: [] };

function readStore(): FormsStore {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Partial<FormsStore>;
    return {
      decisions: parsed.decisions ?? {},
      classifications: parsed.classifications ?? {},
      unified: parsed.unified ?? [],
    };
  } catch {
    return EMPTY_STORE;
  }
}

/** Decision + classification store with audit fields (who/when/prior value). */
export function useFormsStore(userName: string) {
  const [store, setStore] = useState<FormsStore>(readStore);
  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
      // Private mode / quota — decisions stay in memory for the session.
    }
  }, [store]);

  const decide = useCallback(
    (
      formId: string,
      status: FormDecisionStatus,
      reason: string,
      extra?: Pick<FormDecision, 'targetCoreFormId' | 'conditionalBlock' | 'unifiedFormId'>,
    ) => {
      setStore((s) => ({
        ...s,
        decisions: {
          ...s.decisions,
          [formId]: {
            status,
            reason,
            decidedBy: userName,
            decidedAt: new Date().toISOString(),
            ...extra,
          },
        },
      }));
    },
    [userName],
  );

  const withdraw = useCallback((formId: string) => {
    setStore((s) => {
      const decisions = { ...s.decisions };
      const gone = decisions[formId];
      delete decisions[formId];
      // Withdrawing a UNIFY member dissolves the unified target once no member
      // references it any more.
      const unified = gone?.unifiedFormId
        ? s.unified.filter(
            (u) =>
              u.formId !== gone.unifiedFormId ||
              Object.entries(decisions).some(([, d]) => d.unifiedFormId === u.formId),
          )
        : s.unified;
      return { ...s, decisions, unified };
    });
  }, []);

  const classify = useCallback(
    (formId: string, reason: ExistenceReason, prior: ExistenceReason) => {
      setStore((s) => ({
        ...s,
        classifications: {
          ...s.classifications,
          [formId]: {
            reason,
            decidedBy: userName,
            decidedAt: new Date().toISOString(),
            priorValue: prior,
          },
        },
      }));
    },
    [userName],
  );

  /** FR-5.3 — create the multistate target form and mark members UNIFY.
   *  Returns an error string when the name already exists (no-duplicate rule). */
  const unify = useCallback(
    (title: string, region: string, memberFormIds: string[], reason: string): string | null => {
      const clash =
        MOCK_FORMS.some((f) => f.title.toLowerCase() === title.toLowerCase()) ||
        readStore().unified.some((u) => u.title.toLowerCase() === title.toLowerCase());
      if (clash) return `A form named "${title}" already exists.`;
      const members = MOCK_FORMS.filter((f) => memberFormIds.includes(f.formId));
      const states = [...new Set(members.map((f) => f.state).filter((s): s is string => !!s))];
      const formId = `UNI-${region
        .replace(/[^A-Za-z]/g, '')
        .slice(0, 6)
        .toUpperCase()}-${String(readStore().unified.length + 1).padStart(3, '0')}`;
      const now = new Date().toISOString();
      setStore((s) => ({
        ...s,
        unified: [
          ...s.unified,
          { formId, title, region, states, memberFormIds, createdBy: userName, createdAt: now },
        ],
        decisions: {
          ...s.decisions,
          ...Object.fromEntries(
            memberFormIds.map((id) => [
              id,
              {
                status: 'UNIFY' as const,
                reason,
                decidedBy: userName,
                decidedAt: now,
                unifiedFormId: formId,
              },
            ]),
          ),
        },
      }));
      return null;
    },
    [userName],
  );

  return { store, decide, withdraw, classify, unify };
}

// ── Lookups ─────────────────────────────────────────────────────────────────

export const formById = new Map(MOCK_FORMS.map((f) => [f.formId, f]));

export function effectiveReason(f: FormRecord, store: FormsStore): ExistenceReason {
  return store.classifications[f.formId]?.reason ?? f.existenceReason;
}

export function decisionOf(f: FormRecord, store: FormsStore): FormDecisionStatus {
  return store.decisions[f.formId]?.status ?? 'UNDECIDED';
}

/** A decided-away form (its requirement folds into a core/unified target). */
function foldsAway(status: FormDecisionStatus): boolean {
  return status === 'STANDARDIZE' || status === 'UNIFY' || status === 'RETIRE';
}

// ── E1 — core summaries ─────────────────────────────────────────────────────

export interface CoreSummary {
  core: FormRecord;
  productCount: number;
  stateCount: number;
  /** % of states where the countrywide form applies with no active variation. */
  commonalityPct: number;
  stateVariations: FormRecord[];
  productVariations: FormRecord[];
}

export function coreSummaries(store: FormsStore, lobFilter?: string | null): CoreSummary[] {
  return MOCK_FORMS.filter(
    (f) => f.layer === 'CORE' && (!lobFilter || f.lineOfBusiness === lobFilter),
  ).map((core) => {
    const children = MOCK_FORMS.filter((f) => f.parentFormId === core.formId);
    const stateVariations = children.filter((f) => f.layer === 'STATE_VARIATION');
    const productVariations = children.filter((f) => f.layer === 'PRODUCT_VARIATION');
    // A decided variation no longer counts against commonality — its
    // requirement lives in the core / unified target now.
    const activeStates = new Set(
      children
        .filter((f) => f.state && !foldsAway(decisionOf(f, store)))
        .map((f) => f.state as string),
    );
    return {
      core,
      productCount: core.productIds.length,
      stateCount: US_STATES.length,
      commonalityPct: Math.round(((US_STATES.length - activeStates.size) / US_STATES.length) * 100),
      stateVariations,
      productVariations,
    };
  });
}

// ── E2 — state / region rollups ─────────────────────────────────────────────

export interface StateRollup {
  code: string;
  name: string;
  status: StateStatus;
  variantForms: FormRecord[];
  topReason: ExistenceReason | null;
}

/** Per-state status for one core form (or the whole portfolio when null). */
export function stateRollups(coreFormId: string | null, store: FormsStore): StateRollup[] {
  const scope = MOCK_FORMS.filter(
    (f) =>
      f.state &&
      !foldsAway(decisionOf(f, store)) &&
      (coreFormId ? f.parentFormId === coreFormId : f.layer !== 'CORE'),
  );
  return US_STATES.map(({ code, name }) => {
    const variants = scope.filter((f) => f.state === code);
    const hasState = variants.some((f) => f.layer === 'STATE_VARIATION');
    const hasProduct = variants.some((f) => f.layer === 'PRODUCT_VARIATION');
    // A state carrying only product-level variants reads product-specific.
    const status: StateStatus = hasState ? 'state' : hasProduct ? 'product' : 'standard';
    const reasons = variants.map((f) => effectiveReason(f, store));
    return {
      code,
      name,
      status,
      variantForms: variants,
      topReason: reasons[0] ?? null,
    };
  });
}

export interface RegionRollup {
  name: string;
  states: StateRollup[];
  /** Worst member status colors the region tile. */
  status: StateStatus;
  variantCount: number;
  /** The unified target form covering this region, when one exists. */
  unifiedForm: UnifiedForm | null;
}

export function regionRollups(rollups: StateRollup[], store: FormsStore): RegionRollup[] {
  const byCode = new Map(rollups.map((r) => [r.code, r]));
  return DEFAULT_REGIONS.map((def) => {
    const states = def.states.map((c) => byCode.get(c)).filter((r): r is StateRollup => Boolean(r));
    const worst: StateStatus = states.some((s) => s.status === 'product')
      ? 'product'
      : states.some((s) => s.status === 'state')
        ? 'state'
        : 'standard';
    return {
      name: def.name,
      states,
      status: worst,
      variantCount: states.reduce((n, s) => n + s.variantForms.length, 0),
      unifiedForm: store.unified.find((u) => u.region === def.name) ?? null,
    };
  });
}

// ── E3 — matrix ─────────────────────────────────────────────────────────────

export function matrixFor(state: string): MatrixRow[] | null {
  return MATRIX_BY_STATE[state] ?? null;
}

export const MATRIX_STATES = Object.keys(MATRIX_BY_STATE);

/** Summary band: % of cells common / state-required / product-specific. */
export function matrixSummary(rows: MatrixRow[]): {
  common: number;
  state: number;
  product: number;
} {
  const counts = { common: 0, state: 0, product: 0 };
  let total = 0;
  for (const row of rows) {
    counts[row.kind] += row.cells.length;
    total += row.cells.length;
  }
  const pct = (x: number) => (total ? Math.round((x / total) * 100) : 0);
  return { common: pct(counts.common), state: pct(counts.state), product: pct(counts.product) };
}

// ── E4 — clusters ───────────────────────────────────────────────────────────

export type Savings = 'High' | 'Medium' | 'Low';

export interface ClusterGroup {
  clusterId: string;
  similarityPct: number;
  state: string | null;
  lineOfBusiness: string;
  members: FormRecord[];
  productIds: string[];
  /** Savings heuristic: members eliminated × similarity. */
  savings: Savings;
}

export function clusterGroups(): ClusterGroup[] {
  const byId = new Map<string, FormRecord[]>();
  for (const f of MOCK_FORMS)
    if (f.cluster) byId.set(f.cluster.clusterId, [...(byId.get(f.cluster.clusterId) ?? []), f]);
  return [...byId.entries()]
    .map(([clusterId, members]) => {
      const similarityPct = members[0].cluster?.similarityPct ?? 0;
      const score = (members.length - 1) * similarityPct;
      return {
        clusterId,
        similarityPct,
        state: members.every((m) => m.state === members[0].state) ? members[0].state : null,
        lineOfBusiness: members[0].lineOfBusiness,
        members,
        productIds: [...new Set(members.flatMap((m) => m.productIds))],
        savings: (score >= 180 ? 'High' : score >= 85 ? 'Medium' : 'Low') as Savings,
      };
    })
    .sort((a, b) => b.similarityPct - a.similarityPct);
}

// ── E6 — dashboard ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalForms: number;
  coreForms: number;
  stateVariations: number;
  productVariations: number;
  candidates: number;
  decided: number;
  outstanding: number;
  progressPct: number;
  /** Forms today vs projected after every recorded decision executes. */
  currentCount: number;
  projectedCount: number;
  unifiedCount: number;
}

/** A rationalization candidate: an undecided non-core form that clustering or
 *  the agent flagged as consolidatable. */
export function isCandidate(f: FormRecord, store: FormsStore): boolean {
  if (f.layer === 'CORE') return false;
  if (decisionOf(f, store) !== 'UNDECIDED') return false;
  return (
    Boolean(f.cluster) ||
    f.agent?.disposition === 'STANDARDIZE' ||
    f.agent?.disposition === 'RETIRE'
  );
}

export function dashboardStats(store: FormsStore): DashboardStats {
  const nonCore = MOCK_FORMS.filter((f) => f.layer !== 'CORE');
  const decided = nonCore.filter((f) => decisionOf(f, store) !== 'UNDECIDED').length;
  const folded = nonCore.filter((f) => foldsAway(decisionOf(f, store))).length;
  const candidates = MOCK_FORMS.filter((f) => isCandidate(f, store)).length;
  const total = MOCK_FORMS.length;
  return {
    totalForms: total,
    coreForms: MOCK_FORMS.filter((f) => f.layer === 'CORE').length,
    stateVariations: MOCK_FORMS.filter((f) => f.layer === 'STATE_VARIATION').length,
    productVariations: MOCK_FORMS.filter((f) => f.layer === 'PRODUCT_VARIATION').length,
    candidates,
    decided,
    outstanding: nonCore.length - decided,
    progressPct: nonCore.length ? Math.round((decided / nonCore.length) * 100) : 0,
    currentCount: total,
    projectedCount: total - folded + store.unified.length,
    unifiedCount: store.unified.length,
  };
}

export interface Opportunity {
  name: string;
  savings: Savings;
  /** Where the supporting evidence lives. */
  target: { kind: 'cluster'; clusterId: string } | { kind: 'matrix'; state: string };
  detail: string;
}

export function opportunities(store: FormsStore): Opportunity[] {
  const open = clusterGroups().filter((g) =>
    g.members.some((m) => decisionOf(m, store) === 'UNDECIDED'),
  );
  const fromClusters: Opportunity[] = open.map((g) => ({
    name: g.state
      ? `${g.state} Amendment Consolidation (${g.clusterId})`
      : `${g.lineOfBusiness} ${g.clusterId} Consolidation`,
    savings: g.savings,
    target: { kind: 'cluster', clusterId: g.clusterId },
    detail: `${g.members.length} forms · ${g.similarityPct}% similar`,
  }));
  const fromMatrix: Opportunity[] = MATRIX_STATES.filter((s) =>
    (MATRIX_BY_STATE[s] ?? []).some((r) => r.kind === 'product'),
  ).map((s) => ({
    name: `${s} Product Disclosure Alignment`,
    savings: 'Medium',
    target: { kind: 'matrix', state: s },
    detail: 'Product-specific cells in the requirement matrix',
  }));
  const rank = { High: 0, Medium: 1, Low: 2 };
  return [...fromClusters, ...fromMatrix].sort((a, b) => rank[a.savings] - rank[b.savings]);
}

// ── E7 — context package ────────────────────────────────────────────────────

export interface ContextPackage {
  formId: string;
  title: string;
  parentForm: string | null;
  state: string | null;
  products: string[];
  citations: string[];
  coverages: string[];
  rules: string[];
  relatedForms: string[];
}

/** FR-7.1 — the structured bridge context the assistant receives. */
export function contextPackage(f: FormRecord): ContextPackage {
  return {
    formId: f.formId,
    title: f.title,
    parentForm: f.parentFormId ? (formById.get(f.parentFormId)?.title ?? f.parentFormId) : null,
    state: f.state,
    products: f.productIds,
    citations: f.regulatoryCitations,
    coverages: f.coverageRefs,
    rules: f.relatedRules,
    relatedForms: f.relatedForms,
  };
}
