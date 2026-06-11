import type { ReactNode } from 'react';
import { useRegisterCrumb } from '../lib/breadcrumbs';

type Props = {
  title: string;
  subtitle?: string;
  // Optional eyebrow line above the title — use for domain attribution.
  eyebrow?: string;
  actions?: ReactNode;
};

export default function PageHeader({ title, subtitle, eyebrow, actions }: Props) {
  // Contribute this page to the visited-path breadcrumb trail. The trail
  // itself renders once, in the global header (components/BreadcrumbBar) —
  // pages no longer carry their own breadcrumb.
  useRegisterCrumb(title);

  return (
    <div className="mb-4">
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
