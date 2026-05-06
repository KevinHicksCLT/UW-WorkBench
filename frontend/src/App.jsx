// App.jsx

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Portfolio from './pages/Portfolio.jsx';
import Programs from './pages/Programs.jsx';
import ProgramDetail from './pages/ProgramDetail.jsx';
import InitiativeDetail from './pages/InitiativeDetail.jsx';
import RaidLog from './pages/RaidLog.jsx';
import Okrs from './pages/Okrs.jsx';
import Rules from './pages/Rules.jsx';
import Audit from './pages/Audit.jsx';

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
    <Layout>
      <Routes>
        <Route path="/" element={<Portfolio />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/programs/:id" element={<ProgramDetail />} />
        <Route path="/initiatives/:id" element={<InitiativeDetail />} />
        <Route path="/raid" element={<RaidLog />} />
        <Route path="/okrs" element={<Okrs />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
