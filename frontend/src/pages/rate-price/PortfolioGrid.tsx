// Portfolio Grid (SM-B home — CAP-01/14, HLR-13). Estate at a glance: KPI
// rollups + the model registry sheet. In SM-A the KPI band collapses and the
// sheet reads as a simple model list. Rows key into the Model Workspace with
// selection preserved (HLR-19).
import { Card, ErrorMessage, StatusPill } from '../../components/ui';
import { Sheet, type SheetCol } from '../../components/Sheet';
import { lifecycleTone, type RatingModel } from './types';

function Kpi({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <Card className="px-4 py-3 min-w-[140px]">
      <span
        className={'block text-[22px] font-semibold tabular-nums ' + (tone ?? 'text-[#171717]')}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-[#737373]">{label}</span>
    </Card>
  );
}

export default function PortfolioGrid({
  models,
  loading,
  error,
  mode,
  onOpen,
}: {
  models: RatingModel[];
  loading: boolean;
  error: string;
  mode: 'A' | 'B';
  onOpen: (id: string) => void;
}) {
  const legacy = models.filter((m) => ['spreadsheet', 'legacy'].includes(m.engineOfRecord)).length;
  const drafts = models.filter((m) => m.versions.some((v) => v.status === 'draft')).length;
  const retirementCandidates = models.filter((m) =>
    ['deprecated', 'retired'].includes(m.lifecycle),
  ).length;

  const cols: SheetCol<RatingModel>[] = [
    { key: 'ref', label: 'Ref', width: '90px', hideable: false, value: (m) => m.ref },
    {
      key: 'name',
      label: 'Model',
      width: 'minmax(180px,1.4fr)',
      hideable: false,
      value: (m) => m.name,
    },
    { key: 'lob', label: 'LOB', width: '70px', align: 'center', value: (m) => m.lob },
    {
      key: 'jurisdictions',
      label: 'Jurisdictions',
      width: 'minmax(120px,1fr)',
      dim: true,
      value: (m) => m.jurisdictions,
    },
    {
      key: 'engine',
      label: 'Engine',
      width: '110px',
      hint: 'Engine of record — deploy always means connector-mediated promotion (ADR-002)',
      value: (m) => m.engineOfRecord,
    },
    {
      key: 'version',
      label: 'Ver',
      width: '80px',
      align: 'center',
      value: (m) => m.versions.find((v) => v.id === m.currentVersionId)?.semver ?? '—',
    },
    {
      key: 'lifecycle',
      label: 'Lifecycle',
      width: '110px',
      align: 'center',
      value: (m) => m.lifecycle,
      render: (m) => <StatusPill tone={lifecycleTone(m.lifecycle)}>{m.lifecycle}</StatusPill>,
    },
    {
      key: 'runs',
      label: 'Runs',
      width: '70px',
      align: 'right',
      hint: 'Run Store rows across all versions (reference quotes, what-ifs, batches)',
      value: (m) => String(m.runCount ?? 0),
    },
    {
      key: 'owner',
      label: 'Owner role',
      width: 'minmax(140px,1fr)',
      dim: true,
      value: (m) => m.ownerRole?.displayValue ?? '—',
    },
  ];

  return (
    <div className="space-y-4">
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {mode === 'B' && (
        <div className="flex flex-wrap gap-3">
          <Kpi value={models.length} label="Models in estate" />
          <Kpi value={legacy} label="Legacy / spreadsheet" tone="text-[#be123c]" />
          <Kpi value={drafts} label="Draft versions pending" tone="text-[#b45309]" />
          <Kpi value={retirementCandidates} label="Retirement candidates" />
        </div>
      )}
      <Sheet
        rows={models}
        cols={cols}
        rowKey={(m) => m.id}
        loading={loading}
        unit="models"
        sheetKey="rate-price.models"
        emptyText="No rating models in the estate registry yet."
        onRowClick={(m) => onOpen(m.id)}
      />
    </div>
  );
}
