// Login — POST /auth/login {email, password} → {token}. Stores the session in
// localStorage and lands on the workbench.
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setSession } from '../lib/api';
import { Button, Card, ErrorMessage, Input, Label } from '../components/ui';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = (await api.post('/auth/login', { email, password })) as {
        token: string;
        user: { email: string };
      };
      setSession(res.token, res.user.email);
      api.invalidate();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-[#fafafa] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-eyebrow uppercase text-[#737373] mb-2">UW Workbench</p>
          <h1 className="text-h1 text-[#171717]">Sign in</h1>
        </div>

        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-sm text-[#525252]">
          New here?{' '}
          <Link to="/signup" className="font-medium text-[#1d4ed8] hover:underline">
            Start an underwriting company in minutes
          </Link>
        </p>

        <p className="mt-6 text-center text-[11px] text-[#a3a3a3]">
          Demo credentials (seeded):{' '}
          <span className="font-mono text-[#737373]">demo@uw-workbench.dev</span> /{' '}
          <span className="font-mono text-[#737373]">underwrite!</span>
        </p>
      </div>
    </div>
  );
}
