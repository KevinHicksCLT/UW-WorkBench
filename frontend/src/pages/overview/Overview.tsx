import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { type Dashboard, WIDGET_MAP, DEFAULT_LAYOUT, widgetSpan } from '../../lib/dashboardWidgets';
import { Card, ErrorMessage, LoadingState } from '../../components/ui';

// Executive overview — the landing page. A single-glance summary of one
// company's operating model, sourced from GET /dashboard?companyId=…. Which
// areas show (and in what order) is configured per company in Data Admin → Home;
// the widget catalog + rendering live in lib/dashboardWidgets.

export default function Overview() {
  const { companyId, loading: companyLoading } = useCompany();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (companyLoading) return;
    setLoading(true);
    setError('');
    api.get(`/dashboard${companyId ? `?companyId=${companyId}` : ''}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [companyId, companyLoading]);

  if (loading || companyLoading) return <LoadingState message="Loading overview…" />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!data) return null;

  // The chosen layout (ordered widget ids); fall back to the default. Unknown ids
  // (e.g. a removed widget) are skipped.
  const ids = Array.isArray(data.layout) ? data.layout : DEFAULT_LAYOUT;
  const widgets = ids.map((id) => WIDGET_MAP.get(id)).filter((w): w is NonNullable<typeof w> => Boolean(w));

  return (
    <div>
      {widgets.length === 0 ? (
        <Card variant="elevated" className="p-8 text-center text-sm text-[#a3a3a3]">
          No dashboard areas are configured. Add some in <span className="text-[#525252]">Data Admin → Home</span>.
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {widgets.map((w) => (
            <div key={w.id} className={widgetSpan(w.kind)}>{w.render(data)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
