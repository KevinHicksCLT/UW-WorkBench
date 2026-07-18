// Application detail — the drillable page behind every Applications list row.
// Profile (what it does, who uses it, where it's used — all resolved from
// NodeAppUsage on the server) plus the codebase-scan block: attach a
// GitHub/GitLab repo + live URL and the scan agent builds the knowledge base
// that feeds the Workspace map (only scanned applications appear there).
// Data: GET /applications/:id · POST /applications/:id/scan.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useOpenRole } from '../../lib/roleDrawer';
import PageHeader from '../../components/PageHeader';
import {
  BackButton,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Input,
  Label,
  LoadingState,
  StatusPill,
} from '../../components/ui';

type ScanSummary = {
  fetchedAt?: string;
  source?: string;
  fullName?: string;
  description?: string | null;
  defaultBranch?: string;
  sizeKb?: number;
  stars?: number;
  forks?: number;
  openIssues?: number;
  lastPushedAt?: string;
  topics?: string[];
  license?: string | null;
  languages?: Record<string, number>;
  error?: string;
};

type ScanContents = {
  findings: number;
  findingsByLayer: { layer: string; count: number }[];
  common: number;
  moves: number;
  deadCode: number;
  screens: number;
  microservices: { name: string; status: string }[];
};

type Scan = {
  status: string; // NOT_SCANNED | SCANNED
  repoUrl: string | null;
  appUrl: string | null;
  scannedAt: string | null;
  summary: ScanSummary | null;
  contents: ScanContents | null;
};

type AppDetail = {
  id: string;
  code: string | null;
  name: string;
  kind: string;
  category: string | null;
  vendor: string | null;
  criticality: string;
  systemOfRecord: boolean | null;
  illustrative: boolean;
  totalTco: number | null;
  description: string | null;
  division: string | null;
  scan: Scan;
  stats: { taskUsages: number; nodes: number; performed: number; memorialized: number };
  valueStreams: { name: string; count: number }[];
  divisions: { name: string; count: number }[];
  whereUsed: { valueStream: string; l3: string; l4: string; count: number }[];
  roles: { id: string; name: string; count: number }[];
  boards: { id: string; name: string; status: string }[];
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">
    {children}
  </div>
);

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[18px] font-bold text-[#171717] tnum leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-[#a3a3a3]">{label}</div>
    </div>
  );
}

