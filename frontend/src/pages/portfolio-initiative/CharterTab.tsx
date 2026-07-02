/**
 * Charter tab of the Portfolio Initiative page — the user-authored charter
 * narrative plus the complexity-score editor. Extracted verbatim from
 * PortfolioInitiative.tsx.
 */
import { useState } from 'react';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import AssistantMarkdown from '../../components/AssistantMarkdown';
import { Button, Card, EmptyState, Input, Textarea } from '../../components/ui';
import type { Initiative } from '../../lib/portfolio';

// ── CHARTER ──────────────────────────────────────────────────────────────
export function CharterTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const dialogs = useDialogs();
  const [complexity, setComplexity] = useState(String(init.complexityScore));
  const [saving, setSaving] = useState(false);
  const dirty = Number(complexity) !== init.complexityScore;

  async function save() {
    const n = Number(complexity);
    if (Number.isNaN(n) || n < 0 || n > 10) {
      dialogs.alert({ title: 'Invalid value', message: 'Complexity must be between 0 and 10.' });
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/portfolio/initiatives/${init.id}`, { complexityScore: n });
      reload();
    } catch (e) {
      dialogs.alert({ title: 'Save failed', message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <CharterNarrative init={init} reload={reload} />
      <Card variant="elevated" className="p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-1">Complexity Score</h3>
        <p className="text-xs text-[#a3a3a3] mb-3">
          Delivery complexity, 0 (trivial) – 10 (extreme). Used as the x-axis of the program
          prioritization matrix.
        </p>
        <div className="flex items-center gap-3">
          <Input
            className="w-28 text-right tnum"
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={complexity}
            onChange={(e) => setComplexity(e.target.value)}
          />
          <Button className="text-xs" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// The Project Charter narrative — user-authored free text (typed or pasted),
// persisted on the initiative (PATCH `charter`) and rendered as Markdown with
// AssistantMarkdown. Starts in edit mode when no charter exists yet.
function CharterNarrative({ init, reload }: { init: Initiative; reload: () => void }) {
  const dialogs = useDialogs();
  const saved = init.charter ?? '';
  const [editing, setEditing] = useState(!saved);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/portfolio/initiatives/${init.id}`, { charter: draft });
      setEditing(false);
      reload();
    } catch (e) {
      dialogs.alert({ title: 'Save failed', message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }
  function cancel() {
    setDraft(saved);
    setEditing(false);
  }

  return (
    <Card variant="elevated" className="p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-[#171717]">Project Charter</h3>
          <p className="text-xs text-[#a3a3a3]">Type or paste the charter — Markdown supported.</p>
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            {saved !== '' && (
              <Button variant="secondary" className="text-xs" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
            )}
            <Button className="text-xs" onClick={save} disabled={saving || draft === saved}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" className="text-xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
      {editing ? (
        <Textarea
          className="font-mono text-xs leading-relaxed"
          rows={14}
          placeholder="Type or paste the project charter here…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      ) : saved ? (
        <AssistantMarkdown content={saved} />
      ) : (
        <EmptyState baseClassName="text-sm text-[#a3a3a3] py-2" message="No charter yet." />
      )}
    </Card>
  );
}
