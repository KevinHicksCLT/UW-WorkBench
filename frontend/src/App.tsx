// App.tsx

import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import type { MenuKey } from '@cascade/shared';
import { useAuth } from './lib/auth';
import { defaultRoute } from './lib/permissions';
import { PreferencesProvider } from './lib/preferences';
import { CompanyProvider } from './lib/company';
import { DialogProvider } from './lib/dialogs';
import { BreadcrumbProvider } from './lib/breadcrumbs';
// Layout (the app shell) and Login stay eager so the chrome renders instantly;
// every page below is route-level code-split via React.lazy.
import Layout from './components/Layout';
import Login from './pages/login/Login';
import RouteGuard from './components/RouteGuard';

const Overview = lazy(() => import('./pages/overview/Overview'));
const Explorer = lazy(() => import('./pages/explorer/Explorer'));
const DivisionDetail = lazy(() => import('./pages/division-detail/DivisionDetail'));
const DepartmentDetail = lazy(() => import('./pages/department-detail/DepartmentDetail'));
const Organization = lazy(() => import('./pages/organization/Organization'));
const Roles = lazy(() => import('./pages/roles/Roles'));
const SearchResults = lazy(() => import('./pages/search-results/SearchResults'));
const Admin = lazy(() => import('./pages/admin/Admin'));
const UserAdmin = lazy(() => import('./pages/user-admin/UserAdmin'));
const AuditTrail = lazy(() => import('./pages/audit-trail/AuditTrail'));
const Standards = lazy(() => import('./pages/standards/Standards'));
const StandardArea = lazy(() => import('./pages/standard-area/StandardArea'));
const ActiveAI = lazy(() => import('./pages/active-ai/ActiveAI'));
const ActiveAIDetail = lazy(() => import('./pages/active-ai-detail/ActiveAIDetail'));
const Portfolio = lazy(() => import('./pages/portfolio/Portfolio'));
const PortfolioProgram = lazy(() => import('./pages/portfolio-program/PortfolioProgram'));
const PortfolioInitiative = lazy(() => import('./pages/portfolio-initiative/PortfolioInitiative'));
const PortfolioRaid = lazy(() => import('./pages/portfolio-raid/PortfolioRaid'));
const Work = lazy(() => import('./pages/work/Work'));
const Automatable = lazy(() => import('./pages/automatable/Automatable'));
const WorkLibrary = lazy(() => import('./pages/work-library/WorkLibrary'));
const Approvals = lazy(() => import('./pages/approvals/Approvals'));
const Applications = lazy(() => import('./pages/applications/Applications'));
const ApplicationKind = lazy(() => import('./pages/applications/ApplicationKind'));
const ProductModelHierarchy = lazy(() => import('./pages/product-models/ProductModelHierarchy'));
const ProductNodeDetail = lazy(() => import('./pages/product-models/ProductNodeDetail'));
const External = lazy(() => import('./pages/external/External'));
const Regulations = lazy(() => import('./pages/regulations/Regulations'));
const RegulationDetail = lazy(() => import('./pages/regulation-detail/RegulationDetail'));
const RequirementDetail = lazy(() => import('./pages/regulations/RequirementDetail'));
const RegimeDetail = lazy(() => import('./pages/regulations/RegimeDetail'));
const RegulationsInsight = lazy(() => import('./pages/regulations/RegulationsInsight'));
const Compliance = lazy(() => import('./pages/regulations/Compliance'));
const Settings = lazy(() => import('./pages/settings/Settings'));
// The role profile page — revived /roles/:id (description, org, value streams,
// deliverable drill-downs, task summary). Cross-app role links land here.
const RoleProfile = lazy(() => import('./pages/role-profile/RoleProfile'));
// The value-stream drill page — TOC rows land here (L3 areas → L4 → tasks).
const StreamDetail = lazy(() => import('./pages/stream-detail/StreamDetail'));

// Old /value-streams/:id links follow the drill page.
function ValueStreamRedirect() {
  const { id } = useParams();
  return <Navigate to={`/streams/${encodeURIComponent(id ?? '')}`} replace />;
}

// Telemetry became Metrics (defect backlog 02, D6) — old drill-in links follow.
function ActiveAIRedirect() {
  const { id } = useParams();
  return <Navigate to={`/metrics/${encodeURIComponent(id ?? '')}`} replace />;
}

// The portfolio detail pages moved out of Workspace and now live under Home
// (the command-center widgets are their entry point) — old /portfolio/* deep
// links follow them.
function PortfolioDetailRedirect({ base }: { base: string }) {
  const { id } = useParams();
  return <Navigate to={`/${base}/${encodeURIComponent(id ?? '')}`} replace />;
}

// Unknown paths land on the user's start page (or first readable tab). Falls
// back to '/' — whose guard renders the no-access screen when truly nothing is
// readable — so this can never redirect-loop.
function CatchAll() {
  const { permissions, startPage } = useAuth();
  return <Navigate to={defaultRoute(permissions, startPage) ?? '/'} replace />;
}

