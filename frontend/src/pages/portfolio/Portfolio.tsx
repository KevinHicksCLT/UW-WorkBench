import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui';
import ApplicationRationalization from '../greenfield-migration/GreenfieldMigration';

// Workspace — the Rationalization Workspace board, full width. No page title:
// the nav + breadcrumb already say "Workspace" (WR feedback 2026-07-06).
// D7.2: the Portfolio, Programs, Risks and RAID Log views moved to Home (D1.5)
// as dashboard widgets; their detail pages live under Home too
// (/programs/:id, /initiatives/:id and /raid — old /portfolio/* links redirect).
//
// PM-04 seam (product-model-workspace-plan §5 D-2): deep links carry the board
// structure in ?domain= (applications | value-streams | roles | product-models)
// and optionally ?workspace=<id>; this wrapper reads them and hands them to the
// board as initialDomain / initialWorkspaceId. This file is the only shared UI
// seam between the board (Agent 3) and the master pages (Agent 4).

type BoardProps = {
  embedded?: boolean;
  /** Initial structure tab, from ?domain= — board falls back to applications. */
  initialDomain?: string;
  /** Initial workspace scope, from ?workspace=. */
  initialWorkspaceId?: string;
};
// The board declares `embedded` today; initialDomain/initialWorkspaceId land
// with the domain-switch work on the board itself. The widened cast keeps the
// deep-link contract compiling until then — React ignores unknown props.
const Board = ApplicationRationalization as unknown as ComponentType<BoardProps>;

export default function Portfolio() {
  const [params] = useSearchParams();
  const domain = params.get('domain') ?? undefined;
  const workspaceId = params.get('workspace') ?? undefined;

  return (
    <Card variant="elevated" className="p-4 border-l-[3px] border-l-[#4f46e5]">
      <Board embedded initialDomain={domain} initialWorkspaceId={workspaceId} />
    </Card>
  );
}
