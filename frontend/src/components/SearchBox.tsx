import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

// Global search: debounced live dropdown across divisions/departments/roles/
// value-streams/sub-streams.
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
    <div ref={boxRef} className="relative">
      <input
        className="w-full rounded-md bg-white text-[#171717] placeholder-[#a3a3a3]
                   px-3 py-1.5 text-sm border border-[#eaeaea]
                   focus:outline-none focus:border-[#0070f3] focus:ring-2 focus:ring-[rgba(0,112,243,0.20)]
                   transition-colors duration-150"
        placeholder="Search the model…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-1 bg-white rounded-lg border border-[#eaeaea] max-h-80 overflow-y-auto z-50"
             style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)' }}>
          {results.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-[#a3a3a3]">No matches</div>
          ) : (
            results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => go(r.href)}
                className="w-full text-left px-3 py-2 hover:bg-[#fafafa] border-b border-[#f5f5f5] last:border-0 transition-colors duration-150"
              >
                <div className="text-sm text-[#171717] font-medium">{r.name}</div>
                <div className="text-xs text-[#a3a3a3] mt-0.5">
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
