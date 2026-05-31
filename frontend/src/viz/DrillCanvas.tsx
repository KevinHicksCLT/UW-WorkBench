import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { drillNodeTypes, type DrillNodeData, type DrillNodeType } from './nodes/DrillNode';

export type DrillItem = { id: string; type: DrillNodeType; name: string; subtitle?: string; badges?: Record<string, any>; group?: string };
export type DrillParent = { type: DrillNodeType; id: string; name: string; subtitle?: string; illustrative?: boolean };
export type DrillChildren = { childType: DrillNodeType | null; items: DrillItem[]; total: number; nextCursor: string | null };

const PARENT_W = 300, PARENT_H = 92, CHILD_W = 224, CHILD_H = 84, GAP_X = 28, ROW_H = 108, RANK = 120, LABEL_H = 22, BAND_GAP = 40;
const LEAF: DrillNodeType[] = ['task', 'application', 'processStep'];

function columnsFor(n: number) { if (n <= 4) return Math.max(n, 1); if (n <= 12) return 4; if (n <= 30) return 5; return 6; }

export default function DrillCanvas({ parent, children, focusId, onInspect, onDrill, onHover, onLoadMore }: {
  parent: DrillParent; children: DrillChildren; focusId: string | null;
  onInspect: (item: DrillItem) => void; onDrill: (item: DrillItem) => void; onHover?: (item: DrillItem) => void; onLoadMore?: () => void;
}) {
  const items = children.items;
  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = []; const es: Edge[] = [];
    // group items (preserve first-seen order); '' = no group
    const order: string[] = []; const byGroup = new Map<string, DrillItem[]>();
    for (const it of items) { const g = it.group ?? ''; if (!byGroup.has(g)) { byGroup.set(g, []); order.push(g); } byGroup.get(g)!.push(it); }
    const grouped = order.length > 1 || (order.length === 1 && order[0] !== '');

    const gridW = Math.max(CHILD_W, ...order.map((g) => { const n = byGroup.get(g)!.length; const cols = columnsFor(n); return cols * CHILD_W + (cols - 1) * GAP_X; }));

    const mkChild = (it: DrillItem, x: number, y: number) => {
      ns.push({
        id: it.id, type: 'drill', position: { x, y },
        data: { variant: 'child', nodeType: it.type, name: it.name, subtitle: it.subtitle, badges: it.badges, illustrative: it.badges?.employmentType ? true : undefined, selected: it.id === focusId, hasChildren: !LEAF.includes(it.type) } as DrillNodeData,
        sourcePosition: 'bottom' as Node['sourcePosition'], targetPosition: 'top' as Node['targetPosition'], draggable: false,
      });
      es.push({ id: `e:${it.id}`, source: `parent:${parent.id}`, target: it.id, type: 'default', animated: it.id === focusId, style: { stroke: it.id === focusId ? '#3a5ff0' : '#c5d0e6', strokeOpacity: it.id === focusId ? 0.9 : 0.45 } });
    };

    let y = PARENT_H + RANK;
    for (const g of order) {
      const groupItems = byGroup.get(g)!;
      const cols = columnsFor(groupItems.length);
      const rows = Math.ceil(groupItems.length / cols);
      if (grouped && g) { ns.push({ id: `lbl:${g}`, type: 'groupLabel', position: { x: gridW / 2 - 80, y }, data: { label: g }, draggable: false, selectable: false }); y += LABEL_H; }
      groupItems.forEach((it, i) => {
        const row = Math.floor(i / cols); const isLast = row === rows - 1;
        const inRow = isLast ? groupItems.length - row * cols : cols;
        const rowW = inRow * CHILD_W + (inRow - 1) * GAP_X; const rowStart = (gridW - rowW) / 2; const col = i - row * cols;
        mkChild(it, rowStart + col * (CHILD_W + GAP_X), y + row * ROW_H);
      });
      y += rows * ROW_H + BAND_GAP;
    }

    ns.push({
      id: `parent:${parent.id}`, type: 'drill', position: { x: gridW / 2 - PARENT_W / 2, y: 0 },
      data: { variant: 'parent', nodeType: parent.type, name: parent.name, subtitle: parent.subtitle, illustrative: parent.illustrative, selected: focusId === parent.id } as DrillNodeData,
      sourcePosition: 'bottom' as Node['sourcePosition'], targetPosition: 'top' as Node['targetPosition'], draggable: false, selectable: false,
    });
    return { nodes: ns, edges: es };
  }, [parent, items, focusId]);

  return (
    <div className="rf-stage relative h-full w-full rounded-2xl border border-slate-200/70 bg-surface-sunken overflow-hidden animate-fade-in" key={parent.id}>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={drillNodeTypes}
        onNodeClick={(_e, n) => { const it = items.find((x) => x.id === n.id); if (it) onInspect(it); }}
        onNodeDoubleClick={(_e, n) => { const it = items.find((x) => x.id === n.id); if (it && n.data && (n.data as DrillNodeData).hasChildren) onDrill(it); }}
        onNodeMouseEnter={onHover ? (_e, n) => { const it = items.find((x) => x.id === n.id); if (it) onHover(it); } : undefined}
        fitView fitViewOptions={{ padding: 0.16, maxZoom: 1 }} nodesConnectable={false} minZoom={0.08} maxZoom={1.6} proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1.5} />
        <Controls showInteractive={false} position="bottom-right" />
        {items.length > 18 && <MiniMap pannable zoomable nodeColor="#cbd5e1" maskColor="rgba(241,245,249,0.6)" />}
      </ReactFlow>
      {items.length === 0 && <div className="absolute inset-0 grid place-items-center pointer-events-none"><div className="text-center text-sm text-slate-400">No further breakdown at this level.</div></div>}
      {children.nextCursor && onLoadMore && <button onClick={onLoadMore} className="absolute bottom-4 left-1/2 -translate-x-1/2 btn-secondary text-xs shadow-card">Load more ({children.items.length} of {children.total})</button>}
    </div>
  );
}
