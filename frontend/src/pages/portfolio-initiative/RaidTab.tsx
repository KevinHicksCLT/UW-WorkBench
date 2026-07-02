/**
 * RAID tab of the Portfolio Initiative page — risks/assumptions/issues/
 * decisions table with status workflow, plus the create modal. Extracted
 * verbatim from PortfolioInitiative.tsx.
 */
import { useState } from 'react';
import { api } from '../../lib/api';
import {
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Input,
  Label,
  Select,
  StatusPill,
  Textarea,
} from '../../components/ui';
import { SeverityCell, Modal, type Initiative } from '../../lib/portfolio';

// ── RAID ─────────────────────────────────────────────────────────────────
export function RaidTab({ init, reload }: { init: Initiative; reload: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  return (
    <Card variant="elevated" className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#171717]">
          Risks, Assumptions, Issues, Decisions
        </h3>
        <Button variant="secondary" className="text-xs" onClick={() => setShowCreate(true)}>
          + RAID item
        </Button>
      </div>
      {init.raidItems.length === 0 ? (
        <EmptyState baseClassName="text-sm text-[#a3a3a3]" message="No RAID items." />
      ) : (
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="text-xs text-[#a3a3a3] border-b border-[#eaeaea]">
              <tr>
                <th className="text-center pb-2 font-semibold w-24">Type</th>
                <th className="text-left pb-2 font-semibold">Title</th>
                <th className="text-center pb-2 font-semibold w-20">Severity</th>
                <th className="text-left pb-2 font-semibold w-28">Status</th>
              </tr>
            </thead>
            <tbody>
              {init.raidItems.map((r) => (
                <tr key={r.id} className="border-b border-[#f5f5f5]">
                  <td className="py-2.5 text-center">
                    <StatusPill tone="slate" className="text-xs">
                      {r.type}
                    </StatusPill>
                  </td>
                  <td className="py-2.5">
                    <div className="font-medium text-[#171717]">{r.title}</div>
                    {r.mitigation && (
                      <div className="text-xs text-[#a3a3a3] mt-0.5">{r.mitigation}</div>
                    )}
                  </td>
                  <td className="py-2.5 text-center">
                    <SeverityCell value={r.severity} />
                  </td>
                  <td className="py-2.5">
                    <Select
                      className="text-xs"
                      value={r.status}
                      onChange={async (e) => {
                        await api.patch(`/portfolio/raid/${r.id}`, { status: e.target.value });
                        reload();
                      }}
                    >
                      <option value="OPEN">Open</option>
                      <option value="MITIGATED">Mitigated</option>
                      <option value="CLOSED">Closed</option>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showCreate && (
        <CreateRaidModal
          initId={init.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            reload();
          }}
        />
      )}
    </Card>
  );
}

function CreateRaidModal({
  initId,
  onClose,
  onCreated,
}: {
  initId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    type: 'RISK',
    title: '',
    description: '',
    probability: 3,
    impact: 3,
    mitigation: '',
  });
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.type) return setError('Type is required.');
    if (!form.title.trim()) return setError('Title is required.');
    if (form.probability < 1 || form.probability > 5)
      return setError('Probability must be between 1 and 5.');
    if (form.impact < 1 || form.impact > 5) return setError('Impact must be between 1 and 5.');
    setError('');
    try {
      await api.post('/portfolio/raid', { initiativeId: initId, ...form });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <Modal title="New RAID Item" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>Type</Label>
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="RISK">Risk</option>
            <option value="ASSUMPTION">Assumption</option>
            <option value="ISSUE">Issue</option>
            <option value="DECISION">Decision</option>
          </Select>
        </div>
        <div>
          <Label>Title</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Probability (1–5)</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={form.probability}
              onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Impact (1–5)</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={form.impact}
              onChange={(e) => setForm({ ...form, impact: Number(e.target.value) })}
            />
          </div>
        </div>
        <div>
          <Label>Mitigation</Label>
          <Textarea
            rows={2}
            value={form.mitigation}
            onChange={(e) => setForm({ ...form, mitigation: e.target.value })}
          />
        </div>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button>Create</Button>
        </div>
      </form>
    </Modal>
  );
}
