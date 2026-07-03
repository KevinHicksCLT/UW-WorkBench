import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WIDGET_CATALOG, WIDGET_MAP, widgetSpan, type Dashboard } from '../../lib/dashboardWidgets';
import { Card } from '../ui';

// Edit-mode dashboard grid — drag handles to reorder, eye-off to hide, and a
// tray of hidden widgets to re-add. Renders the REAL widgets (same grid as the
// view mode) so what you arrange is what you get. Mixed widget spans (tile /
// card / wide) make dnd-kit's sort preview approximate — drop semantics are
// insert-at-index; the DragOverlay ghost keeps the gesture legible.
// Persistence is the parent's problem (onChange), so this stays controlled.

function SortableWidget({
  id,
  data,
  onHide,
}: {
  id: string;
  data: Dashboard;
  onHide: (id: string) => void;
}) {
  const w = WIDGET_MAP.get(id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  if (!w) return null;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative group ${widgetSpan(w.kind)} ${isDragging ? 'opacity-40 z-10' : ''}`}
    >
      {/* Control strip — drag handle + hide, floating over the widget's corner */}
      <div className="absolute right-1.5 top-1.5 z-20 flex items-center gap-1 rounded-md border border-[#eaeaea] bg-white/95 shadow-sm px-1 py-0.5">
        <button
          {...attributes}
          {...listeners}
          aria-label={`Move ${w.title}`}
          title="Drag to reorder"
          className="cursor-grab active:cursor-grabbing p-1 text-[#a3a3a3] hover:text-[#171717] transition-colors duration-150"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="9" cy="5" r="1.6" />
            <circle cx="15" cy="5" r="1.6" />
            <circle cx="9" cy="12" r="1.6" />
            <circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="19" r="1.6" />
            <circle cx="15" cy="19" r="1.6" />
          </svg>
        </button>
        <button
          onClick={() => onHide(id)}
          aria-label={`Hide ${w.title}`}
          title="Hide from my dashboard"
          className="p-1 text-[#a3a3a3] hover:text-[#be123c] transition-colors duration-150"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <path d="M1 1l22 22" />
          </svg>
        </button>
      </div>
      {/* Block the widget's own links while editing so a drag never navigates. */}
      <div className="pointer-events-none select-none">{w.render(data)}</div>
    </div>
  );
}

export default function DashboardCustomizer({
  data,
  layout,
  onChange,
}: {
  data: Dashboard;
  layout: string[];
  onChange: (layout: string[]) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visible = layout.filter((id) => WIDGET_MAP.has(id));
  const hidden = WIDGET_CATALOG.filter((w) => !layout.includes(w.id));

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = visible.indexOf(String(active.id));
    const to = visible.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onChange(arrayMove(visible, from, to));
  };

  const activeWidget = activeId ? WIDGET_MAP.get(activeId) : null;

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={visible} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {visible.map((id) => (
              <SortableWidget
                key={id}
                id={id}
                data={data}
                onHide={(hid) => onChange(visible.filter((v) => v !== hid))}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeWidget ? (
            <div className="opacity-90 shadow-lg rounded-xl pointer-events-none max-w-md">
              {activeWidget.render(data)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Hidden-widget tray */}
      {hidden.length > 0 && (
        <Card variant="base" className="mt-4 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-2">
            Hidden cards — click to add back
          </div>
          <div className="flex flex-wrap gap-1.5">
            {hidden.map((w) => (
              <button
                key={w.id}
                onClick={() => onChange([...visible, w.id])}
                title={w.desc}
                className="inline-flex items-center gap-1 rounded-md border border-[#eaeaea] bg-white px-2 py-1 text-[12px] text-[#525252] hover:border-[#d4d4d4] hover:text-[#171717] transition-colors duration-150"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {w.title}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
