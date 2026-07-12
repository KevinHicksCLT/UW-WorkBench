/**
 * Drill-down drawer for the workspace board — granular finding detail for the
 * Normalize / Greenfield / shared-service boxes (legacy-cell categories expand
 * in place instead, WR-10). Status dots and classification chips render from
 * the vocabulary (3-A). Extracted from GreenfieldMigration.tsx.
 */
import {
  statusDot,
  staysHere,
  type ClassificationMeta,
  type Finding,
  type Layer,
  type StageDetail,
  type StatusMeta,
} from '../../lib/rationalization';

export type DrillView = {
  eyebrow: string;
  title: string;
  meta?: string;
  findings: Finding[];
};

/** What the board drilled into (WR-10: legacy cells expand in place instead). */
export type Drill =
  | { kind: 'capdan'; layer: Layer }
  | { kind: 'service'; serviceId: string }
  | { kind: 'shared'; appId: string };

/** Resolve a drill subject to the drawer's content (pure). */
export function computeDrillView(
  detail: StageDetail | null,
  drill: Drill | null,
  classification: ClassificationMeta,
): DrillView | null {
  if (!detail || !drill) return null;
  const stays = (f: Finding) => staysHere(f.capdan, classification);
  if (drill.kind === 'capdan') {
    const comp = detail.components.find((c) => c.layer === drill.layer);
    const findings = detail.findings.filter((f) => f.layer === drill.layer && stays(f));
    const meta = [comp?.destination ? `→ ${comp.destination}` : '', comp?.targetTech ?? '']
      .filter(Boolean)
      .join(' · ');
    return {
      eyebrow: `Normalized · ${drill.layer}`,
      title: comp?.name ?? drill.layer,
      meta: meta || undefined,
      findings,
    };
  }
  // A shared service absorbs the Relocate findings pointing at it (WR-15).
  if (drill.kind === 'shared') {
    const a = detail.apps.find((x) => x.id === drill.appId);
    return {
      eyebrow: 'Shared service',
      title: a?.name ?? 'Shared service',
      meta: a?.techStack ?? undefined,
      findings: detail.findings.filter((f) => f.sharedServiceId === drill.appId),
    };
  }
  const m = detail.microservices.find((x) => x.id === drill.serviceId);
  const layers = detail.components
    .filter((c) => c.microserviceId === drill.serviceId)
    .map((c) => c.layer);
  const findings = detail.findings.filter((f) => layers.includes(f.layer) && stays(f));
  const meta = [
    m?.techStack ?? '',
    m?.ownerRole ?? '',
    layers.length ? `Layers: ${layers.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    eyebrow: `Greenfield${m ? ` · ${m.status}` : ''}`,
    title: m?.name ?? 'Service',
    meta: meta || undefined,
    findings,
  };
}

export function DrillDrawer({
  view,
  statusMeta,
  classification,
  onClose,
}: {
  view: DrillView;
  statusMeta: StatusMeta;
  classification: ClassificationMeta;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      <aside className="fixed top-0 right-0 z-50 h-full w-full sm:w-[460px] bg-white border-l border-[#eaeaea] shadow-xl flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#eaeaea]">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3]">
              {view.eyebrow}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <h3 className="text-[15px] font-semibold text-[#171717]">{view.title}</h3>
            </div>
            {view.meta && (
              <div className="text-[11px] text-[#0f766e] mt-1 leading-snug">{view.meta}</div>
            )}
            <div className="text-[11px] text-[#a3a3a3] tnum mt-0.5">
              {view.findings.length} {view.findings.length === 1 ? 'finding' : 'findings'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 -mr-1.5 rounded-md text-[#a3a3a3] hover:text-[#171717] hover:bg-[#fafafa]"
            aria-label="Close"
          >
            <svg
              width="18"
              height="18"
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
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {view.findings.map((f) => (
            <div key={f.id} className="rounded-lg border border-[#eaeaea] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[13px] font-semibold text-[#171717] leading-snug">
                  {f.name}
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] text-[#525252] flex-shrink-0">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: statusDot(f.migrationStatus, statusMeta) }}
                  />
                  {statusMeta[f.migrationStatus]?.label ?? f.migrationStatus}
                </span>
              </div>
              {/* layer context helps when drilling a component / service across cells */}
              <div className="text-[10px] text-[#a3a3a3] mt-0.5">{f.layer}</div>
              {f.codeRef && (
                <div className="mt-2 rounded bg-[#f7f7f8] border border-[#eee] px-2 py-1.5 font-mono text-[11px] text-[#444] break-all">
                  {f.codeRef}
                </div>
              )}
              {f.rationale && (
                <p className="text-[12px] text-[#666666] mt-2 leading-snug">{f.rationale}</p>
              )}
              {f.migrationApproach && (
                <div className="mt-2 flex items-start gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#10b981] mt-px flex-shrink-0">
                    Migrate
                  </span>
                  <span className="text-[12px] text-[#171717] leading-snug">
                    {f.migrationApproach}
                  </span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2.5 text-[10px] text-[#a3a3a3] tnum">
                <span
                  className={`inline-flex items-center rounded border px-1.5 py-0.5 font-medium ${
                    classification.byToken[f.capdan]?.chip ??
                    'bg-[#fafafa] text-[#525252] border-[#e5e5e5]'
                  }`}
                >
                  {classification.byToken[f.capdan]?.label ?? f.capdan}
                </span>
                {!staysHere(f.capdan, classification) && f.targetLayer && (
                  <span className="text-[#be123c]">→ {f.targetLayer}</span>
                )}
                {f.deadCode && <span className="text-[#be123c]">· dead code</span>}
                {f.effort && <span>· Effort {f.effort}</span>}
                {f.complexity && <span>· {f.complexity}</span>}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
