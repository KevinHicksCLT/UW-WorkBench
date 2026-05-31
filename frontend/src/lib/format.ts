type Numeric = number | null | undefined;
type DateLike = string | number | Date | null | undefined;

export const fmt = {
  currency(n: Numeric, opts: { compact?: boolean } = {}) {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    const { compact = false } = opts;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: compact ? 1 : 0,
      ...(compact ? { notation: 'compact' as const } : {}),
    }).format(n);
  },
  number(n: Numeric, opts: Intl.NumberFormatOptions = {}) {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 1,
      ...opts,
    }).format(n);
  },
  percent(n: Numeric) {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    return `${(n * 100).toFixed(0)}%`;
  },
  date(d: DateLike) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  },
  month(d: DateLike) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  },
};

export const STAGE_LABELS: Record<string, string> = {
  IDEA: 'Idea',
  PLAN: 'Plan',
  EXECUTE: 'Execute',
  REALIZE: 'Realize',
  COMPLETE: 'Complete',
};

export const STAGE_ORDER = ['IDEA', 'PLAN', 'EXECUTE', 'REALIZE', 'COMPLETE'];

export const STATUS_PILL_CLASS: Record<string, string> = {
  ON_TRACK: 'pill-green',
  AT_RISK: 'pill-amber',
  OFF_TRACK: 'pill-red',
};

export const STATUS_LABEL: Record<string, string> = {
  ON_TRACK: 'On Track',
  AT_RISK: 'At Risk',
  OFF_TRACK: 'Off Track',
};

// Value-stream participation types (from the workbook) → pill style.
export const PARTICIPATION_CLASS: Record<string, string> = {
  Lead: 'pill-blue',
  Core: 'pill-green',
  Support: 'pill-slate',
  Oversight: 'pill-amber',
  Control: 'pill-amber',
};
