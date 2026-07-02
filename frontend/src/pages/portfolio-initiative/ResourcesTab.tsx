/**
 * Resources tab of the Portfolio Initiative page — assigned resources table
 * plus the inline add-resource form. Extracted verbatim from
 * PortfolioInitiative.tsx.
 */
import { useState } from 'react';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { fmt } from '../../lib/format';
import { Button, Card, EmptyState, ErrorMessage, Input, Label } from '../../components/ui';
import type { Initiative } from '../../lib/portfolio';

// ── RESOURCES ────────────────────────────────────────────────────────────
export function ResourcesTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const dialogs = useDialogs();
  const [form, setForm] = useState({
    name: '',
    roleName: '',
    allocationPct: 50,
    startDate: init.startDate.slice(0, 10),
    endDate: init.dueDate.slice(0, 10),
  });
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required.');
    if (!form.startDate || !form.endDate) return setError('Start and end dates are required.');
    if (form.endDate < form.startDate)
      return setError('End date must be on or after the start date.');
    if (Number(form.allocationPct) < 1 || Number(form.allocationPct) > 100)
      return setError('Allocation must be between 1 and 100%.');
    setError('');
    try {
      await api.post(`/portfolio/initiatives/${init.id}/resources`, {
        name: form.name.trim(),
        roleName: form.roleName.trim() || null,
        allocationPct: Number(form.allocationPct),
        startDate: form.startDate,
        endDate: form.endDate,
      });
      setForm({ ...form, name: '', roleName: '', allocationPct: 50 });
      setError('');
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Card variant="elevated" className="p-5">
      <h3 className="text-sm font-semibold text-[#171717] mb-3">Resources</h3>
      {init.resources.length === 0 ? (
        <EmptyState
          baseClassName="text-sm text-[#a3a3a3] py-2"
          message="No resources assigned yet."
        />
      ) : (
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
              <tr>
                <th className="text-left pb-2 font-semibold">Name</th>
                <th className="text-left pb-2 font-semibold">Role</th>
                <th className="text-center pb-2 font-semibold w-28">Allocation %</th>
                <th className="text-center pb-2 font-semibold pl-4 w-28">Start</th>
                <th className="text-center pb-2 font-semibold w-28">End</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {init.resources.map((r) => (
                <tr key={r.id} className="border-b border-[#f5f5f5]">
                  <td className="py-2.5 font-medium text-[#171717]">{r.name}</td>
                  <td className="py-2.5 text-[#666666]">{r.roleName ?? '—'}</td>
                  <td className="py-2.5 text-center tnum">{r.allocationPct}%</td>
                  <td className="py-2.5 pl-4 text-center text-[#666666] text-xs">
                    {fmt.date(r.startDate)}
                  </td>
                  <td className="py-2.5 text-center text-[#666666] text-xs">
                    {fmt.date(r.endDate)}
                  </td>
                  <td className="py-2.5 text-center">
                    <button
                      className="text-xs text-[#be123c] hover:underline"
                      onClick={async () => {
                        if (
                          !(await dialogs.confirm({
                            title: 'Remove this resource?',
                            danger: true,
                            message: `${r.name} will be unassigned from this initiative.`,
                            confirmLabel: 'Remove',
                          }))
                        ) {
                          return;
                        }
                        await api.delete(`/portfolio/initiatives/resources/${r.id}`);
                        reload();
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        onSubmit={submit}
        className="flex flex-wrap items-end gap-3 mt-4 pt-4 border-t border-[#f5f5f5]"
      >
        <div className="flex-1 min-w-44">
          <Label>Name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Type a name"
            required
          />
        </div>
        <div className="w-44">
          <Label>Role</Label>
          <Input
            value={form.roleName}
            onChange={(e) => setForm({ ...form, roleName: e.target.value })}
            placeholder="e.g. Delivery lead"
          />
        </div>
        <div className="w-24">
          <Label>Alloc %</Label>
          <Input
            className="text-right tnum"
            type="number"
            min={1}
            max={100}
            value={form.allocationPct}
            onChange={(e) => setForm({ ...form, allocationPct: Number(e.target.value) })}
            required
          />
        </div>
        <div>
          <Label>Start</Label>
          <Input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>End</Label>
          <Input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            required
          />
        </div>
        <Button className="text-xs">Add resource</Button>
        {error && (
          <ErrorMessage baseClassName="w-full text-sm text-[#be123c]">{error}</ErrorMessage>
        )}
      </form>
    </Card>
  );
}
