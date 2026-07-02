/**
 * Small UI atoms for the Inspector — inline select, the associate-or-create
 * picker, and the link/detach/empty affordances. Extracted verbatim from
 * Inspector.tsx.
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';

// ── Small UI atoms ───────────────────────────────────────────────────────────
export function Select({ value, onChange, options, w = 130 }: { value: string; onChange: (v: string) => void; options: string[]; w?: number }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: w }}
      className="rounded-md border border-[#9fb6e8] bg-white px-2 py-1 text-[11px] text-[#171717]">
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// Associate-or-create picker: searches existing entities, or creates a new one
// inline from the typed text. Used for roles / applications / deliverables.
export function AddPicker({ label, kind, onPick }: {
  label: string; kind: 'roles' | 'applications' | 'deliverables';
  onPick: (choice: { id?: string; newName?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<{ id: string; name: string; sub?: string | null }[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api.get<{ items: { id: string; name: string; sub?: string | null }[] }>(`/inspector/search/${kind}?q=${encodeURIComponent(q)}`)
        .then((r) => { if (!cancelled) setItems(r.items); })
        .catch(() => { if (!cancelled) setItems([]); });
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, q, kind]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const exact = items.some((i) => i.name.toLowerCase() === q.trim().toLowerCase());
  return (
    <div className="relative" ref={boxRef}>
      <button onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md border border-[#9fb6e8] bg-[#eaf1fe] px-2.5 py-1 text-[11.5px] font-semibold text-[#1d4ed8] hover:bg-[#dceafe]">
        ＋ {label}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-lg border border-[#e2e6ea] bg-white shadow-xl p-2">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or type a new name…"
            className="w-full rounded-md border border-[#e2e6ea] px-2 py-1.5 text-[12px] mb-1.5 outline-none focus:border-[#9fb6e8]" />
          <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5">
            {q.trim() && !exact && (
              <button onClick={() => { onPick({ newName: q.trim() }); setOpen(false); setQ(''); }}
                className="text-left rounded-md px-2 py-1.5 text-[12px] text-[#15603f] bg-[#e7f6ef] hover:bg-[#d6f0e2]">
                ＋ Create new “{q.trim()}”
              </button>
            )}
            {items.map((i) => (
              <button key={i.id} onClick={() => { onPick({ id: i.id }); setOpen(false); setQ(''); }}
                className="text-left rounded-md px-2 py-1.5 hover:bg-[#f5f8ff]">
                <span className="text-[12px] text-[#171717]">{i.name}</span>
                {i.sub && <span className="block text-[10px] text-[#a3a3a3]">{i.sub}</span>}
              </button>
            ))}
            {!items.length && !q.trim() && <div className="px-2 py-2 text-[11px] text-[#a3a3a3] italic">Type to search…</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export const LinkOut = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} title="Open" className="flex-shrink-0 text-[#2563eb] text-[11px] hover:underline">↗ open</button>
);
export const DetachBtn = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} title="Detach" className="flex-shrink-0 text-[#d1453b] text-[14px] leading-none hover:scale-110">✕</button>
);

export const Empty = ({ text }: { text: string }) => <div className="text-[11.5px] text-[#a3a3a3] italic leading-snug">{text}</div>;
