// ProductComponentSidebar.tsx — docked right-hand panel for the product map:
// clicking an L5 model-component card opens this sidebar with the component's
// full contents (owner, current expression, and every element — what it is +
// the system it lives in today). Header deep-links to the dedicated node
// detail page at /product-models/nodes/<id>.

import { Link } from 'react-router-dom';
import { Chip, EmptyState } from '../../components/ui';
import { componentFacts } from '../../components/product-list/model';
import type { ProductNode } from './productNodes';

const SectionLabel = ({ children }: { children: string }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373] mb-1">
    {children}
  </div>
);

export function ProductComponentSidebar({
  node,
  ancestry,
  onClose,
}: {
  node: ProductNode;
  /** "Segment › LOB › Product › Version" context line. */
  ancestry: string;
  onClose: () => void;
}) {
  const facts = componentFacts(node.attributes);
  return (
    <aside className="w-[420px] flex-shrink-0 h-full flex flex-col border-l border-[#eaeaea] bg-white">
      <div className="flex items-start gap-2 px-4 py-3 border-b border-[#eaeaea]">
        <div className="min-w-0 flex-1">
          <SectionLabel>Model component</SectionLabel>
          <Link
            to={`/product-models/nodes/${node.id}`}
            className="text-sm font-semibold text-[#171717] hover:underline"
          >
            {node.name}
          </Link>
          <div className="text-[11px] text-[#737373] truncate" title={ancestry}>
            {ancestry}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close component panel"
          className="text-[#a3a3a3] hover:text-[#171717] text-base leading-none px-1 py-0.5 transition-colors"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <SectionLabel>Maintained by</SectionLabel>
            <div className="text-[12px] text-[#171717]">{facts.owner ?? '—'}</div>
          </div>
          <div>
            <SectionLabel>Current expression</SectionLabel>
            <div className="text-[12px] text-[#171717]">{facts.currentExpression ?? '—'}</div>
          </div>
        </div>
        {facts.formats.length > 0 && (
          <div>
            <SectionLabel>Formats</SectionLabel>
            <div className="flex flex-wrap gap-1">
              {facts.formats.map((f) => (
                <Chip key={f} variant="soft">
                  {f}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div>
          <SectionLabel>{`Elements (${facts.elements.length})`}</SectionLabel>
          {facts.elements.length === 0 ? (
            <EmptyState
              baseClassName="text-[11px] text-[#a3a3a3] italic"
              message="No elements recorded."
            />
          ) : (
            <div className="rounded-md border border-[#eaeaea] divide-y divide-[#f5f5f5] overflow-hidden">
              {facts.elements.map((el, i) => (
                <div key={`${el.element}|${i}`} className="px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[12px] font-medium text-[#171717]">{el.element}</div>
                    {el.format && (
                      <Chip variant="soft" className="flex-shrink-0">
                        {el.format}
                      </Chip>
                    )}
                  </div>
                  {el.description && (
                    <div className="text-[11px] leading-snug text-[#525252] mt-0.5">
                      {el.description}
                    </div>
                  )}
                  {el.livesIn && (
                    <div className="text-[11px] leading-snug text-[#737373] mt-0.5">
                      <span className="font-medium text-[#a3a3a3]">Lives in: </span>
                      {el.livesIn}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
