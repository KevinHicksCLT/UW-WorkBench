import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import { BackButton, Button, Chip, ErrorMessage, LoadingState, Select } from '../../components/ui';
import { ClusterDrawer, CellStateBadge, CELL_STATE_META } from './ClusterDrawer';
import type { CompareRow, MatrixResponse, MatrixRow } from './types';

// Working-set detail (FORMS-COMPARE): Portfolio mode renders the
// cluster×form matrix (glyph+colour cells, keyboard-reachable buttons);
// Reading mode is the clause-aligned two-form comparison. Default mode is
// derived from set size; the toggle stores an explicit override
// (FORMS-HLR-008). Cell drill-down opens the cluster drawer and returns
// without losing state.

export default function FormsWorkingSet() {
  const { id } = useParams();
  const { data, error, loading, refetch } = useApi<MatrixResponse>(
    id ? `/forms/working-sets/${id}/matrix` : null,
  );
  const [busy, setBusy] = useState(false);
  const [openCluster, setOpenCluster] = useState<string | null>(null);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (loading || !data) return <LoadingState />;

  const { workingSet, columns, rows } = data;
  const mode = workingSet.mode;

  const runCluster = async () => {
    setBusy(true);
    try {
      await api.post(`/forms/working-sets/${workingSet.id}/cluster`);
      refetch();
    } finally {
      setBusy(false);
    }
  };

  const setMode = async (m: string) => {
    await api.patch(`/forms/working-sets/${workingSet.id}`, {
      modeOverride: m === 'auto' ? null : m,
    });
    refetch();
  };

  const selectedRow = rows.find((r) => r.clusterId === openCluster) ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Forms · Working set"
        title={workingSet.name}
        subtitle={`${columns.length} forms · θ=${workingSet.clusterThreshold} · analysis ${workingSet.clusterStatus === 'none' ? 'not run' : workingSet.clusterStatus}`}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={workingSet.modeOverride ?? 'auto'}
              onChange={(e) => setMode(e.target.value)}
              title="Reading ≤7 forms, Portfolio ≥8 — override anytime"
            >
              <option value="auto">
                Auto mode ({columns.length <= 7 ? 'Reading' : 'Portfolio'})
              </option>
              <option value="reading">Reading mode</option>
              <option value="portfolio">Portfolio mode</option>
            </Select>
            <Button onClick={runCluster} disabled={busy}>
              {busy
                ? 'Clustering…'
                : workingSet.clusterStatus === 'done'
                  ? 'Re-run clustering'
                  : 'Run clustering'}
            </Button>
          </div>
        }
      />
      <div className="mb-3">
        <BackButton fallback="/forms/working-sets" label="All working sets" />
      </div>

      {rows.length === 0 ? (
        <div className="border border-dashed border-[#d4d4d4] rounded-lg p-10 text-center text-[#737373]">
          No clusters yet — run clustering to group equivalent clauses across the set.
        </div>
      ) : mode === 'portfolio' ? (
        <MatrixView data={data} onOpen={(r) => setOpenCluster(r.clusterId)} />
      ) : (
        <ReadingView data={data} onOpenCluster={(cid) => setOpenCluster(cid)} />
      )}

      {selectedRow && (
        <ClusterDrawer
          row={selectedRow}
          columns={columns}
          workingSetId={workingSet.id}
          onClose={() => setOpenCluster(null)}
          onChanged={refetch}
        />
      )}
    </div>
  );
}

