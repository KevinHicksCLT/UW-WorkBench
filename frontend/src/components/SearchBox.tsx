import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

// Global search: debounced live dropdown across divisions/departments/roles/
// value-streams/sub-streams. Lives in the sidebar chrome.
export default function SearchBox() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get(`/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => { setResults(r); setOpen(true); })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQ('');
    setResults([]);
    navigate(href);
  }

  return (
    <div ref={boxRef} className="relative px-4 py-3 border-b border-brand-900">
      <input
        className="w-full rounded-lg bg-brand-900 text-white placeholder-brand-300 px-3 py-2 text-sm border border-brand-800 focus:outline-none focus:border-brand-400"
        placeholder="Search the model…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute left-3 right-3 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 max-h-80 overflow-y-auto z-50">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400">No matches</div>
          ) : (
            results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => go(r.href)}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
              >
                <div className="text-sm text-slate-800">{r.name}</div>
                <div className="text-xs text-slate-400">
                  {r.type}{r.sublabel ? ` · ${r.sublabel}` : ''}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
