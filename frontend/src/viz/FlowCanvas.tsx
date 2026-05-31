import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import type { Edge, Node, NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Reusable React Flow surface: pan / zoom / minimap / controls, read-only nodes.
export default function FlowCanvas({
  nodes,
  edges,
  onNodeClick,
  height = 620,
}: {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: NodeMouseHandler;
  height?: number | string;
}) {
  return (
    <div style={{ height }} className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
      >
        <Background color="#cbd5e1" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
