// The Forms lens of the Workspace — Forms Rationalization module entry
// (spec: documents/product-model-workspace/forms-rationalization-spec.md).
// Five faces over one shared model + decision store:
//   Dashboard (FR-6.1) · Hierarchy (FR-1.1/1.2) · State overlay (FR-2.x) ·
//   Matrix (FR-3.1) · Clusters (FR-4.x)
// plus the form drawer (FR-5.x / FR-7.x) and the unify dialog (FR-5.3).
// View state persists per session (lib/viewState) so leaving the tab and
// returning restores the exact face and drill position.

import { useMemo, useState } from 'react';
import { useAuth } from '../../../lib/auth';
import { useViewState } from '../../../lib/viewState';
import { DrawerShell } from '../../../components/ui';
import LensBar, { type WorkspaceLens } from '../LensBar';
import { StatusLegend } from './chrome';
import { formById, useFormsStore } from './model';
import FormsDashboard from './FormsDashboard';
import { FormsCards, FormsDrill, type PortfolioFilters } from './FormsPortfolio';
import FormsHeatMap from './FormsHeatMap';
import FormsMatrix from './FormsMatrix';
import FormsClusters, { FormColumn } from './FormsClusters';
import FormDrawer from './FormDrawer';
import UnifyDialog from './UnifyDialog';
import type { FormLayer } from './types';

type FormsView = 'dashboard' | 'hierarchy' | 'overlay' | 'matrix' | 'clusters';

const VIEWS: { key: FormsView; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'hierarchy', label: 'Hierarchy' },
  { key: 'overlay', label: 'State overlay' },
  { key: 'matrix', label: 'Matrix' },
  { key: 'clusters', label: 'Clusters' },
];

