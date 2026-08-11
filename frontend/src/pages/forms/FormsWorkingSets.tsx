import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import { Sheet, type SheetCol } from '../../components/Sheet';
import {
  Button,
  Chip,
  DrawerShell,
  ErrorMessage,
  Input,
  Label,
  StatusPill,
} from '../../components/ui';
import { FormsTabs } from './FormsTabs';
import type { PolicyFormRow, WorkingSetRow } from './types';

// Working Sets (FORMS-COMPARE entry): named rationalization scopes. Mode is
// derived from size (≤7 Reading, ≥8 Portfolio — FORMS-HLR-008); the detail
// page carries the matrix, comparison, and triage.

const DASH = '—';

export default function FormsWorkingSets() {
  const { data, error, loading, refetch } = useApi<WorkingSetRow[]>('/forms/working-sets');
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const rows = data ?? [];

  const cols: SheetCol<WorkingSetRow>[] = [
    {
      key: 'name',
      label: 'Working set',
      width: 'minmax(0,1.2fr)',
      value: (s) => s.name,
      hideable: false,
    },
    {
      key: 'mode',
      label: 'Mode',
      width: '110px',
      value: (s) => s.mode,
      render: (s) => (
        <Chip title={s.modeOverride ? 'User override' : 'Derived from set size'}>
          {s.mode === 'reading' ? '📖 Reading' : '▦ Portfolio'}
        </Chip>
      ),
    },
    {
      key: 'members',
      label: 'Forms',
      width: '80px',
      align: 'right',
      value: (s) => String(s._count.members),
      dim: true,
    },
    {
      key: 'clusters',
      label: 'Clusters',
      width: '90px',
      align: 'right',
      value: (s) => String(s._count.clusters),
      dim: true,
    },
    {
      key: 'findings',
      label: 'Findings',
      width: '90px',
      align: 'right',
      value: (s) => String(s._count.findings),
      dim: true,
    },
    {
      key: 'status',
      label: 'Analysis',
      width: '110px',
      value: (s) => s.clusterStatus,
      render: (s) => (
        <StatusPill
          tone={
            s.clusterStatus === 'done' ? 'green' : s.clusterStatus === 'failed' ? 'red' : 'slate'
          }
        >
          {s.clusterStatus === 'none' ? 'not run' : s.clusterStatus}
        </StatusPill>
      ),
    },
    {
      key: 'desc',
      label: 'Description',
      width: 'minmax(0,1.4fr)',
      value: (s) => s.description ?? DASH,
      dim: true,
    },
  ];

  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  return (
    <div>
      <PageHeader
        title="Working Sets"
        subtitle="Scoped groups of forms for batch rationalization — cluster, triage, decide."
        actions={<Button onClick={() => setCreating(true)}>New working set</Button>}
      />
      <FormsTabs />

      <Sheet
        sheetKey="forms-working-sets"
        rows={rows}
        cols={cols}
        rowKey={(s) => s.id}
        loading={loading}
        unit="working sets"
        emptyText="No working sets yet — create one from the forms in your library."
        onRowClick={(s) => navigate(`/forms/working-sets/${s.id}`)}
      />

      {creating && (
        <CreateSetDrawer
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            refetch();
            navigate(`/forms/working-sets/${id}`);
          }}
        />
      )}
    </div>
  );
}

function CreateSetDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { data: forms } = useApi<PolicyFormRow[]>('/forms');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const eligible = (forms ?? []).filter((f) => f.latestVersion);

  const toggle = (versionId: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(versionId)) next.delete(versionId);
      else next.add(versionId);
      return next;
    });
  };

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      const created = (await api.post('/forms/working-sets', {
        name,
        description: description || undefined,
        formVersionIds: [...picked],
      })) as { id: string };
      onCreated(created.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerShell
      onClose={onClose}
      width={560}
      maxWidth="94vw"
      header={<h2 className="text-[16px] font-bold text-[#171717]">New working set</h2>}
    >
      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="GL additional-insured endorsements"
          />
        </div>
        <div>
          <Label>Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div>
          <Label>
            Forms ({picked.size} selected — {picked.size <= 7 ? 'Reading' : 'Portfolio'} mode
            default)
          </Label>
          <div className="border border-[#eaeaea] rounded-md max-h-80 overflow-y-auto divide-y divide-[#f5f5f5]">
            {eligible.map((f) => {
              const vid = f.latestVersion?.id as string;
              return (
                <label
                  key={f.id}
                  className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[#fafafa]"
                >
                  <input type="checkbox" checked={picked.has(vid)} onChange={() => toggle(vid)} />
                  <span className="text-[13px] font-medium text-[#171717]">{f.formNumber}</span>
                  <span className="text-[12px] text-[#737373] truncate">{f.title}</span>
                </label>
              );
            })}
            {eligible.length === 0 && (
              <div className="px-3 py-4 text-[13px] text-[#a3a3a3] italic">
                No forms with ingested versions yet.
              </div>
            )}
          </div>
        </div>
        {err && <ErrorMessage>{err}</ErrorMessage>}
        <Button onClick={submit} disabled={busy || !name.trim() || picked.size === 0}>
          {busy ? 'Creating…' : 'Create working set'}
        </Button>
      </div>
    </DrawerShell>
  );
}
