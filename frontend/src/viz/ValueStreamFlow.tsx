import { useCallback, useMemo, useState } from 'react';
import type { Edge, Node, NodeMouseHandler } from '@xyflow/react';
import FlowCanvas from './FlowCanvas';
import { layoutGraph } from './layout';

type Sub = {
  id: string;
  parentId: string | null;
  level: number;
  name: string;
  inputs: string | null;
  outputs: string | null;
  upstream: string | null;
  downstream: string | null;
  notes: string | null;
};

// Value-stream flow map: L2 (root) → L3 process areas → L4 sub-processes → L5
// process steps (v15). Any node with children expands/collapses in place; clicking
// a node opens its inputs/outputs/dependencies in the side panel. L4 sub-processes
// start collapsed so their L5 steps reveal on demand.
export default function ValueStreamFlow({ name, subStreams }: { name: string; subStreams: Sub[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(subStreams.filter((s) => s.level === 4).map((s) => s.id)));
  const [selected, setSelected] = useState<Sub | null>(null);

  const toggle = useCallback((id: string) => {
    setCollapsed((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];
    const ROOT = 'vs-root';
    const l3 = subStreams.filter((s) => s.level === 3);
    const orphanL4 = subStreams.filter((s) => s.level === 4 && !s.parentId);
    const childrenOf = (pid: string) => subStreams.filter((s) => s.parentId === pid);

    ns.push({
      id: ROOT, position: { x: 0, y: 0 }, width: 240, height: 46,
      style: { background: '#1f3253', color: '#fff', border: '1px solid #141f37', borderRadius: 8, padding: 8, width: 240, fontSize: 13, fontWeight: 600 },
      data: { label: name },
    });

    // Per-level card styling: L3 (process area) tinted, L4 (sub-process) white,
    // L5 (process step) faint.
    const styleFor = (lvl: number) => lvl === 3 ? { bg: '#e3eaf6', border: '#92b1da' }
      : lvl === 4 ? { bg: '#ffffff', border: '#cbd5e1' }
      : { bg: '#f8fafc', border: '#e2e8f0' };

    const pushSub = (s: Sub) => {
      const hasChildren = childrenOf(s.id).length > 0;
      const st = styleFor(s.level);
      ns.push({
        id: s.id, position: { x: 0, y: 0 }, width: 230, height: s.level === 3 ? 44 : 56,
        style: { background: st.bg, border: `1px solid ${st.border}`, borderRadius: 8, padding: 6, width: 230, fontSize: 11 },
        data: {
          sub: s,
          label: (
            <div className="flex items-start gap-1.5 text-left">
              {hasChildren && (
                <button onClick={(e) => { e.stopPropagation(); toggle(s.id); }} className="w-3 flex-shrink-0 opacity-60 hover:opacity-100">
                  {collapsed.has(s.id) ? '▸' : '▾'}
                </button>
              )}
              <div className="min-w-0 leading-tight">
                <div className="font-medium truncate">{s.name}</div>
                {s.level === 4 && s.inputs && <div className="text-[9px] opacity-60 truncate">In: {s.inputs}</div>}
              </div>
            </div>
          ),
        },
      });
    };

    // Walk a node and (unless collapsed) its descendants — L3 → L4 → L5.
    const walk = (s: Sub) => {
      pushSub(s);
      if (collapsed.has(s.id)) return;
      for (const c of childrenOf(s.id)) {
        es.push({ id: `${s.id}-${c.id}`, source: s.id, target: c.id, style: { stroke: '#cbd5e1' } });
        walk(c);
      }
    };

    for (const a of l3) {
      es.push({ id: `root-${a.id}`, source: ROOT, target: a.id, style: { stroke: '#94a3b8' } });
      walk(a);
    }
    for (const c of orphanL4) {
      es.push({ id: `root-${c.id}`, source: ROOT, target: c.id, style: { stroke: '#94a3b8' } });
      walk(c);
    }

    return { nodes: layoutGraph(ns, es, { direction: 'LR', nodeWidth: 230, nodeHeight: 52, ranksep: 90, nodesep: 16 }), edges: es };
  }, [name, subStreams, collapsed, toggle]);

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    const sub = (node.data as any)?.sub as Sub | undefined;
    if (sub) setSelected(sub);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <FlowCanvas nodes={nodes} edges={edges} onNodeClick={onNodeClick} height={560} />
      </div>
      <div className="card">
        {selected ? (
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">{selected.name}</h3>
            <dl className="text-xs space-y-2">
              {selected.inputs && <Field label="Inputs" value={selected.inputs} />}
              {selected.outputs && <Field label="Outputs" value={selected.outputs} />}
              {selected.upstream && <Field label="Upstream" value={selected.upstream} />}
              {selected.downstream && <Field label="Downstream" value={selected.downstream} />}
              {selected.notes && <Field label="Notes" value={selected.notes} />}
            </dl>
          </div>
        ) : (
          <div className="text-sm text-slate-500">Click a sub-process node to see its inputs, outputs, and dependencies.</div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-400 uppercase tracking-wide text-[10px] font-semibold">{label}</dt>
      <dd className="text-slate-700">{value}</dd>
    </div>
  );
}
