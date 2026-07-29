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
}

export interface ImpactGate {
  state: ImpactGateState | null;
  run: (request: ImpactRequest, proceed: () => void | Promise<void>, onCancel?: () => void) => void;
  cancel: () => void;
  confirm: () => Promise<void>;
}

export function useImpactGate(): ImpactGate {
  const [state, setState] = useState<ImpactGateState | null>(null);
  const proceedRef = useRef<(() => void | Promise<void>) | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  // Guards a stale assessment response from resurrecting a cancelled panel.
  const seqRef = useRef(0);

  const run = (
    request: ImpactRequest,
    proceed: () => void | Promise<void>,
    onCancel?: () => void,
  ) => {
    const seq = ++seqRef.current;
    proceedRef.current = proceed;
    cancelRef.current = onCancel ?? null;
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

  const cancel = () => {
    seqRef.current += 1;
    proceedRef.current = null;
    cancelRef.current?.();
    cancelRef.current = null;
    setState(null);
  };

  const confirm = async () => {
    const proceed = proceedRef.current;
    if (!proceed) return;
    setState((s) => (s ? { ...s, busy: true, error: '' } : s));
    try {
      await proceed();
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

  return { state, run, cancel, confirm };
}
