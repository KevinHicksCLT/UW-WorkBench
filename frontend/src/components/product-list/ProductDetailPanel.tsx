// ProductDetailPanel.tsx — right-hand detail sidebar for the flat Product
// Model list. Docked beside the sheet (same side-by-side pattern as the
// Organization list's metrics panel — no overlay), fixed height, scrolls
// independently. Shows everything under one selected L4 version: the header
// facts (status / jurisdiction / effective / runs-in), the Segment › LOB ›
// Product ancestry, and each L5 model component as a collapsible section with
// owner, current expression and the Element | Lives in | Format table.
// Component names (and the version header) deep-link to the dedicated node
// detail page at /product-models/nodes/<id>.

import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Chip, EmptyState, StatusPill } from '../ui';
import { componentFacts, statusTone, type ProductNode, type VersionRow } from './model';

const nodeHref = (id: string) => `/product-models/nodes/${id}`;

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373] mb-1">
    {children}
  </div>
);

/** Elements table for one model component: Element | Lives in | Format chip. */
function ElementsTable({ node }: { node: ProductNode }) {
  const { elements } = componentFacts(node.attributes);
  if (elements.length === 0) {
    return (
      <EmptyState
        baseClassName="text-[11px] text-[#a3a3a3] italic"
        message="No elements recorded."
      />
    );
  }
  return (
    <div className="rounded-md border border-[#eaeaea] overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)] divide-x divide-[#eaeaea] bg-[#fafafa] border-b border-[#eaeaea]">
        {['Element', 'Lives in', 'Format'].map((h) => (
          <div
            key={h}
            className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373]"
          >
            {h}
          </div>
        ))}
      </div>
      {elements.map((el, i) => (
        <div
          key={`${el.element}|${i}`}
          className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)] divide-x divide-[#f0f0f0] border-b border-[#f5f5f5] last:border-0"
        >
          <div className="px-2 py-1.5 min-w-0">
            <div className="text-[12px] font-medium text-[#171717]">{el.element}</div>
            {el.description && (
              <div className="text-[11px] leading-snug text-[#737373]">{el.description}</div>
            )}
          </div>
          <div className="px-2 py-1.5 text-[12px] text-[#525252]">{el.livesIn}</div>
          <div className="px-2 py-1.5 min-w-0">
            {el.format && <Chip variant="soft">{el.format}</Chip>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** One collapsible model-component section (header row toggles; name deep-links). */
function ComponentSection({ node }: { node: ProductNode }) {
  const [open, setOpen] = useState(false);
  const f = componentFacts(node.attributes);
  return (
    <div className="rounded-md border border-[#eaeaea] overflow-hidden">
      <div
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer hover:bg-[#fafafa] min-w-0"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={
            'flex-shrink-0 text-[#a3a3a3] transition-transform duration-100' +
            (open ? ' rotate-90' : '')
          }
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        <Link
          to={nodeHref(node.id)}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 truncate text-[12px] font-medium text-[#171717] hover:underline"
          title={node.name}
        >
          {node.name}
        </Link>
        {f.owner && (
          <span
            className="ml-auto flex-shrink-0 max-w-[45%] truncate text-[11px] text-[#737373]"
            title={`Owner: ${f.owner}`}
          >
            {f.owner}
          </span>
        )}
      </div>
      {open && (
        <div className="border-t border-[#f0f0f0] px-2 py-2 space-y-2.5">
          {f.owner && (
            <div>
              <SectionLabel>Owner</SectionLabel>
              <div className="text-[12px] text-[#171717] leading-relaxed">{f.owner}</div>
            </div>
          )}
          {f.currentExpression && (
            <div>
              <SectionLabel>Current expression</SectionLabel>
              <div className="text-[12px] text-[#171717] leading-relaxed">
                {f.currentExpression}
              </div>
            </div>
          )}
          {f.formats.length > 0 && (
            <div>
              <SectionLabel>Formats</SectionLabel>
              <div className="flex flex-wrap gap-1">
                {f.formats.map((fmt) => (
                  <Chip key={fmt} variant="soft">
                    {fmt}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <div>
            <SectionLabel>Elements</SectionLabel>
            <ElementsTable node={node} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Detail sidebar for one selected version row. `componentLevelName` is the
 * user-editable caption of L5 (from the payload's `levels`).
 */
export default function ProductDetailPanel({
  row,
  componentLevelName,
  onClose,
}: {
  row: VersionRow;
  componentLevelName: string;
  onClose: () => void;
}) {
  const metaLine = [
    row.effective && `Effective ${row.effective}`,
    row.runsIn && `Runs in ${row.runsIn}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <aside
      className="hidden md:flex flex-col bg-white border-l border-[#eaeaea] flex-shrink-0"
      style={{ width: 440, minWidth: 360 }}
    >
      {/* Header — version identity + facts; title deep-links to the node page. */}
      <div className="px-4 py-4 border-b border-[#eaeaea] flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">
            Version
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto -mr-1 flex-shrink-0 text-[#a3a3a3] hover:text-[#171717] w-6 h-6 rounded-md hover:bg-[#fafafa] flex items-center justify-center"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <Link
          to={nodeHref(row.id)}
          className="block text-[14px] font-bold text-[#171717] leading-snug hover:underline"
        >
          {row.product} — {row.version}
        </Link>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          {row.status && <StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill>}
          {row.jurisdiction && (
            <span className="text-[11px] text-[#525252]">{row.jurisdiction}</span>
          )}
          {metaLine && <span className="text-[11px] text-[#737373]">{metaLine}</span>}
        </div>
        {/* Ancestry: Segment › LOB › Product. */}
        <div
          className="mt-1.5 text-[11px] text-[#737373] truncate"
          title={`${row.segment} › ${row.lob} › ${row.product}`}
        >
          {row.segment} › {row.lob} › {row.product}
        </div>
      </div>

      {/* Body — the version's model components, independently scrollable. */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <SectionLabel>
          {row.components.length} {componentLevelName}
        </SectionLabel>
        {row.components.length === 0 ? (
          <EmptyState
            baseClassName="text-[11px] text-[#a3a3a3] italic"
            message="No model components under this version."
          />
        ) : (
          <div className="space-y-1.5">
            {row.components.map((c) => (
              <ComponentSection key={c.id} node={c} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
