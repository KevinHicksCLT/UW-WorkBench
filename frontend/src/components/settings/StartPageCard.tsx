import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { usePreferences } from '../../lib/preferences';
import { navItems } from '../../lib/navigation';
import { Card, Label, Select } from '../ui';

// Where the user lands after login — limited to pages they can read (the
// backend re-validates on save AND at /auth/me read time, so a later
// permission revocation can never strand login).
export default function StartPageCard() {
  const { permissions } = useAuth();
  const { prefs, update } = usePreferences();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const options = navItems(permissions);
  const value = typeof prefs.startPage === 'string' ? prefs.startPage : 'home';

  return (
    <Card variant="elevated" className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#171717]">Start page</h2>
        {savedAt && <span className="text-[11px] text-[#16a34a]">Saved</span>}
      </div>
      <p className="text-[11px] text-[#666666] mt-0.5 mb-3">
        The page you land on when you sign in.
      </p>
      <Label className="block text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">
        Page
      </Label>
      <Select
        value={value}
        onChange={(e) => {
          update({ startPage: e.target.value });
          setSavedAt(Date.now());
        }}
        className="w-full max-w-xs"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </Select>
    </Card>
  );
}
