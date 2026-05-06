export default function PageHeader({ title, subtitle, actions, breadcrumbs }) {
  return (
    <div className="mb-6">
      {breadcrumbs && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-300">/</span>}
              {b.to ? (
                <a href={b.to} className="hover:text-brand-700">{b.label}</a>
              ) : (
                <span>{b.label}</span>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
