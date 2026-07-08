// AppDrawer — right-hand slide-over for one application, shared by the
// Applications list and the kind drill page. All data is already in the list
// row, so the drawer just presents it — no extra fetch.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useOpenRole } from '../../lib/roleDrawer';
import { EmptyState } from '../../components/ui';

export type App = {
  id: string;
  code: string | null;
  name: string;
  kind: string;
  category: string | null;
  vendor: string | null;
  criticality: string;
  description: string | null;
  systemOfRecord: boolean | null;
  illustrative: boolean;
  totalTco: number | null;
  primaryDivisionName: string | null;
  stepUsages: number;
  sorDeliverables: number;
  valueStreams: string[];
  roles: { id: string; name: string }[];
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">
    {children}
  </div>
);

export default function AppDrawer({ app, onClose }: { app: App; onClose: () => void }) {
  const openRole = useOpenRole();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sub = [app.vendor, app.category, app.primaryDivisionName].filter(Boolean).join(' · ');
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside
        className="relative h-full bg-white border-l border-[#eaeaea] shadow-2xl flex flex-col"
        style={{ width: 480, maxWidth: '92vw' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#eaeaea] border-t-[3px] border-t-[#0070AD] flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0070AD]">
                Application
              </span>
              {app.systemOfRecord && (
                <span className="text-[9px] font-semibold uppercase tracking-wide text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] rounded px-1 py-0.5">
                  System of record
                </span>
              )}
            </div>
            <div className="text-[15px] font-bold text-[#171717] leading-snug mt-0.5">
              {app.name}
            </div>
            {sub && <div className="text-[11px] text-[#a3a3a3] mt-0.5">{sub}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex-shrink-0 text-[#a3a3a3] hover:text-[#171717] w-7 h-7 rounded-md hover:bg-[#fafafa] flex items-center justify-center"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="rounded-lg border border-[#cde3f5] bg-[#f2f8fd] p-3">
            <SectionLabel>What it does</SectionLabel>
            <p className="text-sm text-[#171717] leading-relaxed">{app.description}</p>
          </div>

          <div>
            <SectionLabel>Value streams</SectionLabel>
            {app.valueStreams.length ? (
              <div className="flex flex-wrap gap-1.5">
                {app.valueStreams.map((v) => (
                  <Link
                    key={v}
                    to={`/overview?vs=${encodeURIComponent(v)}`}
                    className="inline-flex items-center rounded-full bg-[#eef6fb] text-[#0070AD] border border-[#cde3f5] px-2 py-0.5 text-[11px] font-medium hover:bg-[#dceaf7] transition-colors"
                  >
                    {v}
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState baseClassName="text-sm text-[#a3a3a3] italic" message="None mapped." />
            )}
          </div>

          <div>
            <SectionLabel>Roles that use it</SectionLabel>
            {app.roles.length ? (
              <div className="flex flex-wrap gap-1.5">
                {app.roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => openRole(r.id)}
                    className="inline-flex items-center rounded-full bg-[#eef2ff] text-[#4338ca] border border-[#d6dcff] px-2 py-0.5 text-[11px] font-medium hover:bg-[#e0e7ff] transition-colors"
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                baseClassName="text-sm text-[#a3a3a3] italic"
                message="None resolved from process steps."
              />
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
