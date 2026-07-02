import { Fragment, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button, Card, EmptyState, ErrorMessage, Input, Select, Textarea } from '../ui';

// Flat AI-adoption editor (audit D3/A1): one row per canonical value stream
// (levelNumber=3) with the four AI autonomy modes as dropdowns. This is the data
// the Telemetry "AI adoption" heat map renders — edit here, it shows there. Edits
// save immediately (PATCH /admin/ai-adoption/:levelId) and are audited.
// Each row expands to the per-mode USE CASES (title / persona / detail) that the
// Active AI drill-in renders — stored on NodeAiAdoption.useCases.

type UseCase = { title: string; persona: string; detail: string };
type ModeKey = 'assistant' | 'augmented' | 'workflow' | 'agent';
type UseCases = Record<ModeKey, UseCase[]>;
type ModeStats = { rolesUsingPct: number; efficiencyGainPct: number };
type Stats = Record<ModeKey, ModeStats>;

type Row = {
  levelId: string;
  name: string;
  domain: string | null;
  aiAssist: string;
  aiAugment: string;
  aiWorkflow: string;
  aiAutonomous: string;
  useCases: Partial<UseCases> | null;
  stats: Partial<Stats> | null;
};

const MODES: [keyof Row, string][] = [
  ['aiAssist', 'Assist'],
  ['aiAugment', 'Augment'],
  ['aiWorkflow', 'Workflow'],
  ['aiAutonomous', 'Autonomous'],
];
// Level column → the use-case mode key it corresponds to.
const MODE_KEYS: [ModeKey, string][] = [
  ['assistant', 'AI Assistant'],
  ['augmented', 'AI Augmented'],
  ['workflow', 'Workflow Agent'],
  ['agent', 'Autonomous Agent'],
];
const LEVEL_LABEL: Record<string, string> = {
  not_used: 'Not used',
  pilot: 'Piloting',
  emerging: 'Emerging',
  scaling: 'Scaling',
  embedded: 'Embedded',
};

const normalize = (uc: Partial<UseCases> | null): UseCases => ({
  assistant: uc?.assistant ?? [],
  augmented: uc?.augmented ?? [],
  workflow: uc?.workflow ?? [],
  agent: uc?.agent ?? [],
});
const normalizeStats = (st: Partial<Stats> | null): Stats => ({
  assistant: st?.assistant ?? { rolesUsingPct: 0, efficiencyGainPct: 0 },
  augmented: st?.augmented ?? { rolesUsingPct: 0, efficiencyGainPct: 0 },
  workflow: st?.workflow ?? { rolesUsingPct: 0, efficiencyGainPct: 0 },
  agent: st?.agent ?? { rolesUsingPct: 0, efficiencyGainPct: 0 },
});

