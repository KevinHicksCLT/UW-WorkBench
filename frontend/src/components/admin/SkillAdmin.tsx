import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { skillLabel, describeSkillFile, SKILL_FILE_GROUP_ORDER } from '../../lib/skills';

// ─── Agent skill editor (Data Admin → Standards → Agent skills) ──────────────
// Edits the SDLC compliance skill packs in place: pick a skill, pick a file
// (SKILL.md, phase playbooks, references, data), edit the content, and save.
// Backed by GET /standards-skills(/:skill[/file]) and PUT /standards-skills/
// :skill/file. Changes are reflected immediately in the Standards tab's skill
// viewer (same files). README / integration notes are hidden (not part of the skill).

type SkillRef = { name: string; files: number };
type FileRef = { path: string; bytes: number };

export default function SkillAdmin() {
  const dialogs = useDialogs();
  const [skills, setSkills] = useState<SkillRef[]>([]);
  const [skill, setSkill] = useState<string>('');
  const [files, setFiles] = useState<FileRef[]>([]);
  const [active, setActive] = useState<string>('SKILL.md');
  const [content, setContent] = useState<string>('');
  const [original, setOriginal] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Load the skill list once; default to the first skill.
  useEffect(() => {
    api.get('/standards-skills')
      .then((r: { skills: SkillRef[] }) => { setSkills(r.skills); if (r.skills[0]) setSkill(r.skills[0].name); })
      .catch((e) => setError(e.message));
  }, []);

  // Load a skill's file manifest; reset to SKILL.md.
  useEffect(() => {
    if (!skill) return;
    setError('');
    api.get(`/standards-skills/${encodeURIComponent(skill)}`)
      .then((m: { files: FileRef[] }) => { setFiles(m.files); setActive('SKILL.md'); })
      .catch((e) => setError(e.message));
  }, [skill]);

  // Load the active file's content.
  useEffect(() => {
    if (!skill || !active) return;
    let on = true;
    setLoading(true); setError(''); setSavedAt(null);
    api.get(`/standards-skills/${encodeURIComponent(skill)}/file?path=${encodeURIComponent(active)}`)
      .then((r: { content: string }) => { if (on) { setContent(r.content); setOriginal(r.content); } })
      .catch((e) => { if (on) setError(e.message); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [skill, active]);

  const dirty = content !== original;

  const save = async () => {
    setSaving(true); setError('');
    try {
      await api.put(`/standards-skills/${encodeURIComponent(skill)}/file`, { path: active, content });
      setOriginal(content);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const visible = files.filter((f) => !describeSkillFile(f.path).hidden);
  const groups = SKILL_FILE_GROUP_ORDER
    .map((group) => ({ group, files: visible.filter((f) => describeSkillFile(f.path).group === group) }))
    .filter((g) => g.files.length > 0);
  const info = describeSkillFile(active);

  // Guard against losing unsaved edits when switching file or skill.
  const confirmDiscard = async () =>
    !dirty ||
    dialogs.confirm({
      title: 'Discard unsaved changes?',
      message: 'The current file has unsaved edits. Switching away will discard them.',
      confirmLabel: 'Discard changes',
      danger: true,
    });

  const pickFile = async (path: string) => {
    if (await confirmDiscard()) setActive(path);
  };

  return (
    <div>
      <p className="text-sm text-[#666666] mb-4 max-w-2xl">
        Edit the SDLC compliance agent skills in place — the same files the Standards tab views and
        downloads. Pick a skill, choose a file, edit, and save.
      </p>

      {/* Skill selector */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {skills.map((s) => (
          <button
            key={s.name}
            onClick={async () => { if (await confirmDiscard()) setSkill(s.name); }}
            className={
              'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ' +
              (s.name === skill ? 'bg-[#171717] text-white border-[#171717]' : 'bg-white text-[#525252] border-[#eaeaea] hover:border-[#d4d4d4] hover:text-[#171717]')
            }
          >
            {skillLabel(s.name)}
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-[#be123c] mb-3">{error}</div>}

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* File nav */}
        <aside className="lg:w-64 flex-shrink-0 card-elevated p-2 max-h-[70vh] overflow-y-auto">
          <nav className="space-y-3">
            {groups.map((grp) => (
              <div key={grp.group}>
                <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{grp.group}</div>
                <div className="space-y-0.5">
                  {grp.files.map((f) => {
                    const fi = describeSkillFile(f.path);
                    const on = active === f.path;
                    return (
                      <button
                        key={f.path}
                        onClick={() => pickFile(f.path)}
                        className={'w-full text-left px-2.5 py-1.5 rounded-md transition-colors ' + (on ? 'bg-[#eef6fb]' : 'hover:bg-[#fafafa]')}
                        title={f.path}
                      >
                        <div className={'text-xs font-medium flex items-center gap-1 ' + (on ? 'text-[#0070AD]' : 'text-[#171717]')}>
                          {fi.label}
                          {on && dirty && <span className="text-[#be9b00]" title="Unsaved changes">●</span>}
                        </div>
                        {fi.description && <div className="text-[10px] text-[#a3a3a3] leading-snug mt-0.5">{fi.description}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Editor */}
        <section className="flex-1 min-w-0 w-full">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#171717]">{info.label}</div>
              <div className="text-[11px] text-[#a3a3a3] font-mono truncate">{skill}/{active}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {savedAt && !dirty && <span className="text-xs text-[#16a34a]">Saved {savedAt}</span>}
              {dirty && <span className="text-xs text-[#be9b00]">Unsaved changes</span>}
              <button className="btn-secondary" disabled={!dirty || saving} onClick={() => setContent(original)}>Revert</button>
              <button className="btn-primary disabled:opacity-50" disabled={!dirty || saving} onClick={save}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
          <textarea
            value={loading ? '' : content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            placeholder={loading ? 'Loading…' : ''}
            className="w-full h-[62vh] rounded-lg border border-[#eaeaea] bg-white px-3.5 py-3 text-[12px] leading-relaxed font-mono text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#0070AD] focus:border-[#0070AD] resize-none"
          />
        </section>
      </div>
    </div>
  );
}
