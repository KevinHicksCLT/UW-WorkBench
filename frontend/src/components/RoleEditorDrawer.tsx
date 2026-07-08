import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Button, DrawerShell, ErrorMessage, Input, Label, Select, Textarea } from './ui';

// RoleEditorDrawer — the SCRUM-34 "amend/add a Role" user flow, surfaced from
// the Roles tab and the role drawer (not buried in Data Admin). Create when
// `role` is null, amend otherwise. Writes go to POST/PATCH /roles (audited,
// permission-gated server-side); org units and family/level suggestions come
// from GET /roles/manage/options.

export type RoleEditorSeed = {
  id: string;
  name: string;
  description: string | null;
  roleFamily: string | null;
  roleLevel: string | null;
} | null;

type Options = {
  orgUnits: { id: string; name: string; level: string; parent: string | null }[];
  roleFamilies: string[];
  roleLevels: string[];
};

export default function RoleEditorDrawer({
  role,
  onClose,
  onSaved,
}: {
  role: RoleEditorSeed;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [options, setOptions] = useState<Options | null>(null);
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [roleFamily, setRoleFamily] = useState(role?.roleFamily ?? '');
  const [roleLevel, setRoleLevel] = useState(role?.roleLevel ?? '');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<Options>('/roles/manage/options')
      .then(setOptions)
      .catch((e: Error) => setError(e.message));
  }, []);

  const save = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setBusy(true);
    setError('');
    const body = {
      displayValue: name.trim(),
      description: description.trim() || null,
      roleFamily: roleFamily || null,
      roleLevel: roleLevel || null,
      ...(orgUnitId ? { orgUnitId } : {}),
    };
    try {
      if (role) {
        await api.patch(`/roles/${encodeURIComponent(role.id)}`, body);
        onSaved(role.id);
      } else {
        const created = (await api.post('/roles', body)) as { id: string };
        onSaved(created.id);
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerShell
      onClose={onClose}
      width={440}
      maxWidth="94vw"
      header={
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">
            {role ? 'Amend role' : 'New role'}
          </div>
          <div className="text-[15px] font-bold text-[#171717] leading-snug">
            {role ? role.name : 'Add a role'}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div>
          <Label htmlFor="role-editor-name">Name</Label>
          <Input
            id="role-editor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Commercial Lines Underwriter"
          />
        </div>
        <div>
          <Label htmlFor="role-editor-description">Job description</Label>
          <Textarea
            id="role-editor-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this role does, grounded in its tasks and deliverables."
          />
        </div>
        <div>
          <Label htmlFor="role-editor-family">Role family</Label>
          <Input
            id="role-editor-family"
            list="role-editor-families"
            value={roleFamily}
            onChange={(e) => setRoleFamily(e.target.value)}
            placeholder="e.g. Underwriting"
          />
          <datalist id="role-editor-families">
            {options?.roleFamilies.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
        <div>
          <Label htmlFor="role-editor-level">Role level</Label>
          <Select
            id="role-editor-level"
            value={roleLevel}
            onChange={(e) => setRoleLevel(e.target.value)}
          >
            <option value="">—</option>
            {(options?.roleLevels.length
              ? options.roleLevels
              : ['Executive', 'Senior Leadership', 'Manager', 'Individual Contributor']
            ).map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="role-editor-org">
            {role ? 'Move to division / department (optional)' : 'Division / department'}
          </Label>
          <Select
            id="role-editor-org"
            value={orgUnitId}
            onChange={(e) => setOrgUnitId(e.target.value)}
          >
            <option value="">{role ? 'Keep current home' : '—'}</option>
            {options?.orgUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.level === 'Department' && u.parent ? ` (${u.parent})` : ''} · {u.level}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button onClick={save} disabled={busy}>
            {busy ? 'Saving…' : role ? 'Save changes' : 'Create role'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    </DrawerShell>
  );
}
