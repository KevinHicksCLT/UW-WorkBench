import { useState } from 'react';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import { Sheet, type SheetCol } from '../../components/Sheet';
import {
  Button,
  Card,
  Chip,
  DrawerShell,
  ErrorMessage,
  Input,
  Label,
  Select,
  StatusPill,
  type PillTone,
} from '../../components/ui';
import { FormsTabs } from './FormsTabs';
import type { DivergenceGroup, FieldDefinitionRow, FieldMappingRow } from './types';

// Field Dictionary & Mapping Studio (FORMS-FIELD): the canonical field
// vocabulary (role.entity.attribute grammar, ACORD-aware — ADR-006), the
// τ-routed mapping review queue (needs-human first, one-at-a-time decisions),
// and the derived "same question, N phrasings" divergence report.

const DASH = '—';

const MAPPING_TONE: Record<string, PillTone> = {
  'needs-human': 'amber',
  suggested: 'blue',
  confirmed: 'green',
  rejected: 'red',
};

const DATA_SET_TYPES = [
  'Insured',
  'Policy',
  'Producer',
  'Carrier',
  'Coverage',
  'Location',
  'Vehicle',
  'Loss',
  'Payment',
  'Identification',
  'Signature',
  'Nav',
  'UserDefined',
];

export default function FormsFieldDictionary() {
  const { data, error, loading, refetch } = useApi<FieldDefinitionRow[]>('/forms/field-dictionary');
  const { data: mappings, refetch: refetchMappings } =
    useApi<FieldMappingRow[]>('/forms/field-mappings');
  const { data: divergence, refetch: refetchDivergence } =
    useApi<DivergenceGroup[]>('/forms/field-divergence');
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<'dictionary' | 'queue' | 'divergence'>('dictionary');
  const rows = data ?? [];
  const queue = (mappings ?? []).filter(
    (m) => m.status === 'needs-human' || m.status === 'suggested',
  );

  const refreshAll = () => {
    refetch();
    refetchMappings();
    refetchDivergence();
  };

  const cols: SheetCol<FieldDefinitionRow>[] = [
    { key: 'key', label: 'Key', width: 'minmax(0,1.2fr)', value: (d) => d.key, hideable: false },
    { key: 'dataSet', label: 'Data set', width: '130px', value: (d) => d.dataSetType, dim: true },
    { key: 'type', label: 'Type', width: '100px', value: (d) => d.dataType, dim: true },
    {
      key: 'acord',
      label: 'ACORD ref',
      width: '130px',
      value: (d) => d.acordRef ?? DASH,
      dim: true,
    },
    { key: 'scope', label: 'Scope', width: '90px', value: (d) => d.scope, dim: true },
    {
      key: 'stability',
      label: 'Stability',
      width: '120px',
      value: (d) => d.stability,
      render: (d) =>
        d.stability === 'do-not-map' ? (
          <StatusPill tone="red">⃠ do-not-map</StatusPill>
        ) : (
          <span className="truncate text-[12px] text-[#737373]">stable</span>
        ),
    },
    {
      key: 'calc',
      label: 'Calculated',
      width: '150px',
      value: (d) => (d.compositionParts && d.compositionParts.length > 0 ? 'ƒ get-only' : DASH),
      render: (d) =>
        d.compositionParts && d.compositionParts.length > 0 ? (
          <Chip
            title={`= ${d.compositionFormat ?? d.compositionParts.join(' + ')} (get-only, INV-F2)`}
          >
            ƒ {d.compositionParts.length} parts
          </Chip>
        ) : (
          <span className="text-[12px] text-[#a3a3a3]">{DASH}</span>
        ),
    },
    {
      key: 'mappings',
      label: 'Mappings',
      width: '90px',
      align: 'right',
      value: (d) => String(d._count.mappings),
      dim: true,
    },
  ];

  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  return (
    <div>
      <PageHeader
        title="Field Dictionary"
        subtitle="One canonical name per question your forms ask — QFD-style grammar, ACORD-aware, execution-ready."
        actions={
          <div className="flex gap-2">
            <SuggestButton onDone={refreshAll} />
            <Button onClick={() => setAdding(true)}>Add definition</Button>
          </div>
        }
      />
      <FormsTabs />

      <div className="flex items-center gap-1.5 mb-4">
        <SubTab active={tab === 'dictionary'} onClick={() => setTab('dictionary')}>
          Dictionary ({rows.length})
        </SubTab>
        <SubTab active={tab === 'queue'} onClick={() => setTab('queue')}>
          Mapping queue ({queue.length})
        </SubTab>
        <SubTab active={tab === 'divergence'} onClick={() => setTab('divergence')}>
          Divergence ({(divergence ?? []).length})
        </SubTab>
      </div>

      {tab === 'dictionary' && (
        <Sheet
          sheetKey="forms-field-dictionary"
          rows={rows}
          cols={cols}
          rowKey={(d) => d.id}
          loading={loading}
          unit="definitions"
          emptyText="No field definitions yet — add the canonical names your forms should map to."
        />
      )}
      {tab === 'queue' && <MappingQueue queue={queue} onChanged={refreshAll} />}
      {tab === 'divergence' && <DivergencePanel groups={divergence ?? []} />}

      {adding && (
        <AddDefinitionDrawer
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            refreshAll();
          }}
        />
      )}
    </div>
  );
}

function SubTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'px-2.5 py-1 rounded-md text-[12px] font-medium ' +
        (active ? 'bg-[#0070AD] text-white' : 'bg-[#f5f5f5] text-[#525252] hover:bg-[#eaeaea]')
      }
    >
      {children}
    </button>
  );
}

