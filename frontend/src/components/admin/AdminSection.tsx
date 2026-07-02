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
import StepLensEditor from './StepLensEditor';
import { Card, ErrorMessage } from '../ui';

// Resolves one section's EditorSpec to the right editor component, wiring entity
// metadata in from the registry. Keeps Admin.tsx declarative — the page just maps
// the configured tab/section tree to <AdminSection> instances.

function Missing({ slug }: { slug: string }) {
  return (
    <Card variant="elevated" className="p-8 text-center text-sm text-[#a3a3a3]">
      <code className="text-[#525252]">{slug}</code> isn't available in this build.
    </Card>
  );
}

function Intro({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="text-sm text-[#666666] mb-4 max-w-2xl">{text}</p>;
}

export default function AdminSection({
  spec, companyId, bySlug, onRequestAi, onNavigate,
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
          {missing.length > 0 && <ErrorMessage baseClassName="text-xs text-[#be123c] mb-2">Unavailable: {missing.join(', ')}</ErrorMessage>}
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

    case 'stepLens':
      return <StepLensEditor companyId={companyId} onNavigate={onNavigate} />;

    default:
      return null;
  }
}
