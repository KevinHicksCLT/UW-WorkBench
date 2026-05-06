export const fmt = {
  currency(n, opts = {}) {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    const { compact = false } = opts;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: compact ? 1 : 0,
      ...(compact && { notation: 'compact' }),
    }).format(n);
  },
  number(n, opts = {}) {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 1,
      ...opts,
    }).format(n);
  },
  percent(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    return `${(n * 100).toFixed(0)}%`;
  },
  date(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  },
  month(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  },
};

export const STAGE_LABELS = {
  IDEA: 'Idea',
  PLAN: 'Plan',
  EXECUTE: 'Execute',
  REALIZE: 'Realize',
  COMPLETE: 'Complete',
};

export const STAGE_ORDER = ['IDEA', 'PLAN', 'EXECUTE', 'REALIZE', 'COMPLETE'];

export const STATUS_PILL_CLASS = {
  ON_TRACK: 'pill-green',
  AT_RISK: 'pill-amber',
  OFF_TRACK: 'pill-red',
};

export const STATUS_LABEL = {
  ON_TRACK: 'On Track',
  AT_RISK: 'At Risk',
  OFF_TRACK: 'Off Track',
};
