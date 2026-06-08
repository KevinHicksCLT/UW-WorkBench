import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';

// ─── Home dashboard configurator (Data Admin → Home) ─────────────────────────
// The Home screen is a LIVE rollup of the company's operating model — count
// tiles, workforce mix, and model footprint — so there's no layout to edit. The
// one dashboard-level setting is the company name (its title); everything else is
// driven by the underlying data. This panel makes that explicit: edit the company
// profile here, and jump straight to the tab that feeds each dashboard widget.

type WidgetRef = { title: string; shows: string; tab: string; section?: string; tabLabel: string };

const WIDGETS: WidgetRef[] = [
  { title: 'Divisions & Roles tiles', shows: 'Division, department, and role counts', tab: 'organization', section: 'divisions', tabLabel: 'Organization' },
  { title: 'Value Streams tile + Domains', shows: 'Value-stream and domain counts', tab: 'valueStreams', section: 'levels', tabLabel: 'Value Streams' },
  { title: 'Initiatives tile', shows: 'Programs, workstreams, and initiatives', tab: 'initiatives', section: 'portfolio', tabLabel: 'Initiatives' },
  { title: 'Deliverables & Tasks tiles', shows: 'Deliverable and task counts', tab: 'work', section: 'deliverables', tabLabel: 'Deliverables & Tasks' },
  { title: 'Workforce mix', shows: 'People by employment type and region', tab: 'people', section: 'people', tabLabel: 'People' },
  { title: 'Model footprint — scenarios & applications', shows: 'Change scenarios and the application landscape', tab: 'initiatives', section: 'scenarios', tabLabel: 'Initiatives' },
];

export default function DashboardAdmin({ onNavigate }: { onNavigate?: (tab: string, section?: string) => void }) {
  const { companyId, company, refresh } = useCompany();
  const [name, setName] = useState('');
  const [original, setOriginal] = useState('');
  const [companyDbId, setCompanyDbId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Load the active company record (its name is the dashboard title).
  useEffect(() => {
    if (!companyId) return;
    setError(''); setSavedAt(null);
    api.get(`/admin/company/${companyId}`)
      .then((c: { id: string; name: string }) => { setName(c.name); setOriginal(c.name); setCompanyDbId(c.id); })
      .catch((e) => setError(e.message));
  }, [companyId]);

  const dirty = name.trim() !== original && name.trim().length > 0;

  const save = async () => {
    if (!companyDbId) return;
    setSaving(true); setError('');
    try {
      await api.patch(`/admin/company/${companyDbId}`, { name: name.trim() });
      setOriginal(name.trim());
      setSavedAt(new Date().toLocaleTimeString());
      refresh(); // update the company switcher + dashboard title everywhere
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-[#666666]">
        The <span className="font-medium text-[#171717]">Home</span> screen is a live summary of{' '}
        {company?.name ?? 'this company'}’s operating model — headline counts, workforce mix, and model
        footprint. It updates automatically as you edit the data; there’s no layout to configure. The only
        dashboard-level setting is the title below. Use the shortcuts to edit what each section shows.
      </p>

      {/* Company profile — the dashboard title */}
      <div className="card-elevated p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-1">Dashboard title (company name)</h3>
        <p className="text-xs text-[#a3a3a3] mb-3">Shown as the heading on Home and in the company switcher.</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" />
          </div>
          {savedAt && !dirty && <span className="text-xs text-[#16a34a] pb-2.5">Saved {savedAt}</span>}
          <button className="btn-primary disabled:opacity-50" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save title'}
          </button>
        </div>
        {error && <div className="text-sm text-[#be123c] mt-3">{error}</div>}
      </div>

      {/* Widget → source map */}
      <div>
        <h3 className="text-sm font-semibold text-[#171717] mb-1">What the dashboard shows</h3>
        <p className="text-xs text-[#a3a3a3] mb-3">Each part of Home is a rollup of one area. Jump straight to its editor.</p>
        <div className="card-elevated overflow-hidden">
          {WIDGETS.map((w) => (
            <div key={w.title} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa]">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[#171717]">{w.title}</div>
                <div className="text-xs text-[#a3a3a3]">{w.shows}</div>
              </div>
              <button
                onClick={() => onNavigate?.(w.tab, w.section)}
                className="btn-secondary text-xs flex-shrink-0 inline-flex items-center gap-1"
              >
                Edit in {w.tabLabel}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
