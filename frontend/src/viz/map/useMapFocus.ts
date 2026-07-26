/**
 * Drill/focus state machine for the operating-model map: company → domain →
 * division → value stream → L4 step → L5 sub-process, plus the flow fetches,
 * click/toggle handlers, deep-link focus, and breadcrumb collapse callbacks.
 * Extracted verbatim from MapCanvas; behavior unchanged.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { DivisionSummary, DivisionFlow } from '../model';
import { api } from '../../lib/api';
import { useViewState } from '../../lib/viewState';
import type { Category } from './constants';

export function useMapFocus(divisions: DivisionSummary[], focusVsId: string | null | undefined) {
  // The whole drill path persists per session (lib/viewState) so leaving the
  // tab and returning restores the exact focus; a ?focus deep link still wins
  // (the apply-once effect below overrides the restored path).
  // Top-of-map gating: company → domains → divisions. The company starts open by
  // default so the three domains are visible on load (drill begins one level in).
  const [companyOpen, setCompanyOpen] = useViewState<boolean>('explorer.map.companyOpen', true);
  const [selectedDomain, setSelectedDomain] = useViewState<Category | null>(
    'explorer.map.domain',
    null,
  );

  // Level / focus state (within a selected domain)
  const [level, setLevel] = useViewState<0 | 1 | 2 | 3 | 4>('explorer.map.level', 0);
  const [focusedDivisionId, setFocusedDivisionId] = useViewState<string | null>(
    'explorer.map.division',
    null,
  );
  const [focusedVsId, setFocusedVsId] = useViewState<string | null>('explorer.map.vs', null);
  const [focusedStepId, setFocusedStepId] = useViewState<string | null>('explorer.map.step', null);
  const [focusedSubStepId, setFocusedSubStepId] = useViewState<string | null>(
    'explorer.map.subStep',
    null,
  );

  // API data
  const [flowData, setFlowData] = useState<DivisionFlow | null>(null);
  const [flowLoading, setFlowLoading] = useState(false);
  const [vsFlowData, setVsFlowData] = useState<DivisionFlow | null>(null);
  const [vsFlowLoading, setVsFlowLoading] = useState(false);

  // Fetch helpers
  const fetchFlow = useCallback(async (divId: string) => {
    setFlowLoading(true);
    setFlowData(null);
    try {
      const data: DivisionFlow = await api.get(`/explorer/division/${divId}/flow`);
      setFlowData(data);
    } catch {
      /* ignore */
    } finally {
      setFlowLoading(false);
    }
  }, []);

  const fetchVsFlow = useCallback(async (divId: string, vsId: string) => {
    setVsFlowLoading(true);
    setVsFlowData(null);
    try {
      const data: DivisionFlow = await api.get(`/explorer/division/${divId}/flow?vs=${vsId}`);
      setVsFlowData(data);
    } catch {
      /* ignore */
    } finally {
      setVsFlowLoading(false);
    }
  }, []);

  // Reset everything below the domain level.
  const resetBelowDomain = useCallback(() => {
    setLevel(0);
    setFocusedDivisionId(null);
    setFlowData(null);
    setFocusedVsId(null);
    setVsFlowData(null);
    setFocusedStepId(null);
    setFocusedSubStepId(null);
  }, []);

  // Click handlers
  const onCompanyClick = useCallback(() => {
    if (companyOpen) {
      setCompanyOpen(false);
      setSelectedDomain(null);
      resetBelowDomain();
    } else {
      setCompanyOpen(true);
    }
  }, [companyOpen, resetBelowDomain]);

  const onDomainClick = useCallback(
    (cat: Category) => {
      if (selectedDomain === cat) {
        setSelectedDomain(null);
        resetBelowDomain(); // toggle off → hide divisions
      } else {
        setSelectedDomain(cat);
        resetBelowDomain(); // switch → show this domain's divisions
      }
    },
    [selectedDomain, resetBelowDomain],
  );

  const onDivisionClick = useCallback(
    (divId: string) => {
      if (focusedDivisionId === divId && level >= 1) {
        setLevel(0);
        setFocusedDivisionId(null);
        setFlowData(null);
        setFocusedVsId(null);
        setVsFlowData(null);
        setFocusedStepId(null);
        setFocusedSubStepId(null);
        return;
      }
      setLevel(1);
      setFocusedDivisionId(divId);
      setFocusedVsId(null);
      setVsFlowData(null);
      setFocusedStepId(null);
      setFocusedSubStepId(null);
      fetchFlow(divId);
    },
    [focusedDivisionId, level, fetchFlow],
  );

  const onVsClick = useCallback(
    (vsId: string) => {
      if (!focusedDivisionId) return;
      if (focusedVsId === vsId && level >= 2) {
        setLevel(1);
        setFocusedVsId(null);
        setVsFlowData(null);
        setFocusedStepId(null);
        setFocusedSubStepId(null);
        return;
      }
      setLevel(2);
      setFocusedVsId(vsId);
      setFocusedStepId(null);
      setFocusedSubStepId(null);
      fetchVsFlow(focusedDivisionId, vsId);
    },
    [focusedDivisionId, focusedVsId, level, fetchVsFlow],
  );

  // Clicking a process area (L3): focus it and reveal its L4 sub-processes as a
  // left-to-right flow below. The right dashboard updates to this area's metrics.
  const onStepClick = useCallback(
    (stepId: string) => {
      if (focusedStepId === stepId && level >= 3) {
        setLevel(2);
        setFocusedStepId(null);
        setFocusedSubStepId(null);
        return;
      }
      setLevel(3);
      setFocusedStepId(stepId);
      setFocusedSubStepId(null);
    },
    [focusedStepId, level],
  );

  // Clicking an L4 sub-process: focus it and reveal its L5 process steps (v15)
  // as a left-to-right flow below. Toggles back to the sub-process row (L3 focus).
  const onSubStepClick = useCallback(
    (subId: string) => {
      if (focusedSubStepId === subId && level === 4) {
        setLevel(3);
        setFocusedSubStepId(null);
        return;
      }
      setLevel(4);
      setFocusedSubStepId(subId);
    },
    [focusedSubStepId, level],
  );

  // Deep-link focus: jump straight to a value stream (company → domain → division
  // → VS) in one shot. Used when the user arrives from a value-stream link
  // elsewhere in the app. Sets the whole drill path at once and kicks off both
  // flow fetches, so the VS node + its process row + the sidebar all resolve.
  const focusValueStream = useCallback(
    (category: Category, divisionId: string, vsId: string) => {
      setCompanyOpen(true);
      setSelectedDomain(category);
      setLevel(2);
      setFocusedDivisionId(divisionId);
      setFocusedVsId(vsId);
      setFocusedStepId(null);
      setFocusedSubStepId(null);
      fetchFlow(divisionId);
      fetchVsFlow(divisionId, vsId);
    },
    [fetchFlow, fetchVsFlow],
  );

  // A restored drill re-arms its data: the flow fetches happen in the click
  // handlers on the original visit, so a mount that restores a division/VS
  // focus must kick them off again (no-op on a fresh visit — both ids null).
  const rearmedRef = useRef(false);
  useEffect(() => {
    if (rearmedRef.current) return;
    rearmedRef.current = true;
    if (focusedDivisionId) fetchFlow(focusedDivisionId);
    if (focusedDivisionId && focusedVsId) fetchVsFlow(focusedDivisionId, focusedVsId);
  }, [focusedDivisionId, focusedVsId, fetchFlow, fetchVsFlow]);

  // Apply an incoming focus target once per id. The backend resolves which domain
  // + division surfaces the stream (it may not be a division's LEAD stream).
  const appliedFocusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusVsId || divisions.length === 0) return;
    if (appliedFocusRef.current === focusVsId) return;
    appliedFocusRef.current = focusVsId;
    let cancelled = false;
    api
      .get<{ divisionId: string; category: string }>(`/explorer/value-stream/${focusVsId}/focus`)
      .then((f) => {
        if (!cancelled) focusValueStream(f.category as Category, f.divisionId, focusVsId);
      })
      .catch(() => {
        /* unresolvable → leave the map at its default view */
      });
    return () => {
      cancelled = true;
    };
  }, [focusVsId, divisions.length, focusValueStream]);

  // Breadcrumb collapse
  const crumbToL0 = useCallback(() => {
    setLevel(0);
    setFocusedDivisionId(null);
    setFlowData(null);
    setFocusedVsId(null);
    setVsFlowData(null);
    setFocusedStepId(null);
    setFocusedSubStepId(null);
  }, []);
  const crumbToL1 = useCallback(() => {
    if (level >= 2) {
      setLevel(1);
      setFocusedVsId(null);
      setVsFlowData(null);
      setFocusedStepId(null);
      setFocusedSubStepId(null);
    }
  }, [level]);
  const crumbToL2 = useCallback(() => {
    if (level >= 3) {
      setLevel(2);
      setFocusedStepId(null);
      setFocusedSubStepId(null);
    }
  }, [level]);
  const crumbToL3 = useCallback(() => {
    if (level >= 4) {
      setLevel(3);
      setFocusedSubStepId(null);
    }
  }, [level]);
  // Back to the domains row (clears the selected domain + everything below).
  const crumbToDomains = useCallback(() => {
    setSelectedDomain(null);
    resetBelowDomain();
  }, [resetBelowDomain]);

  return {
    companyOpen,
    selectedDomain,
    level,
    focusedDivisionId,
    focusedVsId,
    focusedStepId,
    focusedSubStepId,
    flowData,
    flowLoading,
    vsFlowData,
    vsFlowLoading,
    fetchFlow,
    fetchVsFlow,
    onCompanyClick,
    onDomainClick,
    onDivisionClick,
    onVsClick,
    onStepClick,
    onSubStepClick,
    crumbToL0,
    crumbToL1,
    crumbToL2,
    crumbToL3,
    crumbToDomains,
  };
}
