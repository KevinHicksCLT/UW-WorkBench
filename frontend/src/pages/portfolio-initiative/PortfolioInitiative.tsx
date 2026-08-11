/**
 * Portfolio Initiative detail page — header, status, workflow actions and the
 * tab strip. Each tab's content lives in pages/portfolio-initiative/
 * (pure code motion split; behavior unchanged).
 */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { isHeldResponse, notifyHeld } from '../../lib/approvals';
import { useDialogs } from '../../lib/dialogs';
import { useViewState } from '../../lib/viewState';
import { STAGE_ORDER, STAGE_LABELS } from '../../lib/format';
import PageHeader from '../../components/PageHeader';
import { Button, Card, ErrorMessage, LoadingState, Select, StatusPill } from '../../components/ui';
import { type Initiative } from '../../lib/portfolio';
import ImpactPanel from '../workspace-map/impact/ImpactPanel';
import { useImpactGate } from '../workspace-map/impact/useImpactGate';
import AssessmentHistory from '../workspace-map/impact/AssessmentHistory';
import { SummaryTab } from './SummaryTab';
import { CharterTab } from './CharterTab';
import { AlignmentTab } from './AlignmentTab';
import { FinancialsTab } from './FinancialsTab';
import { WorkplanTab } from './WorkplanTab';
import { ChangeLogTab } from './ChangeLogTab';
import { ResourcesTab } from './ResourcesTab';
import { RaidTab } from './RaidTab';
import { AuditTab } from './AuditTab';

const TABS = [
  'Summary',
  'Charter',
  'Strategic Alignment',
  'Financials',
  'Workplan',
  'Change Log',
  'Resources',
  'RAID',
  'Audit',
] as const;
type Tab = (typeof TABS)[number];

export default function PortfolioInitiative() {
  const { id } = useParams();
  const dialogs = useDialogs();
  const [init, setInit] = useState<Initiative | null>(null);
  // Active tab persists per initiative (lib/viewState) so leaving the page and
  // returning — any route back — lands on the same tab, not Summary.
  const [tab, setTab] = useViewState<Tab>(`initiative.${id}.tab`, 'Summary');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const gate = useImpactGate();
  // Refresh the assessment history when the impact panel closes after a save.
  const [assessRefresh, setAssessRefresh] = useState(0);
  const panelWasOpen = useRef(false);
  useEffect(() => {
    const open = !!gate.state;
    if (panelWasOpen.current && !open) setAssessRefresh((n) => n + 1);
    panelWasOpen.current = open;
  }, [gate.state]);

  function load() {
    api
      .get<Initiative>(`/portfolio/initiatives/${id}`)
      .then(setInit)
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
  }, [id]);

  async function workflow(action: string) {
    setBusy(true);
    try {
      const res = await api.post(`/portfolio/initiatives/${id}/workflow`, { action });
      // Stage-gate approvals are governed — a 202-held response means nothing
      // changed yet; tell the user instead of reloading as if it applied.
      if (isHeldResponse(res)) await notifyHeld(dialogs, res);
      else load();
    } catch (e) {
      dialogs.alert({ title: 'Workflow action failed', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  async function setStatus(status: string) {
    await api.patch(`/portfolio/initiatives/${id}`, { status });
    load();
  }

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!init) return <LoadingState />;

  const stageIdx = STAGE_ORDER.indexOf(init.stage);

  return (
    <div>
      <PageHeader
        title={init.name}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                gate.run(
                  {
                    changeType: 'RESCHEDULE',
                    label: init.name,
                    subject: { kind: 'plan', initiativeId: init.id },
                    pickable: true,
                  },
                  () => {},
                )
              }
            >
              Assess Impact
            </Button>
            {init.workflowAction === 'SUBMIT' && (
              <Button disabled={busy} onClick={() => workflow('APPROVE')}>
                Approve → {STAGE_LABELS[STAGE_ORDER[stageIdx + 1]] ?? 'Done'}
              </Button>
            )}
            {stageIdx > 0 && (
              <Button variant="secondary" disabled={busy} onClick={() => workflow('MOVE_BACK')}>
                Roll Back
              </Button>
            )}
          </>
        }
      />

      {/* Status (FB-04 — stage label + stage ladder removed) */}
      <Card variant="elevated" className="p-5 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase font-semibold tracking-[0.08em] text-[#a3a3a3]">
            Status
          </span>
          <Select className="w-36" value={init.status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ON_TRACK">On Track</option>
            <option value="AT_RISK">At Risk</option>
            <option value="OFF_TRACK">Off Track</option>
          </Select>
          {init.workflowAction === 'SUBMIT' && (
            <StatusPill tone="amber">Pending approval</StatusPill>
          )}
        </div>
      </Card>

      <div className="mb-6">
        <AssessmentHistory subjectKind="plan" subjectId={init.id} refreshToken={assessRefresh} />
      </div>

      {/* Tabs */}
      <div className="border-b border-[#eaeaea] mb-5 overflow-x-auto">
        <nav className="flex gap-6 whitespace-nowrap">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                'relative inline-flex items-center h-10 -mb-px px-0.5 text-sm border-b-2 transition-colors duration-150 ' +
                (tab === t
                  ? 'text-[#171717] font-semibold border-[#171717]'
                  : 'text-[#666666] font-medium border-transparent hover:text-[#171717]')
              }
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'Summary' && <SummaryTab init={init} />}
      {tab === 'Charter' && <CharterTab init={init} reload={load} />}
      {tab === 'Strategic Alignment' && <AlignmentTab init={init} reload={load} />}
      {tab === 'Financials' && <FinancialsTab init={init} reload={load} />}
      {tab === 'Workplan' && <WorkplanTab init={init} reload={load} />}
      {tab === 'Change Log' && <ChangeLogTab init={init} />}
      {tab === 'Resources' && <ResourcesTab init={init} reload={load} />}
      {tab === 'RAID' && <RaidTab init={init} reload={load} />}
      {tab === 'Audit' && <AuditTab initId={init.id} />}

      <ImpactPanel gate={gate} />
    </div>
  );
}
