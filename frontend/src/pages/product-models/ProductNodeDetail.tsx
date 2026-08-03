import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { useRegisterCrumb } from '../../lib/breadcrumbs';
import ProductModelView from './ProductModelView';
import {
  Card,
  Chip,
  EmptyState,
  ErrorMessage,
  LoadingState,
  StatusPill,
} from '../../components/ui';
import {
  componentFacts,
  countCaption,
  formatChipVariant,
  levelCaption,
  lobFacts,
  productFacts,
  segmentFacts,
  statusTone,
  versionFacts,
  type ChildNode,
  type DetailNode,
  type NodeDetailData,
  type ProductLevel,
} from './node-detail-model';

// Product node detail — dedicated drill page for ONE node of the product
// hierarchy (drill target from the Product Models TOC/Map/List). Works for any
// level: ancestry breadcrumb, level-captioned header, level-appropriate facts,
// then the main content — an L5 model component lays out its full elements
// table (element | where it lives today | format); container levels list their
// children as drillable rows. All level names come from the company's
// user-editable ProductLevelType captions — nothing is hardcoded.

export default function ProductNodeDetail() {
  const { id } = useParams();
  const { data, error, loading } = useApi<NodeDetailData>(
    id ? `/product-spine/node/${encodeURIComponent(id)}` : null,
  );

  if (loading)
    return <LoadingState baseClassName="text-slate-500" message="Loading product node…" />;
  if (error) {
    // Cross-tenant / unknown id → the API answers 404; land softly.
    if (/not found|no company/i.test(error)) {
      return (
        <Card className="max-w-lg">
          <EmptyState
            baseClassName="text-sm text-[#525252]"
            message={
              <>
                <div className="font-medium text-[#171717] mb-1">Product node not found</div>
                <p className="mb-3">
                  This node doesn&rsquo;t exist (or is no longer part of the product hierarchy).
                </p>
                <Link to="/product-models" className="text-[#2563eb] font-medium hover:underline">
                  Back to Products
                </Link>
              </>
            }
          />
        </Card>
      );
    }
    return <ErrorMessage baseClassName="text-red-600">{error}</ErrorMessage>;
  }
  if (!data) return null;
  return <NodeDetailBody data={data} />;
}

function NodeDetailBody({ data }: { data: NodeDetailData }) {
  const { node, children, levels } = data;
  // Contribute the node to the global visited-path trail (what PageHeader does).
  useRegisterCrumb(node.name);
  const caption = levelCaption(levels, node.levelNumber);

  // A PRODUCT (L3) renders the document-shaped model view — Forms decomposed
  // into coverages / terms / endorsements / clauses, then Rating · Pricing ·
  // Underwriting Rules · Filings · Lifecycle Behavior, with jurisdictions as
  // a filter rather than a drill level.
  if (node.levelNumber === 3) return <ProductModelView id={node.id} />;

  return (
    <div>
      {/* Header — level caption chip, node name, status, description. The
          global BreadcrumbBar is the only trail; no in-page ancestry crumb. */}
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <Chip variant="soft">{caption}</Chip>
          {node.status && <StatusPill tone={statusTone(node.status)}>{node.status}</StatusPill>}
        </div>
        <h1 className="text-h1 text-[#171717]">{node.name}</h1>
        {node.description && (
          <p className="text-sm text-[#666666] mt-1 max-w-3xl">{node.description}</p>
        )}
      </div>

      <FactsCard node={node} />

      {node.levelNumber === 5 ? (
        <ElementsSection node={node} />
      ) : (
        <ChildrenSection node={node} childRows={children} levels={levels} />
      )}
    </div>
  );
}

// ── Facts card — level-appropriate label/value grid ──────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373] mb-1">
      {children}
    </div>
  );
}

/** One labelled fact — renders nothing when the value is absent. */
function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="text-sm text-[#171717] leading-relaxed">{value}</div>
    </div>
  );
}

