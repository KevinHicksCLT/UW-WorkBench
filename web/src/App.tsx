// App shell — unauthenticated routes (/login, /signup) plus the authenticated
// layout: a slim top bar (product name, user email, logout) over the UW
// Workbench page, which carries its own internal tabs.
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DialogProvider } from './lib/dialogs';
import { api, clearSession, getSessionEmail, getToken } from './lib/api';
import Login from './pages/Login';
import Signup from './pages/Signup';
import UwWorkbench from './pages/uw-workbench/UwWorkbench';

function RequireAuth({ children }: { children: ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function TopBar() {
  const navigate = useNavigate();
  const email = getSessionEmail();

  function logout() {
    clearSession();
    api.invalidate();
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#eaeaea] bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2 text-sm font-semibold text-[#171717]">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 items-center justify-center rounded-md bg-[#171717] text-[10px] font-bold text-white"
          >
            UW
          </span>
          UW Workbench
        </a>
        <div className="flex-1" />
        {email && (
          <span className="hidden truncate text-xs text-[#737373] sm:block" title={email}>
            {email}
          </span>
        )}
        <button
          type="button"
          onClick={logout}
          className="rounded-md border border-[#eaeaea] bg-white px-2.5 py-1 text-xs font-medium text-[#525252] transition-colors duration-150 hover:border-[#d4d4d4] hover:bg-[#fafafa] hover:text-[#171717]"
        >
          Log out
        </button>
      </div>
    </header>
  );
}

function Workbench() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <UwWorkbench />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DialogProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Workbench />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DialogProvider>
    </BrowserRouter>
  );
}
