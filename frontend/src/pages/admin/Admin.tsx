import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import PageHeader from '../../components/PageHeader';
import DataDictionary from '../data-dictionary/DataDictionary';
import AuditTrail from '../audit-trail/AuditTrail';
import AdminSection from '../../components/admin/AdminSection';
import AdminAssistant from '../../components/admin/AdminAssistant';
import { ADMIN_TABS } from '../../lib/adminConfig';
import type { AdminEntity } from '../../lib/adminTypes';
import { Button, Card, ErrorMessage } from '../../components/ui';

// Two-letter abbreviations shown in the left nav when it's collapsed.
const TAB_SHORT: Record<string, string> = {
  company: 'CO', home: 'HM', valueStreams: 'VS', organization: 'OR', standards: 'ST',
  regulations: 'RG', telemetry: 'ME', initiatives: 'WS', work: 'DT', applications: 'AP',
  external: 'EX', health: 'DH',
};

// ─── Data Admin Studio ───────────────────────────────────────────────────────
// One console to configure every tab of the product. The left nav mirrors the
// app's own navigation (Company onboarding, Home, Value Streams, Organization,
// Standards, Metrics, Workspace, Deliverables & Tasks, Regulations,
// Third-Parties, Data Health). Each tab renders a tailored editor for its data
// shape (drill-down trees, master-detail, or flat lists) — defined in
// lib/adminConfig.ts; the app speaks the domain, never raw database tables.
// An AI assistant can draft and apply changes on request. Everything is
// company-scoped and every write is audited.

export default function Admin() {
  const { companyId, company } = useCompany();
  const [entities, setEntities] = useState<AdminEntity[]>([]);
  const [error, setError] = useState('');
  const [tabKey, setTabKey] = useState<string>(ADMIN_TABS[0].key);
  const [sectionKey, setSectionKey] = useState<string>(ADMIN_TABS[0].sections[0].key);
  const [view, setView] = useState<'studio' | 'audit' | 'dictionary'>('studio');
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // bumped after AI applies changes

  useEffect(() => {
    api.get<{ entities: AdminEntity[] }>('/admin/_meta')
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

  // Jump to a specific tab (and optional section) — used by the Home/Dashboard
  // editor's "edit this widget's source" shortcuts.
  const goTo = (tabK: string, sectionK?: string) => {
    const t = ADMIN_TABS.find((x) => x.key === tabK);
    if (!t) return;
    setTabKey(tabK);
    setSectionKey(sectionK && t.sections.some((s) => s.key === sectionK) ? sectionK : t.sections[0].key);
  };

  return (
    <div>
      <PageHeader
        title="Data Admin"
        subtitle={
          view === 'dictionary'
            ? 'Plain-language definitions of the terms used across the platform.'
            : view === 'audit'
              ? 'Every create, update, and delete across the platform.'
              : `Configure every screen of the platform for ${company?.name ?? 'the active company'}. The tabs below mirror the app; pick one to edit what it shows. All changes are audited.`
        }
        eyebrow={company ? 'Editing company' : undefined}
        actions={
          <Button onClick={() => setAiOpen(true)} className="inline-flex items-center gap-1.5" disabled={!companyId}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.6L19.5 9l-4.6 3.3 1.8 5.7L12 14.7 7.3 18l1.8-5.7L4.5 9l5.6-.4z" /></svg>
            AI assist
          </Button>
        }
      />

      {/* View switch — Configure, then Audit Log, then the Dictionary (D12.2). */}
      <div className="inline-flex rounded-lg border border-[#eaeaea] p-0.5 mb-5">
        {([['studio', 'Configure'], ['audit', 'Audit Log'], ['dictionary', 'Data Dictionary']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={'px-3 py-1 text-sm font-medium rounded-md transition-colors ' + (view === v ? 'bg-[#171717] text-white' : 'text-[#525252] hover:text-[#171717]')}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorMessage className="mb-3">{error}</ErrorMessage>}

      {view === 'dictionary' ? (
        <DataDictionary embedded />
      ) : view === 'audit' ? (
        <AuditTrail embedded />
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left sidebar — collapsible primary navigation (mirrors the product nav). */}
          <aside className={'flex-shrink-0 transition-[width] duration-150 ' + (navCollapsed ? 'lg:w-14' : 'lg:w-56')}>
            {/* Collapse toggle (desktop only) */}
            <button
              onClick={() => setNavCollapsed((v) => !v)}
              aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!navCollapsed}
              className={
                'hidden lg:flex items-center gap-2 w-full rounded-md px-3 py-2 mb-1 text-[#666666] hover:text-[#171717] hover:bg-[#fafafa] transition-colors duration-150 ' +
                (navCollapsed ? 'justify-center' : '')
              }
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                className={'transition-transform duration-150 ' + (navCollapsed ? 'rotate-180' : '')}
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
              {!navCollapsed && <span className="text-xs font-medium">Collapse</span>}
            </button>

            <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible -mx-1 px-1 lg:mx-0 lg:px-0" aria-label="Data Admin sections">
              {ADMIN_TABS.map((t) => {
                const active = t.key === tabKey;
                return (
                  <button
                    key={t.key}
                    onClick={() => selectTab(t.key)}
                    aria-current={active ? 'page' : undefined}
                    title={navCollapsed ? t.label : undefined}
                    className={
                      'whitespace-nowrap lg:whitespace-normal rounded-md px-3 py-2 text-sm transition-colors duration-150 lg:border-l-2 ' +
                      (navCollapsed ? 'lg:text-center lg:px-0 lg:font-semibold' : 'text-left') + ' ' +
                      (active
                        ? 'bg-[#f5f5f5] text-[#171717] font-semibold lg:border-[#171717]'
                        : 'text-[#666666] font-medium hover:text-[#171717] hover:bg-[#fafafa] lg:border-transparent')
                    }
                  >
                    {/* Mobile always shows the full label; desktop collapses to an abbreviation */}
                    <span className={navCollapsed ? 'lg:hidden' : ''}>{t.label}</span>
                    {navCollapsed && <span className="hidden lg:inline">{TAB_SHORT[t.key] ?? t.label.slice(0, 2).toUpperCase()}</span>}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content area */}
          <div className="flex-1 min-w-0">
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
                <Card variant="elevated" className="p-10 text-center text-sm text-[#a3a3a3]">Loading…</Card>
              ) : (
                <AdminSection
                  spec={section.editor}
                  companyId={companyId}
                  companyName={company?.name}
                  bySlug={bySlug}
                  onRequestAi={() => setAiOpen(true)}
                  onNavigate={goTo}
                />
              )}
            </div>
          </div>
        </div>
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
