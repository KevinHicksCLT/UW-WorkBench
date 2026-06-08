import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import AssistantMarkdown from './AssistantMarkdown';
import { skillLabel } from '../lib/skills';

// Modal that views an SDLC compliance agent skill: its SKILL.md plus the phase
// guides, references, and datasets that ship with it. Markdown renders inline;
// any file can be downloaded. Backed by GET /standards-skills/:skill.

type FileRef = { path: string; bytes: number };
type Manifest = { name: string; files: FileRef[]; primary: string; skillMd: string | null };

const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);
const baseName = (p: string) => p.split('/').pop() ?? p;
const isMd = (p: string) => /\.md$/i.test(p);

// Trigger a client-side download of text content (keeps the auth'd fetch in JS).
function download(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export default function SkillViewer({ skill, onClose }: { skill: string; onClose: () => void }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState('SKILL.md');
  const [cache, setCache] = useState<Record<string, string>>({});
  const [loadingFile, setLoadingFile] = useState(false);

  // Load the manifest (+ SKILL.md content) once.
  useEffect(() => {
    api.get(`/standards-skills/${encodeURIComponent(skill)}`)
      .then((m: Manifest) => {
        setManifest(m);
        if (m.skillMd != null) setCache({ 'SKILL.md': m.skillMd });
      })
      .catch((e) => setError(e.message));
  }, [skill]);

  // Lazy-load the active file's content when not cached.
  useEffect(() => {
    if (active in cache) return;
    let on = true;
    setLoadingFile(true);
    api.get(`/standards-skills/${encodeURIComponent(skill)}/file?path=${encodeURIComponent(active)}`)
      .then((r: { content: string }) => { if (on) setCache((c) => ({ ...c, [active]: r.content })); })
      .catch((e) => { if (on) setError(e.message); })
      .finally(() => { if (on) setLoadingFile(false); });
    return () => { on = false; };
  }, [active, skill]); // eslint-disable-line

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const content = cache[active];

  // Download with a skill-scoped filename so it's unambiguous outside the app
  // (e.g. gdpr-sdlc-compliance__design-phase.md instead of a bare design-phase.md).
  const downloadActive = () => { if (content != null) download(`${skill}__${baseName(active)}`, content); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-4xl h-[85vh] bg-white rounded-2xl border border-[#eaeaea] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-[#eaeaea] flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-[#0070AD] text-white flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.6L19.5 9l-4.6 3.3 1.8 5.7L12 14.7 7.3 18l1.8-5.7L4.5 9l5.6-.4z" /></svg>
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">SDLC agent skill</div>
              <div className="text-sm font-semibold text-[#171717] truncate">{skillLabel(skill)}</div>
              <div className="text-[11px] text-[#a3a3a3] truncate font-mono">{skill}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={downloadActive} disabled={content == null} className="btn-primary text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>
              Download {baseName(active)}
            </button>
            <button onClick={onClose} className="text-[#a3a3a3] hover:text-[#171717]" aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </div>

        {error && <div className="px-5 py-2 text-sm text-[#be123c]">{error}</div>}

        <div className="flex-1 min-h-0 flex">
          {/* File nav */}
          <aside className="w-56 flex-shrink-0 border-r border-[#eaeaea] overflow-y-auto p-2">
            <nav className="space-y-0.5">
              {(manifest?.files ?? []).map((f) => (
                <button
                  key={f.path}
                  onClick={() => setActive(f.path)}
                  className={
                    'w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ' +
                    (active === f.path ? 'bg-[#eef6fb] text-[#0070AD] font-medium' : 'text-[#525252] hover:bg-[#fafafa] hover:text-[#171717]')
                  }
                  title={f.path}
                >
                  <div className="truncate">{f.path}</div>
                  <div className={'text-[10px] ' + (active === f.path ? 'text-[#0070AD]/60' : 'text-[#a3a3a3]')}>{fmtBytes(f.bytes)}</div>
                </button>
              ))}
              {!manifest && !error && <div className="px-2.5 py-2 text-xs text-[#a3a3a3]">Loading…</div>}
            </nav>
          </aside>

          {/* Content */}
          <section className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
            {content == null ? (
              <div className="text-sm text-[#a3a3a3]">{loadingFile ? 'Loading…' : 'Select a file.'}</div>
            ) : isMd(active) ? (
              <div className="max-w-none"><AssistantMarkdown content={content} /></div>
            ) : (
              <pre className="text-[11px] leading-relaxed text-[#404040] whitespace-pre-wrap font-mono">{content}</pre>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
