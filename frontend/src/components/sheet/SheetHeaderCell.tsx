import { useRef, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Personalized header row plumbing for the Sheet: a DndContext scoped to the
// header cells (horizontal reorder) and a per-cell wrapper that adds a
// hover-revealed drag grip plus a right-edge width-resize handle. Drag uses
// an 8px activation distance and listeners live ONLY on the grip, so the
// sort toggles and filter comboboxes inside the cell never regress.

export function HeaderDnd({
  items,
  onReorder,
  children,
}: {
  items: string[];
  onReorder: (activeKey: string, overKey: string) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items} strategy={horizontalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function SortableHeaderCell({
  colKey,
  label,
  onPreviewWidth,
  onCommitWidth,
  onCancelWidth,
  children,
}: {
  colKey: string;
  label: string;
  onPreviewWidth: (key: string, px: number) => void;
  onCommitWidth: (key: string, px: number) => void;
  onCancelWidth: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: colKey,
  });
  const cellRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ startX: number; startW: number } | null>(null);

  const widthAt = (clientX: number) =>
    drag.current ? drag.current.startW + clientX - drag.current.startX : 0;

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        cellRef.current = el;
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={
        'relative group/col min-w-0 ' + (isDragging ? 'z-30 opacity-60 bg-white shadow-sm' : '')
      }
    >
      {/* Drag grip — appears on hover; the ONLY drag-activation surface. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${label} column`}
        title="Drag to reorder column"
        className="absolute left-0 top-[3px] z-10 p-0.5 cursor-grab active:cursor-grabbing text-[#a3a3a3] hover:text-[#171717] opacity-0 group-hover/col:opacity-100 focus-visible:opacity-100 transition-opacity duration-100"
      >
        <svg width="8" height="11" viewBox="0 0 12 20" fill="currentColor" aria-hidden="true">
          <circle cx="3.5" cy="4" r="1.5" />
          <circle cx="8.5" cy="4" r="1.5" />
          <circle cx="3.5" cy="10" r="1.5" />
          <circle cx="8.5" cy="10" r="1.5" />
          <circle cx="3.5" cy="16" r="1.5" />
          <circle cx="8.5" cy="16" r="1.5" />
        </svg>
      </button>
      {children}
      {/* Width-resize handle — pointer-capture drag, commit on release. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${label} column`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = {
            startX: e.clientX,
            startW: cellRef.current?.getBoundingClientRect().width ?? 0,
          };
        }}
        onPointerMove={(e) => {
          if (drag.current) onPreviewWidth(colKey, widthAt(e.clientX));
        }}
        onPointerUp={(e) => {
          if (!drag.current) return;
          const px = widthAt(e.clientX);
          drag.current = null;
          onCommitWidth(colKey, px);
        }}
        onPointerCancel={() => {
          drag.current = null;
          onCancelWidth();
        }}
        className="absolute right-0 top-0 h-full w-[5px] cursor-col-resize touch-none select-none hover:bg-[#d4d4d4]/70 active:bg-[#a3a3a3]/70"
      />
    </div>
  );
}
