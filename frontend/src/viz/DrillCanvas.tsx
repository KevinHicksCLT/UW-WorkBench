import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, MarkerType, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { drillNodeTypes, type DrillNodeData, type DrillNodeType, DOMAIN_HEX } from './nodes/DrillNode';

export type DrillItem = { id: string; type: DrillNodeType; name: string; subtitle?: string; badges?: Record<string, any>; group?: string; flow?: boolean; domainCategory?: string; hasOwner?: boolean; roleLinkCount?: number };
export type DrillParent = { type: DrillNodeType; id: string; name: string; subtitle?: string; illustrative?: boolean; domainCategory?: string };
export type DrillChildren = { childType: DrillNodeType | null; items: DrillItem[]; total: number; nextCursor: string | null };

// divsByGroup is only provided when the parent is a company — it powers the
// CEO's three-domain org split: Core Business / IT / Corporate Function.
export type DivsByGroup = Record<string, { id: string; name: string; roles: number }[]>;

const PARENT_W = 300, PARENT_H = 92, CHILD_W = 224, CHILD_H = 84, GAP_X = 40, ROW_H = 112, RANK = 120, LABEL_H = 32, BAND_GAP = 48;
const LEAF: DrillNodeType[] = ['task', 'processStep'];

function gridCols(n: number) { if (n <= 4) return Math.max(n, 1); if (n <= 12) return 4; if (n <= 30) return 5; return 6; }

// Build the org-chart nodes when we're at the company level.
// Divisions are grouped into the three CEO domains and each domain gets
// a colored header label + nodes whose accent bars match the domain hue.
function buildCompanyOrgNodes(
  divsByGroup: DivsByGroup,
  focusId: string | null,
  gridW: number,
): { ns: Node[]; es: Edge[]; totalH: number } {
  const ns: Node[] = [];
  const es: Edge[] = [];
  const parentId = 'parent:company';
  const DOMAIN_ORDER = ['Core Business', 'IT', 'Corporate Function'];

  let y = PARENT_H + RANK;

  for (const domain of DOMAIN_ORDER) {
    const divs = divsByGroup[domain];
    if (!divs || divs.length === 0) continue;

    const domainColor = DOMAIN_HEX[domain];
    const cols = gridCols(divs.length);
    const rows = Math.ceil(divs.length / cols);
    const rowW = cols * CHILD_W + (cols - 1) * GAP_X;
    const rowStart = (gridW - rowW) / 2;

    // Domain group label
    ns.push({
      id: `lbl:${domain}`,
      type: 'groupLabel',
      position: { x: gridW / 2 - 110, y },
      data: { label: domain, domainColor, isDomainGroup: true },
      draggable: false,
      selectable: false,
    });
    y += LABEL_H;

    // Division nodes
    divs.forEach((div, i) => {
      const row = Math.floor(i / cols);
      const isLast = row === rows - 1;
      const inRow = isLast ? divs.length - row * cols : cols;
      const rowWAdj = inRow * CHILD_W + (inRow - 1) * GAP_X;
      const rowStartAdj = (gridW - rowWAdj) / 2;
      const col = i - row * cols;

      ns.push({
        id: div.id,
        type: 'drill',
        position: { x: rowStartAdj + col * (CHILD_W + GAP_X), y: y + row * ROW_H },
        data: {
          variant: 'child',
          nodeType: 'division',
          name: div.name,
          subtitle: `${div.roles} roles`,
          badges: { roles: div.roles },
          selected: div.id === focusId,
          hasChildren: true,
          domainCategory: domain,
        } as DrillNodeData,
        draggable: false,
      });

      es.push({
        id: `e:${parentId}->${div.id}`,
        source: parentId,
        target: div.id,
        type: 'default',
        sourceHandle: 'b',
        targetHandle: 't',
        style: {
          stroke: div.id === focusId ? '#3a5ff0' : domainColor,
          strokeWidth: 1.25,
          strokeOpacity: div.id === focusId ? 0.95 : 0.3,
        },
      });
    });

    y += rows * ROW_H + BAND_GAP;
  }

  return { ns, es, totalH: y };
}

