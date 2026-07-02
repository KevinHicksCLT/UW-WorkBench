/**
 * Shared types and utilities for the Work Library page — plan/template data
 * shapes, the pointer-based sortable-row hook, and small helpers. Extracted
 * verbatim from WorkLibrary.tsx.
 */
import { useRef, useState } from 'react';

export type SubjectType = 'task' | 'standard' | 'regulation';

export type Subject = { id: string; name: string; path: string };
export type TemplateKey = { id: string; key: string; guidance: string | null; valueKind: string; sortOrder: number };
export type Template = {
  id: string; kind: 'CHECKLIST' | 'TEST'; name: string; description: string | null; isDefault: boolean;
  keys: TemplateKey[]; usage?: { tasks: number; standards: number; regulations: number };
};
export type EntityRef = { id: string; name: string } | null;
export type Answer = {
  id: string; templateKeyId: string | null; customKey: string | null; kind: string | null; value: string | null;
  suppressed: boolean; sortOrder: number; application: EntityRef; role: EntityRef; deliverable: EntityRef;
};
export type PlanKey = TemplateKey & { answer: Answer | null };
export type Section = { id: string; kind: 'CHECKLIST' | 'TEST'; name: string; description: string | null; keys: PlanKey[] };
export type EvidenceRow = {
  id: string; kind: string; step: string; value: string | null; sortOrder: number;
  application: EntityRef; role: EntityRef; deliverable: EntityRef;
};
export type TiedItem = { id: string; name: string; source: string | null; direct: boolean; checklist: EvidenceRow[]; testing: EvidenceRow[] };
export type Plan = {
  subject: { type: SubjectType; id: string; name: string; path: string };
  assignedTemplateIds: string[];
  sections: Section[];
  customRows: Answer[];
  standards: TiedItem[];
  regulations: TiedItem[];
};

export const cellInput = 'w-full text-[12.5px] px-2 py-1.5 rounded-md border border-transparent hover:border-[#d4d4d4] focus:border-[#7aa7d9] focus:outline-none bg-transparent';

// Pointer-based row reorder with live animation: grab the ⋮⋮ handle and the
// row follows the cursor while the other rows slide out of the way; on release
// the new order is applied optimistically and persisted. (Pointer events, not
// HTML5 drag — so it animates and row inputs keep normal text selection.)
type SortState = { from: number; over: number; dy: number; rowH: number };

export function useSortable(count: number, onMove: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<SortState | null>(null);
  const live = useRef<SortState | null>(null);

  const handleProps = (index: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const tr = (e.target as HTMLElement).closest('tr');
      const rowH = tr?.getBoundingClientRect().height || 40;
      const startY = e.clientY;
      live.current = { from: index, over: index, dy: 0, rowH };
      setDrag(live.current);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      const move = (ev: PointerEvent) => {
        const dy = ev.clientY - startY;
        const over = Math.max(0, Math.min(count - 1, index + Math.round(dy / rowH)));
        live.current = { from: index, over, dy, rowH };
        setDrag(live.current);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        const d = live.current;
        live.current = null;
        setDrag(null);
        if (d && d.over !== d.from) onMove(d.from, d.over);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
  });

  const rowStyle = (index: number): React.CSSProperties => {
    if (!drag) return {};
    const { from, over, dy, rowH } = drag;
    if (index === from) {
      return { transform: `translateY(${dy}px)`, position: 'relative', zIndex: 5, background: '#f0f6ff', boxShadow: '0 2px 10px rgba(15,40,80,0.15)', transition: 'none' };
    }
    if (from < over && index > from && index <= over) return { transform: `translateY(-${rowH}px)`, transition: 'transform 140ms ease' };
    if (from > over && index >= over && index < from) return { transform: `translateY(${rowH}px)`, transition: 'transform 140ms ease' };
    return { transform: 'translateY(0)', transition: 'transform 140ms ease' };
  };

  return { handleProps, rowStyle };
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

export const DragHandle = (props: React.HTMLAttributes<HTMLSpanElement>) => (
  <span {...props} className="cursor-grab touch-none select-none mr-1.5 text-[#94a3b8] hover:text-[#475569]" title="Drag to reorder">⋮⋮</span>
);

export function valueText(a: Answer | EvidenceRow | null | undefined): string {
  if (!a) return '';
  return a.application?.name ?? a.role?.name ?? a.deliverable?.name ?? a.value ?? '';
}