/** Codebase-scan card: repo + app URL inputs, scan action, current status. */
function ScanCard({
  appId,
  scan,
  onScanned,
}: {
  appId: string;
  scan: Scan;
  onScanned: (s: Scan) => void;
}) {
  const [repoUrl, setRepoUrl] = useState(scan.repoUrl ?? '');
  const [appUrl, setAppUrl] = useState(scan.appUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scanned = scan.status === 'SCANNED';

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = (await api.post(`/applications/${appId}/scan`, {
        repoUrl: repoUrl.trim(),
        appUrl: appUrl.trim() || null,
      })) as { scan: Scan };
      onScanned(res.scan);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <SectionLabel>Codebase scan</SectionLabel>
        <StatusPill tone={scanned ? 'green' : 'slate'}>
          {scanned ? 'Scanned' : 'Not scanned'}
        </StatusPill>
      </div>
      <p className="text-[12px] text-[#737373] leading-relaxed mb-3">
        {scanned
          ? 'The agent has access to this codebase; its knowledge base feeds the Workspace map.'
          : 'Point the agent at this application’s repository. It builds a knowledge base used to populate the Workspace map — only scanned applications appear there.'}
      </p>
      <div className="space-y-2.5">
        <div>
          <Label htmlFor="repo-url" className="text-[11px] font-medium text-[#525252]">
            GitHub / GitLab repository URL
          </Label>
          <Input
            id="repo-url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/org/repo"
            className="mt-1 text-[12.5px]"
          />
        </div>
        <div>
          <Label htmlFor="app-url" className="text-[11px] font-medium text-[#525252]">
            Application URL
          </Label>
          <Input
            id="app-url"
            value={appUrl}
            onChange={(e) => setAppUrl(e.target.value)}
            placeholder="https://app.example.com"
            className="mt-1 text-[12.5px]"
          />
        </div>
        {error && <ErrorMessage baseClassName="text-[12px] text-red-600">{error}</ErrorMessage>}
        <Button onClick={submit} disabled={busy || !repoUrl.trim()} className="text-[12px]">
          {busy ? 'Scanning…' : scanned ? 'Re-scan codebase' : 'Save & scan'}
        </Button>
        {scanned && scan.scannedAt && (
          <div className="text-[11px] text-[#a3a3a3]">
            Last scanned {new Date(scan.scannedAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </Card>
  );
}

const LANG_COLORS = ['#0070AD', '#4f46e5', '#0d9488', '#ca8a04', '#9333ea', '#64748b'];

/** What the scan gathered — repo facts from the GitHub/GitLab API plus the
 *  knowledge-base contents derived from this app's Workspace board data. */
function ScanOverview({ scan }: { scan: Scan }) {
  const s = scan.summary;
  const c = scan.contents;
  if (scan.status !== 'SCANNED' || (!s && !c)) return null;

  const langs = Object.entries(s?.languages ?? {}).sort((a, b) => b[1] - a[1]);
  const totalBytes = langs.reduce((n, [, b]) => n + b, 0);
  const top = langs.slice(0, 6);

  return (
    <Card className="p-4">
      <SectionLabel>Scan overview</SectionLabel>

      {s?.error && !s.fullName ? (
        <p className="text-[12px] text-[#b45309]">
          Repository metadata unavailable ({s.error}) — re-scan to retry.
        </p>
      ) : (
        s && (
          <div className="space-y-3">
            {s.description && (
              <p className="text-[12px] text-[#525252] leading-relaxed">{s.description}</p>
            )}
            {totalBytes > 0 && (
              <div>
                <div className="flex h-2 rounded-full overflow-hidden bg-[#f0f0f0] mb-1.5">
                  {top.map(([lang, bytes], i) => (
                    <span
                      key={lang}
                      title={lang}
                      style={{
                        width: `${(bytes / totalBytes) * 100}%`,
                        background: LANG_COLORS[i % LANG_COLORS.length],
                      }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {top.map(([lang, bytes], i) => (
                    <span
                      key={lang}
                      className="inline-flex items-center gap-1 text-[10.5px] text-[#525252]"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: LANG_COLORS[i % LANG_COLORS.length] }}
                      />
                      {lang}{' '}
                      <span className="tnum text-[#a3a3a3]">
                        {Math.round((bytes / totalBytes) * 100)}%
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[#525252]">
              {s.fullName && (
                <div className="col-span-2 truncate">
                  <span className="text-[#a3a3a3]">Repo</span> {s.fullName}
                </div>
              )}
              {s.defaultBranch && (
                <div>
                  <span className="text-[#a3a3a3]">Branch</span> {s.defaultBranch}
                </div>
              )}
              {s.sizeKb != null && (
                <div>
                  <span className="text-[#a3a3a3]">Size</span>{' '}
                  {s.sizeKb > 1024 ? `${(s.sizeKb / 1024).toFixed(1)} MB` : `${s.sizeKb} KB`}
                </div>
              )}
              {s.lastPushedAt && (
                <div>
                  <span className="text-[#a3a3a3]">Last push</span>{' '}
                  {new Date(s.lastPushedAt).toLocaleDateString()}
                </div>
              )}
              {s.license && (
                <div>
                  <span className="text-[#a3a3a3]">License</span> {s.license}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {c && (
        <div className={s ? 'mt-3 pt-3 border-t border-[#f0f0f0]' : ''}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">
            Knowledge base
          </div>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <Stat label="Decomposed steps" value={c.findings.toLocaleString()} />
            <Stat label="Screens mapped" value={c.screens.toLocaleString()} />
            <Stat label="Stay as-is" value={c.common.toLocaleString()} />
            <Stat label="Move / retire" value={c.moves.toLocaleString()} />
          </div>
          {c.findingsByLayer.length > 0 && (
            <div className="space-y-0.5">
              {c.findingsByLayer.map((l) => (
                <div key={l.layer} className="flex items-baseline justify-between text-[11px]">
                  <span className="text-[#525252]">{l.layer}</span>
                  <span className="tnum text-[#737373]">{l.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const { data, error, loading } = useApi<AppDetail>(id ? `/applications/${id}` : null);
  const [scanOverride, setScanOverride] = useState<Scan | null>(null);
  const openRole = useOpenRole();

  if (loading) return <LoadingState message="Loading application…" />;
  if (error || !data)
    return (
      <ErrorMessage baseClassName="text-sm text-red-600">Failed to load application.</ErrorMessage>
    );

  const app = data;
  const scan = scanOverride ?? app.scan;
  const sub = [app.vendor, app.category, app.division].filter(Boolean).join(' · ');

  return (
    <div>
      <BackButton className="mb-3" />
      <PageHeader eyebrow="Application" title={app.name} subtitle={sub || undefined} />

      <div className="flex flex-wrap items-center gap-1.5 -mt-2 mb-4">
        <StatusPill tone="blue">{app.kind}</StatusPill>
        <StatusPill
          tone={app.criticality === 'High' ? 'red' : app.criticality === 'Low' ? 'slate' : 'amber'}
        >
          {app.criticality} criticality
        </StatusPill>
        {app.systemOfRecord && <StatusPill tone="green">System of record</StatusPill>}
        <StatusPill tone={scan.status === 'SCANNED' ? 'green' : 'slate'}>
          {scan.status === 'SCANNED' ? 'Scanned' : 'Not scanned'}
        </StatusPill>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* ── Profile ── */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 border-[#cde3f5] bg-[#f2f8fd]">
            <SectionLabel>What it does</SectionLabel>
            <p className="text-sm text-[#171717] leading-relaxed">
              {app.description ?? 'No description yet — a codebase scan fills this in.'}
            </p>
          </Card>

          <Card className="p-4">
            <SectionLabel>Where it’s used</SectionLabel>
            {app.valueStreams.length ? (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {app.valueStreams.map((v) => (
                  <Link
                    key={v.name}
                    to={`/overview?vs=${encodeURIComponent(v.name)}`}
                    className="inline-flex items-center gap-1 rounded-full bg-[#eef6fb] text-[#0070AD] border border-[#cde3f5] px-2 py-0.5 text-[11px] font-medium hover:bg-[#dceaf7] transition-colors"
                  >
                    {v.name}
                    <span className="tnum text-[#7db4d6]">{v.count}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                baseClassName="text-sm text-[#a3a3a3] italic"
                message="Not mapped to any process yet."
              />
            )}
            {app.whereUsed.length > 0 && (
              <div className="border-t border-[#f0f0f0] pt-2">
                {app.whereUsed.slice(0, 12).map((w) => (
                  <div
                    key={`${w.valueStream}|${w.l4}`}
                    className="flex items-baseline gap-2 py-1 border-b border-[#f7f7f7] last:border-0"
                  >
                    <span className="text-[12.5px] text-[#171717] font-medium truncate">
                      {w.l4}
                    </span>
                    <span className="text-[11px] text-[#a3a3a3] truncate flex-1">
                      {w.valueStream}
                      {w.l3 ? ` › ${w.l3}` : ''}
                    </span>
                    <span className="text-[11px] tnum text-[#737373] flex-shrink-0">
                      {w.count} task{w.count === 1 ? '' : 's'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <SectionLabel>Who uses it</SectionLabel>
            {app.roles.length ? (
              <div className="flex flex-wrap gap-1.5">
                {app.roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => openRole(r.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-[#eef2ff] text-[#4338ca] border border-[#d6dcff] px-2 py-0.5 text-[11px] font-medium hover:bg-[#e0e7ff] transition-colors"
                  >
                    {r.name}
                    <span className="tnum text-[#a5b0f0]">{r.count}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                baseClassName="text-sm text-[#a3a3a3] italic"
                message="No roles resolved from process steps."
              />
            )}
          </Card>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          <Card className="p-4">
            <SectionLabel>Usage</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Task usages" value={app.stats.taskUsages.toLocaleString()} />
              <Stat label="Process nodes" value={app.stats.nodes.toLocaleString()} />
              <Stat label="Performed in" value={app.stats.performed.toLocaleString()} />
              <Stat label="Memorialized in" value={app.stats.memorialized.toLocaleString()} />
            </div>
            {app.totalTco != null && (
              <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
                <Stat
                  label="Run cost / yr"
                  value={`$${Math.round(app.totalTco / 1000).toLocaleString()}K`}
                />
              </div>
            )}
          </Card>

          <ScanCard
            appId={app.id}
            scan={scan}
            // POST /scan returns contents: null (board data derives on read) —
            // keep whatever the page already loaded so the overview stays put.
            onScanned={(s) => setScanOverride({ ...s, contents: app.scan.contents })}
          />
          <ScanOverview scan={scan} />

          {(scan.repoUrl || scan.appUrl) && (
            <Card className="p-4">
              <SectionLabel>Links</SectionLabel>
              <div className="space-y-1.5">
                {scan.repoUrl && (
                  <a
                    href={scan.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-[12px] text-[#0070AD] hover:underline truncate"
                  >
                    {scan.repoUrl}
                  </a>
                )}
                {scan.appUrl && (
                  <a
                    href={scan.appUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-[12px] text-[#0070AD] hover:underline truncate"
                  >
                    {scan.appUrl}
                  </a>
                )}
              </div>
            </Card>
          )}

          {app.boards.length > 0 && (
            <Card className="p-4">
              <SectionLabel>Workspace boards</SectionLabel>
              <div className="space-y-1.5">
                {app.boards.map((b) => (
                  <Link
                    key={b.id}
                    to="/portfolio"
                    className="flex items-center justify-between gap-2 text-[12.5px] text-[#171717] hover:text-[#0070AD] transition-colors"
                  >
                    <span className="truncate font-medium">{b.name}</span>
                    <span className="text-[11px] text-[#a3a3a3] flex-shrink-0">{b.status}</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
