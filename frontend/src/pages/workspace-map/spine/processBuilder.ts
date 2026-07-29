// Shared model for the workspace's process/role BUILDERS — the right-hand
// "new value stream" / "new role" panels the user assembles by drag & drop.
// Items carry their real ProcessNode ids so every destructive edit can route
// through the common change-impact gate, and the vocabulary is pure process
// levels: Process level 3 (area) › 4 (sub-process) › 5 (task) › 6 (Work
// Library step). No invented nouns.

import type { DragEvent } from 'react';

export type ProcessLevel = '3' | '4' | '5' | '6';

export const LEVEL_LABEL: Record<ProcessLevel, string> = {
  '3': 'Process level 3',
  '4': 'Process level 4',
  '5': 'Process level 5',
  '6': 'Process level 6',
};

/** Compact badge form for tight card corners. */
export const LEVEL_SHORT: Record<ProcessLevel, string> = {
  '3': 'PL3',
  '4': 'PL4',
  '5': 'PL5',
  '6': 'PL6',
};

export interface BuilderItem {
  /** Unique within the builder (source id + counter). */
  uid: string;
  /** Editable display name — renames live only in the builder. */
  name: string;
  level: ProcessLevel;
  /** Where the item came from (stream or role name). */
  source: string;
  /** Real ProcessNode ids backing the item (impact assessment subject). */
  nodeIds: string[];
  /** Roles lens: true = assigned to the agent box (agent runs it). */
  agent?: boolean;
}

/** The drag payload every draggable card writes into dataTransfer. */
export interface DragPayload {
  name: string;
  level: ProcessLevel;
  source: string;
  nodeIds: string[];
  agentScore?: number | null;
}

const MIME = 'application/x-spine-item';

export function setDragPayload(e: DragEvent, p: DragPayload) {
  e.dataTransfer.setData(MIME, JSON.stringify(p));
  e.dataTransfer.setData('text/plain', p.name);
  e.dataTransfer.effectAllowed = 'copyMove';
}

export function readDragPayload(e: DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData(MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

export function hasDragPayload(e: DragEvent): boolean {
  return e.dataTransfer.types.includes(MIME);
}

let uidCounter = 0;
export function newUid(seed: string): string {
  uidCounter += 1;
  return `${seed}:${uidCounter}`;
}

/** Insert `item` at `index` (append when index is null / out of range). */
export function insertItem<T>(list: T[], item: T, index: number | null): T[] {
  if (index === null || index < 0 || index >= list.length) return [...list, item];
  return [...list.slice(0, index), item, ...list.slice(index)];
}

/** Move the element at `from` so it lands at `to` (same-list reorder). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to > from ? to - 1 : to, 0, it);
  return next;
}
