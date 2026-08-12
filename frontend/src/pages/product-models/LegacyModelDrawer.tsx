import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Chip, DrawerShell, StatusPill } from '../../components/ui';
import { dispositionTone, type LegacyProductModel } from './legacyModelList';

// LegacyModelDrawer — one legacy product model's detail (description, source
// system, segment/geography scope, disposition, workspace membership, finding
// count), rendered as a slide-over from the Legacy models master list
// (`/product-models?view=legacy`). Fed entirely by the row the list already
// holds — no extra fetch.

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">
    {children}
  </div>
);

export default function LegacyModelDrawer({
  model,
  onClose,
}: {
  model: LegacyProductModel;
  onClose: () => void;
}) {
  return (
    <DrawerShell
      onClose={onClose}
      width={520}
      maxWidth="92vw"
      header={
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">
            Legacy product model
          </div>
          <div className="text-[15px] font-bold text-[#171717] leading-snug">{model.name}</div>
        </div>
      }
    >
      <div className="space-y-5">
        {model.description && (
          <div>
            <SectionLabel>Description</SectionLabel>
            <p className="text-sm text-[#171717] leading-relaxed">{model.description}</p>
          </div>
        )}

        <div>
          <SectionLabel>Source system</SectionLabel>
          {model.sourceSystem ? (
            <p className="text-sm text-[#171717]">{model.sourceSystem}</p>
          ) : (
            <span className="text-sm text-[#a3a3a3] italic">Unknown</span>
          )}
        </div>

        {(model.segment || model.geography) && (
          <div>
            <SectionLabel>Segment &amp; geography</SectionLabel>
            <div className="flex flex-wrap gap-1">
              {model.segment && <Chip title="Segment">{model.segment}</Chip>}
              {model.geography && <Chip title="Geography">{model.geography}</Chip>}
            </div>
          </div>
        )}

        <div>
          <SectionLabel>Disposition</SectionLabel>
          {model.disposition ? (
            <StatusPill tone={dispositionTone(model.disposition)}>{model.disposition}</StatusPill>
          ) : (
            <span className="text-sm text-[#a3a3a3] italic">Not set</span>
          )}
        </div>

        <div>
          <SectionLabel>Workspaces</SectionLabel>
          {model.workspaces.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {model.workspaces.map((w) => (
                <Chip
                  as={Link}
                  key={w.id}
                  to="/portfolio?domain=product-models"
                  className="hover:bg-[#eaeaea]"
                  title="Open the product-model workspace board"
                >
                  {w.name}
                </Chip>
              ))}
            </div>
          ) : (
            <span className="text-sm text-[#a3a3a3] italic">Not on a workspace board</span>
          )}
        </div>

        <div>
          <SectionLabel>Findings</SectionLabel>
          <p className="text-sm text-[#171717]">
            {model.findingCount} finding{model.findingCount === 1 ? '' : 's'} on the workspace board
          </p>
        </div>

        {model.illustrative && (
          <p className="text-xs text-[#a3a3a3] italic">
            Illustrative demo data — not sourced from a client inventory.
          </p>
        )}
      </div>
    </DrawerShell>
  );
}