// Shorthand: a permission-guarded route element (see components/RouteGuard).
function G({ k, children }: { k: MenuKey; children: ReactNode }) {
  return <RouteGuard menuKey={k}>{children}</RouteGuard>;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-slate-500">Loading…</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <DialogProvider>
      <PreferencesProvider>
        <CompanyProvider>
          <BreadcrumbProvider>
            <Layout>
              {/* Single Suspense boundary for all lazy routes — an empty div keeps the
          shell steady (no spinner flash) while a page chunk loads. */}
              <Suspense fallback={<div />}>
                <Routes>
                  {/* Home IS the executive dashboard — the application landing. */}
                  <Route
                    path="/"
                    element={
                      <G k="home">
                        <Overview />
                      </G>
                    }
                  />
                  {/* Value Streams IS the Operating Model Explorer (drill-down diagram).
            `/n/*` carries the drill path (deep-linkable). */}
                  <Route
                    path="/overview"
                    element={
                      <G k="value-streams">
                        <Explorer />
                      </G>
                    }
                  />
                  <Route
                    path="/n/*"
                    element={
                      <G k="value-streams">
                        <Explorer />
                      </G>
                    }
                  />
                  <Route path="/explorer" element={<Navigate to="/overview" replace />} />
                  {/* Roles — the roles-centric tab: flat sheet + reporting-line org chart. */}
                  <Route
                    path="/roles"
                    element={
                      <G k="roles">
                        <Roles />
                      </G>
                    }
                  />
                  {/* Organization — interactive table (org groupings → role, value-stream cross-link). */}
                  <Route
                    path="/organization"
                    element={
                      <G k="organization">
                        <Organization />
                      </G>
                    }
                  />
                  {/* Detail pages remain as deep-link targets from inspector + search. */}
                  <Route
                    path="/divisions/:id"
                    element={
                      <G k="organization">
                        <DivisionDetail />
                      </G>
                    }
                  />
                  <Route
                    path="/departments/:id"
                    element={
                      <G k="organization">
                        <DepartmentDetail />
                      </G>
                    }
                  />
                  <Route
                    path="/roles/:id"
                    element={
                      <G k="roles">
                        <RoleProfile />
                      </G>
                    }
                  />
                  <Route path="/value-streams/:id" element={<ValueStreamRedirect />} />
                  <Route
                    path="/streams/:id"
                    element={
                      <G k="value-streams">
                        <StreamDetail />
                      </G>
                    }
                  />
                  <Route path="/search" element={<SearchResults />} />
                  {/* Personal settings — auth-only, no menu-key guard (every user). */}
                  <Route path="/settings" element={<Settings />} />
                  {/* Standards & Greenfield Migration — placeholder tabs. */}
                  <Route
                    path="/standards"
                    element={
                      <G k="standards">
                        <Standards />
                      </G>
                    }
                  />
                  <Route
                    path="/standards/:id"
                    element={
                      <G k="standards">
                        <StandardArea />
                      </G>
                    }
                  />
                  {/* Metrics (formerly Telemetry) — AI adoption heat map + drill-in.
            Old /active-ai links redirect. */}
                  <Route
                    path="/metrics"
                    element={
                      <G k="metrics">
                        <ActiveAI />
                      </G>
                    }
                  />
                  <Route
                    path="/metrics/:id"
                    element={
                      <G k="metrics">
                        <ActiveAIDetail />
                      </G>
                    }
                  />
                  <Route path="/active-ai" element={<Navigate to="/metrics" replace />} />
                  <Route path="/active-ai/:id" element={<ActiveAIRedirect />} />
                  {/* Application Rationalization now lives inside the Initiatives tab.
            Keep a redirect so old /greenfield links still resolve. */}
                  <Route path="/greenfield" element={<Navigate to="/portfolio" replace />} />
                  {/* Initiatives — strategic-portfolio tracker (Programs → Workstreams →
            Initiatives) integrated with the operating model. Hosts the
            Application Rationalization workspace as its focal feature. */}
                  <Route
                    path="/portfolio"
                    element={
                      <G k="workspace">
                        <Portfolio />
                      </G>
                    }
                  />
                  {/* Portfolio drill-downs live under Home — the command-center widgets
            on the dashboard are their entry point (not the Workspace tab). */}
                  <Route
                    path="/programs/:id"
                    element={
                      <G k="home">
                        <PortfolioProgram />
                      </G>
                    }
                  />
                  <Route
                    path="/initiatives/:id"
                    element={
                      <G k="home">
                        <PortfolioInitiative />
                      </G>
                    }
                  />
                  <Route
                    path="/raid"
                    element={
                      <G k="home">
                        <PortfolioRaid />
                      </G>
                    }
                  />
                  <Route
                    path="/portfolio/programs/:id"
                    element={<PortfolioDetailRedirect base="programs" />}
                  />
                  <Route
                    path="/portfolio/initiatives/:id"
                    element={<PortfolioDetailRedirect base="initiatives" />}
                  />
                  <Route path="/portfolio/raid" element={<Navigate to="/raid" replace />} />
                  {/* Deliverables / Tasks — standalone work tracker, one top-level tab
            each. Old /work links land on Deliverables. */}
                  <Route
                    path="/deliverables"
                    element={
                      <G k="deliverables">
                        <Work tab="deliverables" />
                      </G>
                    }
                  />
                  <Route
                    path="/tasks"
                    element={
                      <G k="tasks">
                        <Work tab="tasks" />
                      </G>
                    }
                  />
                  <Route
                    path="/automatable"
                    element={
                      <G k="automatable">
                        <Automatable />
                      </G>
                    }
                  />
                  {/* Work Library — checklist/testing plans at the atomic level of work. */}
                  <Route
                    path="/work-library"
                    element={
                      <G k="work-library">
                        <WorkLibrary />
                      </G>
                    }
                  />
                  <Route path="/work" element={<Navigate to="/deliverables" replace />} />
                  {/* Approvals — the creator → approver work queue (held mutations). */}
                  <Route
                    path="/approvals"
                    element={
                      <G k="approvals">
                        <Approvals />
                      </G>
                    }
                  />
                  {/* Regulations — 50-state insurance regulatory baseline (states /
            requirements / coverage lenses) + per-state detail by USPS code. */}
                  <Route
                    path="/regulations"
                    element={
                      <G k="regulations">
                        <Regulations />
                      </G>
                    }
                  />
                  {/* Single-regulation page + the four overview-card insight pages.
                      Static segments outrank the :code param route in v6 matching. */}
                  <Route
                    path="/regulations/requirement/:id"
                    element={
                      <G k="regulations">
                        <RequirementDetail />
                      </G>
                    }
                  />
                  <Route
                    path="/regulations/regulation/:regime"
                    element={
                      <G k="regulations">
                        <RegimeDetail />
                      </G>
                    }
                  />
                  <Route
                    path="/regulations/compliance"
                    element={
                      <G k="regulations">
                        <Compliance />
                      </G>
                    }
                  />
                  {(['jurisdictions', 'catalog', 'rules', 'sources'] as const).map((kind) => (
                    <Route
                      key={kind}
                      path={`/regulations/${kind}`}
                      element={
                        <G k="regulations">
                          <RegulationsInsight kind={kind} />
                        </G>
                      }
                    />
                  ))}
                  <Route
                    path="/regulations/:code"
                    element={
                      <G k="regulations">
                        <RegulationDetail />
                      </G>
                    }
                  />
                  {/* External Interactions — read-only external-party dependency view. */}
                  <Route
                    path="/applications"
                    element={
                      <G k="applications">
                        <Applications />
                      </G>
                    }
                  />
                  <Route
                    path="/applications/kinds/:kind"
                    element={
                      <G k="applications">
                        <ApplicationKind />
                      </G>
                    }
                  />
                  {/* Product Models — the product hierarchy spine (segment →
            LOB / product family → product → version → model component) with
            TOC / Map / List views, mirroring Organization / Value Streams. */}
                  <Route
                    path="/product-models"
                    element={
                      <G k="product-models">
                        <ProductModelHierarchy />
                      </G>
                    }
                  />
                  {/* Dedicated drill page for one product node (any level; a model
            component lays out its elements + source locations). */}
                  <Route
                    path="/product-models/nodes/:id"
                    element={
                      <G k="product-models">
                        <ProductNodeDetail />
                      </G>
                    }
                  />
                  <Route
                    path="/external"
                    element={
                      <G k="third-parties">
                        <External />
                      </G>
                    }
                  />
                  {/* Data Admin + audit trail — permission-gated (SITE_ADMIN always; other
            user types via an explicit data-admin grant). The backend enforces
            the same menu keys via requirePermission. */}
                  <Route
                    path="/admin"
                    element={
                      <G k="data-admin">
                        <Admin />
                      </G>
                    }
                  />
                  {/* User Admin — accounts, permission sets, import, API keys. */}
                  <Route
                    path="/user-admin"
                    element={
                      <G k="user-admin">
                        <UserAdmin />
                      </G>
                    }
                  />
                  <Route
                    path="/audit"
                    element={
                      <G k="data-admin.audit-log">
                        <AuditTrail />
                      </G>
                    }
                  />
                  <Route path="/login" element={<Navigate to="/" replace />} />
                  <Route path="*" element={<CatchAll />} />
                </Routes>
              </Suspense>
            </Layout>
          </BreadcrumbProvider>
        </CompanyProvider>
      </PreferencesProvider>
    </DialogProvider>
  );
}
