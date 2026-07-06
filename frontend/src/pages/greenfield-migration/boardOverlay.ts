/**
 * Board overlay model for the Application Rationalization board — the
 * user-curated drag/connect layer persisted on top of the data-derived board,
 * plus the diff that turns a working board into an overlay + staged-change
 * list. Extracted verbatim from GreenfieldMigration.tsx.
 */
import { MarkerType, type Node, type Edge } from '@xyflow/react';
import type { StageDetail, BoardLayout } from '../../lib/rationalization';

// ── Board overlay (user-curated drag/connect layer) ──────────────────────────
export type Overlay = {
  positions: Record<string, { x: number; y: number }>;
  addedEdges: {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }[];
  removedEdges: string[];
};
export const EMPTY_OVERLAY: Overlay = { positions: {}, addedEdges: [], removedEdges: [] };

export type StagedChange = { type: 'move' | 'connect' | 'reconnect' | 'disconnect'; label: string };
export const CHANGE_DOT: Record<StagedChange['type'], string> = {
  move: '#a3a3a3',
  connect: '#10b981',
  reconnect: '#4f46e5',
  disconnect: '#be123c',
};

// Visual style for any arrow the user has drawn or re-pointed.
export const USER_EDGE = {
  type: 'default' as const,
  style: { stroke: '#4f46e5', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5', width: 16, height: 16 },
  reconnectable: true as const,
};

export function normalizeOverlay(layout: BoardLayout | null | undefined): Overlay {
  if (!layout) return EMPTY_OVERLAY;
  return {
    positions: layout.positions ?? {},
    addedEdges: layout.addedEdges ?? [],
    removedEdges: layout.removedEdges ?? [],
  };
}

// Lay the saved/user overlay on top of the data-derived board.
export function applyOverlay(
  base: { nodes: Node[]; edges: Edge[] },
  ov: Overlay,
): { nodes: Node[]; edges: Edge[] } {
  const nodes = base.nodes.map((n) =>
    ov.positions[n.id] ? { ...n, position: ov.positions[n.id] } : n,
  );
  const removed = new Set(ov.removedEdges);
  const kept = base.edges.filter((e) => !removed.has(e.id));
  const added: Edge[] = ov.addedEdges.map((e) => ({
    ...USER_EDGE,
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? 'r',
    targetHandle: e.targetHandle ?? 'l',
  }));
  return { nodes, edges: [...kept, ...added] };
}

function boardNodeLabel(id: string, detail: StageDetail): string {
  if (id.startsWith('cell:')) {
    const [, appId, layer] = id.split(':');
    const app = detail.apps.find((a) => a.id === appId)?.name ?? 'App';
    return `${app} · ${layer}`;
  }
  if (id.startsWith('cap:')) {
    const layer = id.slice(4);
    return detail.components.find((c) => c.layer === layer)?.name ?? `Normalize ${layer}`;
  }
  if (id.startsWith('svc:')) {
    return detail.microservices.find((m) => m.id === id.slice(4))?.name ?? 'Greenfield service';
  }
  if (id.startsWith('shared:')) {
    return detail.apps.find((a) => a.id === id.slice(7))?.name ?? 'Shared service';
  }
  return id;
}

// Diff a working board against a reference: which positions moved, which arrows
// were added / re-pointed / removed. Drives both the overlay to persist and the
// human-readable staged-change list.
export function diffBoard(
  ref: { nodes: Node[]; edges: Edge[] },
  work: { nodes: Node[]; edges: Edge[] },
  detail: StageDetail,
): { overlay: Overlay; changes: StagedChange[] } {
  const positions: Overlay['positions'] = {};
  const addedEdges: Overlay['addedEdges'] = [];
  const removedEdges: string[] = [];
  const changes: StagedChange[] = [];

  const refPos = new Map(ref.nodes.map((n) => [n.id, n.position]));
  for (const n of work.nodes) {
    const p = refPos.get(n.id);
    if (!p) continue;
    if (
      Math.round(p.x) !== Math.round(n.position.x) ||
      Math.round(p.y) !== Math.round(n.position.y)
    ) {
      positions[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
      changes.push({ type: 'move', label: `Moved ${boardNodeLabel(n.id, detail)}` });
    }
  }

  const serialize = (e: Edge) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? 'r',
    targetHandle: e.targetHandle ?? 'l',
  });
  const refById = new Map(ref.edges.map((e) => [e.id, e]));
  const workById = new Map(work.edges.map((e) => [e.id, e]));
  for (const [id, e] of workById) {
    const b = refById.get(id);
    if (!b) {
      addedEdges.push(serialize(e));
      changes.push({
        type: 'connect',
        label: `Connected ${boardNodeLabel(e.source, detail)} → ${boardNodeLabel(e.target, detail)}`,
      });
    } else if (
      b.source !== e.source ||
      b.target !== e.target ||
      (b.sourceHandle ?? 'r') !== (e.sourceHandle ?? 'r') ||
      (b.targetHandle ?? 'l') !== (e.targetHandle ?? 'l')
    ) {
      removedEdges.push(id);
      addedEdges.push(serialize(e));
      changes.push({
        type: 'reconnect',
        label: `Re-pointed ${boardNodeLabel(e.source, detail)} → ${boardNodeLabel(e.target, detail)}`,
      });
    }
  }
  for (const [id, e] of refById) {
    if (!workById.has(id)) {
      removedEdges.push(id);
      changes.push({
        type: 'disconnect',
        label: `Removed ${boardNodeLabel(e.source, detail)} → ${boardNodeLabel(e.target, detail)}`,
      });
    }
  }
  return { overlay: { positions, addedEdges, removedEdges }, changes };
}
