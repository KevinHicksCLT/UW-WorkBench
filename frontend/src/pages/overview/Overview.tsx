import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { usePreferences } from '../../lib/preferences';
import { useDialogs } from '../../lib/dialogs';
import { type Dashboard, WIDGET_MAP, DEFAULT_LAYOUT, widgetSpan } from '../../lib/dashboardWidgets';
import DashboardCustomizer from '../../components/home/DashboardCustomizer';
import { Button, Card, ErrorMessage, LoadingState } from '../../components/ui';

// Executive overview — the landing page. A single-glance summary of one
// company's operating model, sourced from GET /dashboard?companyId=….
// Layout precedence: the user's personal arrangement (preference store,
// "Customize" below) → the company layout from Data Admin → Home → the
// built-in default. View mode renders the plain grid (no DnD wrappers);
// edit mode swaps in DashboardCustomizer and auto-saves each change.

export default function Overview() {
  const { companyId, loading: companyLoading } = useCompany();
  const { prefs, update } = usePreferences();
  const { confirm } = useDialogs();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(params.get('customize') === '1');

  useEffect(() => {
    if (companyLoading) return;
    setLoading(true);
    setError('');
    api
      .get<Dashboard>(`/dashboard${companyId ? `?companyId=${companyId}` : ''}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [companyId, companyLoading]);

  if (loading || companyLoading) return <LoadingState message="Loading overview…" />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!data) return null;

  // Personal layout beats company layout beats default. Unknown ids (removed
  // widgets) are skipped at render.
  const personal = (prefs.dashboard as { layout?: string[] } | undefined)?.layout;
  const ids = personal ?? (Array.isArray(data.layout) ? data.layout : DEFAULT_LAYOUT);
  const widgets = ids
    .map((id) => WIDGET_MAP.get(id))
    .filter((w): w is NonNullable<typeof w> => Boolean(w));

  const stopEditing = () => {
    setEditing(false);
    if (params.get('customize')) setParams({}, { replace: true });
  };

  return (
    <div>
      {/* Customize bar — personal arrangement, auto-saved per user. */}
      <div className="flex items-center justify-end gap-2 mb-2">
        {editing ? (
          <>
            <span className="text-[11px] text-[#a3a3a3] mr-auto">
              Drag the handle to reorder · eye to hide · changes save automatically
            </span>
            {personal && (
              <Button
                variant="ghost"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Reset dashboard?',
                    message:
                      'Your personal card arrangement will be removed and the company default restored.',
                    confirmLabel: 'Reset',
                  });
                  if (ok) update({ dashboard: null });
                }}
              >
                Reset to default
              </Button>
            )}
            <Button variant="secondary" onClick={stopEditing}>
              Done
            </Button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 text-[12px] text-[#a3a3a3] hover:text-[#171717] transition-colors duration-150"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Customize
          </button>
        )}
      </div>

      {editing ? (
        <DashboardCustomizer
          data={data}
          layout={ids}
          onChange={(layout) => update({ dashboard: { layout } })}
        />
      ) : widgets.length === 0 ? (
        <Card variant="elevated" className="p-8 text-center text-sm text-[#a3a3a3]">
          No dashboard areas are configured. Add some in{' '}
          <span className="text-[#525252]">Data Admin → Home</span>.
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {widgets.map((w) => (
            <div key={w.id} className={widgetSpan(w.kind)}>
              {w.render(data)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
