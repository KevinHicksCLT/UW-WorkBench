import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';

export default function Rules() {
  const [rules, setRules] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null); // null | 'new' | rule object

  useEffect(() => { load(); }, []);
  function load() { api.get('/rules').then(setRules); }

  async function toggle(rule: any) {
    await api.patch(`/rules/${rule.id}`, { enabled: !rule.enabled });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this rule?')) return;
    await api.delete(`/rules/${id}`);
    load();
  }

  return (
    <div>
      <PageHeader
        title="Business Rules"
        subtitle="Event-driven automation: notify, set values, chain rules"
        actions={
          <button className="btn-primary" onClick={() => setEditing('new')}>+ New Rule</button>
        }
      />

      <div className="card">
        {rules.length === 0 ? (
          <div className="text-sm text-slate-500 italic py-2">No rules configured</div>
        ) : (
          <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left py-2 font-semibold">Name</th>
                <th className="text-left py-2 font-semibold">Entity</th>
                <th className="text-left py-2 font-semibold">Trigger</th>
                <th className="text-left py-2 font-semibold">Action</th>
                <th className="text-center py-2 font-semibold w-24">Enabled</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2.5 font-medium text-slate-800">
                    <button className="hover:underline" onClick={() => setEditing(r)}>{r.name}</button>
                  </td>
                  <td className="py-2.5 text-slate-600">{r.entityType}</td>
                  <td className="py-2.5 text-slate-600">
                    {r.trigger}
                    {r.fieldName && <span className="text-xs text-slate-500"> · {r.fieldName}={r.fieldValue}</span>}
                  </td>
                  <td className="py-2.5 text-slate-600">{r.action}</td>
                  <td className="py-2.5 text-center">
                    <button onClick={() => toggle(r)}
                      className={r.enabled ? 'pill-green' : 'pill-slate'}>
                      {r.enabled ? 'On' : 'Off'}
                    </button>
                  </td>
                  <td className="py-2.5 text-right">
                    <button className="text-xs text-red-600 hover:underline" onClick={() => remove(r.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {editing && (
        <RuleEditor
          rule={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function RuleEditor({ rule, onClose, onSaved }: { rule: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(() => rule ? {
    name: rule.name, entityType: rule.entityType, trigger: rule.trigger,
    fieldName: rule.fieldName || '', fieldValue: rule.fieldValue || '',
    action: rule.action, actionConfig: rule.actionConfig, enabled: rule.enabled,
  } : {
    name: '', entityType: 'Initiative', trigger: 'ON_FIELD_CHANGE',
    fieldName: 'status', fieldValue: 'OFF_TRACK',
    action: 'NOTIFY',
    actionConfig: JSON.stringify({
      recipientField: 'sponsorId',
      subject: 'Heads up: {!name}',
      body: 'Initiative {!name} requires attention.',
    }, null, 2),
    enabled: true,
  });
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      JSON.parse(form.actionConfig); // validate
      const body = { ...form };
      if (!body.fieldName) delete body.fieldName;
      if (!body.fieldValue) delete body.fieldValue;
      if (rule) {
        await api.patch(`/rules/${rule.id}`, body);
      } else {
        await api.post('/rules', body);
      }
      onSaved();
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-5 sm:p-6 w-full max-w-2xl my-auto max-h-[calc(100vh-2rem)] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          {rule ? 'Edit Rule' : 'New Rule'}
        </h2>
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Name</label>
            <input className="input" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className="label">Entity</label>
              <select className="input" value={form.entityType}
                onChange={(e) => setForm({ ...form, entityType: e.target.value })}>
                <option value="Initiative">Initiative</option>
                <option value="RaidItem">RaidItem</option>
                <option value="Program">Program</option>
                <option value="Workstream">Workstream</option>
              </select></div>
            <div><label className="label">Trigger</label>
              <select className="input" value={form.trigger}
                onChange={(e) => setForm({ ...form, trigger: e.target.value })}>
                <option value="ON_CREATE">On Create</option>
                <option value="ON_UPDATE">On Update</option>
                <option value="ON_FIELD_CHANGE">On Field Change</option>
              </select></div>
            <div><label className="label">Action</label>
              <select className="input" value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value })}>
                <option value="NOTIFY">Notify</option>
                <option value="SET_VALUE">Set Value</option>
                <option value="RUN_RULE">Run Rule</option>
              </select></div>
          </div>
          {form.trigger === 'ON_FIELD_CHANGE' && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Field</label>
                <input className="input" value={form.fieldName}
                  onChange={(e) => setForm({ ...form, fieldName: e.target.value })}
                  placeholder="e.g. status" /></div>
              <div><label className="label">Value</label>
                <input className="input" value={form.fieldValue}
                  onChange={(e) => setForm({ ...form, fieldValue: e.target.value })}
                  placeholder="e.g. OFF_TRACK" /></div>
            </div>
          )}
          <div>
            <label className="label">Action Config (JSON)</label>
            <textarea
              className="input font-mono text-xs"
              rows={8}
              value={form.actionConfig}
              onChange={(e) => setForm({ ...form, actionConfig: e.target.value })}
            />
            <div className="text-xs text-slate-500 mt-1">
              Tokens like <code>{'{!name}'}</code> are replaced with the entity's field values.
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            Enabled
          </label>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary">{rule ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
