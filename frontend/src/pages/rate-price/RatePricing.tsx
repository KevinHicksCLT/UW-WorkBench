// Rate & Price — Rating & Pricing Rationalization module (RATE-PRICE).
// Page shell: one tab bar (?tab= deep-linkable) over the five module surfaces,
// plus the scale-mode control (HLR-19 / ADR-005): SM-A (1–5 models,
// workspace-centric) vs SM-B (30–50 models, portfolio-grid-centric). Mode is
// auto-selected from estate size (>8 → SM-B) with manual override, and the
// selected model survives tab and mode pivots — modes are pure view-layer,
// one data plane.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useApi } from '../../lib/useApi';
import { useCompany } from '../../lib/company';
import { withCompany } from '../../lib/portfolio';
import PortfolioGrid from './PortfolioGrid';
import ModelWorkspace from './ModelWorkspace';
import SimulationDesk from './SimulationDesk';
import FilingDesk from './FilingDesk';
import Rationalizer from './Rationalizer';
import type { RatingModel } from './types';

const TAB_DEFS = [
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'workspace', label: 'Model Workspace' },
  { key: 'simulation', label: 'Simulation & Optimization' },
  { key: 'filing', label: 'Filing Desk' },
  { key: 'rationalizer', label: 'Rationalizer' },
] as const;

type TabKey = (typeof TAB_DEFS)[number]['key'];
type ScaleMode = 'A' | 'B';

const SM_B_THRESHOLD = 8; // SM-01: auto-select by working-set size

export default function RatePricing() {
  const { companyId } = useCompany();
  const [params, setParams] = useSearchParams();
  const models = useApi<RatingModel[]>(withCompany('/rate-price/models', companyId));

  const autoMode: ScaleMode = (models.data?.length ?? 0) > SM_B_THRESHOLD ? 'B' : 'A';
  const [modeOverride, setModeOverride] = useState<ScaleMode | null>(null);
  const mode = modeOverride ?? autoMode;

  const defaultTab: TabKey = mode === 'B' ? 'portfolio' : 'workspace';
  const raw = params.get('tab');
  const tab: TabKey = TAB_DEFS.some((t) => t.key === raw) ? (raw as TabKey) : defaultTab;
  // Selected model survives tab/mode pivots (HLR-19) — page state, not URL state.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const setTab = (k: TabKey) => setParams({ tab: k });
  const openModel = (id: string) => {
    setSelectedId(id);
    setParams({ tab: 'workspace' });
  };
  const estateSize = models.data?.length ?? 0;
  const homeBadge = useMemo(() => (mode === 'B' ? 'portfolio' : 'workspace') as TabKey, [mode]);

  return (
    <div>
      <PageHeader
        title="Rate & Price"
        subtitle="Model estate → immutable versions → reference quotes & parallel-run evidence → constrained optimization → SERFF filings → legacy-rater rationalization"
        dense
      />

      {/* Scale-mode strip — the volume ↔ complexity spectrum control (ADR-005). */}
      <div className="flex flex-wrap items-center gap-3 mb-3 text-[12px]">
        <span className="text-[#737373] uppercase tracking-wide text-[10px]">
          Volume · Earnix-pattern
        </span>
        <div className="h-1.5 w-40 rounded-full bg-gradient-to-r from-teal-100 to-amber-100 relative">
          <div
            className="absolute -top-1 h-3.5 w-3.5 rounded-full bg-[#171717] border-2 border-white shadow"
            style={{ left: mode === 'B' ? '72%' : '15%', transition: 'left .2s' }}
          />
        </div>
        <span className="text-[#737373] uppercase tracking-wide text-[10px]">
          Complexity · hx-pattern
        </span>
        <span className="ml-auto text-[#737373]">Working set: {estateSize} models</span>
        <div className="inline-flex rounded-md border border-[#eaeaea] overflow-hidden">
          {(['A', 'B'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModeOverride(m)}
              aria-pressed={mode === m}
              className={
                'px-3 py-1.5 text-[11px] font-semibold ' +
                (mode === m ? 'bg-[#171717] text-white' : 'bg-white text-[#666666]')
              }
            >
              {m === 'A' ? 'SM-A · 1–5' : 'SM-B · 30–50'}
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-[#eaeaea] mb-5 overflow-x-auto">
        <nav className="flex gap-6 whitespace-nowrap" aria-label="Rate & Price tabs">
          {TAB_DEFS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                'relative inline-flex items-center gap-1.5 h-10 -mb-px px-0.5 text-sm border-b-2 transition-colors duration-150 ' +
                (tab === t.key
                  ? 'text-[#171717] font-semibold border-[#171717]'
                  : 'text-[#666666] font-medium border-transparent hover:text-[#171717]')
              }
            >
              {t.label}
              {t.key === homeBadge && (
                <span className="text-[9px] font-semibold bg-teal-700 text-white rounded px-1 py-px">
                  SM-{mode} HOME
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'portfolio' && (
        <PortfolioGrid
          models={models.data ?? []}
          loading={models.loading}
          error={models.error}
          mode={mode}
          onOpen={openModel}
        />
      )}
      {tab === 'workspace' && (
        <ModelWorkspace
          models={models.data ?? []}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onPublished={models.refetch}
        />
      )}
      {tab === 'simulation' && <SimulationDesk />}
      {tab === 'filing' && <FilingDesk />}
      {tab === 'rationalizer' && <Rationalizer mode={mode} onOpenModel={openModel} />}
    </div>
  );
}
