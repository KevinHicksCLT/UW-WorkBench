import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Crumb = { label: string; to?: string };

type Props = {
  title: string;
  subtitle?: string;
  // Optional eyebrow line above the title — use for domain attribution
  // (e.g. "Core Business · Division") or the node-type label from a detail page.
  eyebrow?: string;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
};

export default function PageHeader({ title, subtitle, eyebrow, actions, breadcrumbs }: Props) {
  return (
    <div className="mb-6">
      {breadcrumbs && (
        <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2" aria-label="Breadcrumb">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-300 select-none">/</span>}
              {b.to ? (
                <Link to={b.to} className="hover:text-brand-700 transition-colors">{b.label}</Link>
              ) : (
                <span className="text-slate-500">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-eyebrow uppercase text-accent-600 mb-1">{eyebrow}</p>
          )}
          <h1 className="text-h1 text-slate-900 truncate">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
