/**
 * Compact drill-path breadcrumb for the operating-model map — rendered into
 * the page header via portal from MapCanvas. Extracted verbatim; pure
 * presentational component (all state and handlers come in as props).
 */
import { sentenceCase } from '../nodes/MapNode';
import type { DivisionSummary, FlowStep, FlowValueStream } from '../model';
import { CRUMB, CRUMB_SEP, type Category } from './constants';

type SubStep = FlowStep['subSteps'][number];

export type MapBreadcrumbProps = {
  companyName: string;
  selectedDomain: Category | null;
  level: number;
  focusedDivision: DivisionSummary | null;
  focusedVs: FlowValueStream | null;
  focusedStep: FlowStep | null;
  focusedSubStep: SubStep | null;
  crumbToDomains: () => void;
  crumbToL0: () => void;
  crumbToL1: () => void;
  crumbToL2: () => void;
  crumbToL3: () => void;
};

export default function MapBreadcrumb({
  companyName, selectedDomain, level, focusedDivision, focusedVs, focusedStep, focusedSubStep,
  crumbToDomains, crumbToL0, crumbToL1, crumbToL2, crumbToL3,
}: MapBreadcrumbProps) {
  return selectedDomain ? (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', whiteSpace: 'nowrap' }}>
      <button onClick={crumbToDomains} className="focus-crumb-ancestor" style={CRUMB}>{sentenceCase(companyName)}</button>
      <span style={CRUMB_SEP}>›</span>
      {!focusedDivision
        ? <span className="focus-crumb-active" style={CRUMB}>{selectedDomain}</span>
        : <button onClick={crumbToL0} className="focus-crumb-ancestor" style={CRUMB}>{selectedDomain}</button>}
      {focusedDivision && (
        <>
          <span style={CRUMB_SEP}>›</span>
          {level === 1
            ? <span className="focus-crumb-active" style={CRUMB}>{sentenceCase(focusedDivision.name)}</span>
            : <button onClick={crumbToL1} className="focus-crumb-ancestor" style={CRUMB}>{sentenceCase(focusedDivision.name)}</button>}
        </>
      )}
      {level >= 2 && focusedVs && (
        <>
          <span style={CRUMB_SEP}>›</span>
          {level === 2
            ? <span className="focus-crumb-active" style={CRUMB}>{sentenceCase(focusedVs.name)}</span>
            : <button onClick={crumbToL2} className="focus-crumb-ancestor" style={CRUMB}>{sentenceCase(focusedVs.name)}</button>}
        </>
      )}
      {level >= 3 && focusedStep && (
        <>
          <span style={CRUMB_SEP}>›</span>
          {level === 3
            ? <span className="focus-crumb-active" style={CRUMB}>{sentenceCase(focusedStep.name)}</span>
            : <button onClick={crumbToL3} className="focus-crumb-ancestor" style={CRUMB}>{sentenceCase(focusedStep.name)}</button>}
        </>
      )}
      {level === 4 && focusedSubStep && (
        <>
          <span style={CRUMB_SEP}>›</span>
          <span className="focus-crumb-active" style={CRUMB}>{sentenceCase(focusedSubStep.name)}</span>
        </>
      )}
      <button
        onClick={crumbToDomains}
        aria-label="Clear focus"
        style={{
          marginLeft: 6, width: 18, height: 18, borderRadius: 5,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: '#a3a3a3',
          background: 'transparent', border: '1px solid #eaeaea', cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  ) : (
    <span className="text-[11px] text-[#666666]">
      Click a domain to drill into the end-to-end process.
    </span>
  );
}
