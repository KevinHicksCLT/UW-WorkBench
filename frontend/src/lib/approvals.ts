/**
 * Held-response helpers for the creator → approver framework.
 *
 * Governed mutations may return HTTP 202 with a `HeldResponse` body instead of
 * applying the change. Every governed call site funnels that body through
 * `notifyHeld` so the "submitted for approval" message stays consistent, and
 * MUST NOT treat the response as a normal success (no optimistic update).
 */
import { isHeldResponse, type HeldResponse } from '@cascade/shared';
import type { AlertOptions } from './dialogs';
import { fmt } from './format';

export { isHeldResponse };
export type { HeldResponse };

/**
 * Show the standard "submitted for approval" dialog for a 202-held mutation.
 * Accepts anything exposing a `dialogs.alert`-shaped function (the object
 * returned by `useDialogs()` fits directly).
 */
export function notifyHeld(
  dialogs: { alert: (opts: AlertOptions | string) => Promise<void> },
  held: HeldResponse,
): Promise<void> {
  const due = held.dueAt ? ` An approval decision is due by ${fmt.date(held.dueAt)}.` : '';
  return dialogs.alert({
    title: 'Submitted for approval',
    message: `${held.summary} — the change is held pending approver(s) and has not been applied.${due} Track it under Approvals.`,
  });
}