export default function FormsBoard({
  lens,
  onLens,
}: {
  lens: WorkspaceLens;
  onLens: (l: WorkspaceLens) => void;
}) {
  const { user } = useAuth();
  const userName = user?.name ?? user?.email ?? 'Analyst';
  const { store, decide, withdraw, classify, unify } = useFormsStore(userName);

  const [view, setView] = useViewState<FormsView>('workspace.forms.view', 'dashboard');
  const [filters, setFilters] = useViewState<PortfolioFilters>('workspace.forms.filters', {
    lob: null,
    productId: null,
  });
  const [drillCoreId, setDrillCoreId] = useViewState<string | null>('workspace.forms.drill', null);
  const [drillLayer, setDrillLayer] = useViewState<FormLayer | null>(
    'workspace.forms.drillLayer',
    null,
  );
  const [drillState, setDrillState] = useViewState<string | null>(
    'workspace.forms.drillState',
    null,
  );
  const [heatCoreId, setHeatCoreId] = useViewState<string | null>('workspace.forms.heat', null);
  const [regionLens, setRegionLens] = useViewState<boolean>('workspace.forms.regions', false);
  const [matrixState, setMatrixState] = useViewState<string | null>('workspace.forms.matrix', null);
  const [clusterFocus, setClusterFocus] = useViewState<string | null>(
    'workspace.forms.cluster',
    null,
  );
  const [threshold, setThreshold] = useViewState<number>('workspace.forms.threshold', 85);
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [unifyMembers, setUnifyMembers] = useState<string[] | null>(null);
  const [compareIds, setCompareIds] = useState<string[] | null>(null);

  const openMatrix = (state: string) => {
    setMatrixState(state);
    setView('matrix');
  };
  const openCluster = (clusterId: string) => {
    setClusterFocus(clusterId);
    setView('clusters');
  };
  const openDrill = (coreId: string, layerFilter: FormLayer | null) => {
    setDrillCoreId(coreId);
    setDrillLayer(layerFilter);
    setDrillState(null);
  };

  const compareForms = useMemo(
    () => (compareIds ?? []).map((id) => formById.get(id)).filter((f) => f !== undefined),
    [compareIds],
  );
  const compareHeadings = useMemo(
    () => [...new Set(compareForms.flatMap((f) => f.sections.map((s) => s.heading)))],
    [compareForms],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
      <LensBar
        lens={lens}
        onLens={onLens}
        boards={[]}
        boardId={null}
        onBoard={() => undefined}
        legend={<StatusLegend />}
      />

      {/* Face switch — same visual as the Products Detail/Grid selector. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            display: 'flex',
            height: 28,
            border: '1px solid #d4d4d4',
            borderRadius: 6,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          {VIEWS.map((v, i) => {
            const on = view === v.key;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                style={{
                  font: 'inherit',
                  padding: '0 13px',
                  fontSize: 12,
                  lineHeight: '28px',
                  cursor: 'pointer',
                  border: 'none',
                  borderLeft: i === 0 ? 'none' : '1px solid #eaeaea',
                  background: on ? '#171717' : '#fff',
                  color: on ? '#fff' : '#404040',
                  fontWeight: on ? 600 : 500,
                }}
              >
                {v.label}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 11.5, color: '#525252' }}>
          Forms Rationalization — mock dataset (ingestion deferred with FR-8.1)
        </span>
      </div>

      {view === 'dashboard' && (
        <FormsDashboard store={store} onOpenCluster={openCluster} onOpenMatrix={openMatrix} />
      )}

      {view === 'hierarchy' &&
        (drillCoreId ? (
          <FormsDrill
            store={store}
            coreId={drillCoreId}
            layerFilter={drillLayer}
            stateFilter={drillState}
            onLayerFilter={setDrillLayer}
            onStateFilter={setDrillState}
            onBack={() => setDrillCoreId(null)}
            onOpenForm={setOpenFormId}
          />
        ) : (
          <FormsCards
            store={store}
            filters={filters}
            onFilters={setFilters}
            onOpenCore={openDrill}
          />
        ))}

      {view === 'overlay' && (
        <FormsHeatMap
          store={store}
          coreId={heatCoreId}
          regionLens={regionLens}
          onCore={setHeatCoreId}
          onRegionLens={setRegionLens}
          onOpenMatrix={openMatrix}
        />
      )}

      {view === 'matrix' && (
        <FormsMatrix state={matrixState} onState={setMatrixState} onCompare={setCompareIds} />
      )}

      {view === 'clusters' && (
        <FormsClusters
          store={store}
          focusClusterId={clusterFocus}
          threshold={threshold}
          onThreshold={setThreshold}
          onFocus={setClusterFocus}
          onOpenForm={setOpenFormId}
          onConsolidate={setUnifyMembers}
        />
      )}

      {openFormId && (
        <FormDrawer
          formId={openFormId}
          store={store}
          onClose={() => setOpenFormId(null)}
          onDecide={decide}
          onWithdraw={withdraw}
          onClassify={classify}
        />
      )}

      {/* FR-3.1 cell click — side-by-side comparison of the underlying forms. */}
      {compareIds && compareForms.length > 0 && (
        <DrawerShell
          onClose={() => setCompareIds(null)}
          width={720}
          maxWidth="96vw"
          header={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#171717' }}>
                Form comparison
              </span>
              <span style={{ fontSize: 12, color: '#404040' }}>
                {compareForms.map((f) => f.formId).join(' vs ')}
              </span>
            </div>
          }
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            {compareForms.map((f) => (
              <FormColumn
                key={f.formId}
                form={f}
                headings={compareHeadings}
                store={store}
                onOpenForm={(id) => {
                  setCompareIds(null);
                  setOpenFormId(id);
                }}
              />
            ))}
          </div>
        </DrawerShell>
      )}

      {unifyMembers && (
        <UnifyDialog
          memberFormIds={unifyMembers}
          onCancel={() => setUnifyMembers(null)}
          onUnify={(title, region, reason) => {
            const err = unify(title, region, unifyMembers, reason);
            if (!err) setUnifyMembers(null);
            return err;
          }}
        />
      )}
    </div>
  );
}
