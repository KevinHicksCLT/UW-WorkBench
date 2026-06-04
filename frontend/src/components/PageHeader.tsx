import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRegisterCrumb, useBreadcrumbTrail } from '../lib/breadcrumbs';

type Props = {
  title: string;
  subtitle?: string;
  // Optional eyebrow line above the title — use for domain attribution.
  eyebrow?: string;
  actions?: ReactNode;
  // Suppress the visited-path breadcrumb when the page renders its own richer
  // breadcrumb (e.g. OrgTable's state-driven drill path), to avoid doubling up.
  hideBreadcrumb?: boolean;
};

export default function PageHeader({ title, subtitle, eyebrow, actions, hideBreadcrumb }: Props) {
  // Contribute this page to the visited-path breadcrumb trail, then render it.
  useRegisterCrumb(title);
  const trail = useBreadcrumbTrail();
  const navigate = useNavigate();
  // Drop the leading Home crumb — the breadcrumb starts at the tab name.
  const crumbs = trail[0]?.to === '/' ? trail.slice(1) : trail;

  return (
    <div className="mb-6">
      {!hideBreadcrumb && crumbs.length > 0 && (
        // Same chevron + dark-pill + clear-focus treatment as the Value Streams map
        // breadcrumb (see MapCanvas.tsx / .focus-crumb-* in index.css).
        <nav className="flex items-center flex-wrap mb-2" aria-label="Breadcrumb">
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={c.to} className="inline-flex items-center">
                {i > 0 && <span style={{ color: '#d4d4d4', margin: '0 4px' }}>›</span>}
                {isLast ? (
                  <span className="focus-crumb-active" aria-current="page">{c.label}</span>
                ) : (
                  <Link to={c.to} className="focus-crumb-ancestor">{c.label}</Link>
                )}
              </span>
            );
          })}
          <button
            onClick={() => navigate(crumbs.length > 1 ? crumbs[0].to : '/')}
            aria-label="Clear focus"
            style={{
              marginLeft: 6, width: 22, height: 22, borderRadius: 6,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: '#a3a3a3',
              background: 'transparent', border: '1px solid #eaeaea', cursor: 'pointer',
            }}
          >
            ✕
          </button>
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
