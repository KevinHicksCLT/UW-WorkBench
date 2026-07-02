/**
 * Strategic Alignment tab of the Portfolio Initiative page — link/unlink
 * strategic objectives with per-link impact. Extracted verbatim from
 * PortfolioInitiative.tsx.
 */
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { Button, Card, EmptyState, ErrorMessage, Label, Select } from '../../components/ui';
import type { Initiative, Objective } from '../../lib/portfolio';

// ── STRATEGIC ALIGNMENT ──────────────────────────────────────────────────
export function AlignmentTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const dialogs = useDialogs();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [addId, setAddId] = useState('');
  const [addImpact, setAddImpact] = useState(3);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Objective[]>(`/portfolio/objectives?companyId=${init.companyId}`).then(setObjectives).catch((e) => setError(e.message));
  }, [init.companyId]);

  const linkedIds = new Set(init.objectives.map((l) => l.objectiveId));
  const available = objectives.filter((o) => !linkedIds.has(o.id));

  async function run(fn: () => Promise<unknown>) {
    try { await fn(); reload(); } catch (e) { dialogs.alert({ title: 'Change failed', message: (e as Error).message }); }
  }

  return (
    <div className="space-y-4">
      <Card variant="elevated" className="p-5">
        <h3 className="text-sm font-semibold text-[#171717] mb-3">Linked strategic objectives</h3>
        {error && <ErrorMessage className="mb-2">{error}</ErrorMessage>}
        {init.objectives.length === 0 ? (
          <EmptyState baseClassName="text-sm text-[#a3a3a3] py-2" message="No objectives linked yet." />
        ) : (
          <div className="table-scroll">
            <table className="w-full table-fixed text-sm">
              <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
                <tr>
                  <th className="text-left pb-2 font-semibold">Objective</th>
                  <th className="text-left pb-2 font-semibold">Weight</th>
                  <th className="text-left pb-2 font-semibold">Impact (1–5)</th>
                  <th className="text-left pb-2 font-semibold">Contribution</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {init.objectives.map((l) => (
                  <tr key={l.id} className="border-b border-[#f5f5f5]">
                    <td className="py-2.5 font-medium text-[#171717]">{l.objective.name}</td>
                    <td className="py-2.5 text-left tnum text-[#666666]">{l.objective.weight}</td>
                    <td className="py-2.5">
                      <Select
                        className="text-xs w-24"
                        value={l.impact}
                        onChange={(e) => run(() => api.patch(`/portfolio/initiatives/objectives/${l.id}`, { impact: Number(e.target.value) }))}
                      >
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                      </Select>
                    </td>
                    <td className="py-2.5 text-left tnum text-[#171717]">{Math.round(l.impact * l.objective.weight * 10) / 10}</td>
                    <td className="py-2.5 text-right">
                      <button
                        className="text-[#be123c] hover:underline text-sm"
                        title="Remove link"
                        onClick={() => run(() => api.delete(`/portfolio/initiatives/objectives/${l.id}`))}
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3 mt-4 pt-4 border-t border-[#f5f5f5]">
          <div className="flex-1 min-w-48">
            <Label>Add objective</Label>
            <Select value={addId} onChange={(e) => setAddId(e.target.value)}>
              <option value="">— select an objective —</option>
              {available.map((o) => <option key={o.id} value={o.id}>{o.name} (weight {o.weight})</option>)}
            </Select>
          </div>
          <div>
            <Label>Impact</Label>
            <Select className="w-20" value={addImpact} onChange={(e) => setAddImpact(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </div>
          <Button
            className="text-xs"
            disabled={!addId}
            onClick={() => run(async () => { await api.post(`/portfolio/initiatives/${init.id}/objectives`, { objectiveId: addId, impact: addImpact }); setAddId(''); setAddImpact(3); })}
          >Link objective</Button>
        </div>
      </Card>
    </div>
  );
}
