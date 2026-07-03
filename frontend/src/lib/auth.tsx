import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, setForbiddenHandler } from './api';
import type {
  AuthUser,
  EffectivePermissions,
  MeResponse,
  MenuKey,
  UserAttributes,
} from '@cascade/shared';

// AuthProvider owns the /auth/me session payload: identity + effective
// permissions + ABAC attributes + start page. Permissions are a snapshot —
// bounded-staleness mitigations: refreshMe() after admin permission edits, a
// throttled window-focus revalidate, and a one-shot refresh on any API 403.
// The server re-checks every request regardless; the client copy only shapes UI.

type AuthContextValue = {
  user: AuthUser | null;
  permissions: EffectivePermissions | null;
  attributes: UserAttributes | null;
  startPage: MenuKey;
  loading: boolean;
  login: (email: string, password: string) => Promise<MeResponse>;
  logout: () => void;
  refreshMe: () => Promise<MeResponse | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const FOCUS_REVALIDATE_MS = 5 * 60_000;

// cascade.user now stores the whole MeResponse. A legacy plain-AuthUser value
// (pre-entitlements session) still parses — permissions stay null until the
// mount-time /auth/me resolves, which is the same first-paint path as before.
function readStored(): MeResponse | null {
  try {
    const raw = localStorage.getItem('cascade.user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MeResponse | AuthUser;
    if ('user' in parsed && typeof parsed.user === 'object') return parsed as MeResponse;
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(readStored);
  const [loading, setLoading] = useState(true);
  const lastFetch = useRef(0);

  const applyMe = useCallback((m: MeResponse) => {
    lastFetch.current = Date.now();
    setMe(m);
    localStorage.setItem('cascade.user', JSON.stringify(m));
  }, []);

  const refreshMe = useCallback(async (): Promise<MeResponse | null> => {
    try {
      // Bypass the GET cache — a refresh exists to observe server-side change.
      api.invalidate('/auth/me');
      const m = await api.get<MeResponse>('/auth/me');
      applyMe(m);
      return m;
    } catch {
      return null; // 401 already redirected via api.ts; other failures keep the snapshot
    }
  }, [applyMe]);

  useEffect(() => {
    const token = localStorage.getItem('cascade.token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<MeResponse>('/auth/me')
      .then(applyMe)
      .catch(() => {
        localStorage.removeItem('cascade.token');
        localStorage.removeItem('cascade.user');
        setMe(null);
      })
      .finally(() => setLoading(false));
  }, [applyMe]);

  // Throttled focus revalidation + one-shot 403 refresh.
  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastFetch.current > FOCUS_REVALIDATE_MS) void refreshMe();
    };
    window.addEventListener('focus', onFocus);
    setForbiddenHandler(() => void refreshMe());
    return () => {
      window.removeEventListener('focus', onFocus);
      setForbiddenHandler(null);
    };
  }, [refreshMe]);

  const login = async (email: string, password: string): Promise<MeResponse> => {
    const { token } = (await api.post('/auth/login', { email, password })) as { token: string };
    localStorage.setItem('cascade.token', token);
    api.invalidate('/auth/me');
    const m = await api.get<MeResponse>('/auth/me');
    applyMe(m);
    setLoading(false);
    return m;
  };

  const logout = () => {
    localStorage.removeItem('cascade.token');
    localStorage.removeItem('cascade.user');
    setMe(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user: me?.user ?? null,
        permissions: me?.permissions ?? null,
        attributes: me?.attributes ?? null,
        startPage: me?.startPage ?? 'home',
        loading,
        login,
        logout,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
