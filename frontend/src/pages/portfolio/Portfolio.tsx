import { Card, EmptyState } from '../../components/ui';

// Workspace — the previous Rationalization Workspace board UI was removed in
// full (user direction 2026-07-12); this tab is an intentional blank slate
// awaiting the next design. Deep-link params (?domain=, ?workspace=) are
// accepted and ignored so old links still land here without erroring.
export default function Portfolio() {
  return (
    <Card variant="elevated" className="p-4 border-l-[3px] border-l-[#4f46e5]">
      <EmptyState message="The workspace board UI has been retired. A replacement design is pending." />
    </Card>
  );
}
