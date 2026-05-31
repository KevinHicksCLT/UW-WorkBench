import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { AuthUser } from '@cascade/shared';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const u = localStorage.getItem('cascade.user');
    return u ? JSON.parse(u) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('cascade.token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then((u) => {
        setUser(u);
        localStorage.setItem('cascade.user', JSON.stringify(u));
      })
      .catch(() => {
        localStorage.removeItem('cascade.token');
        localStorage.removeItem('cascade.user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<AuthUser> => {
    const { token, user } = await api.post('/auth/login', { email, password });
    localStorage.setItem('cascade.token', token);
    localStorage.setItem('cascade.user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('cascade.token');
    localStorage.removeItem('cascade.user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
