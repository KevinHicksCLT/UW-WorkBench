import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import Login from './pages/login/Login';
import { CompanyProvider, useCompany } from './lib/company';
import { DialogProvider } from './lib/dialogs';
import { PreferencesProvider } from './lib/preferences';
import { Button, Select } from './components/ui';

// The workbench itself stays lazy (route-level code-split); Login is eager so
// the unauthenticated entry path needs no chunk fetch.
const UwWorkbench = lazy(() => import('./pages/uw-workbench/UwWorkbench'));

function hasToken(): boolean {
  return localStorage.getItem('cascade.token') !== null;
}

// Minimal chrome: wordmark, company switcher, sign-out. The platform edition
// hangs the workbench off a multi-module nav; standalone, the workbench IS the
// app, so the shell stays one slim header.
function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { companies, companyId, setCompanyId } = useCompany();
  const signOut = () => {
    localStorage.removeItem('cascade.token');
    localStorage.removeItem('cascade.user');
    navigate('/login');
  };
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 bg-white border-b border-[#eaeaea]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
          <span className="text-sm font-semibold tracking-tight text-[#171717]">UW WorkBench</span>
          <div className="flex items-center gap-2">
            {companies.length > 1 && (
              <Select
                value={companyId ?? ''}
                onChange={(e) => setCompanyId(e.target.value)}
                className="text-xs h-8"
                aria-label="Active company"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
            <Button variant="secondary" className="text-xs" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!hasToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <DialogProvider>
      <PreferencesProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <CompanyProvider>
                  <Shell>
                    <Suspense fallback={<div />}>
                      <Routes>
                        <Route path="/" element={<UwWorkbench />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </Suspense>
                  </Shell>
                </CompanyProvider>
              </RequireAuth>
            }
          />
        </Routes>
      </PreferencesProvider>
    </DialogProvider>
  );
}