function MatrixView({ data, onOpen }: { data: MatrixResponse; onOpen: (r: MatrixRow) => void }) {
  const { columns, rows } = data;
  return (
    <div>
      <div className="flex items-center gap-3 mb-2 text-[11px] text-[#737373]">
        <span className="font-semibold uppercase tracking-[0.08em]">Legend</span>
        {Object.entries(CELL_STATE_META).map(([state]) => (
          <CellStateBadge key={state} state={state} />
        ))}
        <span>⚠ outlier</span>
      </div>
      <div className="overflow-x-auto border border-[#eaeaea] rounded-lg bg-white">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-[#fafafa] border-b border-[#eaeaea]">
              <th className="text-left px-3 py-2 font-semibold text-[#525252] sticky left-0 bg-[#fafafa] min-w-[260px]">
                Clause cluster
              </th>
              {columns.map((c) => (
                <th
                  key={c.id}
                  className="px-2 py-2 font-semibold text-[#525252] whitespace-nowrap"
                  title={c.form.title}
                >
                  {c.form.formNumber}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.clusterId} className="border-b border-[#f5f5f5] hover:bg-[#fafafa]">
                <td className="px-3 py-1.5 sticky left-0 bg-white">
                  <button
                    className="text-left text-[#0070AD] hover:underline font-medium truncate max-w-[340px] block"
                    onClick={() => onOpen(r)}
                    title={r.representativeText ?? r.label}
                  >
                    {r.label}
                  </button>
                  <span className="text-[10px] text-[#a3a3a3]">
                    {r.memberCount} members · div {(r.divergenceScore * 100).toFixed(0)}%
                    {r.hasPreferredWording && ' · ★'}
                    {r.dispositions.length > 0 && ` · ${r.dispositions[0].type}`}
                  </span>
                </td>
                {columns.map((c) => {
                  const cell = r.cells[c.id];
                  const meta = CELL_STATE_META[cell?.state ?? 'absent'];
                  return (
                    <td key={c.id} className="px-2 py-1.5 text-center">
                      <button
                        aria-label={`${r.label} in ${c.form.formNumber}: ${meta.label}${cell?.outlier ? ' (outlier)' : ''}`}
                        title={`${meta.label} · ${((cell?.similarity ?? 0) * 100).toFixed(0)}%`}
                        onClick={() => onOpen(r)}
                        className="w-7 h-7 rounded font-semibold"
                        style={{ background: meta.bg, color: meta.text }}
                      >
                        {meta.glyph}
                        {cell?.outlier ? '⚠' : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReadingView({
  data,
  onOpenCluster,
}: {
  data: MatrixResponse;
  onOpenCluster: (clusterId: string) => void;
}) {
  const { workingSet, columns } = data;
  const [a, setA] = useState(columns[0]?.id ?? '');
  const [b, setB] = useState(columns[1]?.id ?? '');
  const comparePath = useMemo(
    () =>
      a && b && a !== b
        ? `/forms/working-sets/${workingSet.id}/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`
        : null,
    [workingSet.id, a, b],
  );
  const { data: compare, loading } = useApi<{ rows: CompareRow[] }>(comparePath);

  const colLabel = (id: string) => {
    const c = columns.find((x) => x.id === id);
    return c ? `${c.form.formNumber} v${c.versionNo}` : '';
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Select value={a} onChange={(e) => setA(e.target.value)}>
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.form.formNumber} — {c.form.title}
            </option>
          ))}
        </Select>
        <span className="text-[#a3a3a3] text-sm">vs</span>
        <Select value={b} onChange={(e) => setB(e.target.value)}>
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.form.formNumber} — {c.form.title}
            </option>
          ))}
        </Select>
        {data.rows.length > 0 && (
          <span className="text-[11px] text-[#a3a3a3] ml-2">
            Clause-aligned by cluster; cited text is never truncated.
          </span>
        )}
      </div>

      {!comparePath ? (
        <div className="text-[13px] text-[#a3a3a3] italic">
          Pick two different forms to compare.
        </div>
      ) : loading ? (
        <LoadingState />
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 text-[12px] font-semibold text-[#525252]">
            <div>{colLabel(a)}</div>
            <div>{colLabel(b)}</div>
          </div>
          {(compare?.rows ?? []).map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-2 gap-3 border border-[#eaeaea] rounded-md overflow-hidden"
            >
              <ClausePane clause={row.a} status={row.status} similarity={row.similarity} />
              <ClausePane clause={row.b} status={row.status} similarity={row.similarity} />
            </div>
          ))}
        </div>
      )}

      {data.rows.length > 0 && (
        <div className="mt-4 text-[12px] text-[#737373]">
          Portfolio clusters for this set:{' '}
          {data.rows.slice(0, 8).map((r) => (
            <button
              key={r.clusterId}
              onClick={() => onOpenCluster(r.clusterId)}
              className="text-[#0070AD] hover:underline mr-2"
            >
              {r.label}
            </button>
          ))}
          {data.rows.length > 8 && (
            <Link to="#" className="text-[#a3a3a3]">
              +{data.rows.length - 8} more (switch to Portfolio mode)
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function ClausePane({
  clause,
  status,
  similarity,
}: {
  clause: CompareRow['a'];
  status: CompareRow['status'];
  similarity: number;
}) {
  if (!clause) {
    return (
      <div className="p-3 bg-[#fafafa] text-[12px] text-[#a3a3a3] italic">absent in this form</div>
    );
  }
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] font-semibold text-[#525252]">
          {clause.ordinal}. {clause.heading ?? 'Clause'}
        </span>
        <CellStateBadge state={status === 'unique' ? 'unique' : status} />
        {status !== 'unique' && <Chip>{(similarity * 100).toFixed(0)}%</Chip>}
      </div>
      <div className="text-[12px] text-[#404040] whitespace-pre-wrap">{clause.text}</div>
    </div>
  );
}
