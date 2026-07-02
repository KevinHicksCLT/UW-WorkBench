import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import AssistantMarkdown from './AssistantMarkdown';
import { skillLabel, describeSkillFile, SKILL_FILE_GROUP_ORDER } from '../lib/skills';
import { Button, ErrorMessage, LoadingState } from './ui';

// Modal that views an SDLC compliance agent skill: its SKILL.md plus the phase
// guides, references, and datasets that ship with it. Markdown renders inline;
// any file can be downloaded. Backed by GET /standards-skills/:skill.

type FileRef = { path: string; bytes: number };
type Manifest = { name: string; files: FileRef[]; primary: string; skillMd: string | null };

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
    api.get<Manifest>(`/standards-skills/${encodeURIComponent(skill)}`)
      .then((m) => {
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
    api.get<{ content: string }>(`/standards-skills/${encodeURIComponent(skill)}/file?path=${encodeURIComponent(active)}`)
      .then((r) => { if (on) setCache((c) => ({ ...c, [active]: r.content })); })
      .catch((e) => { if (on) setError(e.message); })
      .finally(() => { if (on) setLoadingFile(false); });
    return () => { on = false; };
  }, [active, skill]);  

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const content = cache[active];
  const activeInfo = describeSkillFile(active);

  // Show only files that are part of the agent skill (hide README / integration
  // notes), grouped and clearly labelled.
  const visibleFiles = (manifest?.files ?? []).filter((f) => !describeSkillFile(f.path).hidden);
  const groups = SKILL_FILE_GROUP_ORDER
    .map((group) => ({ group, files: visibleFiles.filter((f) => describeSkillFile(f.path).group === group) }))
    .filter((g) => g.files.length > 0);

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
            <Button onClick={downloadActive} disabled={content == null} className="text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>
              Download {baseName(active)}
            </Button>
            <button onClick={onClose} className="text-[#a3a3a3] hover:text-[#171717]" aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </div>

        {error && <ErrorMessage baseClassName="px-5 py-2 text-sm text-[#be123c]">{error}</ErrorMessage>}

        <div className="flex-1 min-h-0 flex">
          {/* File nav — grouped, with clear names + how the agent uses each. */}
          <aside className="w-64 flex-shrink-0 border-r border-[#eaeaea] overflow-y-auto p-2">
            <nav className="space-y-3">
              {groups.map((grp) => (
                <div key={grp.group}>
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{grp.group}</div>
                  <div className="space-y-0.5">
                    {grp.files.map((f) => {
                      const info = describeSkillFile(f.path);
                      const on = active === f.path;
                      return (
                        <button
                          key={f.path}
                          onClick={() => setActive(f.path)}
                          className={'w-full text-left px-2.5 py-1.5 rounded-md transition-colors ' + (on ? 'bg-[#eef6fb]' : 'hover:bg-[#fafafa]')}
                          title={f.path}
                        >
                          <div className={'text-xs font-medium ' + (on ? 'text-[#0070AD]' : 'text-[#171717]')}>{info.label}</div>
                          {info.description && <div className="text-[10px] text-[#a3a3a3] leading-snug mt-0.5">{info.description}</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!manifest && !error && <LoadingState baseClassName="px-2.5 py-2 text-xs text-[#a3a3a3]" />}
            </nav>
          </aside>

          {/* Content */}
          <section className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
            <div className="mb-3 pb-3 border-b border-[#f0f0f0]">
              <div className="text-sm font-semibold text-[#171717]">{activeInfo.label}</div>
              {activeInfo.description && <div className="text-xs text-[#737373] mt-0.5">{activeInfo.description}</div>}
              <div className="text-[10px] text-[#bdbdbd] font-mono mt-0.5">{active}</div>
            </div>
            {content == null ? (
              <LoadingState message={loadingFile ? 'Loading…' : 'Select a file.'} />
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