// Per-stream use-case editor panel (expanded below the stream's row).
function UseCaseEditor({
  row,
  companyId,
  onSaved,
}: {
  row: Row;
  companyId: string;
  onSaved: (uc: UseCases, st: Stats) => void;
}) {
  const [draft, setDraft] = useState<UseCases>(() => normalize(row.useCases));
  const [statsDraft, setStatsDraft] = useState<Stats>(() => normalizeStats(row.stats));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  const setStat = (mode: ModeKey, field: keyof ModeStats, value: string) => {
    const n = Math.max(0, Math.min(100, Number(value) || 0));
    setStatsDraft((d) => ({ ...d, [mode]: { ...d[mode], [field]: n } }));
    setDirty(true);
  };

  const setUc = (mode: ModeKey, i: number, field: keyof UseCase, value: string) => {
    setDraft((d) => ({
      ...d,
      [mode]: d[mode].map((u, j) => (j === i ? { ...u, [field]: value } : u)),
    }));
    setDirty(true);
  };
  const add = (mode: ModeKey) => {
    setDraft((d) => ({ ...d, [mode]: [...d[mode], { title: '', persona: '', detail: '' }] }));
    setDirty(true);
  };
  const remove = (mode: ModeKey, i: number) => {
    setDraft((d) => ({ ...d, [mode]: d[mode].filter((_, j) => j !== i) }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      // Drop entirely-empty drafts; the backend requires a non-empty title.
      const cleaned = normalize(null);
      for (const [mode] of MODE_KEYS)
        cleaned[mode] = draft[mode].filter(
          (u) => u.title.trim() || u.persona.trim() || u.detail.trim(),
        );
      const untitled = MODE_KEYS.some(([mode]) => cleaned[mode].some((u) => !u.title.trim()));
      if (untitled) {
        setError('Every use case needs a title.');
        setSaving(false);
        return;
      }
      await api.patch(`/admin/ai-adoption/${row.levelId}?companyId=${companyId}`, {
        useCases: cleaned,
        stats: statsDraft,
      });
      setDraft(cleaned);
      setDirty(false);
      onSaved(cleaned, statsDraft);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-3 bg-[#fafafa] border-t border-[#f0f0f0]">
      <div className="grid gap-4 lg:grid-cols-2">
        {MODE_KEYS.map(([mode, label]) => (
          <Card key={mode} className="bg-white p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-[#171717]">{label}</div>
              <button className="text-xs text-[#4338ca] hover:underline" onClick={() => add(mode)}>
                + Add use case
              </button>
            </div>
            {/* Adoption statistics rendered on the Active AI drill-in */}
            <div className="flex items-center gap-3 mb-2.5 text-xs">
              <label className="flex items-center gap-1.5 text-[#666666]">
                Roles using %
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="py-0.5 text-xs w-16 tnum"
                  value={statsDraft[mode].rolesUsingPct}
                  onChange={(e) => setStat(mode, 'rolesUsingPct', e.target.value)}
                />
              </label>
              <label className="flex items-center gap-1.5 text-[#666666]">
                Efficiency gain %
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="py-0.5 text-xs w-16 tnum"
                  value={statsDraft[mode].efficiencyGainPct}
                  onChange={(e) => setStat(mode, 'efficiencyGainPct', e.target.value)}
                />
              </label>
            </div>
            {draft[mode].length === 0 ? (
              <EmptyState
                baseClassName="text-xs text-[#a3a3a3] italic"
                message="No use cases for this mode."
              />
            ) : (
              <div className="space-y-3">
                {draft[mode].map((u, i) => (
                  <div key={i} className="border border-[#eaeaea] rounded-md p-2 space-y-1.5">
                    <div className="flex gap-1.5">
                      <Input
                        className="py-1 text-xs flex-1"
                        placeholder="Title"
                        value={u.title}
                        onChange={(e) => setUc(mode, i, 'title', e.target.value)}
                      />
                      <button
                        className="text-[#be123c] hover:text-[#9f1239] text-xs px-1"
                        title="Remove use case"
                        onClick={() => remove(mode, i)}
                      >
                        ✕
                      </button>
                    </div>
                    <Input
                      className="py-1 text-xs w-full"
                      placeholder="Persona (who uses it)"
                      value={u.persona}
                      onChange={(e) => setUc(mode, i, 'persona', e.target.value)}
                    />
                    <Textarea
                      className="py-1 text-xs w-full min-h-[48px]"
                      placeholder="Detail — what the AI does"
                      value={u.detail}
                      onChange={(e) => setUc(mode, i, 'detail', e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3">
        <Button className="disabled:opacity-50" disabled={saving || !dirty} onClick={save}>
          {saving ? 'Saving…' : 'Save use cases & stats'}
        </Button>
        {error && <span className="text-xs text-[#be123c]">{error}</span>}
        {!error && !dirty && (
          <span className="text-xs text-[#a3a3a3]">
            Saved — these render in Metrics → AI Adoption drill-in.
          </span>
        )}
      </div>
    </div>
  );
}

export default function AiAdoptionEditor({ companyId }: { companyId: string | null }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [levels, setLevels] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [expandedId, setExpandedId] = useState('');

  const load = () => {
    if (!companyId) return;
    setError('');
    api
      .get<{ rows: Row[]; levels: string[] }>(`/admin/ai-adoption?companyId=${companyId}`)
      .then((d) => {
        setRows(d.rows);
        setLevels(d.levels);
      })
      .catch((e: unknown) => setError(String((e as { message?: string })?.message || e)));
  };
  useEffect(load, [companyId]);

  const update = async (row: Row, field: keyof Row, value: string) => {
    setRows((rs) =>
      rs ? rs.map((r) => (r.levelId === row.levelId ? { ...r, [field]: value } : r)) : rs,
    );
    setSavingId(row.levelId);
    try {
      await api.patch(`/admin/ai-adoption/${row.levelId}?companyId=${companyId}`, {
        [field]: value,
      });
    } catch (e) {
      setError(String((e as Error).message));
      load();
    } finally {
      setSavingId('');
    }
  };

  if (!companyId)
    return <p className="text-sm text-[#a3a3a3]">Select a company to edit AI adoption.</p>;

  return (
    <div>
      <p className="text-sm text-[#666666] mb-4 max-w-3xl">
        AI-adoption level per value stream and autonomy mode — the data the Metrics “AI adoption”
        heat map renders. Edits save immediately and are audited. Value streams with no AI yet stay{' '}
        <span className="font-medium">Not used</span>. Expand a stream to edit the concrete{' '}
        <span className="font-medium">use cases</span> behind each mode (rendered in the Active AI
        drill-in).
      </p>
      {error && <ErrorMessage className="mb-3">{error}</ErrorMessage>}
      <Card variant="elevated" className="overflow-hidden">
        <div className="table-scroll" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eaeaea] text-left">
                <th className="px-3 py-2 font-medium text-[#666666]">Value Stream</th>
                <th className="px-3 py-2 font-medium text-[#666666]">Domain</th>
                {MODES.map(([k, label]) => (
                  <th key={k} className="px-3 py-2 font-medium text-[#666666]">
                    {label}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium text-[#666666] w-28 text-center">Use cases</th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-[#a3a3a3]">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-[#a3a3a3] italic">
                    No value streams for this company.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const ucCount = (
                    ['assistant', 'augmented', 'workflow', 'agent'] as ModeKey[]
                  ).reduce((n, m) => n + (r.useCases?.[m]?.length ?? 0), 0);
                  const expanded = expandedId === r.levelId;
                  return (
                    <Fragment key={r.levelId}>
                      <tr className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa]">
                        <td className="px-3 py-2 text-[#171717]">{r.name}</td>
                        <td className="px-3 py-2 text-[#737373]">{r.domain ?? '—'}</td>
                        {MODES.map(([k]) => (
                          <td key={k} className="px-3 py-1.5">
                            <Select
                              value={r[k] as string}
                              disabled={savingId === r.levelId}
                              onChange={(e) => update(r, k, e.target.value)}
                              className="py-1 text-xs disabled:opacity-50"
                            >
                              {levels.map((lv) => (
                                <option key={lv} value={lv}>
                                  {LEVEL_LABEL[lv] ?? lv}
                                </option>
                              ))}
                            </Select>
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-center">
                          <button
                            className={
                              'text-xs font-medium ' +
                              (expanded ? 'text-[#171717]' : 'text-[#4338ca] hover:underline')
                            }
                            aria-expanded={expanded}
                            onClick={() => setExpandedId(expanded ? '' : r.levelId)}
                          >
                            {expanded ? 'Close' : `Edit (${ucCount})`}
                          </button>
                        </td>
                      </tr>
                      {expanded && companyId && (
                        <tr className="border-b border-[#f5f5f5] last:border-0">
                          <td colSpan={7} className="p-0">
                            <UseCaseEditor
                              row={r}
                              companyId={companyId}
                              onSaved={(uc, st) =>
                                setRows((rs) =>
                                  rs
                                    ? rs.map((x) =>
                                        x.levelId === r.levelId
                                          ? { ...x, useCases: uc, stats: st }
                                          : x,
                                      )
                                    : rs,
                                )
                              }
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
