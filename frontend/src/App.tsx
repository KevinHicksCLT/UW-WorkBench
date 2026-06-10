// App.tsx

import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { CompanyProvider } from './lib/company';
import { BreadcrumbProvider } from './lib/breadcrumbs';
import Layout from './components/Layout';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Explorer from './pages/Explorer';
import DivisionDetail from './pages/DivisionDetail';
import DepartmentDetail from './pages/DepartmentDetail';
import Organization from './pages/Organization';
import ValueStreamDetail from './pages/ValueStreamDetail';
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
import External from './pages/External';

// The standalone role page was retired (it repeated the Organization role
// panel) — old /roles/:id links open that panel instead.
function RoleRedirect() {
  const { id } = useParams();
  return <Navigate to={`/roles?role=${encodeURIComponent(id ?? '')}`} replace />;
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
        <Route path="/value-streams/:id" element={<ValueStreamDetail />} />
        <Route path="/search" element={<SearchResults />} />
        {/* Standards & Greenfield Migration — placeholder tabs. */}
        <Route path="/standards" element={<Standards />} />
        <Route path="/standards/:id" element={<StandardArea />} />
        {/* Active AI — heat map of AI adoption across value streams + drill-in. */}
        <Route path="/active-ai" element={<ActiveAI />} />
        <Route path="/active-ai/:id" element={<ActiveAIDetail />} />
        {/* Application Rationalization now lives inside the Initiatives tab.
            Keep a redirect so old /greenfield links still resolve. */}
        <Route path="/greenfield" element={<Navigate to="/portfolio" replace />} />
        {/* Initiatives — strategic-portfolio tracker (Programs → Workstreams →
            Initiatives) integrated with the operating model. Hosts the
            Application Rationalization workspace as its focal feature. */}
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/portfolio/programs/:id" element={<PortfolioProgram />} />
        <Route path="/portfolio/initiatives/:id" element={<PortfolioInitiative />} />
        <Route path="/portfolio/raid" element={<PortfolioRaid />} />
        {/* Deliverables & Tasks — standalone work tracker (banner + filters + table). */}
        <Route path="/work" element={<Work />} />
        {/* External Interactions — read-only external-party dependency view. */}
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
  );
}