/** A labelled row of chips — renders nothing when empty. */
function ChipFacts({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-wrap gap-1">
        {items.map((it) => (
          <Chip key={it} variant={formatChipVariant(it)}>
            {it}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function FactsCard({ node }: { node: DetailNode }) {
  const n = node.levelNumber;
  if (n === 1) {
    const f = segmentFacts(node.attributes);
    const hasAny =
      f.canonicalName ||
      f.systems ||
      f.legacyVariants ||
      f.distribution ||
      f.placement ||
      f.reinsurance ||
      f.regulatory ||
      f.patterns.length > 0;
    if (!hasAny) return null;
    return (
      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Fact label="Canonical name" value={f.canonicalName} />
          <Fact label="Systems" value={f.systems} />
          <Fact label="Legacy variants" value={f.legacyVariants} />
          <Fact label="Distribution" value={f.distribution} />
          <Fact label="Placement" value={f.placement} />
          <Fact label="Reinsurance" value={f.reinsurance} />
          <Fact label="Regulatory" value={f.regulatory} />
        </div>
        {f.patterns.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#f5f5f5]">
            <SectionLabel>Patterns</SectionLabel>
            <div className="space-y-2">
              {f.patterns.map((p) => (
                <div key={p.name}>
                  <div className="text-sm font-medium text-[#171717]">{p.name}</div>
                  {p.components.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.components.map((c) => (
                        <Chip key={c} variant="soft">
                          {c}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    );
  }
  if (n === 2) {
    const f = lobFacts(node.attributes);
    if (!f.componentsExtended) return null;
    return (
      <Card className="mb-4">
        <Fact label="Components (extended)" value={f.componentsExtended} />
      </Card>
    );
  }
  if (n === 3) {
    const f = productFacts(node.attributes);
    if (!f.runsIn) return null;
    return (
      <Card className="mb-4">
        <Fact label="Runs in" value={f.runsIn} />
      </Card>
    );
  }
  if (n === 4) {
    const f = versionFacts(node.attributes);
    if (!f.version && !f.jurisdiction && !f.effective) return null;
    return (
      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Fact label="Version" value={f.version} />
          <Fact label="Jurisdiction" value={f.jurisdiction} />
          <Fact label="Effective" value={f.effective} />
        </div>
      </Card>
    );
  }
  if (n === 5) {
    const f = componentFacts(node.attributes);
    if (!f.owner && !f.currentExpression && f.formats.length === 0) return null;
    return (
      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Fact label="Maintained by" value={f.owner} />
          <Fact label="Current expression" value={f.currentExpression} />
          <ChipFacts label="Formats" items={f.formats} />
        </div>
      </Card>
    );
  }
  return null;
}

// ── L5 main content — the component's full elements table ────────────────────

const ELEMENT_GRID =
  'grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,0.55fr)]';

function ElementsSection({ node }: { node: DetailNode }) {
  const { elements } = componentFacts(node.attributes);
  return (
    <section>
      <h2 className="text-sm font-semibold text-[#171717] mb-1.5 flex items-baseline gap-2">
        Elements
        <span className="text-xs font-normal text-[#a3a3a3] tnum">{elements.length}</span>
      </h2>
      {elements.length === 0 ? (
        <Card>
          <EmptyState message="No elements recorded for this component." />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div
            className={`${ELEMENT_GRID} divide-x divide-[#eaeaea] bg-[#fafafa] border-b border-[#eaeaea]`}
          >
            {['Element', 'What it is', 'Lives in today', 'Format'].map((h) => (
              <div
                key={h}
                className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#737373]"
              >
                {h}
              </div>
            ))}
          </div>
          {elements.map((el, i) => (
            <div
              key={`${el.element}|${i}`}
              className={`${ELEMENT_GRID} divide-x divide-[#f5f5f5] border-b border-[#f5f5f5] last:border-0`}
            >
              <div className="px-4 py-2 text-sm font-medium text-[#171717]">
                {el.element || '—'}
              </div>
              <div className="px-4 py-2 text-sm text-[#525252]">{el.description ?? '—'}</div>
              <div className="px-4 py-2 text-sm text-[#525252]">{el.livesIn || '—'}</div>
              <div className="px-4 py-2 min-w-0">
                {el.format && <Chip variant={formatChipVariant(el.format)}>{el.format}</Chip>}
              </div>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}

// ── L1–L4 main content — drillable children table ────────────────────────────

/** Level-appropriate meta shown at the right of a child row. */
function ChildMeta({ child }: { child: ChildNode }) {
  if (child.levelNumber === 3) {
    const runsIn = productFacts(child.attributes).runsIn;
    return runsIn ? (
      <span className="text-xs text-[#525252] truncate">Runs in {runsIn}</span>
    ) : null;
  }
  if (child.levelNumber === 4) {
    const { jurisdiction } = versionFacts(child.attributes);
    return (
      <span className="flex items-center gap-2 min-w-0">
        {jurisdiction && <span className="text-xs text-[#525252] truncate">{jurisdiction}</span>}
        {child.status && <StatusPill tone={statusTone(child.status)}>{child.status}</StatusPill>}
      </span>
    );
  }
  if (child.levelNumber === 5) {
    const f = componentFacts(child.attributes);
    return (
      <span className="flex items-center gap-2 min-w-0 text-xs text-[#525252]">
        {f.owner && <span className="truncate">{f.owner}</span>}
        <span className="text-[#a3a3a3] tnum flex-shrink-0">
          {f.elements.length} element{f.elements.length === 1 ? '' : 's'}
        </span>
      </span>
    );
  }
  return null;
}

function ChildrenSection({
  node,
  childRows,
  levels,
}: {
  node: DetailNode;
  childRows: ChildNode[];
  levels: ProductLevel[];
}) {
  const childCaption = levelCaption(levels, node.levelNumber + 1);
  return (
    <section>
      <h2 className="text-sm font-semibold text-[#171717] mb-1.5 flex items-baseline gap-2">
        {countCaption(childRows.length, childCaption)}
      </h2>
      {childRows.length === 0 ? (
        <Card>
          <EmptyState message={`No ${childCaption.toLowerCase()} rows under this node yet.`} />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          {childRows.map((c) => (
            <Link
              key={c.id}
              to={`/product-models/nodes/${c.id}`}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors duration-150"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-[#171717] truncate">{c.name}</span>
                {c.description && (
                  <span className="block text-xs text-[#a3a3a3] truncate">{c.description}</span>
                )}
              </span>
              <ChildMeta child={c} />
              {/* Grandchild count, captioned with the NEXT level's name. */}
              {c.levelNumber < 5 && (
                <span className="text-xs text-[#a3a3a3] tnum flex-shrink-0">
                  {countCaption(c.childCount, levelCaption(levels, c.levelNumber + 1))}
                </span>
              )}
              <RowChevron />
            </Link>
          ))}
        </Card>
      )}
    </section>
  );
}

function RowChevron() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="flex-shrink-0 text-[#a3a3a3]"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
