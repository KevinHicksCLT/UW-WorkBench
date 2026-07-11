// ProductModelDrawer — right-hand slide-over for one legacy product model,
// shared by the Product Models list and the segment drill page. All data is
// already in the list row (GET /product-models), so the drawer just presents
// it — no extra fetch. Workspaces link into the Workspace board with the
// product-models domain pre-selected (/portfolio?domain=product-models).
import { Link } from 'react-router-dom';
import { DrawerShell, EmptyState, StatusPill, type PillTone } from '../../components/ui';

/** One row of GET /product-models (frozen DTO — plan §6.2). */
export type ProductModel = {
  id: string;
  name: string;
  description: string | null;
  sourceSystem: string | null;
  segment: string | null;
  geography: string | null;
  disposition: string | null;
  workspaces: { id: string; name: string }[];
  findingCount: number;
  illustrative: boolean;
  /** Optional detail fields — rendered when the API provides them. */
  components?: string[];
  canonicalModelName?: string | null;
};

/** Disposition vocabulary (plan §6.4) → pill tone. */
export const DISPOSITION_TONE: Record<string, PillTone> = {
  Retain: 'green',
  Refactor: 'blue',
  Replace: 'amber',
  Retire: 'red',
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">
    {children}
  </div>
);

export default function ProductModelDrawer({
  model,
  onClose,
}: {
  model: ProductModel;
  onClose: () => void;
}) {
  const sub = [model.sourceSystem, model.segment, model.geography].filter(Boolean).join(' · ');
  return (
    <DrawerShell
      onClose={onClose}
      width={480}
      maxWidth="92vw"
      header={
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0070AD]">
              Product model
            </span>
            {model.disposition && (
              <StatusPill tone={DISPOSITION_TONE[model.disposition] ?? 'slate'}>
                {model.disposition}
              </StatusPill>
            )}
          </div>
          <div className="text-[15px] font-bold text-[#171717] leading-snug mt-0.5">
            {model.name}
          </div>
          {sub && <div className="text-[11px] text-[#a3a3a3] mt-0.5">{sub}</div>}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-[#cde3f5] bg-[#f2f8fd] p-3">
          <SectionLabel>What it covers</SectionLabel>
          {model.description ? (
            <p className="text-sm text-[#171717] leading-relaxed">{model.description}</p>
          ) : (
            <EmptyState baseClassName="text-sm text-[#a3a3a3] italic" message="No description." />
          )}
        </div>

        {model.components && model.components.length > 0 && (
          <div>
            <SectionLabel>Components touched</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {model.components.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center rounded-full bg-[#fafafa] text-[#525252] border border-[#eaeaea] px-2 py-0.5 text-[11px] font-medium"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {model.canonicalModelName != null && (
          <div>
            <SectionLabel>Canonical mapping</SectionLabel>
            <p className="text-sm text-[#171717]">{model.canonicalModelName}</p>
          </div>
        )}

        <div>
          <SectionLabel>Workspaces</SectionLabel>
          {model.workspaces.length ? (
            <div className="flex flex-wrap gap-1.5">
              {model.workspaces.map((w) => (
                <Link
                  key={w.id}
                  to={`/portfolio?domain=product-models&workspace=${encodeURIComponent(w.id)}`}
                  className="inline-flex items-center rounded-full bg-[#eef6fb] text-[#0070AD] border border-[#cde3f5] px-2 py-0.5 text-[11px] font-medium hover:bg-[#dceaf7] transition-colors"
                >
                  {w.name}
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              baseClassName="text-sm text-[#a3a3a3] italic"
              message="Not on a workspace board yet."
            />
          )}
        </div>

        <div>
          <SectionLabel>Findings</SectionLabel>
          <p className="text-sm text-[#525252]">
            {model.findingCount
              ? `${model.findingCount} rationalization finding${model.findingCount === 1 ? '' : 's'} reference this model.`
              : 'No rationalization findings yet.'}
          </p>
        </div>
      </div>
    </DrawerShell>
  );
}
