/**
 * Change Log tab of the Portfolio Initiative page (FB-27) — change requests
 * with cost/schedule impact and status workflow, plus the create modal.
 * Extracted verbatim from PortfolioInitiative.tsx.
 */
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { fmt } from '../../lib/format';
import { Button, Card, EmptyState, ErrorMessage, Input, Label, LoadingState, Select, Textarea } from '../../components/ui';
import { Modal, type Initiative } from '../../lib/portfolio';

// ── CHANGE LOG (FB-27) ─────────────────────────────────────────────────────
type ChangeRequest = {
  id: string; title: string; description: string | null; raisedBy: string;
  costImpact: number; scheduleImpactDays: number; status: string; createdAt: string;
};
const CR_STATUS = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export function ChangeLogTab({ init }: { init: Initiative }) {
  const [rows, setRows] = useState<ChangeRequest[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function load() { api.get(`/portfolio/initiatives/${init.id}/change-requests`).then(setRows).catch(() => setRows([])); }
  useEffect(() => { load(); }, [init.id]);  

  async function setStatus(cr: ChangeRequest, status: string) {
    await api.patch(`/portfolio/change-requests/${cr.id}`, { status });
    load();
  }

  return (
    <Card variant="elevated" className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#171717]">Change log</h3>
        <Button variant="secondary" className="text-xs" onClick={() => setShowCreate(true)}>+ New change request</Button>
      </div>
      {!rows ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState baseClassName="text-sm text-[#a3a3a3] py-2" message="No change requests yet." />
      ) : (
        <div className="table-scroll">
          <table className="w-full text-sm table-fixed">
            <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
              <tr>
                <th className="text-left pb-2 font-semibold w-[24%]">Change request</th>
                <th className="text-left pb-2 font-semibold w-[17%]">Raised by</th>
                <th className="text-left pb-2 font-semibold w-[11%]">When</th>
                <th className="text-right pb-2 font-semibold w-[14%] px-3">Cost impact</th>
                <th className="text-right pb-2 font-semibold w-[16%] px-3">Schedule impact</th>
                <th className="text-left pb-2 font-semibold w-[18%] pl-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((cr) => (
                <tr key={cr.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] align-top">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-[#171717]">{cr.title}</div>
                    {cr.description && <div className="text-xs text-[#a3a3a3] mt-0.5">{cr.description}</div>}
                  </td>
                  <td className="py-2.5 pr-3 text-[#666666] truncate" title={cr.raisedBy}>{cr.raisedBy}</td>
                  <td className="py-2.5 text-[#666666] text-xs whitespace-nowrap">{fmt.date(cr.createdAt)}</td>
                  <td className={'py-2.5 px-3 text-right tnum whitespace-nowrap ' + (cr.costImpact > 0 ? 'text-[#be123c]' : cr.costImpact < 0 ? 'text-[#047857]' : 'text-[#171717]')}>
                    {cr.costImpact > 0 ? '+' : ''}{fmt.currency(cr.costImpact, { compact: true })}
                  </td>
                  <td className={'py-2.5 px-3 text-right tnum whitespace-nowrap ' + (cr.scheduleImpactDays > 0 ? 'text-[#be123c]' : cr.scheduleImpactDays < 0 ? 'text-[#047857]' : 'text-[#171717]')}>
                    {cr.scheduleImpactDays > 0 ? '+' : ''}{cr.scheduleImpactDays}d
                  </td>
                  <td className="py-2.5 pl-6">
                    <Select className="text-xs w-full" value={cr.status} onChange={(e) => setStatus(cr, e.target.value)}>
                      {CR_STATUS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showCreate && <CreateChangeRequestModal initId={init.id} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </Card>
  );
}

function CreateChangeRequestModal({ initId, onClose, onCreated }: { initId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', raisedBy: '', costImpact: 0, scheduleImpactDays: 0, status: 'PENDING' });
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return setError('Title is required.');
    setError('');
    try {
      await api.post(`/portfolio/initiatives/${initId}/change-requests`, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        raisedBy: form.raisedBy.trim() || undefined,
        costImpact: Number(form.costImpact) || 0,
        scheduleImpactDays: Number(form.scheduleImpactDays) || 0,
        status: form.status,
      });
      onCreated();
    } catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal title="New Change Request" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
        <div><Label>Description</Label>
          <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div><Label>Raised by</Label>
          <Input value={form.raisedBy} onChange={(e) => setForm({ ...form, raisedBy: e.target.value })} placeholder="defaults to you" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Change cost ($)</Label>
            <Input className="text-right tnum" type="number" value={form.costImpact} onChange={(e) => setForm({ ...form, costImpact: Number(e.target.value) })} /></div>
          <div><Label>Schedule impact (days)</Label>
            <Input className="text-right tnum" type="number" value={form.scheduleImpactDays} onChange={(e) => setForm({ ...form, scheduleImpactDays: Number(e.target.value) })} /></div>
        </div>
        <div><Label>Status</Label>
          <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {CR_STATUS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
          </Select></div>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button>Create</Button>
        </div>
      </form>
    </Modal>
  );
}
