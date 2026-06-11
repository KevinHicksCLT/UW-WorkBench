import { useNavigate } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';
import { Sheet, SheetCell, type SheetCol } from '../components/Sheet';

// External Interactions — read-only view of the external dependency rows
// (vendors, regulators, partners ↔ internal owner roles ↔ value streams),
// rendered in the canonical Sheet format (see components/Sheet.tsx). Clicking
// a row expands its inputs / outputs / notes. Data: GET /external-interactions.

type Interaction = {
  id: string;
  partyType: string;
  externalRole: string;
  internalRoleId: string | null;
  internalRoleName: string | null;
  divisionFunction: string | null;
  interactionType: string | null;
  inputs: string | null;
  outputs: string | null;
  relatedValueStream: string | null;
  dependencyType: string | null;
  frequency: string | null;
  notes: string | null;
};

const DASH = '—';

export default function External() {
  const { data, error, loading } = useApi<Interaction[]>('/external-interactions');
  const navigate = useNavigate();
  const items = data ?? [];

  const cols: SheetCol<Interaction>[] = [
    { key: 'party', label: 'External party', width: 'minmax(0,1.2fr)', value: (i) => i.externalRole },
    { key: 'type', label: 'Party type', width: '130px', value: (i) => i.partyType, dim: true },
    { key: 'vs', label: 'Value stream', width: 'minmax(0,1fr)', value: (i) => i.relatedValueStream ?? DASH, dim: true },
    {
      key: 'owner', label: 'Internal owner', width: 'minmax(0,1fr)', value: (i) => i.internalRoleName ?? DASH, dim: true,
      render: (i) => (
        <SheetCell
          text={i.internalRoleName ?? DASH}
          dim={!i.internalRoleId}
          onClick={i.internalRoleId ? () => navigate(`/roles/${i.internalRoleId}`) : undefined}
        />
      ),
    },
    { key: 'interaction', label: 'Interaction', width: 'minmax(0,1fr)', value: (i) => i.interactionType ?? DASH, dim: true },
    { key: 'dependency', label: 'Dependency', width: '150px', value: (i) => i.dependencyType ?? DASH, dim: true },
  ];

  if (error) return <div className="text-sm text-[#be123c]">{error}</div>;

  return (
    <div>
      <PageHeader
        title="Third-Parties"
        subtitle="External parties the operating model depends on — who they touch internally, across which value streams."
      />

      <Sheet
        rows={items}
        cols={cols}
        rowKey={(i) => i.id}
        loading={loading}
        summarize={(v) => `${new Set(v.map((i) => i.partyType)).size} party types · ${new Set(v.map((i) => i.relatedValueStream).filter(Boolean)).size} value streams`}
        expand={(i) => (
          <div className="space-y-1.5 text-xs text-[#525252]">
            {i.divisionFunction && (
              <div className="flex gap-1.5">
                <span className="flex-shrink-0 font-semibold text-[#171717]">Division / function:</span>
                <span>{i.divisionFunction}</span>
              </div>
            )}
            <div className="flex gap-1.5">
              <span className="flex-shrink-0 rounded bg-[#171717] text-white text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 leading-[14px]">Inputs</span>
              <span>{i.inputs ?? DASH}</span>
            </div>
            <div className="flex gap-1.5">
              <span className="flex-shrink-0 rounded bg-[#404040] text-white text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 leading-[14px]">Outputs</span>
              <span>{i.outputs ?? DASH}</span>
            </div>
            {i.frequency && (
              <div className="flex gap-1.5">
                <span className="flex-shrink-0 font-semibold text-[#171717]">Frequency:</span>
                <span>{i.frequency}</span>
              </div>
            )}
            {i.notes && (
              <div className="flex gap-1.5">
                <span className="flex-shrink-0 font-semibold text-[#171717]">Notes:</span>
                <span>{i.notes}</span>
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}
