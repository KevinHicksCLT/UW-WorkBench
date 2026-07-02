import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';

// Active-company context. Every company's operating-model data is isolated, so
// the whole authenticated app views and edits one company at a time. The choice
// persists in localStorage and is threaded into the dashboard + admin APIs.

export type CompanyOption = { id: string; name: string };

type CompanyContextValue = {
  companies: CompanyOption[];
  companyId: string | null;
  company: CompanyOption | null;
  setCompanyId: (id: string) => void;
  loading: boolean;
  refresh: () => void;
};

const STORAGE_KEY = 'cascade.companyId';
const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyId, setCompanyIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(true);

  const setCompanyId = (id: string) => {
    setCompanyIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
    api.invalidate(); // drop cached GETs so the newly-selected company loads fresh
  };

  const refresh = () => {
    setLoading(true);
    api.get<{ id: string; name: string }[]>('/companies')
      .then((list) => {
        const opts = list.map((c) => ({ id: c.id, name: c.name }));
        setCompanies(opts);
        // Keep the stored choice if still valid, else default to the first company.
        setCompanyIdState((prev) => {
          const valid = prev && opts.some((o) => o.id === prev) ? prev : opts[0]?.id ?? null;
          if (valid) localStorage.setItem(STORAGE_KEY, valid);
          return valid;
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const company = companies.find((c) => c.id === companyId) ?? null;

  return (
    <CompanyContext.Provider value={{ companies, companyId, company, setCompanyId, loading, refresh }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within a CompanyProvider');
  return ctx;
}
