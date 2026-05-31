// App.tsx

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import DivisionDetail from './pages/DivisionDetail';
import DepartmentDetail from './pages/DepartmentDetail';
import RoleDetail from './pages/RoleDetail';
import ValueStreams from './pages/ValueStreams';
import ValueStreamDetail from './pages/ValueStreamDetail';
import SearchResults from './pages/SearchResults';

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
        <Route path="/" element={<Home />} />
        <Route path="/divisions/:id" element={<DivisionDetail />} />
        <Route path="/departments/:id" element={<DepartmentDetail />} />
        <Route path="/roles/:id" element={<RoleDetail />} />
        <Route path="/value-streams" element={<ValueStreams />} />
        <Route path="/value-streams/:id" element={<ValueStreamDetail />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
