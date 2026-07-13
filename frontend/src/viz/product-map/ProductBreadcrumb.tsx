/**
 * Drill breadcrumb for the Product Model map — Company › segment › LOB family
 * › product › version, deepest crumb active, ancestors clickable, ✕ clears.
 * Same 11px focus-crumb visual language as the org map's breadcrumb.
 * Extracted from ProductMapCanvas.tsx to keep it under the 500-line cap.
 */
import { sentenceCase } from '../nodes/MapNode';
import { CRUMB, CRUMB_SEP, type ProductNode } from './productNodes';

export type ProductBreadcrumbProps = {
  companyName: string;
  /** L1 level display name (user-editable, from the payload) for the hint text. */
  level1Name: string;
  selSegment: ProductNode | null;
  selLob: ProductNode | null;
  selProduct: ProductNode | null;
  selVersion: ProductNode | null;
  onClear: () => void;
  onToSegment: () => void;
  onToLob: () => void;
  onToProduct: () => void;
};

export function ProductBreadcrumb({
  companyName,
  level1Name,
  selSegment,
  selLob,
  selProduct,
  selVersion,
  onClear,
  onToSegment,
  onToLob,
  onToProduct,
}: ProductBreadcrumbProps) {
  if (!selSegment) {
    return (
      <span className="text-[11px] text-[#666666]">
        Click a {level1Name.toLowerCase()} to drill into the product hierarchy.
      </span>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', whiteSpace: 'nowrap' }}>
      <button onClick={onClear} className="focus-crumb-ancestor" style={CRUMB}>
        {sentenceCase(companyName)}
      </button>
      <span style={CRUMB_SEP}>›</span>
      {!selLob ? (
        <span className="focus-crumb-active" style={CRUMB}>
          {sentenceCase(selSegment.name)}
        </span>
      ) : (
        <button onClick={onToSegment} className="focus-crumb-ancestor" style={CRUMB}>
          {sentenceCase(selSegment.name)}
        </button>
      )}
      {selLob && (
        <>
          <span style={CRUMB_SEP}>›</span>
          {!selProduct ? (
            <span className="focus-crumb-active" style={CRUMB}>
              {sentenceCase(selLob.name)}
            </span>
          ) : (
            <button onClick={onToLob} className="focus-crumb-ancestor" style={CRUMB}>
              {sentenceCase(selLob.name)}
            </button>
          )}
        </>
      )}
      {selProduct && (
        <>
          <span style={CRUMB_SEP}>›</span>
          {!selVersion ? (
            <span className="focus-crumb-active" style={CRUMB}>
              {sentenceCase(selProduct.name)}
            </span>
          ) : (
            <button onClick={onToProduct} className="focus-crumb-ancestor" style={CRUMB}>
              {sentenceCase(selProduct.name)}
            </button>
          )}
        </>
      )}
      {selVersion && (
        <>
          <span style={CRUMB_SEP}>›</span>
          <span className="focus-crumb-active" style={CRUMB}>
            {sentenceCase(selVersion.name)}
          </span>
        </>
      )}
      <button
        onClick={onClear}
        aria-label="Clear focus"
        style={{
          marginLeft: 6,
          width: 18,
          height: 18,
          borderRadius: 5,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          color: '#a3a3a3',
          background: 'transparent',
          border: '1px solid #eaeaea',
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  );
}
