/**
 * Charter tab of the Portfolio Initiative page — AI-drafted charter narrative
 * (FB-13) plus the complexity-score editor. Extracted verbatim from
 * PortfolioInitiative.tsx.
 */
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import AssistantMarkdown from '../../components/AssistantMarkdown';
import { Button, Card, EmptyState, ErrorMessage, Input, LoadingState } from '../../components/ui';
import type { Initiative } from '../../lib/portfolio';

// ── CHARTER ──────────────────────────────────────────────────────────────
export function CharterTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const dialogs = useDialogs();
  const [complexity, setComplexity] = useState(String(init.complexityScore));
  const [saving, setSaving] = useState(false);
  const dirty = Number(complexity) !== init.complexityScore;

  async function save() {
    const n = Number(complexity);
    if (Number.isNaN(n) || n < 0 || n > 10) { dialogs.alert({ title: 'Invalid value', message: 'Complexity must be between 0 and 10.' }); return; }
    setSaving(true);
    try { await api.patch(`/portfolio/initiatives/${init.id}`, { complexityScore: n }); reload(); }
    catch (e) { dialogs.alert({ title: 'Save failed', message: (e as Error).message }); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <CharterNarrative init={init} />
      <Card variant="elevated" className="p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-1">Complexity Score</h3>
        <p className="text-xs text-[#a3a3a3] mb-3">Delivery complexity, 0 (trivial) – 10 (extreme). Used as the x-axis of the program prioritization matrix.</p>
        <div className="flex items-center gap-3">
          <Input
            className="w-28 text-right tnum"
            type="number" min={0} max={10} step={0.5}
            value={complexity}
            onChange={(e) => setComplexity(e.target.value)}
          />
          <Button className="text-xs" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </Card>
    </div>
  );
}

// FB-13: an AI-drafted Project Charter narrative, shown at the top of the Charter
// tab. Generated server-side from the initiative's real data and cached in
// localStorage per initiative so it isn't regenerated on every visit (a manual
// "Regenerate" refreshes it). Renders the returned Markdown with AssistantMarkdown.
function CharterNarrative({ init }: { init: Initiative }) {
  const cacheKey = `charter:${init.id}`;
  const [text, setText] = useState<string>(() => localStorage.getItem(cacheKey) ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const res = await api.post(`/portfolio/initiatives/${init.id}/charter`, {});
      const charter = res.charter ?? '';
      setText(charter);
      if (charter) localStorage.setItem(cacheKey, charter);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }

  // Auto-draft on first view when nothing is cached yet.
  useEffect(() => {
    if (!text && !loading && !error) void generate();
  }, [init.id]);  

  return (
    <Card variant="elevated" className="p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-[#171717]">Project Charter</h3>
          <p className="text-xs text-[#a3a3a3]">AI-drafted from this initiative's data — review before sharing.</p>
        </div>
        <Button variant="secondary" className="text-xs" onClick={generate} disabled={loading}>
          {loading ? 'Generating…' : text ? 'Regenerate' : 'Generate'}
        </Button>
      </div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {!error && loading && !text && <LoadingState className="py-2" message="Drafting the charter…" />}
      {text && (
        <div className={loading ? 'opacity-50 transition-opacity' : ''}>
          <AssistantMarkdown content={text} />
        </div>
      )}
      {!text && !loading && !error && <EmptyState baseClassName="text-sm text-[#a3a3a3] py-2" message="No charter yet." />}
    </Card>
  );
}
