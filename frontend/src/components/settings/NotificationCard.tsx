import { useState } from 'react';
import type { NotificationPreference } from '@cascade/shared';
import { useAuth } from '../../lib/auth';
import { usePreferences } from '../../lib/preferences';
import { Card, Input, Label, Select } from '../ui';

// Notification method + delivery details. This stores the user's choice and
// the specifics each channel needs (email address, SMS phone number, Teams
// delivery mode/channel); actual message delivery is a follow-on integration.
const METHODS = [
  { key: 'EMAIL', label: 'Email' },
  { key: 'SMS', label: 'SMS text' },
  { key: 'TEAMS', label: 'Microsoft Teams' },
] as const;

const TEAMS_MODES = [
  { key: 'channel', label: 'Post to an existing channel' },
  { key: 'create', label: 'Create a dedicated channel for me' },
  { key: 'dm', label: 'Direct message from Transformation Bridge' },
] as const;

export default function NotificationCard() {
  const { user } = useAuth();
  const { prefs, update } = usePreferences();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const value: NotificationPreference = (prefs.notification as
    NotificationPreference | undefined) ?? { method: 'EMAIL' };

  const save = (next: NotificationPreference) => {
    update({ notification: next });
    setSavedAt(Date.now());
  };

  const fieldLabel =
    'block text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1';

  return (
    <Card variant="elevated" className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#171717]">Notifications</h2>
        {savedAt && <span className="text-[11px] text-[#16a34a]">Saved</span>}
      </div>
      <p className="text-[11px] text-[#666666] mt-0.5 mb-3">
        How the platform should reach you. Delivery details are stored now; message delivery is
        being wired up as a follow-on.
      </p>

      <fieldset className="mb-3">
        <legend className={fieldLabel}>Method</legend>
        <div className="flex flex-wrap gap-4">
          {METHODS.map((m) => (
            <label
              key={m.key}
              className="flex items-center gap-1.5 text-sm text-[#525252] cursor-pointer"
            >
              <input
                type="radio"
                name="notification-method"
                checked={value.method === m.key}
                onChange={() => save({ ...value, method: m.key })}
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      {value.method === 'EMAIL' && (
        <div className="max-w-xs">
          <Label className={fieldLabel}>Email address</Label>
          <Input
            type="email"
            value={value.email ?? user?.email ?? ''}
            onChange={(e) => save({ ...value, email: e.target.value })}
          />
        </div>
      )}

      {value.method === 'SMS' && (
        <div className="max-w-xs">
          <Label className={fieldLabel}>Mobile number</Label>
          <Input
            type="tel"
            placeholder="+1 555 555 5555"
            value={value.phone ?? ''}
            onChange={(e) => save({ ...value, phone: e.target.value })}
          />
        </div>
      )}

      {value.method === 'TEAMS' && (
        <div className="space-y-3 max-w-md">
          <div>
            <Label className={fieldLabel}>Delivery</Label>
            <Select
              value={value.teams?.mode ?? 'dm'}
              onChange={(e) =>
                save({
                  ...value,
                  teams: { ...value.teams, mode: e.target.value as 'channel' | 'create' | 'dm' },
                })
              }
              className="w-full"
            >
              {TEAMS_MODES.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          {value.teams?.mode === 'channel' && (
            <div>
              <Label className={fieldLabel}>Channel</Label>
              <Input
                placeholder="Channel link or id"
                value={value.teams?.channelId ?? ''}
                onChange={(e) =>
                  save({ ...value, teams: { mode: 'channel', channelId: e.target.value } })
                }
              />
              <p className="text-[11px] text-[#a3a3a3] mt-1">
                Paste the channel link from Teams (channel browsing arrives with the Teams
                integration).
              </p>
            </div>
          )}
          {value.teams?.mode === 'create' && (
            <div>
              <Label className={fieldLabel}>Channel name</Label>
              <Input
                placeholder={`transformation-bridge-${(user?.name ?? '').split(' ')[0]?.toLowerCase() || 'me'}`}
                value={value.teams?.channelName ?? ''}
                onChange={(e) =>
                  save({ ...value, teams: { mode: 'create', channelName: e.target.value } })
                }
              />
              <p className="text-[11px] text-[#a3a3a3] mt-1">
                A dedicated channel with this name will be created when delivery goes live.
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
