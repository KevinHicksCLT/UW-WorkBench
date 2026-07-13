/**
 * Task agent-skill block (Work Library, tasks only). Compiles the task's plan —
 * generic + specific checklist, generic + specific testing, and every tied
 * standard/regulation with its evidence steps — into a self-contained SKILL.md
 * an autonomous agent can follow. One click generates it via Claude; the result
 * is persisted (SkillFile row + ProcessNode.agentSkill pointer), editable inline,
 * and preserved. Backed by /work-library/plan/task/:id/skill.
 */
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import AssistantMarkdown from '../../components/AssistantMarkdown';
import { Button, ErrorMessage } from '../../components/ui';

const SKILL_FILE = 'SKILL.md';

type PackFile = { path: string; content: string; bytes: number };
type Pack = { slug: string; exists: boolean; generatedAt: string | null; files: PackFile[] };

function download(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const SparkleIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3l1.9 5.6L19.5 9l-4.6 3.3 1.8 5.7L12 14.7 7.3 18l1.8-5.7L4.5 9l5.6-.4z" />
  </svg>
);

export function TaskSkillBlock({ taskId, taskName }: { taskId: string; taskName: string }) {
  const dialogs = useDialogs();
  const [pack, setPack] = useState<Pack | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const load = () => {
    api
      .get<Pack>(`/work-library/plan/task/${taskId}/skill`)
      .then(setPack)
      .catch((e) => setError(e.message));
  };
  useEffect(() => {
    setPack(null);
    setEditing(false);
    setError('');
    load();
  }, [taskId]);

  const skillMd = pack?.files.find((f) => f.path === SKILL_FILE)?.content ?? '';

  const generate = async (regen: boolean) => {
    if (regen) {
      const ok = await dialogs.confirm({
        title: 'Regenerate agent skill?',
        message: 'This rebuilds the skill from the current plan and overwrites any hand edits.',
        confirmLabel: 'Regenerate',
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    setError('');
    try {
      const next = (await api.post(`/work-library/plan/task/${taskId}/skill/generate`, {})) as Pack;
      setPack(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    setBusy(true);
    setError('');
    try {
      await api.put(`/work-library/plan/task/${taskId}/skill/file`, {
        path: SKILL_FILE,
        content: draft,
      });
      setEditing(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const generatedAt = pack?.generatedAt ? new Date(pack.generatedAt).toLocaleString() : null;

  return (
    <div className="mt-6 rounded-xl border border-[#e5e5e5] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#fafafa] border-b border-[#eee]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center justify-center h-6 w-6 rounded-md bg-[#0070AD] text-white flex-shrink-0">
            <SparkleIcon />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[#171717]">Agent skill</div>
            <div className="text-[10.5px] text-[#8a94a0] truncate">
              {generatedAt
                ? `Generated ${generatedAt}`
                : 'Compiled from this task’s checklist, testing, standards & regs'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {pack?.exists && !editing && (
            <>
              <Button
                variant="secondary"
                onClick={() => download(`${pack.slug}__${SKILL_FILE}`, skillMd)}
                className="text-xs"
              >
                Download
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft(skillMd);
                  setEditing(true);
                }}
                className="text-xs"
              >
                Edit
              </Button>
              <Button
                variant="secondary"
                onClick={() => generate(true)}
                disabled={busy}
                className="text-xs disabled:opacity-50"
              >
                {busy ? 'Working…' : 'Regenerate'}
              </Button>
            </>
          )}
          {!pack?.exists && (
            <Button
              onClick={() => generate(false)}
              disabled={busy || !pack}
              className="text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <SparkleIcon />
              {busy ? 'Generating…' : 'Generate agent skill'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <ErrorMessage baseClassName="px-4 py-2 text-xs text-[#be123c]">{error}</ErrorMessage>
      )}

      <div className="p-4">
        {!pack ? (
          <div className="text-[12px] text-[#a3a3a3]">Loading…</div>
        ) : editing ? (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full h-[420px] font-mono text-[12px] leading-relaxed text-[#262626] border border-[#e5e5e5] rounded-lg p-3 focus:outline-none focus:border-[#0070AD]"
              spellCheck={false}
            />
            <div className="flex gap-2 mt-2">
              <Button onClick={saveEdit} disabled={busy} className="text-xs disabled:opacity-50">
                {busy ? 'Saving…' : 'Save'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setEditing(false)}
                disabled={busy}
                className="text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : pack.exists ? (
          <div className="max-w-none">
            <AssistantMarkdown content={skillMd} />
          </div>
        ) : (
          <div className="text-[12px] text-[#737373] leading-relaxed max-w-2xl">
            No agent skill yet for <span className="font-medium text-[#171717]">{taskName}</span>.
            Generating compiles a single <span className="font-mono text-[11px]">SKILL.md</span>{' '}
            from this task’s generic and specific checklist steps, generic and specific testing, and
            every tied standard and regulation with its implement/verify steps — a self-contained
            procedure an autonomous agent can follow. It is saved and stays editable.
          </div>
        )}
      </div>
    </div>
  );
}
