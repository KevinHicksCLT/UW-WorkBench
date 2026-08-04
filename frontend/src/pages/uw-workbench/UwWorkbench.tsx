// UW Workbench — AI-native underwriting decisioning module (UW-WORK).
// Page shell: one tab bar (?tab= deep-linkable) over the seven workbench
// surfaces. The selected submission id lives here so pivoting from Pipeline to
// Workspace preserves selection (SM-03); Governance rows can pivot the same way.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { Button, Card, EmptyState } from '../../components/ui';
import PipelineTriage from './PipelineTriage';
import RiskWorkspace from './RiskWorkspace';
import AppetiteStudio from './AppetiteStudio';
import AuthorityMatrix from './AuthorityMatrix';
import Rationalization from './Rationalization';
import GovernanceAudit from './GovernanceAudit';
import SdlcComposite from './SdlcComposite';

const TAB_DEFS = [
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'appetite', label: 'Appetite' },
  { key: 'authority', label: 'Authority' },
  { key: 'rationalization', label: 'Rationalization' },
  { key: 'governance', label: 'Governance' },
  { key: 'sdlc', label: 'SDLC View' },
] as const;

type TabKey = (typeof TAB_DEFS)[number]['key'];

export default function UwWorkbench() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: TabKey = TAB_DEFS.some((t) => t.key === raw) ? (raw as TabKey) : 'pipeline';
  // Selected submission survives tab pivots (SM-03) — it is page state, not URL
  // state, so flipping to Appetite and back keeps the desk where it was.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const setTab = (k: TabKey) => setParams({ tab: k });
  const openSubmission = (id: string) => {
    setSelectedId(id);
    setParams({ tab: 'workspace' });
  };

  return (
    <div>
      <PageHeader
        title="UW Workbench"
        subtitle="Submission → clearance → triage → decision → bind, on an append-only governance spine shared by humans and agents"
        dense
      />

      <div className="border-b border-[#eaeaea] mb-5 overflow-x-auto">
        <nav className="flex gap-6 whitespace-nowrap" aria-label="UW Workbench tabs">
          {TAB_DEFS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                'relative inline-flex items-center h-10 -mb-px px-0.5 text-sm border-b-2 transition-colors duration-150 ' +
                (tab === t.key
                  ? 'text-[#171717] font-semibold border-[#171717]'
                  : 'text-[#666666] font-medium border-transparent hover:text-[#171717]')
              }
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'pipeline' && <PipelineTriage onOpen={openSubmission} />}
      {tab === 'workspace' &&
        (selectedId ? (
          <RiskWorkspace submissionId={selectedId} onBack={() => setTab('pipeline')} />
        ) : (
          <Card className="p-8 text-center">
            <EmptyState
              baseClassName="text-sm text-[#a3a3a3]"
              message="No submission selected — pick one from the Pipeline to open it at the desk."
            />
            <Button variant="secondary" className="mt-4 text-xs" onClick={() => setTab('pipeline')}>
              Go to Pipeline
            </Button>
          </Card>
        ))}
      {tab === 'appetite' && <AppetiteStudio />}
      {tab === 'authority' && <AuthorityMatrix />}
      {tab === 'rationalization' && <Rationalization />}
      {tab === 'governance' && <GovernanceAudit onOpenSubmission={openSubmission} />}
      {tab === 'sdlc' && <SdlcComposite />}
    </div>
  );
}