export default function DrillCanvas({ parent, children, focusId, divsByGroup, onInspect, onDrill, onHover, onLoadMore }: {
  parent: DrillParent; children: DrillChildren; focusId: string | null;
  divsByGroup?: DivsByGroup;
  onInspect: (item: DrillItem) => void; onDrill: (item: DrillItem) => void; onHover?: (item: DrillItem) => void; onLoadMore?: () => void;
}) {
  const items = children.items;

  const { nodes, edges, allItems } = useMemo(() => {
    const ns: Node[] = []; const es: Edge[] = [];
    const parentId = `parent:${parent.id}`;
    const order: string[] = []; const byGroup = new Map<string, DrillItem[]>();
    for (const it of items) { const g = it.group ?? ''; if (!byGroup.has(g)) { byGroup.set(g, []); order.push(g); } byGroup.get(g)!.push(it); }
    const grouped = order.length > 1 || (order.length === 1 && order[0] !== '');

    // When the company node is open AND divsByGroup is available, we also render
    // the org-chart tree below any operating-model children.
    const hasOrgView = parent.type === 'company' && !!divsByGroup;

    const widthOf = (g: string) => { const its = byGroup.get(g)!; const flow = !!its[0]?.flow; const cols = flow ? Math.min(its.length, 6) : gridCols(its.length); return cols * CHILD_W + (cols - 1) * GAP_X; };
    const gridW = hasOrgView
      ? Math.max(CHILD_W, 4 * CHILD_W + 3 * GAP_X, ...order.map(widthOf))
      : Math.max(CHILD_W, ...order.map(widthOf));

    const mkNode = (it: DrillItem, x: number, y: number) => {
      ns.push({
        id: it.id, type: 'drill', position: { x, y },
        data: {
          variant: 'child', nodeType: it.type, name: it.name, subtitle: it.subtitle,
          badges: it.badges, illustrative: it.badges?.employmentType ? true : undefined,
          selected: it.id === focusId, hasChildren: !LEAF.includes(it.type),
          domainCategory: it.domainCategory,
          hasOwner: it.hasOwner,
        } as DrillNodeData,
        draggable: false,
      });
    };
    const edge = (from: string, to: string, opts: { flow?: boolean; seq?: boolean; sel?: boolean } = {}) => es.push({
      id: `e:${from}->${to}`, source: from, target: to, type: opts.flow ? 'smoothstep' : 'default',
      sourceHandle: opts.seq ? 'r' : 'b', targetHandle: opts.seq ? 'l' : 't',
      markerEnd: opts.flow ? { type: MarkerType.ArrowClosed, width: 16, height: 16, color: opts.sel ? '#3a5ff0' : '#94a3b8' } : undefined,
      animated: !!opts.sel,
      style: { stroke: opts.sel ? '#3a5ff0' : opts.flow ? '#94a3b8' : '#c5d0e6', strokeWidth: opts.flow ? 1.5 : 1.25, strokeOpacity: opts.sel ? 0.95 : opts.flow ? 0.85 : 0.45 },
    });

    let y = PARENT_H + RANK;
    for (const g of order) {
      const groupItems = byGroup.get(g)!;
      const isFlow = !!groupItems[0]?.flow;
      const cols = isFlow ? Math.min(groupItems.length, 6) : gridCols(groupItems.length);
      const rows = Math.ceil(groupItems.length / cols);
      if (grouped && g) { ns.push({ id: `lbl:${g}`, type: 'groupLabel', position: { x: gridW / 2 - 90, y }, data: { label: g + (isFlow ? '  ›››' : '') }, draggable: false, selectable: false }); y += LABEL_H; }
      groupItems.forEach((it, i) => {
        const row = Math.floor(i / cols); const isLast = row === rows - 1;
        const inRow = isLast ? groupItems.length - row * cols : cols;
        const rowW = inRow * CHILD_W + (inRow - 1) * GAP_X; const rowStart = (gridW - rowW) / 2; const col = i - row * cols;
        mkNode(it, rowStart + col * (CHILD_W + GAP_X), y + row * ROW_H);
      });
      if (isFlow) {
        edge(parentId, groupItems[0].id, { flow: true, sel: groupItems[0].id === focusId });
        for (let i = 1; i < groupItems.length; i++) edge(groupItems[i - 1].id, groupItems[i].id, { flow: true, seq: true, sel: groupItems[i].id === focusId });
      } else {
        for (const it of groupItems) edge(parentId, it.id, { sel: it.id === focusId });
      }
      y += rows * ROW_H + BAND_GAP;
    }

    // CEO org-chart view: three CEO domains below the operating-model domains.
    let orgItems: DrillItem[] = [];
    if (hasOrgView && divsByGroup) {
      // Divider label between the two axes.
      ns.push({
        id: 'lbl:org-divider',
        type: 'groupLabel',
        position: { x: gridW / 2 - 90, y },
        data: { label: 'Organisation' },
        draggable: false,
        selectable: false,
      });
      y += LABEL_H;

      const { ns: orgNs, es: orgEs } = buildCompanyOrgNodes(divsByGroup, focusId, gridW);
      // Shift the org nodes down by the current y offset, using the node positions
      // already set relative to y=0 in buildCompanyOrgNodes (which starts from PARENT_H+RANK).
      // We need to offset them so they appear below the operating-model nodes.
      const orgYOffset = y - (PARENT_H + RANK);
      for (const n of orgNs) {
        ns.push({ ...n, id: n.id.startsWith('lbl:') ? n.id : n.id, position: { x: n.position.x, y: n.position.y + orgYOffset } });
        // Build a synthetic DrillItem so these nodes are clickable.
        const domCat = (n.data as DrillNodeData).domainCategory;
        if (domCat && n.type === 'drill') {
          orgItems.push({ id: n.id, type: 'division', name: (n.data as DrillNodeData).name, domainCategory: domCat, badges: (n.data as DrillNodeData).badges });
        }
      }
      for (const e of orgEs) es.push(e);
    }

    ns.push({
      id: parentId, type: 'drill', position: { x: gridW / 2 - PARENT_W / 2, y: 0 },
      data: { variant: 'parent', nodeType: parent.type, name: parent.name, subtitle: parent.subtitle, illustrative: parent.illustrative, selected: focusId === parent.id, domainCategory: parent.domainCategory } as DrillNodeData,
      sourcePosition: 'bottom' as Node['sourcePosition'], targetPosition: 'top' as Node['targetPosition'], draggable: false, selectable: false,
    });
    return { nodes: ns, edges: es, allItems: [...items, ...orgItems] };
  }, [parent, items, focusId, divsByGroup]);

  return (
    <div className="rf-stage relative h-full w-full rounded-2xl border border-slate-200/70 bg-surface-sunken overflow-hidden animate-fade-in" key={parent.id}>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={drillNodeTypes}
        onNodeClick={(e, n) => {
          const it = allItems.find((x) => x.id === n.id); if (!it) return;
          const onChip = (e.target as HTMLElement)?.closest?.('[data-drill]');
          if (onChip && (n.data as DrillNodeData).hasChildren) onDrill(it); else onInspect(it);
        }}
        onNodeDoubleClick={(_e, n) => { const it = allItems.find((x) => x.id === n.id); if (it && n.data && (n.data as DrillNodeData).hasChildren) onDrill(it); }}
        onNodeMouseEnter={onHover ? (_e, n) => { const it = allItems.find((x) => x.id === n.id); if (it) onHover(it); } : undefined}
        fitView fitViewOptions={{ padding: 0.16, maxZoom: 1 }} nodesConnectable={false} minZoom={0.08} maxZoom={1.6} proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1.5} />
        <Controls showInteractive={false} position="bottom-right" />
        {allItems.length > 18 && <MiniMap pannable zoomable nodeColor="#cbd5e1" maskColor="rgba(241,245,249,0.6)" />}
      </ReactFlow>
      {allItems.length === 0 && <div className="absolute inset-0 grid place-items-center pointer-events-none"><div className="text-center text-sm text-slate-400">No further breakdown at this level.</div></div>}
      {children.nextCursor && onLoadMore && <button onClick={onLoadMore} className="absolute bottom-4 left-1/2 -translate-x-1/2 btn-secondary text-xs shadow-card">Load more ({children.items.length} of {children.total})</button>}
    </div>
  );
}
