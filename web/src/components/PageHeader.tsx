import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  /** Optional eyebrow line above the title. */
  eyebrow?: string;
  actions?: ReactNode;
  /** Tighter bottom margin — for pages where the header sits close to dense content. */
  dense?: boolean;
};

export default function PageHeader({ title, subtitle, eyebrow, actions, dense }: Props) {
  return (
    <div className={dense ? 'mb-2' : 'mb-4'}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#666666] mb-1">
              {eyebrow}
            </p>
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
