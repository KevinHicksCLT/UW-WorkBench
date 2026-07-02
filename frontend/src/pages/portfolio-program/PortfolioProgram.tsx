/**
 * Portfolio Program drill-down page — KPI rollup + tabbed views over the
 * program's initiatives: Workstreams (tables + create), Pipeline (stage
 * columns), Prioritization (value-vs-complexity matrix), Roadmap (date bars
 * per workstream), Resources (cross-initiative utilization), RAID. The tab
 * views and create modals live in pages/portfolio-program/ (pure code motion
 * split; behavior unchanged).
 */
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useCompany } from '../../lib/company';
import { fmt } from '../../lib/format';
import PageHeader from '../../components/PageHeader';
import { Button, ErrorMessage, LoadingState } from '../../components/ui';
import { Tile, withCompany, type LinkOptions } from '../../lib/portfolio';
import PortfolioRaid from '../portfolio-raid/PortfolioRaid';
import {
  BudgetSpendCard, WorkstreamsTab, PipelineTab, PrioritizationTab, RoadmapTab, ProgramResourcesTab,
  type Program, type Summary,
} from './tabs';
import { CreateWorkstreamModal, CreateInitiativeModal } from './modals';

// Re-export — LinkSelect was part of this module's public surface.
export { LinkSelect } from './modals';

const TABS = ['Workstreams', 'Pipeline', 'Prioritization', 'Roadmap', 'Resources', 'RAID'] as const;
type Tab = (typeof TABS)[number];

export default function PortfolioProgram() {
  const { id } = useParams();
  const { companyId } = useCompany();
  const [params] = useSearchParams();
  const [program, setProgram] = useState<Program | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [links, setLinks] = useState<LinkOptions | null>(null);
  // ?tab=RAID etc. presets the open tab (the Home RAID-by-program widget deep-links here).
  const linkedTab = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(linkedTab && TABS.includes(linkedTab) ? linkedTab : 'Workstreams');
  const [showCreateWs, setShowCreateWs] = useState(false);
  const [createInitWs, setCreateInitWs] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState('');

  function load() {
    Promise.all([api.get(`/portfolio/programs/${id}`), api.get(`/portfolio/programs/${id}/summary`)])
      .then(([p, s]) => { setProgram(p); setSummary(s); })
      .catch((e) => setError(e.message));
  }
  useEffect(() => { load(); }, [id]);  
  useEffect(() => { api.get(withCompany('/portfolio/links', companyId)).then(setLinks).catch(() => {}); }, [companyId]);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!program) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title={program.name}
        subtitle={program.description ?? undefined}
        actions={<Button onClick={() => setShowCreateWs(true)}>+ New Workstream</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Tile label="Workstreams" value={program.workstreams.length} />
        <Tile label="Initiatives" value={summary?.initiativeCount ?? 0} />
        <Tile label="Project Budget" value={fmt.currency(summary?.budget ?? 0, { compact: true })} />
        <Tile
          label="Spent to date"
          value={fmt.currency(summary?.actualSpend ?? 0, { compact: true })}
          hint={(summary?.budget ?? 0) > 0 ? `${Math.round(((summary?.actualSpend ?? 0) / summary!.budget) * 100)}% of budget` : undefined}
        />
      </div>

      {/* FB-03 — budget vs. spend, visualised. */}
      <BudgetSpendCard summary={summary} />

      {/* Tabs */}
      <div className="border-b border-[#eaeaea] mb-5 overflow-x-auto">
        <nav className="flex gap-6 whitespace-nowrap">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                'relative inline-flex items-center h-10 -mb-px px-0.5 text-sm border-b-2 transition-colors duration-150 ' +
                (tab === t ? 'text-[#171717] font-semibold border-[#171717]' : 'text-[#666666] font-medium border-transparent hover:text-[#171717]')
              }
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'Workstreams' && <WorkstreamsTab program={program} onCreateInit={setCreateInitWs} />}
      {tab === 'Pipeline' && <PipelineTab program={program} />}
      {tab === 'Prioritization' && <PrioritizationTab program={program} />}
      {tab === 'Roadmap' && <RoadmapTab program={program} />}
      {tab === 'Resources' && <ProgramResourcesTab programId={program.id} />}
      {tab === 'RAID' && <PortfolioRaid embedded programId={program.id} />}

      {showCreateWs && <CreateWorkstreamModal programId={id!} onClose={() => setShowCreateWs(false)} onCreated={() => { setShowCreateWs(false); load(); }} />}
      {createInitWs && <CreateInitiativeModal workstream={createInitWs} links={links} onClose={() => setCreateInitWs(null)} onCreated={() => { setCreateInitWs(null); load(); }} />}
    </div>
  );
}
