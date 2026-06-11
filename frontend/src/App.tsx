// App.tsx

import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { CompanyProvider } from './lib/company';
import { DialogProvider } from './lib/dialogs';
import { BreadcrumbProvider } from './lib/breadcrumbs';
import Layout from './components/Layout';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Explorer from './pages/Explorer';
import DivisionDetail from './pages/DivisionDetail';
import DepartmentDetail from './pages/DepartmentDetail';
import Organization from './pages/Organization';
import SearchResults from './pages/SearchResults';
import Admin from './pages/Admin';
import AuditTrail from './pages/AuditTrail';
import Standards from './pages/Standards';
import StandardArea from './pages/StandardArea';
import ActiveAI from './pages/ActiveAI';
import ActiveAIDetail from './pages/ActiveAIDetail';
import Portfolio from './pages/Portfolio';
import PortfolioProgram from './pages/PortfolioProgram';
import PortfolioInitiative from './pages/PortfolioInitiative';
import PortfolioRaid from './pages/PortfolioRaid';
import Work from './pages/Work';
import Applications from './pages/Applications';
import External from './pages/External';
import Regulations from './pages/Regulations';
import RegulationDetail from './pages/RegulationDetail';

// The standalone role page was retired (it repeated the Organization role
// panel) — old /roles/:id links open that panel instead.
function RoleRedirect() {
  const { id } = useParams();
  return <Navigate to={`/roles?role=${encodeURIComponent(id ?? '')}`} replace />;
}

// The standalone value-stream page was retired too — its detail renders as an
// in-place drawer on the map/list view. Old links land on the focused map.
function ValueStreamRedirect() {
  const { id } = useParams();
  return <Navigate to={`/overview?focus=${encodeURIComponent(id ?? '')}`} replace />;
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

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500">
        Loading…
      </div>
    );
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
    <CompanyProvider>
    <BreadcrumbProvider>
    <Layout>
      <Routes>
        {/* Home IS the executive dashboard — the application landing. */}
        <Route path="/" element={<Overview />} />
        {/* Value Streams IS the Operating Model Explorer (drill-down diagram).
            `/n/*` carries the drill path (deep-linkable). */}
        <Route path="/overview" element={<Explorer />} />
        <Route path="/n/*" element={<Explorer />} />
        <Route path="/explorer" element={<Navigate to="/overview" replace />} />
        {/* Roles & people — interactive table (org groupings → person, value-stream cross-link). */}
        <Route path="/roles" element={<Organization />} />
        {/* Detail pages remain as deep-link targets from inspector + search. */}
        <Route path="/divisions/:id" element={<DivisionDetail />} />
        <Route path="/departments/:id" element={<DepartmentDetail />} />
        <Route path="/roles/:id" element={<RoleRedirect />} />
        <Route path="/value-streams/:id" element={<ValueStreamRedirect />} />
        <Route path="/search" element={<SearchResults />} />
        {/* Standards & Greenfield Migration — placeholder tabs. */}
        <Route path="/standards" element={<Standards />} />
        <Route path="/standards/:id" element={<StandardArea />} />
        {/* Metrics (formerly Telemetry) — AI adoption heat map + drill-in.
            Old /active-ai links redirect. */}
        <Route path="/metrics" element={<ActiveAI />} />
        <Route path="/metrics/:id" element={<ActiveAIDetail />} />
        <Route path="/active-ai" element={<Navigate to="/metrics" replace />} />
        <Route path="/active-ai/:id" element={<ActiveAIRedirect />} />
        {/* Application Rationalization now lives inside the Initiatives tab.
            Keep a redirect so old /greenfield links still resolve. */}
        <Route path="/greenfield" element={<Navigate to="/portfolio" replace />} />
        {/* Initiatives — strategic-portfolio tracker (Programs → Workstreams →
            Initiatives) integrated with the operating model. Hosts the
            Application Rationalization workspace as its focal feature. */}
        <Route path="/portfolio" element={<Portfolio />} />
        {/* Portfolio drill-downs live under Home — the command-center widgets
            on the dashboard are their entry point (not the Workspace tab). */}
        <Route path="/programs/:id" element={<PortfolioProgram />} />
        <Route path="/initiatives/:id" element={<PortfolioInitiative />} />
        <Route path="/raid" element={<PortfolioRaid />} />
        <Route path="/portfolio/programs/:id" element={<PortfolioDetailRedirect base="programs" />} />
        <Route path="/portfolio/initiatives/:id" element={<PortfolioDetailRedirect base="initiatives" />} />
        <Route path="/portfolio/raid" element={<Navigate to="/raid" replace />} />
        {/* Deliverables & Tasks — standalone work tracker (banner + filters + table). */}
        <Route path="/work" element={<Work />} />
        {/* Regulations — 50-state insurance regulatory baseline (states /
            requirements / coverage lenses) + per-state detail by USPS code. */}
        <Route path="/regulations" element={<Regulations />} />
        <Route path="/regulations/:code" element={<RegulationDetail />} />
        {/* External Interactions — read-only external-party dependency view. */}
        <Route path="/applications" element={<Applications />} />
        <Route path="/external" element={<External />} />
        {/* ADMIN-only data administration + audit trail. The Data Dictionary now
            lives inside the Data Admin tab as a view. The backend also gates
            every /admin and write endpoint behind requireRole('ADMIN'). */}
        {user.role === 'ADMIN' && <Route path="/admin" element={<Admin />} />}
        {user.role === 'ADMIN' && <Route path="/audit" element={<AuditTrail />} />}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
    </BreadcrumbProvider>
    </CompanyProvider>
    </DialogProvider>
  );
}
