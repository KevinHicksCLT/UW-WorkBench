/**
 * Create modals for the Portfolio Program page — New Workstream and New
 * Initiative (with operating-model link selects). Extracted verbatim from
 * PortfolioProgram.tsx.
 */
import { useState } from 'react';
import { api } from '../../lib/api';
import { Button, ErrorMessage, Input, Label, Select, Textarea } from '../../components/ui';
import { Modal, type LinkOptions } from '../../lib/portfolio';

export function CreateWorkstreamModal({ programId, onClose, onCreated }: { programId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required.');
    setError('');
    try { await api.post('/portfolio/workstreams', { programId, ...form }); onCreated(); }
    catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal title="New Workstream" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><Label>Description</Label>
          <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button>Create</Button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateInitiativeModal({ workstream, links, onClose, onCreated }: { workstream: { id: string; name: string }; links: LinkOptions | null; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', description: '',
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
    valueStreamId: '', divisionId: '', ownerRoleId: '', sponsorRoleId: '',
  });
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required.');
    if (!form.startDate || !form.dueDate) return setError('Start and due dates are required.');
    if (form.dueDate < form.startDate) return setError('Due date must be on or after the start date.');
    setError('');
    try {
      await api.post('/portfolio/initiatives', {
        workstreamId: workstream.id,
        name: form.name, description: form.description, startDate: form.startDate, dueDate: form.dueDate,
        valueStreamId: form.valueStreamId || null, divisionId: form.divisionId || null,
        ownerRoleId: form.ownerRoleId || null, sponsorRoleId: form.sponsorRoleId || null,
      });
      onCreated();
    } catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal title={`New Initiative — ${workstream.name}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><Label>Description</Label>
          <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start</Label>
            <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
          <div><Label>Due</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required /></div>
        </div>
        <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">Operating-model links (optional)</div>
        <div className="grid grid-cols-2 gap-3">
          <LinkSelect label="Value stream" value={form.valueStreamId} options={links?.valueStreams} onChange={(v) => setForm({ ...form, valueStreamId: v })} />
          <LinkSelect label="Division" value={form.divisionId} options={links?.divisions} onChange={(v) => setForm({ ...form, divisionId: v })} />
          <LinkSelect label="Owner role" value={form.ownerRoleId} options={links?.roles} onChange={(v) => setForm({ ...form, ownerRoleId: v })} />
          <LinkSelect label="Sponsor role" value={form.sponsorRoleId} options={links?.roles} onChange={(v) => setForm({ ...form, sponsorRoleId: v })} />
        </div>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button>Create</Button>
        </div>
      </form>
    </Modal>
  );
}

export function LinkSelect({ label, value, options, onChange }: { label: string; value: string; options?: { id: string; name: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— none —</option>
        {(options ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Select>
    </div>
  );
}
