import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useRegisterCrumb } from '../../lib/breadcrumbs';
import { useCompany } from '../../lib/company';
import { useApi } from '../../lib/useApi';
import { withCompany, Tile } from '../../lib/portfolio';
import { BackButton } from '../../components/ui';
import { RegulationBrowser } from './compliance/RegulationBrowser';
import { ItemDrawer } from './compliance/ItemDrawer';
import { COMPLIANCE_LENS_KEY, type ComplianceSummary } from './compliance/shared';

// Compliance register — /regulations/compliance. The SCRUM-46 v2
// determination-ready register imported from the frozen workbook baseline:
// 538 regulations → 4,089 atomic compliance items → 23,928 source requirement
// rows (23,664 binding / 264 informational). This page replaces the old
// "COMPLIANCE — 137" tile bucket (a randomly selected placeholder, discarded).

// Lens tabs mirror the Regulations landing page (a regulation's lens is the
// majority regulator type of its source rows); "All" keeps the exact workbook
// reconciliation view. Persisted so drill-down navigation returns to the lens
// the user left.
const LENSES = [
  ['', 'All'],
  ['international', 'International'],
  ['federal', 'Federal'],
  ['state', 'State'],
] as const;
const initialLens = (): string => {
  const saved = sessionStorage.getItem(COMPLIANCE_LENS_KEY);
  return LENSES.some(([v]) => v === saved) ? (saved ?? '') : '';
};

export default function Compliance() {
  useRegisterCrumb('Compliance');
  const { companyId } = useCompany();
  const [lens, setLensState] = useState<string>(initialLens);
  const setLens = (v: string) => {
    sessionStorage.setItem(COMPLIANCE_LENS_KEY, v);
    setLensState(v);
  };
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  // Bumped after any mutation so the tiles and both views refetch.
  const [reloadKey, setReloadKey] = useState(0);
  const onChanged = () => setReloadKey((k) => k + 1);

  const lensParam = lens ? `&lens=${lens}` : '';
  const { data: summary } = useApi<ComplianceSummary>(
    companyId
      ? withCompany(
          `/regulations/compliance-register/summary?reload=${reloadKey}${lensParam}`,
          companyId,
        )
      : null,
  );

  return (
    <div className="relative">
      <PageHeader
        eyebrow="Regulations"
        title="Compliance register"
        subtitle="Compliance items derived from the regulatory baseline"
        actions={
          <div className="flex items-center gap-2">
            <BackButton />
            <Link
              to="/regulations"
              className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:border-[#d4d4d4] transition-colors duration-150"
            >
              All regulations
            </Link>
          </div>
        }
      />

      {/* Lens tabs — the tiles and both views scope to the active lens. */}
      <div
        className="inline-flex items-center gap-0.5 rounded-full border border-[#eaeaea] bg-white p-0.5 mb-2"
        role="tablist"
        aria-label="Compliance lenses"
      >
        {LENSES.map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={lens === v}
            onClick={() => setLens(v)}
            className={
              'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ' +
              (lens === v ? 'bg-[#171717] text-white' : 'text-[#525252] hover:text-[#171717]')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Reconciliation tiles — on the All lens these match the workbook
          Summary exactly until the register is mutated in-app
          (538 / 4,089 / 23,928 = 23,664 + 264). */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          <Tile
            compact
            label="Regulations"
            value={summary.regulations.toLocaleString()}
            hint="enforced regimes & programs (REG-###)"
          />
          <Tile
            compact
            label="Compliance items"
            value={summary.items.toLocaleString()}
            hint={`${summary.confidence.high} high · ${summary.confidence.medium.toLocaleString()} medium · ${summary.confidence.low.toLocaleString()} low confidence`}
          />
          <Tile
            compact
            label="Requirement rows"
            value={summary.requirementRows.total.toLocaleString()}
            hint={`${summary.requirementRows.binding.toLocaleString()} binding · ${summary.requirementRows.informational} informational`}
          />
          <Tile
            compact
            tone={summary.signOff.confirmed > 0 ? 'positive' : 'neutral'}
            label="Sign-off progress"
            value={`${summary.signOff.confirmed.toLocaleString()}/${summary.items.toLocaleString()}`}
            hint={`${summary.signOff.pending.toLocaleString()} pending · ${summary.signOff.needsResearch.toLocaleString()} needs research · ${summary.signOff.rejected.toLocaleString()} rejected`}
          />
        </div>
      )}

      {/* key by lens so switching lenses remounts with cleared filters/paging */}
      <RegulationBrowser
        key={lens}
        companyId={companyId}
        lens={lens}
        onOpenItem={setOpenItemId}
        onChanged={onChanged}
        reloadKey={reloadKey}
      />

      {openItemId && (
        <ItemDrawer itemId={openItemId} companyId={companyId} onClose={() => setOpenItemId(null)} />
      )}
    </div>
  );
}
