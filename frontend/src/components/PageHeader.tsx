import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useRegisterCrumb, useBreadcrumbTrail } from '../lib/breadcrumbs';

type Props = {
  title: string;
  subtitle?: string;
  // Optional eyebrow line above the title — use for domain attribution.
  eyebrow?: string;
  actions?: ReactNode;
};

export default function PageHeader({ title, subtitle, eyebrow, actions }: Props) {
  // Contribute this page to the visited-path breadcrumb trail, then render it.
  useRegisterCrumb(title);
  const trail = useBreadcrumbTrail();

  return (
    <div className="mb-6">
      {trail.length > 1 && (
        <nav className="flex items-center gap-1.5 text-xs mb-2" aria-label="Breadcrumb">
          {trail.map((c, i) => {
            const isLast = i === trail.length - 1;
            return (
              <span key={c.to} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-[#d4d4d4] select-none">/</span>}
                {isLast ? (
                  <span className="font-semibold text-[#171717]" aria-current="page">{c.label}</span>
                ) : (
                  <Link to={c.to} className="text-[#a3a3a3] hover:text-[#171717] transition-colors duration-150">{c.label}</Link>
                )}
              </span>
            );
          })}
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
