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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  },
  month(d: DateLike) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  },
};