function SuggestButton({ onDone }: { onDone: () => void }) {
  const { data: forms } = useApi<{ id: string; latestVersion: { id: string } | null }[]>('/forms');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const versions = (forms ?? [])
        .map((f) => f.latestVersion?.id)
        .filter((v): v is string => Boolean(v));
      for (const formVersionId of versions) {
        await api.post('/forms/field-mappings/suggest', { formVersionId });
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="secondary" onClick={run} disabled={busy}>
      {busy ? 'Suggesting…' : 'Run mapping suggestions'}
    </Button>
  );
}

function MappingQueue({ queue, onChanged }: { queue: FieldMappingRow[]; onChanged: () => void }) {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const decide = async (id: string, decision: 'confirmed' | 'rejected') => {
    setBusy(id);
    setErr('');
    try {
      await api.post(`/forms/field-mappings/${id}/decide`, { decision });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Decision failed');
    } finally {
      setBusy('');
    }
  };
  if (queue.length === 0) {
    return (
      <div className="border border-dashed border-[#d4d4d4] rounded-lg p-10 text-center text-[#737373]">
        Queue clear — run mapping suggestions to propose dictionary links for extracted fields.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {err && <ErrorMessage>{err}</ErrorMessage>}
      {queue.map((m) => (
        <Card key={m.id} className="p-3.5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <StatusPill tone={MAPPING_TONE[m.status] ?? 'slate'}>{m.status}</StatusPill>
                <span className="text-[12px] text-[#737373]">
                  {m.formField.formVersion.form.formNumber} v{m.formField.formVersion.versionNo}
                </span>
              </div>
              <div className="text-[13px]">
                <span className="font-medium">{m.formField.label ?? m.formField.sourceName}</span>
                <span className="text-[#a3a3a3] mx-2">→</span>
                <span className="font-mono text-[12px] text-[#0070AD]">
                  {m.fieldDefinition.key}
                </span>
              </div>
              <div className="text-[11px] text-[#a3a3a3] mt-1">
                confidence {(m.confidence * 100).toFixed(0)}% (name {(m.nameSim * 100).toFixed(0)}%
                · label {(m.labelSim * 100).toFixed(0)}% · options{' '}
                {(m.optionOverlap * 100).toFixed(0)}
                %) — signals persisted for audit
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="secondary"
                className="!py-1 !px-2.5 text-[12px]"
                disabled={busy === m.id}
                onClick={() => decide(m.id, 'confirmed')}
              >
                Confirm
              </Button>
              <Button
                variant="ghost"
                className="!py-1 !px-2.5 text-[12px]"
                disabled={busy === m.id}
                onClick={() => decide(m.id, 'rejected')}
              >
                Reject
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function DivergencePanel({ groups }: { groups: DivergenceGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="border border-dashed border-[#d4d4d4] rounded-lg p-10 text-center text-[#737373]">
        No divergence detected — fields mapped to the same definition are asked consistently.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <Card key={g.fieldDefinition.id} className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[13px] font-medium text-[#0070AD]">
              {g.fieldDefinition.key}
            </span>
            <span className="text-[12px] text-[#737373]">
              same question, {g.members.length} phrasings
            </span>
            {g.divergenceKinds.map((k) => (
              <Chip key={k}>{k}</Chip>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            {g.members.map((mem) => (
              <div
                key={mem.formFieldId}
                className="border border-[#eaeaea] rounded-md px-3 py-2 text-[12px]"
              >
                <span className="font-medium">{mem.form.formNumber}</span>
                <span className="text-[#a3a3a3] mx-1.5">·</span>
                <span>{mem.label ?? mem.sourceName}</span>
                <span className="text-[#a3a3a3] ml-1.5">
                  ({mem.widgetType}
                  {mem.required ? ', required' : ''})
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function AddDefinitionDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [key, setKey] = useState('');
  const [dataSetType, setDataSetType] = useState('Insured');
  const [dataType, setDataType] = useState('string');
  const [acordRef, setAcordRef] = useState('');
  const [stability, setStability] = useState('stable');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.post('/forms/field-dictionary', {
        key,
        dataSetType,
        dataType,
        acordRef: acordRef || undefined,
        stability,
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerShell
      onClose={onClose}
      width={440}
      maxWidth="94vw"
      header={<h2 className="text-[16px] font-bold text-[#171717]">Add field definition</h2>}
    >
      <div className="space-y-4">
        <div>
          <Label>Key (role.entity.attribute)</Label>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="insured.tax.fein"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Data set</Label>
            <Select value={dataSetType} onChange={(e) => setDataSetType(e.target.value)}>
              {DATA_SET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Data type</Label>
            <Select value={dataType} onChange={(e) => setDataType(e.target.value)}>
              {['string', 'number', 'date', 'boolean', 'choice', 'signature'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label>ACORD element ref (semantics defer to ACORD — never forked)</Label>
          <Input
            value={acordRef}
            onChange={(e) => setAcordRef(e.target.value)}
            placeholder="ACORD:FEIN (optional)"
          />
        </div>
        <div>
          <Label>Stability</Label>
          <Select value={stability} onChange={(e) => setStability(e.target.value)}>
            <option value="stable">Stable (mappable)</option>
            <option value="do-not-map">Do-not-map (excluded from suggestions)</option>
          </Select>
        </div>
        {err && <ErrorMessage>{err}</ErrorMessage>}
        <Button onClick={submit} disabled={busy || !key.trim()}>
          {busy ? 'Creating…' : 'Create definition'}
        </Button>
      </div>
    </DrawerShell>
  );
}
