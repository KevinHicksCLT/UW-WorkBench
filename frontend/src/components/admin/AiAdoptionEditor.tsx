import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

// Flat AI-adoption editor (audit D3/A1): one row per canonical value stream
// (levelNumber=3) with the four AI autonomy modes as dropdowns. This is the data
// the Telemetry "AI adoption" heat map renders — edit here, it shows there. Edits
// save immediately (PATCH /admin/ai-adoption/:levelId) and are audited.

type Row = {
  levelId: string; name: string; domain: string | null;
  aiAssist: string; aiAugment: string; aiWorkflow: string; aiAutonomous: string;
};

const MODES: [keyof Row, string][] = [
  ['aiAssist', 'Assist'], ['aiAugment', 'Augment'], ['aiWorkflow', 'Workflow'], ['aiAutonomous', 'Autonomous'],
];
const LEVEL_LABEL: Record<string, string> = {
  not_used: 'Not used', pilot: 'Piloting', emerging: 'Emerging', scaling: 'Scaling', embedded: 'Embedded',
};

export default function AiAdoptionEditor({ companyId }: { companyId: string | null }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [levels, setLevels] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');

  const load = () => {
    if (!companyId) return;
    setError('');
    api.get(`/admin/ai-adoption?companyId=${companyId}`)
      .then((d: { rows: Row[]; levels: string[] }) => { setRows(d.rows); setLevels(d.levels); })
      .catch((e: any) => setError(String(e?.message || e)));
  };
  useEffect(load, [companyId]);

  const update = async (row: Row, field: keyof Row, value: string) => {
    setRows((rs) => rs ? rs.map((r) => r.levelId === row.levelId ? { ...r, [field]: value } : r) : rs);
    setSavingId(row.levelId);
    try {
      await api.patch(`/admin/ai-adoption/${row.levelId}?companyId=${companyId}`, { [field]: value });
    } catch (e) {
      setError(String((e as Error).message));
      load();
    } finally {
      setSavingId('');
    }
  };

  if (!companyId) return <p className="text-sm text-[#a3a3a3]">Select a company to edit AI adoption.</p>;

  return (
    <div>
      <p className="text-sm text-[#666666] mb-4 max-w-3xl">
        AI-adoption level per value stream and autonomy mode — the data the Telemetry “AI adoption” heat map renders.
        Edits save immediately and are audited. Value streams with no AI yet stay <span className="font-medium">Not used</span>.
      </p>
      {error && <div className="text-sm text-[#be123c] mb-3">{error}</div>}
      <div className="card-elevated overflow-hidden">
        <div className="table-scroll" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eaeaea] text-left">
                <th className="px-3 py-2 font-medium text-[#666666]">Value Stream</th>
                <th className="px-3 py-2 font-medium text-[#666666]">Domain</th>
                {MODES.map(([k, label]) => <th key={k} className="px-3 py-2 font-medium text-[#666666]">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[#a3a3a3]">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[#a3a3a3] italic">No value streams for this company.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.levelId} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa]">
                    <td className="px-3 py-2 text-[#171717]">{r.name}</td>
                    <td className="px-3 py-2 text-[#737373]">{r.domain ?? '—'}</td>
                    {MODES.map(([k]) => (
                      <td key={k} className="px-3 py-1.5">
                        <select
                          value={r[k] as string}
                          disabled={savingId === r.levelId}
                          onChange={(e) => update(r, k, e.target.value)}
                          className="input py-1 text-xs disabled:opacity-50"
                        >
                          {levels.map((lv) => <option key={lv} value={lv}>{LEVEL_LABEL[lv] ?? lv}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
