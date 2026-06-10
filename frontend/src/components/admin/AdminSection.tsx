import { useState } from 'react';
import type { AdminEntity } from '../../lib/adminTypes';
import type { EditorSpec } from '../../lib/adminConfig';
import EntityList from './EntityList';
import MasterDetailEditor, { type ChildSpec } from './MasterDetailEditor';
import CompanyOnboard from './CompanyOnboard';
import RoleStudio from './RoleStudio';
import SkillAdmin from './SkillAdmin';
import DashboardAdmin from './DashboardAdmin';
import ValidationPanel from './ValidationPanel';
import AiAdoptionEditor from './AiAdoptionEditor';
import ModelBuilder from './ModelBuilder';

// Resolves one section's EditorSpec to the right editor component, wiring entity
// metadata in from the registry. Keeps Admin.tsx declarative — the page just maps
// the configured tab/section tree to <AdminSection> instances.

function Missing({ slug }: { slug: string }) {
  return (
    <div className="card-elevated p-8 text-center text-sm text-[#a3a3a3]">
      The <code className="text-[#525252]">{slug}</code> table isn't available in this build.
    </div>
  );
}

function Intro({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="text-sm text-[#666666] mb-4 max-w-2xl">{text}</p>;
}

export default function AdminSection({
  spec, companyId, companyName, bySlug, onRequestAi, onNavigate,
}: {
  spec: EditorSpec;
  companyId: string | null;
  companyName?: string;
  bySlug: Map<string, AdminEntity>;
  onRequestAi: () => void;
  onNavigate?: (tab: string, section?: string) => void;
}) {
  switch (spec.kind) {
    case 'company':
      return <CompanyOnboard companyEntity={bySlug.get('company') ?? null} onRequestAi={onRequestAi} />;

    case 'dashboard':
      return <DashboardAdmin onNavigate={onNavigate} />;

    case 'list': {
      const e = bySlug.get(spec.slug);
      if (!e) return <Missing slug={spec.slug} />;
      return (
        <div>
          <Intro text={spec.intro} />
          <EntityList entity={e} companyId={companyId} fixed={spec.fixed} />
        </div>
      );
    }

    case 'group':
      return (
        <div className="space-y-6">
          <Intro text={spec.intro} />
          {spec.lists.map((l) => {
            const e = bySlug.get(l.slug);
            return e ? <EntityList key={l.slug} entity={e} companyId={companyId} title={l.title ?? e.label} /> : <Missing key={l.slug} slug={l.slug} />;
          })}
        </div>
      );

    case 'masterDetail': {
      const parent = bySlug.get(spec.parent);
      if (!parent) return <Missing slug={spec.parent} />;
      const children: ChildSpec[] = [];
      const missing: string[] = [];
      for (const c of spec.children) {
        const ce = bySlug.get(c.slug);
        if (ce) children.push({ entity: ce, fkField: c.fk, title: c.title, newLabel: c.newLabel });
        else missing.push(c.slug);
      }
      return (
        <div>
          {missing.length > 0 && <div className="text-xs text-[#be123c] mb-2">Unavailable: {missing.join(', ')}</div>}
          <MasterDetailEditor companyId={companyId} parent={parent} parentTitle={spec.parentTitle} intro={spec.intro} childSpecs={children} />
        </div>
      );
    }

    case 'roleStudio':
      return <RoleStudio companyId={companyId} bySlug={bySlug} />;

    case 'skills':
      return <SkillAdmin />;

    case 'validations':
      return <ValidationPanel companyId={companyId} onNavigate={onNavigate} />;

    case 'aiAdoption':
      return <AiAdoptionEditor companyId={companyId} />;

    case 'builder':
      return <ModelBuilder companyId={companyId} scope={spec.scope ?? 'all'} />;

    case 'catalog':
      return <CatalogEditor companyId={companyId} bySlug={bySlug} />;

    default:
      return null;
  }
}

// Power-user view: a sub-sidebar of every editable table (grouped) + its EntityList.
function CatalogEditor({ companyId, bySlug }: { companyId: string | null; bySlug: Map<string, AdminEntity> }) {
  const entities = Array.from(bySlug.values());
  const [slug, setSlug] = useState<string>(entities[0]?.slug ?? '');
  const active = bySlug.get(slug) ?? null;

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      <aside className="lg:w-56 flex-shrink-0">
        <div className="card-elevated p-2 max-h-[70vh] overflow-y-auto">
          <nav className="space-y-0.5">
            {entities.map((e, i) => (
              <div key={e.slug}>
                {(e.group && e.group !== entities[i - 1]?.group) && (
                  <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">{e.group}</div>
                )}
                <button
                  onClick={() => setSlug(e.slug)}
                  className={
                    'w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ' +
                    (e.slug === slug ? 'bg-[#f5f5f5] text-[#171717] font-medium' : 'text-[#525252] hover:bg-[#fafafa] hover:text-[#171717]')
                  }
                >
                  {e.label}
                </button>
              </div>
            ))}
          </nav>
        </div>
      </aside>
      <section className="flex-1 min-w-0">
        {active ? <EntityList entity={active} companyId={companyId} /> : <div className="text-sm text-[#a3a3a3]">No tables available.</div>}
      </section>
    </div>
  );
}
