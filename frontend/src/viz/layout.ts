import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';

// Auto-layout a node/edge graph with dagre. Positions are top-left (React Flow
// convention); dagre returns centers, so we offset by half width/height.
export function layoutGraph(
  nodes: Node[],
  edges: Edge[],
  opts: { direction?: 'TB' | 'LR'; nodeWidth?: number; nodeHeight?: number; ranksep?: number; nodesep?: number } = {}
): Node[] {
  const { direction = 'TB', nodeWidth = 220, nodeHeight = 56, ranksep = 70, nodesep = 28 } = opts;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep, ranksep, marginx: 24, marginy: 24 });

  for (const n of nodes) g.setNode(n.id, { width: n.width ?? nodeWidth, height: n.height ?? nodeHeight });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);

  const horizontal = direction === 'LR';
  return nodes.map((n) => {
    const p = g.node(n.id);
    const w = n.width ?? nodeWidth;
    const h = n.height ?? nodeHeight;
    return {
      ...n,
      position: { x: p.x - w / 2, y: p.y - h / 2 },
      sourcePosition: (horizontal ? 'right' : 'bottom') as Node['sourcePosition'],
      targetPosition: (horizontal ? 'left' : 'top') as Node['targetPosition'],
    };
  });
}
