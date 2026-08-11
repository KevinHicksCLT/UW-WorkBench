// useImpactGate — the intent-first flow (Change Impact v2). A pure assessment
// opens on the Intent stage and assesses only when the reviewer runs it; board
// gates assess immediately; a saved packet reopens read-only. api module mocked.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ImpactReport, ImpactRequest } from '../../../../src/pages/workspace-map/impact/types';

const apiMock = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../../../../src/lib/api', () => ({ api: apiMock }));

import { useImpactGate } from '../../../../src/pages/workspace-map/impact/useImpactGate';

const request = (pickable: boolean): ImpactRequest => ({
  changeType: 'ELIMINATE_ROLE',
  label: 'Adjuster',
  subject: { kind: 'role', roleId: 'r1' },
  pickable,
});

const reportStub = {
  changeType: 'MERGE_ROLES',
  subject: { name: 'Adjuster' },
} as unknown as ImpactReport;

beforeEach(() => vi.clearAllMocks());

describe('useImpactGate — intent-first flow', () => {
  it('opens a pure assessment on the Intent stage without assessing', () => {
    const { result } = renderHook(() => useImpactGate());
    act(() => result.current.run(request(true), () => {}));
    expect(result.current.state?.awaitingIntent).toBe(true);
    expect(result.current.state?.loading).toBe(false);
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('picks a change type and writes intent before running — no POST until assessNow', async () => {
    apiMock.post.mockResolvedValue(reportStub);
    const { result } = renderHook(() => useImpactGate());
    act(() => result.current.run(request(true), () => {}));
    act(() => result.current.setChangeType('MERGE_ROLES'));
    act(() => result.current.setIntent('Consolidating two desks'));
    expect(result.current.state?.request.changeType).toBe('MERGE_ROLES');
    expect(result.current.state?.intent).toBe('Consolidating two desks');
    expect(apiMock.post).not.toHaveBeenCalled();

    act(() => result.current.assessNow());
    expect(apiMock.post).toHaveBeenCalledWith(
      '/impact/assess',
      expect.objectContaining({ changeType: 'MERGE_ROLES' }),
      { invalidate: 'none' },
    );
    await waitFor(() => expect(result.current.state?.report).not.toBeNull());
    expect(result.current.state?.awaitingIntent).toBe(false);
    // Intent survives the assessment so it rides into the saved packet.
    expect(result.current.state?.intent).toBe('Consolidating two desks');
  });

  it('board gates (not pickable) assess immediately', () => {
    apiMock.post.mockResolvedValue(reportStub);
    const { result } = renderHook(() => useImpactGate());
    act(() => result.current.run(request(false), () => {}));
    expect(result.current.state?.awaitingIntent).toBeFalsy();
    expect(result.current.state?.loading).toBe(true);
    expect(apiMock.post).toHaveBeenCalledTimes(1);
  });

  it('openSaved shows a stored snapshot read-only, carrying its intent, with no POST', () => {
    const { result } = renderHook(() => useImpactGate());
    act(() => result.current.openSaved(request(false), reportStub, 'Prior intent'));
    expect(result.current.state?.saved).toBe(true);
    expect(result.current.state?.intent).toBe('Prior intent');
    expect(result.current.state?.report).toBe(reportStub);
    expect(apiMock.post).not.toHaveBeenCalled();
  });
});
