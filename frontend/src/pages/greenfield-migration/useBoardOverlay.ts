/**
 * useBoardOverlay — the user-curated drag/connect layer over the data-derived
 * board: keeps the live React Flow state synced to (base + saved overlay)
 * while reading, hands control to the user while editing, and diffs the
 * working board into the staged-change list + the overlay to persist.
 */
import { useCallback, useEffect, useMemo } from 'react';
import {
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import type { StageDetail } from '../../lib/rationalization';
import {
  EMPTY_OVERLAY,
  USER_EDGE,
  applyOverlay,
  diffBoard,
  normalizeOverlay,
  type Overlay,
  type StagedChange,
} from './boardOverlay';

export type BoardOverlayApi = {
  bnodes: Node[];
  bedges: Edge[];
  onNodesChange: ReturnType<typeof useNodesState<Node>>[2];
  onEdgesChange: ReturnType<typeof useEdgesState<Edge>>[2];
  onConnect: (c: Connection) => void;
  onReconnect: (oldEdge: Edge, newConn: Connection) => void;
  /** Staged this session (vs the effective board) — feeds the commit panel. */
  session: { overlay: Overlay; changes: StagedChange[] };
  /** The absolute overlay to save (vs the data-derived base). */
  saveOverlay: Overlay;
};

export function useBoardOverlay(
  base: { nodes: Node[]; edges: Edge[] },
  detail: StageDetail | null,
  editing: boolean,
): BoardOverlayApi {
  const [bnodes, setBNodes, onNodesChange] = useNodesState<Node>([]);
  const [bedges, setBEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Saved overlay + the effective (data + saved overlay) board shown read-only.
  const savedOverlay = useMemo(() => normalizeOverlay(detail?.layout), [detail]);
  const effective = useMemo(() => applyOverlay(base, savedOverlay), [base, savedOverlay]);

  // Keep the live board synced to the effective board while NOT editing; when
  // editing, leave it under the user's control (their staged edits live here).
  useEffect(() => {
    if (editing) return;
    setBNodes(effective.nodes);
    setBEdges(effective.edges);
  }, [effective, editing, setBNodes, setBEdges]);

  // Edit interactions: draw a new arrow, or re-point an existing one. The id
  // is deterministic per connection so it survives remounts without colliding.
  const onConnect = useCallback(
    (c: Connection) => {
      const id = `u:${c.source}.${c.sourceHandle ?? 'r'}-${c.target}.${c.targetHandle ?? 'l'}`;
      setBEdges((eds) => addEdge({ ...USER_EDGE, ...c, id }, eds));
    },
    [setBEdges],
  );
  const onReconnect = useCallback(
    (oldEdge: Edge, newConn: Connection) => {
      setBEdges((eds) => reconnectEdge(oldEdge, newConn, eds));
    },
    [setBEdges],
  );

  const session = useMemo(
    () =>
      detail
        ? diffBoard(effective, { nodes: bnodes, edges: bedges }, detail)
        : { overlay: EMPTY_OVERLAY, changes: [] as StagedChange[] },
    [effective, bnodes, bedges, detail],
  );
  const saveOverlay = useMemo(
    () =>
      detail ? diffBoard(base, { nodes: bnodes, edges: bedges }, detail).overlay : EMPTY_OVERLAY,
    [base, bnodes, bedges, detail],
  );

  return {
    bnodes,
    bedges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onReconnect,
    session,
    saveOverlay,
  };
}
