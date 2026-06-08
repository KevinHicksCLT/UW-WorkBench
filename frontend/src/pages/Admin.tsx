import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';
import PageHeader from '../components/PageHeader';
import DataDictionary from './DataDictionary';
import AdminSection from '../components/admin/AdminSection';
import AdminAssistant from '../components/admin/AdminAssistant';
import { ADMIN_TABS } from '../lib/adminConfig';
import type { AdminEntity } from '../lib/adminTypes';

// ─── Data Admin Studio ───────────────────────────────────────────────────────
// One console to configure every tab of the product. The top nav mirrors the
// app's own navigation (Company onboarding, Home, Value Streams, Organization,
// Standards, Telemetry, Initiatives, Deliverables & Tasks, People, External) plus
// a power-user Data Catalog. Each tab renders a tailored editor for its data
// shape (drill-down trees, master-detail, or flat lists) — defined in
// lib/adminConfig.ts. An AI assistant can draft and apply changes on request.
// Everything is company-scoped and every write is audited.

export default function Admin() {
  const { companyId, company } = useCompany();
  const [entities, setEntities] = useState<AdminEntity[]>([]);
  const [error, setError] = useState('');
  const [tabKey, setTabKey] = useState<string>(ADMIN_TABS[0].key);
  const [sectionKey, setSectionKey] = useState<string>(ADMIN_TABS[0].sections[0].key);
  const [view, setView] = useState<'studio' | 'dictionary'>('studio');
  const [aiOpen, setAiOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // bumped after AI applies changes

  useEffect(() => {
    api.get('/admin/_meta')
      .then((m) => setEntities(m.entities))
      .catch((e) => setError(e.message));
  }, []);

  const bySlug = useMemo(() => new Map(entities.map((e) => [e.slug, e])), [entities]);

  const tab = useMemo(() => ADMIN_TABS.find((t) => t.key === tabKey) ?? ADMIN_TABS[0], [tabKey]);
  const section = useMemo(() => tab.sections.find((s) => s.key === sectionKey) ?? tab.sections[0], [tab, sectionKey]);

  const selectTab = (key: string) => {
    const t = ADMIN_TABS.find((x) => x.key === key);
    if (!t) return;
    setTabKey(key);
    setSectionKey(t.sections[0].key);
  };

  return (
    <div>
      <PageHeader
        title="Data Admin"
        subtitle={
          view === 'dictionary'
            ? 'Plain-language definitions of the terms used across the platform.'
            : `Configure every screen of the platform for ${company?.name ?? 'the active company'}. The tabs below mirror the app; pick one to edit what it shows. All changes are audited.`
        }
        eyebrow={company ? 'Editing company' : undefined}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setAiOpen(true)} className="btn-primary inline-flex items-center gap-1.5" disabled={!companyId}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.6L19.5 9l-4.6 3.3 1.8 5.7L12 14.7 7.3 18l1.8-5.7L4.5 9l5.6-.4z" /></svg>
              AI assist
            </button>
            <Link to="/audit" className="btn-secondary">Audit trail</Link>
          </div>
        }
      />

      {/* View switch */}
      <div className="inline-flex rounded-lg border border-[#eaeaea] p-0.5 mb-5">
        {([['studio', 'Configure'], ['dictionary', 'Data Dictionary']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={'px-3 py-1 text-sm font-medium rounded-md transition-colors ' + (view === v ? 'bg-[#171717] text-white' : 'text-[#525252] hover:text-[#171717]')}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-[#be123c] mb-3">{error}</div>}

      {view === 'dictionary' ? (
        <DataDictionary embedded />
      ) : (
        <>
          {/* Primary tab bar — mirrors the product navigation. */}
          <div className="flex flex-wrap gap-1 border-b border-[#eaeaea] mb-4">
            {ADMIN_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => selectTab(t.key)}
                className={
                  'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ' +
                  (t.key === tabKey ? 'text-[#171717] border-[#0070AD]' : 'text-[#737373] border-transparent hover:text-[#171717] hover:border-[#d4d4d4]')
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab description */}
          <p className="text-sm text-[#666666] mb-4 max-w-3xl">{tab.description}</p>

          {/* Secondary section selector (only when a tab has multiple sections). */}
          {tab.sections.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {tab.sections.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSectionKey(s.key)}
                  className={
                    'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ' +
                    (s.key === sectionKey
                      ? 'bg-[#171717] text-white border-[#171717]'
                      : 'bg-white text-[#525252] border-[#eaeaea] hover:border-[#d4d4d4] hover:text-[#171717]')
                  }
                >
                  {s.label}
                  {s.hint && <span className={'ml-1.5 text-[11px] ' + (s.key === sectionKey ? 'text-white/60' : 'text-[#a3a3a3]')}>{s.hint}</span>}
                </button>
              ))}
            </div>
          )}

          {/* The active editor. refreshKey forces a remount after AI applies edits. */}
          <div key={`${tab.key}:${section.key}:${refreshKey}`}>
            {entities.length === 0 ? (
              <div className="card-elevated p-10 text-center text-sm text-[#a3a3a3]">Loading tables…</div>
            ) : (
              <AdminSection
                spec={section.editor}
                companyId={companyId}
                companyName={company?.name}
                bySlug={bySlug}
                onRequestAi={() => setAiOpen(true)}
              />
            )}
          </div>
        </>
      )}

      <AdminAssistant
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        companyId={companyId}
        companyName={company?.name}
        onApplied={() => setRefreshKey((n) => n + 1)}
      />
    </div>
  );
}
