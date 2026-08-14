import { useRef, useState } from 'react';
import { api } from '../../../lib/api';
import type { ImpactReport, ImpactRequest } from './types';

// The impact gate — the one mechanism every lens routes its decisions
// through. `run(request, proceed)` opens the ImpactPanel; the pending `proceed`
// only executes when the user confirms from the report. The assessment POST is
// a pure read, so it must NOT wipe the warm GET cache (invalidate:'none').
//
// Two entry shapes:
//   • Board gates (pickable falsy) — a fixed change verb, assessed immediately;
//     the panel is the confirm step for a destructive decision (the quick path).
//   • Pure assessments (pickable) — open on the Intent stage FIRST: the reviewer
//     names the change type (per-lens taxonomy) and writes the intent, THEN runs
//     the assessment. Nothing is posted until they choose to assess.

export interface ImpactGateState {
  request: ImpactRequest;
  report: ImpactReport | null;
  loading: boolean;
  error: string;
  busy: boolean;
  /** The Intent stage — a pure assessment opened but not yet run. The reviewer
   *  picks the change type and writes the intent before the graph is walked. */
  awaitingIntent?: boolean;
  /** The free-text Intent Statement, carried into the saved packet. */
  intent: string;
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
   *  the panel once a report is showing. Keeps the pending proceed callback. */
  reassess: (changeType: string) => void;
  /** Intent stage only: swap the change type WITHOUT running (no POST yet). */
  setChangeType: (changeType: string) => void;
  /** Intent stage: edit the free-text intent statement. */
  setIntent: (intent: string) => void;
  /** Intent stage: run the assessment for the chosen change type + intent. */
  assessNow: () => void;
  /** Reopen a saved packet's stored snapshot read-only (assessment history).
   *  No graph re-walk, no AI re-run — the panel shows exactly what was saved. */
  openSaved: (request: ImpactRequest, report: ImpactReport, intent?: string) => void;
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
  // Preserves the intent the reviewer wrote on the Intent stage.
  const assess = (request: ImpactRequest, intent: string) => {
    const seq = ++seqRef.current;
    setState({
      request,
      report: null,
      loading: true,
      error: '',
      busy: false,
      awaitingIntent: false,
      intent,
    });
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
    if (request.pickable) {
      // Pure assessment — open on the Intent stage; assess only when the reviewer
      // has chosen the change type and is ready to run it.
      seqRef.current += 1;
      setState({
        request,
        report: null,
        loading: false,
        error: '',
        busy: false,
        awaitingIntent: true,
        intent: '',
      });
    } else {
      assess(request, '');
    }
  };

  // Swap the change type and re-derive — the report reshapes to the new verb's
  // blast-radius profile. Reachable from the picker once a report is showing.
  const reassess = (changeType: string) => {
    if (state) assess({ ...state.request, changeType }, state.intent);
  };

  // Intent stage: pick the change type, but hold the assessment until the
  // reviewer runs it — so they choose in context before anything is computed.
  const setChangeType = (changeType: string) => {
    setState((s) => (s ? { ...s, request: { ...s.request, changeType } } : s));
  };

  const setIntent = (intent: string) => {
    setState((s) => (s ? { ...s, intent } : s));
  };

  const assessNow = () => {
    if (state) assess(state.request, state.intent);
  };

  // Reopen a stored packet — bump the sequence so any in-flight assess can't
  // clobber the snapshot, and clear the callbacks so the panel is view-only.
  const openSaved = (request: ImpactRequest, report: ImpactReport, intent = '') => {
    seqRef.current += 1;
    proceedRef.current = null;
    cancelRef.current = null;
    setState({
      request,
      report,
      loading: false,
      error: '',
      busy: false,
      awaitingIntent: false,
      intent,
      saved: true,
    });
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

  return {
    state,
    run,
    reassess,
    setChangeType,
    setIntent,
    assessNow,
    openSaved,
    cancel,
    confirm,
  };
}
