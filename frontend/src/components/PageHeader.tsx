import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Crumb = { label: string; to?: string };

type Props = {
  title: string;
  subtitle?: string;
  // Optional eyebrow line above the title — use for domain attribution.
  eyebrow?: string;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
};

export default function PageHeader({ title, subtitle, eyebrow, actions, breadcrumbs }: Props) {
  return (
    <div className="mb-6">
      {breadcrumbs && (
        <nav className="flex items-center gap-1.5 text-xs text-[#a3a3a3] mb-2" aria-label="Breadcrumb">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-[#d4d4d4] select-none">/</span>}
              {b.to ? (
                <Link to={b.to} className="hover:text-[#171717] transition-colors duration-150">{b.label}</Link>
              ) : (
                <span className="text-[#666666]">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#666666] mb-1">{eyebrow}</p>
          )}
          <h1 className="text-h1 text-[#171717] truncate">{title}</h1>
          {subtitle && <p className="text-sm text-[#666666] mt-1">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
