// App.tsx

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Portfolio from './pages/Portfolio';
import Programs from './pages/Programs';
import ProgramDetail from './pages/ProgramDetail';
import InitiativeDetail from './pages/InitiativeDetail';
import RaidLog from './pages/RaidLog';
import Okrs from './pages/Okrs';
import Rules from './pages/Rules';
import Audit from './pages/Audit';

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
