import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { WIDGET_CATALOG, WIDGET_MAP, DEFAULT_LAYOUT, FOOTPRINT_STATS, FOOTPRINT_DEFAULT, type Widget } from '../../lib/dashboardWidgets';

// ─── Home dashboard configurator (Data Admin → Home) ─────────────────────────
// The Home screen is a per-company layout of widgets drawn from a fixed catalog
// (each widget is a live rollup of the operating model). Here an admin sets the
// dashboard title (company name) and chooses which areas appear, in what order —
// add, remove, and reorder. The chosen layout is saved on the company and shown
// to everyone viewing it; the data inside each widget stays driven by the model.

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function KindBadge({ kind }: { kind: Widget['kind'] }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded bg-[#f5f5f5] text-[#a3a3a3]">
      {kind === 'card' ? 'Card' : 'Tile'}
    </span>
  );
}

function Chevron({ dir }: { dir: 'up' | 'down' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === 'up' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  );
}

export default function DashboardAdmin({ onNavigate }: { onNavigate?: (tab: string, section?: string) => void }) {
  const { companyId, company, refresh } = useCompany();
  const [companyDbId, setCompanyDbId] = useState<string | null>(null);

  // Title (company name).
  const [name, setName] = useState('');
  const [origName, setOrigName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSavedAt, setNameSavedAt] = useState<string | null>(null);

  // Layout (ordered widget ids).
  const [layout, setLayout] = useState<string[]>([]);
  const [savedLayout, setSavedLayout] = useState<string[]>([]);
  // Which stats the Model footprint card lists.
  const [footprint, setFootprint] = useState<string[]>(FOOTPRINT_DEFAULT);
  const [savedFootprint, setSavedFootprint] = useState<string[]>(FOOTPRINT_DEFAULT);
  // Per-widget custom display titles (empty/missing -> catalog default).
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [savedTitles, setSavedTitles] = useState<Record<string, string>>({});
  // Which widget row's settings editor is expanded.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutSavedAt, setLayoutSavedAt] = useState<string | null>(null);

  const [error, setError] = useState('');

  useEffect(() => {
    if (!companyId) return;
    setError(''); setNameSavedAt(null); setLayoutSavedAt(null);
    api.get(`/admin/company/${companyId}`)
      .then((c: { id: string; name: string; dashboardConfig?: { widgets?: string[]; footprintStats?: string[]; widgetTitles?: Record<string, string> } | null }) => {
        setCompanyDbId(c.id);
        setName(c.name); setOrigName(c.name);
        // Keep only ids still in the catalog; fall back to the default layout.
        const saved = (c.dashboardConfig?.widgets ?? DEFAULT_LAYOUT).filter((id) => WIDGET_MAP.has(id));
        setLayout(saved); setSavedLayout(saved);
        const fp = (c.dashboardConfig?.footprintStats ?? FOOTPRINT_DEFAULT).filter((k) => FOOTPRINT_STATS[k]);
        setFootprint(fp); setSavedFootprint(fp);
        const wt = c.dashboardConfig?.widgetTitles ?? {};
        setTitles(wt); setSavedTitles(wt);
      })
      .catch((e) => setError(e.message));
  }, [companyId]);

  const nameDirty = name.trim() !== origName && name.trim().length > 0;
  const sameTitles = (a: Record<string, string>, b: Record<string, string>) => JSON.stringify(a) === JSON.stringify(b);
  const layoutDirty = !same(layout, savedLayout) || !same(footprint, savedFootprint) || !sameTitles(titles, savedTitles);

  const saveName = async () => {
    if (!companyDbId) return;
    setSavingName(true); setError('');
    try {
      await api.patch(`/admin/company/${companyDbId}`, { name: name.trim() });
      setOrigName(name.trim());
      setNameSavedAt(new Date().toLocaleTimeString());
      refresh(); // update the company switcher + dashboard title everywhere
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingName(false);
    }
  };

  const saveLayout = async () => {
    if (!companyDbId) return;
    setSavingLayout(true); setError('');
    try {
      const cleanTitles = Object.fromEntries(Object.entries(titles).filter(([, v]) => v.trim()));
      await api.patch(`/admin/company/${companyDbId}/dashboard`, { widgets: layout, footprintStats: footprint, widgetTitles: cleanTitles });
      setSavedLayout(layout); setSavedFootprint(footprint);
      setTitles(cleanTitles); setSavedTitles(cleanTitles);
      setLayoutSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingLayout(false);
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= layout.length) return;
    const next = [...layout];
    [next[i], next[j]] = [next[j], next[i]];
    setLayout(next);
  };
  const remove = (id: string) => setLayout((l) => l.filter((x) => x !== id));
  const add = (id: string) => setLayout((l) => (l.includes(id) ? l : [...l, id]));

  const toggleFootprint = (k: string) =>
    setFootprint((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]));

  const available = WIDGET_CATALOG.filter((w) => !layout.includes(w.id));
  const availTiles = available.filter((w) => w.kind === 'tile');
  const availCards = available.filter((w) => w.kind === 'card');

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-[#666666]">
        The <span className="font-medium text-[#171717]">Home</span> screen is {company?.name ?? 'this company'}’s
        dashboard. Choose which areas appear and in what order below — each area is a live rollup that updates as you
        edit the underlying data. Set the dashboard title (company name) here too.
      </p>

      {/* Company profile — the dashboard title */}
      <div className="card-elevated p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-1">Dashboard title (company name)</h3>
        <p className="text-xs text-[#a3a3a3] mb-3">Shown as the heading on Home and in the company switcher.</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" />
          </div>
          {nameSavedAt && !nameDirty && <span className="text-xs text-[#16a34a] pb-2.5">Saved {nameSavedAt}</span>}
          <button className="btn-primary disabled:opacity-50" disabled={!nameDirty || savingName} onClick={saveName}>
            {savingName ? 'Saving…' : 'Save title'}
          </button>
        </div>
      </div>

      {/* Layout — what appears on the dashboard */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-1">
          <h3 className="text-sm font-semibold text-[#171717]">On the dashboard</h3>
          <div className="flex items-center gap-3">
            {layoutSavedAt && !layoutDirty && <span className="text-xs text-[#16a34a]">Saved {layoutSavedAt}</span>}
            <button
              className="text-xs text-[#525252] hover:text-[#171717] disabled:opacity-40"
              disabled={same(layout, DEFAULT_LAYOUT)}
              onClick={() => setLayout(DEFAULT_LAYOUT)}
            >
              Reset to default
            </button>
            <button className="btn-primary text-xs disabled:opacity-50" disabled={!layoutDirty || savingLayout} onClick={saveLayout}>
              {savingLayout ? 'Saving…' : 'Save layout'}
            </button>
          </div>
        </div>
        <p className="text-xs text-[#a3a3a3] mb-3">Reorder with the arrows, remove with ×. Changes apply once you save.</p>

        <div className="card-elevated overflow-hidden">
          {layout.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-[#a3a3a3]">No areas yet — add some below.</div>
          )}
          {layout.map((id, i) => {
            const w = WIDGET_MAP.get(id);
            if (!w) return null;
            const editing = editingId === id;
            const customTitle = titles[id] ?? '';
            return (
              <div key={id} className="border-b border-[#f5f5f5] last:border-0">
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#fafafa]">
                  <div className="flex flex-col">
                    <button className="text-[#a3a3a3] hover:text-[#171717] disabled:opacity-25" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><Chevron dir="up" /></button>
                    <button className="text-[#a3a3a3] hover:text-[#171717] disabled:opacity-25" disabled={i === layout.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><Chevron dir="down" /></button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#171717] truncate">{customTitle.trim() || w.title}</span>
                      <KindBadge kind={w.kind} />
                      {customTitle.trim() !== '' && <span className="text-[10px] text-[#a3a3a3]">renamed</span>}
                    </div>
                    <div className="text-xs text-[#a3a3a3]">{w.desc}</div>
                  </div>
                  {/* Per-widget settings: title (+ the footprint card's stat list) */}
                  <button
                    onClick={() => setEditingId(editing ? null : id)}
                    aria-expanded={editing}
                    className={'text-xs flex-shrink-0 inline-flex items-center gap-1 ' + (editing ? 'btn-primary' : 'btn-secondary')}
                  >
                    {editing ? 'Close' : 'Edit'}
                  </button>
                  <button onClick={() => remove(id)} className="text-[#a3a3a3] hover:text-[#be123c] flex-shrink-0 p-1" aria-label="Remove">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </div>
                {editing && (
                  <div className="px-4 pb-4 pt-2 bg-[#fafafa] border-t border-[#f0f0f0] space-y-3">
                    <div className="max-w-sm">
                      <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1">Display title</label>
                      <input
                        className="input text-sm"
                        placeholder={w.title}
                        value={customTitle}
                        onChange={(e) => setTitles((t) => ({ ...t, [id]: e.target.value }))}
                      />
                      <p className="text-[10px] text-[#a3a3a3] mt-1">Leave empty to use the default name.</p>
                    </div>
                    {id === 'card:modelFootprint' && (
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1.5">Stats shown</div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                          {Object.values(FOOTPRINT_STATS).map((st) => (
                            <label key={st.key} className="flex items-center gap-1.5 text-sm text-[#525252]">
                              <input type="checkbox" checked={footprint.includes(st.key)} onChange={() => toggleFootprint(st.key)} />
                              {st.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-[#a3a3a3]">Changes apply when you save the layout.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add an area */}
      <div>
        <h3 className="text-sm font-semibold text-[#171717] mb-1">Add an area</h3>
        <p className="text-xs text-[#a3a3a3] mb-3">Pick any area to append it to the dashboard.</p>
        {available.length === 0 ? (
          <div className="card-elevated px-4 py-6 text-center text-sm text-[#a3a3a3]">Every available area is already on the dashboard.</div>
        ) : (
          <div className="space-y-5">
            {([['Headline tiles', availTiles], ['Cards', availCards]] as [string, Widget[]][]).map(([group, items]) =>
              items.length === 0 ? null : (
                <div key={group}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-2">{group}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => add(w.id)}
                        className="card-elevated px-3 py-2.5 text-left hover:border-[#4f46e5] transition-colors flex items-center gap-2"
                      >
                        <span className="text-[#4f46e5] flex-shrink-0">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                        </span>
                        <span className="min-w-0">
                          <span className="text-sm font-medium text-[#171717] block truncate">{w.title}</span>
                          <span className="text-xs text-[#a3a3a3] block truncate">{w.desc}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {error && <div className="text-sm text-[#be123c]">{error}</div>}
    </div>
  );
}
