/**
 * "New application to rationalize" modal — name prompt for creating an
 * application with its starter stage/columns/components. Extracted verbatim
 * from GreenfieldMigration.tsx (markup unchanged); the page owns the
 * name/creating state and the create call.
 */
import { Button, Input } from '../../components/ui';

export type NewApplicationModalProps = {
  name: string;
  onNameChange: (name: string) => void;
  creating: boolean;
  onCreate: () => void;
  onClose: () => void;
};

export function NewApplicationModal({
  name,
  onNameChange,
  creating,
  onCreate,
  onClose,
}: NewApplicationModalProps) {
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={() => !creating && onClose()}
        aria-hidden="true"
      />
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-[420px] rounded-xl border border-[#eaeaea] bg-white shadow-xl p-5">
        <h3 className="text-[15px] font-semibold text-[#171717]">New application to rationalize</h3>
        <p className="text-[12px] text-[#666666] mt-1 leading-snug">
          Creates an application with a starter stage, two legacy-app columns, the five CAPDAN
          components and five layer-aligned green-field targets. Add findings and more stages in
          Data Admin.
        </p>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#525252] mt-4 mb-1.5">
          Application name
        </label>
        <Input
          autoFocus
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCreate();
          }}
          placeholder="e.g. Billing & Finance Platform"
        />
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={onClose} disabled={creating} className="text-sm">
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={creating || !name.trim()} className="text-sm">
            {creating ? 'Creating…' : 'Create application'}
          </Button>
        </div>
      </div>
    </>
  );
}
