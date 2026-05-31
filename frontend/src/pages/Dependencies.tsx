import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { Edge, Node, NodeMouseHandler } from '@xyflow/react';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';
import FlowCanvas from '../viz/FlowCanvas';
import { layoutGraph } from '../viz/layout';

const PARTY_COLOR: Record<string, string> = {
  Customer: '#10b981',
  'Distribution Partner': '#3d6db1',
  Vendor: '#f59e0b',
  Reinsurer: '#8b5cf6',
  Regulator: '#ef4444',
  Partner: '#0ea5e9',
};

// Dependency graph from ExternalInteraction rows: external parties ↔ internal
// owner roles. Click a node to highlight its connections; internal-role nodes
// deep-link to the role detail page from the side panel.
export default function Dependencies() {
  const { data: rows, loading, error } = useApi<any[]>('/external-interactions');
  const [selected, setSelected] = useState<string | null>(null);

  const { baseNodes, baseEdges, meta } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];
    const seenNode = new Map<string, any>();
    const seenEdge = new Set<string>();
    for (const r of rows ?? []) {
      const extId = `ext:${r.externalRole}`;
      const roleId = `role:${r.internalRoleId ?? r.internalRoleName ?? r.id}`;
      const color = PARTY_COLOR[r.partyType] ?? '#94a3b8';
      if (!seenNode.has(extId)) {
        seenNode.set(extId, { kind: 'ext', r });
        ns.push({
          id: extId, position: { x: 0, y: 0 }, width: 210, height: 46,
          style: { background: '#fff', border: `2px solid ${color}`, borderRadius: 8, padding: 6, width: 210, fontSize: 11 },
          data: { label: (<div className="leading-tight"><div className="font-medium truncate">{r.externalRole}</div><div className="text-[10px] opacity-60">{r.partyType}</div></div>) },
        });
      }
      if (!seenNode.has(roleId)) {
        seenNode.set(roleId, { kind: 'role', roleId: r.internalRoleId, roleName: r.internalRoleName });
        ns.push({
          id: roleId, position: { x: 0, y: 0 }, width: 200, height: 40,
          style: { background: '#e3eaf6', border: '1px solid #92b1da', borderRadius: 8, padding: 6, width: 200, fontSize: 11 },
          data: { label: (<div className="font-medium truncate">{r.internalRoleName ?? '—'}</div>) },
        });
      }
      const eid = `${extId}->${roleId}`;
      if (!seenEdge.has(eid)) {
        seenEdge.add(eid);
        es.push({ id: eid, source: extId, target: roleId, label: r.interactionType ?? undefined, labelStyle: { fontSize: 9, fill: '#94a3b8' } });
      }
    }
    return { baseNodes: layoutGraph(ns, es, { direction: 'LR', nodeWidth: 210, nodeHeight: 46, ranksep: 150, nodesep: 12 }), baseEdges: es, meta: seenNode };
  }, [rows]);

  const edges = useMemo(
    () =>
      baseEdges.map((e) => {
        const on = !!selected && (e.source === selected || e.target === selected);
        return { ...e, animated: on, style: { stroke: on ? '#2c5594' : '#e2e8f0', strokeWidth: on ? 2 : 1 } };
      }),
    [baseEdges, selected]
  );

  const nodes = useMemo(
    () =>
      baseNodes.map((n) => {
        const isSel = n.id === selected;
        const neighbor = !!selected && edges.some((e) => (e.source === selected && e.target === n.id) || (e.target === selected && e.source === n.id));
        const dim = !!selected && !isSel && !neighbor;
        return { ...n, style: { ...(n.style as CSSProperties), opacity: dim ? 0.3 : 1, boxShadow: isSel ? '0 0 0 2px #2c5594' : undefined } };
      }),
    [baseNodes, edges, selected]
  );

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => setSelected(node.id), []);

  if (loading) return <div className="text-slate-500">Loading dependencies…</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  const sel = selected ? meta.get(selected) : null;

  return (
    <div>
      <PageHeader
        title="External Dependencies"
        subtitle="External parties ↔ internal owner roles, from the workbook's external-interaction rows. Click a node to highlight its connections."
      />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <FlowCanvas nodes={nodes} edges={edges} onNodeClick={onNodeClick} height={660} />
        </div>
        <div className="card">
          {!sel ? (
            <div className="text-sm text-slate-500">Click a node to inspect it and highlight its connections.</div>
          ) : sel.kind === 'role' ? (
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">Internal Role</div>
              <h3 className="font-semibold text-slate-900 mb-2">{sel.roleName ?? '—'}</h3>
              {sel.roleId && <Link to={`/roles/${sel.roleId}`} className="text-sm text-brand-700 hover:underline">View role →</Link>}
            </div>
          ) : (
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">{sel.r.partyType}</div>
              <h3 className="font-semibold text-slate-900 mb-3">{sel.r.externalRole}</h3>
              <dl className="text-xs space-y-2">
                {sel.r.interactionType && <div><dt className="text-slate-400">Interaction</dt><dd className="text-slate-700">{sel.r.interactionType}</dd></div>}
                {sel.r.relatedValueStream && <div><dt className="text-slate-400">Related value streams</dt><dd className="text-slate-700">{sel.r.relatedValueStream}</dd></div>}
                {sel.r.dependencyType && <div><dt className="text-slate-400">Dependency</dt><dd className="text-slate-700">{sel.r.dependencyType}</dd></div>}
                {sel.r.frequency && <div><dt className="text-slate-400">Frequency</dt><dd className="text-slate-700">{sel.r.frequency}</dd></div>}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
