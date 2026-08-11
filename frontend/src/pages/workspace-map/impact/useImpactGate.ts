import { useRef, useState } from 'react';
import { api } from '../../../lib/api';
import type { ImpactReport, ImpactRequest } from './types';

// The impact gate — the one mechanism every lens routes its decisions
// through. `run(request, proceed)` assesses the change against the live graph
// and opens the ImpactPanel; the pending `proceed` only executes when the
// user confirms from the report. The assessment POST is a pure read, so it
// must NOT wipe the warm GET cache (invalidate:'none').

export interface ImpactGateState {
  request: ImpactRequest;
  report: ImpactReport | null;
  loading: boolean;
  error: string;
  busy: boolean;
  /** A previously-saved packet reopened from assessment history — the panel
   *  renders the stored snapshot read-only (no re-assess, no save, no decision). */
  saved?: boolean;
}

export interface ImpactGate {
  state: ImpactGateState | null;
  /** `proceed` may receive the decision the user picked IN the panel (product
   *  decisions offer Retain · Standardize · Retire there) — callers that only
   *  have one pending action simply ignore the argument. */
  run: (
    request: ImpactRequest,
    proceed: (chosen?: string) => void | Promise<void>,
    onCancel?: () => void,
  ) => void;
  /** Re-run the assessment with a different change type — the lens picker in
   *  the panel (pure assessments only). Keeps the pending proceed callback. */
  reassess: (changeType: string) => void;
  /** Reopen a saved packet's stored snapshot read-only (assessment history).
   *  No graph re-walk, no AI re-run — the panel shows exactly what was saved. */
  openSaved: (request: ImpactRequest, report: ImpactReport) => void;
  cancel: () => void;
  confirm: (chosen?: string) => Promise<void>;
}

export function useImpactGate(): ImpactGate {
  const [state, setState] = useState<ImpactGateState | null>(null);
  const proceedRef = useRef<((chosen?: string) => void | Promise<void>) | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  // Guards a stale assessment response from resurrecting a cancelled panel.
  const seqRef = useRef(0);

  // Post the assessment for a request and fold the report (or error) back into
  // state, guarding against a stale response resurrecting a cancelled panel.
  const assess = (request: ImpactRequest) => {
    const seq = ++seqRef.current;
    setState({ request, report: null, loading: true, error: '', busy: false });
    api
      .post('/impact/assess', request, { invalidate: 'none' })
      .then((r) => {
        if (seqRef.current !== seq) return;
        setState((s) => (s ? { ...s, report: r as ImpactReport, loading: false } : s));
      })
      .catch((e) => {
        if (seqRef.current !== seq) return;
        setState((s) =>
          s
            ? {
                ...s,
                error: e instanceof Error ? e.message : 'Assessment failed',
                loading: false,
              }
            : s,
        );
      });
  };

  const run = (
    request: ImpactRequest,
    proceed: (chosen?: string) => void | Promise<void>,
    onCancel?: () => void,
  ) => {
    proceedRef.current = proceed;
    cancelRef.current = onCancel ?? null;
    assess(request);
  };

  // Swap the change type and re-derive — the report reshapes to the new verb's
  // blast-radius profile. Only reachable from the picker (pure assessments).
  const reassess = (changeType: string) => {
    if (state) assess({ ...state.request, changeType });
  };

  // Reopen a stored packet — bump the sequence so any in-flight assess can't
  // clobber the snapshot, and clear the callbacks so the panel is view-only.
  const openSaved = (request: ImpactRequest, report: ImpactReport) => {
    seqRef.current += 1;
    proceedRef.current = null;
    cancelRef.current = null;
    setState({ request, report, loading: false, error: '', busy: false, saved: true });
  };

  const cancel = () => {
    seqRef.current += 1;
    proceedRef.current = null;
    cancelRef.current?.();
    cancelRef.current = null;
    setState(null);
  };

  const confirm = async (chosen?: string) => {
    const proceed = proceedRef.current;
    if (!proceed) return;
    setState((s) => (s ? { ...s, busy: true, error: '' } : s));
    try {
      await proceed(chosen);
      seqRef.current += 1;
      proceedRef.current = null;
      cancelRef.current = null;
      setState(null);
    } catch (e) {
      setState((s) =>
        s ? { ...s, busy: false, error: e instanceof Error ? e.message : 'Failed' } : s,
      );
    }
  };

  return { state, run, reassess, openSaved, cancel, confirm };
}
