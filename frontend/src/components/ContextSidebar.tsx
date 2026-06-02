// ContextSidebar.tsx — Level 2 left sidebar: shows apps + people for a clicked process step.
// Uses .ctx-sidebar / .ctx-sidebar-section / .ctx-sidebar-label / .ctx-sidebar-item CSS classes.

import { DOMAIN_HEX, DOMAIN_BG, DOMAIN_BORDER, DOMAIN_TEXT } from '../viz/model';

// ── Types (mirror nodeSubValueStream response) ─────────────────────────────────

export type CtxApp = {
  id: string;
  name: string;
  kind: string;
  vendor: string | null;
  criticality: string | null;
  illustrative?: boolean;
};

export type CtxPerson = {
  id: string;
  name: string;
  title: string | null;
  region: string | null;
  employmentType: string;
};

export type StepContext = {
  domain: {
    primaryCategory: string | null;
    categories: string[];
    crossDomain: boolean;
  };
  lenses: {
    who: {
      byParticipation: Record<string, { id: string; name: string }[]>;
      people: CtxPerson[];
    };
    where: {
      applications: CtxApp[];
    };
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function domainTagClass(cat: string): string {
  if (cat === 'Core Business') return 'tag-core';
  if (cat === 'Corporate Function') return 'tag-corp';
  if (cat === 'IT') return 'tag-it';
  return 'chip-soft';
}

function domainDotClass(cat: string): string {
  if (cat === 'Core Business') return 'dot-core';
  if (cat === 'Corporate Function') return 'dot-corp';
  if (cat === 'IT') return 'dot-it';
  return '';
}

function critColor(criticality: string | null): string {
  if (criticality === 'High') return '#ef4444';
  if (criticality === 'Medium') return '#f59e0b';
  return '#10b981';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AppItem({ app }: { app: CtxApp }) {
  return (
    <div className="ctx-sidebar-item">
      {/* App icon */}
      <div className="flex-shrink-0 w-7 h-7 rounded-md bg-[#faf5ff] border border-[#e9d5ff] flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2.2" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-[#171717] truncate">{app.name}</div>
        {(app.vendor || app.kind) && (
          <div className="text-[10px] text-[#a3a3a3] truncate">
            {[app.vendor, app.kind].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      {/* Criticality dot */}
      {app.criticality && (
        <span
          className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
          style={{ background: critColor(app.criticality) }}
          title={`${app.criticality} criticality`}
        />
      )}
    </div>
  );
}

function PersonItem({ person }: { person: CtxPerson }) {
  return (
    <div className="ctx-sidebar-item">
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
        style={{ background: '#16a34a' }}
      >
        {initials(person.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-[#171717] truncate">{person.name}</div>
        {(person.title || person.region) && (
          <div className="text-[10px] text-[#a3a3a3] truncate">
            {[person.title, person.region].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      {/* Employment type dot */}
      {person.employmentType === 'contractor' && (
        <span className="flex-shrink-0 chip border border-[#e9d5ff] bg-[#faf5ff] text-[#7c3aed] text-[9px]">C</span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  stepName: string;
  ctx: StepContext | null;
  loading: boolean;
  /** 'left' (default) or 'right' — controls which border and flex order */
  side?: 'left' | 'right';
};

export default function ContextSidebar({ stepName, ctx, loading, side = 'left' }: Props) {
  const apps = ctx?.lenses.where.applications ?? [];
  const people = ctx?.lenses.who.people ?? [];
  const primaryCat = ctx?.domain.primaryCategory ?? null;
  const crossDomain = ctx?.domain.crossDomain ?? false;
  const secondaryCats = ctx?.domain.categories.filter((c) => c !== primaryCat) ?? [];

  const borderClass = side === 'right' ? 'border-l border-[#eaeaea]' : 'border-r border-[#eaeaea]';

  return (
    <aside
      className={`flex flex-col bg-white overflow-y-auto flex-shrink-0 ${borderClass}`}
      style={{ width: 280, minWidth: 240, maxWidth: 320 }}
    >
      {/* Sidebar header */}
      <div className="px-4 py-4 border-b border-[#eaeaea]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">
          Process Area
        </div>
        <div className="text-[13px] font-bold text-[#171717] leading-snug mb-2">{stepName}</div>

        {/* Domain tags */}
        <div className="flex flex-wrap gap-1">
          {primaryCat && (
            <span className={domainTagClass(primaryCat)}>
              <span className={domainDotClass(primaryCat)} />
              {primaryCat === 'Corporate Function' ? 'Corp Func' : primaryCat}
            </span>
          )}
          {crossDomain && secondaryCats.map((cat) => (
            <span key={cat} className={domainTagClass(cat)}>
              <span className={domainDotClass(cat)} />
              {cat === 'Corporate Function' ? 'Corp Func' : cat}
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-6">
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton rounded-md" style={{ height: 40 }} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Supporting systems (apps) */}
          <div className="ctx-sidebar-section">
            <div className="ctx-sidebar-label">
              Supporting Systems
              {apps.length > 0 && (
                <span className="ml-1 text-[#171717]">{apps.length}</span>
              )}
            </div>
            {apps.length === 0 ? (
              <div className="text-[11px] text-[#a3a3a3]">None mapped</div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {apps.map((app) => (
                  <AppItem key={app.id} app={app} />
                ))}
              </div>
            )}
          </div>

          {/* People */}
          <div className="ctx-sidebar-section">
            <div className="ctx-sidebar-label">
              People
              {people.length > 0 && (
                <span className="ml-1 text-[#171717]">{people.length}</span>
              )}
            </div>
            {people.length === 0 ? (
              <div className="text-[11px] text-[#a3a3a3]">No people mapped</div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {people.slice(0, 20).map((person) => (
                  <PersonItem key={person.id} person={person} />
                ))}
                {people.length > 20 && (
                  <div className="text-[10px] text-[#a3a3a3] mt-1 px-1">
                    +{people.length - 20} more people
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
