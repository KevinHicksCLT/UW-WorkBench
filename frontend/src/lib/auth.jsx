import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
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

  const login = async (email, password) => {
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

export function useAuth() {
  return useContext(AuthContext);
}
