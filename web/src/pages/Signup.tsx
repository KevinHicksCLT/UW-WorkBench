// Signup — the democratization moment. POST /auth/signup provisions a full
// underwriting operation (company, admin seat, roles) and applies a bundled
// starter pack, so the new company is decision-ready before the first refresh.
// GET /uw/packs is auth-gated, so the two bundled starter packs are described
// inline here.
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setSession } from '../lib/api';
import { Button, Card, ErrorMessage, Input, Label } from '../components/ui';

const STARTER_PACKS = [
  {
    slug: 'commercial-property-starter',
    name: 'Commercial Property Starter',
    blurb:
      'A decision-ready commercial property estate: Southeast-flavored appetite, a flood-sublimit guideline rule, and a three-seat authority ladder (Underwriter → Senior Underwriter → CUO).',
    lobs: 'CP · EB · BOP',
  },
  {
    slug: 'mga-delegated-authority',
    name: 'MGA Delegated Authority Starter',
    blurb:
      'An MGA / coverholder operating model: small-commercial GL and BOP appetite with tight authority ceilings, a roofing-operations guideline, and delegable grant templates sized for program business.',
    lobs: 'GL · BOP',
  },
] as const;

const VALUE_BULLETS = [
  {
    title: 'Appetite as code',
    body: 'Versioned, effective-dated appetite statements — every verdict cites the exact statement version it derived from.',
  },
  {
    title: 'Authority as data',
    body: 'Grants bind to roles, never user ids. Every decision passes a pure authority validator; breaches auto-open referrals.',
  },
  {
    title: 'Governed AI',
    body: 'Agents propose, humans disposition. No agent output ever auto-applies — every action lands on the same audit spine.',
  },
  {
    title: 'Append-only audit',
    body: 'The audit IS the event log: an immutable governance spine, correlation-stitched from intake to bind.',
  },
];

type SignupResponse = {
  token: string;
  companyId: string;
  starterPack: {
    slug: string;
    version: string;
    applied: {
      appetiteStatements: number;
      guidelineRules: number;
      authorityGrants: number;
      enrichmentSources: number;
      unresolvedRoles: string[];
    };
  } | null;
};

export default function Signup() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [packSlug, setPackSlug] = useState<string>(STARTER_PACKS[0].slug);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [provisioned, setProvisioned] = useState<SignupResponse | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const res = (await api.post('/auth/signup', {
        companyName: companyName.trim(),
        adminName: adminName.trim(),
        email: email.trim(),
        password,
        starterPackSlug: packSlug,
      })) as SignupResponse;
      setSession(res.token, email.trim().toLowerCase());
      api.invalidate();
      setProvisioned(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // Post-provision interstitial: show what the starter pack seeded, then enter.
  if (provisioned) {
    const applied = provisioned.starterPack?.applied;
    return (
      <div className="min-h-full flex items-center justify-center bg-[#fafafa] px-4 py-10">
        <Card className="w-full max-w-lg p-8 text-center animate-rise-in">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#ecfdf5] text-[#047857] text-lg">
            ✓
          </div>
          <h1 className="text-h2 text-[#171717]">{companyName.trim()} is live</h1>
          <p className="mt-2 text-sm text-[#525252]">
            Your underwriting operation is provisioned and decision-ready
            {provisioned.starterPack
              ? ` — seeded from ${provisioned.starterPack.slug}@${provisioned.starterPack.version}:`
              : '.'}
          </p>
          {applied && (
            <div className="mt-4 grid grid-cols-2 gap-2 text-left">
              {(
                [
                  ['Appetite statements', applied.appetiteStatements],
                  ['Guideline rules', applied.guidelineRules],
                  ['Authority grants', applied.authorityGrants],
                  ['Enrichment sources', applied.enrichmentSources],
                ] as const
              ).map(([label, n]) => (
                <div key={label} className="rounded-md border border-[#eaeaea] bg-white px-3 py-2">
                  <div className="text-lg font-bold text-[#171717] tnum">{n}</div>
                  <div className="text-[11px] text-[#737373]">{label}</div>
                </div>
              ))}
            </div>
          )}
          <Button className="mt-6 w-full" onClick={() => navigate('/')}>
            Open the workbench
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#fafafa] px-4 py-10">
      <div className="mx-auto grid w-full max-w-4xl gap-10 lg:grid-cols-[1fr,minmax(340px,420px)] lg:items-start">
        {/* ── Pitch ──────────────────────────────────────────────────────── */}
        <div>
          <p className="text-eyebrow uppercase text-[#737373] mb-3">UW Workbench · open source</p>
          <h1 className="text-display text-[#171717]">
            Start an underwriting company in minutes
          </h1>
          <p className="mt-4 max-w-lg text-base text-[#525252]">
            One form provisions a complete operation — company, roles, an authority ladder, and a
            community starter pack of appetite and guidelines. Reshape it to your book, then export
            your estate and share it back.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {VALUE_BULLETS.map((b) => (
              <div key={b.title}>
                <h3 className="text-sm font-semibold text-[#171717]">{b.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[#525252]">{b.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Form ───────────────────────────────────────────────────────── */}
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="su-company">Company name</Label>
              <Input
                id="su-company"
                required
                minLength={2}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Blue Ridge Specialty"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="su-name">Your name</Label>
              <Input
                id="su-name"
                required
                minLength={2}
                autoComplete="name"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Alex Rivera"
              />
            </div>
            <div>
              <Label htmlFor="su-email">Email</Label>
              <Input
                id="su-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <Label htmlFor="su-password">Password (min 8 characters)</Label>
              <Input
                id="su-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <fieldset>
              <legend className="label">Starter pack</legend>
              <div className="space-y-2">
                {STARTER_PACKS.map((p) => (
                  <label
                    key={p.slug}
                    className={
                      'flex cursor-pointer items-start gap-2.5 rounded-md border p-3 transition-colors duration-150 ' +
                      (packSlug === p.slug
                        ? 'border-[#171717] bg-white'
                        : 'border-[#eaeaea] bg-white hover:border-[#d4d4d4]')
                    }
                  >
                    <input
                      type="radio"
                      name="starterPack"
                      className="mt-0.5 accent-[#171717]"
                      checked={packSlug === p.slug}
                      onChange={() => setPackSlug(p.slug)}
                    />
                    <span>
                      <span className="block text-[13px] font-semibold text-[#171717]">
                        {p.name} <span className="font-normal text-[#a3a3a3]">· {p.lobs}</span>
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-[#737373]">
                        {p.blurb}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {error && <ErrorMessage>{error}</ErrorMessage>}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Provisioning your company…' : 'Create my underwriting company'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-[#525252]">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-[#1d4ed8] hover:underline">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
