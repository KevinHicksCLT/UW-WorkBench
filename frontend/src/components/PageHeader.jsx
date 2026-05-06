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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
