import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EmptyState, ErrorMessage, SkeletonLoader } from './ui';

// TestingTemplateModal — surfaces a ProcessNode's testing-template rows. Each
// template's "Testing Plan" is parsed into specific tests rendered as
// key/value pairs — the test directive is the key, its "Pass = …" answer is
// the value. Generic pattern steps are parsed but not surfaced to users.
// Client-side CSV export.

type SpecificTest = { system: string | null; directive: string; pass: string | null };
type Template = {
  id: string;
  deliverable: string | null;
  task: string | null;
  system: string | null;
  location: string | null;
  checkType: string | null;
  expected: string | null;
  parsed: { genericPattern: string[]; specificTests: SpecificTest[] };
};

type Payload = { node: { id: string; name: string }; total: number; templates: Template[] };

const META: { key: keyof Template; label: string }[] = [
  { key: 'deliverable', label: 'Deliverable' },
  { key: 'task', label: 'Task' },
  { key: 'system', label: 'System' },
  { key: 'location', label: 'Location' },
  { key: 'checkType', label: 'Check type' },
];

function csvCell(v: string | null): string {
  const s = v ?? '';
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Flatten every parsed specific test into one row each so the export is the
// structured key/value form, not the raw blob. Generic pattern steps are not
// included — only item-specific tests are shown to users.
function downloadCsv(node: string, templates: Template[]) {
  const header = [
    'Deliverable',
    'Task',
    'Section',
    '#',
    'System',
    'Test / Directive',
    'Pass / Answer',
  ];
  const lines: string[] = [];
  for (const t of templates) {
    t.parsed.specificTests.forEach((s, i) =>
      lines.push(
        [t.deliverable, t.task, 'Specific test', String(i + 1), s.system, s.directive, s.pass]
          .map(csvCell)
          .join(','),
      ),
    );
    // Fallback: if nothing parsed, keep the raw expected text on one row.
    if (!t.parsed.genericPattern.length && !t.parsed.specificTests.length) {
      lines.push(
        [t.deliverable, t.task, 'Expected', '', t.system, t.expected, ''].map(csvCell).join(','),
      );
    }
  }
  const blob = new Blob([[header.join(','), ...lines].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const slug =
    node
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'node';
  const a = document.createElement('a');
  a.href = url;
  a.download = `testing-templates-${slug}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function TestingTemplateModal({
  nodeId,
  onClose,
}: {
  nodeId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api
      .get<Payload>(`/explorer/testing-templates/${nodeId}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [nodeId]);

  const templates = data?.templates ?? [];

  return (
    <div className="absolute inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop dims the canvas; click to dismiss. */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <aside
        className="relative h-full bg-white border-l border-[#eaeaea] shadow-2xl flex flex-col"
        style={{ width: 600, maxWidth: '94vw' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#eaeaea] flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a3a3a3]">
              Testing template
            </div>
            <div className="text-[15px] font-bold text-[#171717] leading-snug flex items-center gap-1.5">
              {data?.node.name ?? 'Loading…'}
              {data && (
                <span className="text-[#a3a3a3] font-normal tabular-nums">({data.total})</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {templates.length > 0 && (
              <button
                onClick={() => downloadCsv(data!.node.name, templates)}
                className="inline-flex items-center gap-1 rounded-md border border-[#dbe7ff] bg-[#f5f8ff] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#1d4ed8] hover:bg-[#eaf1ff] transition-colors duration-150"
              >
                Download CSV
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="flex-shrink-0"
                >
                  <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 text-[#a3a3a3] hover:text-[#171717] w-7 h-7 rounded-md hover:bg-[#fafafa] flex items-center justify-center"
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
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {error ? (
            <ErrorMessage>{error}</ErrorMessage>
          ) : !data ? (
            <SkeletonLoader count={5} height={72} className="space-y-2" />
          ) : templates.length === 0 ? (
            <EmptyState
              baseClassName="text-sm text-[#a3a3a3] italic"
              message="No testing templates for this node."
            />
          ) : (
            <div className="space-y-4">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border border-[#eaeaea] bg-white overflow-hidden"
                >
                  {/* Meta key/value */}
                  <dl className="divide-y divide-[#f0f0f0] bg-[#fafafa]">
                    {META.map((c) => (
                      <div key={c.key} className="flex items-start gap-3 px-3 py-1.5">
                        <dt className="flex-shrink-0 w-[84px] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] pt-0.5">
                          {c.label}
                        </dt>
                        <dd className="flex-1 min-w-0 text-[12.5px] text-[#171717] leading-snug break-words">
                          {(t[c.key] as string | null) || <span className="text-[#cbcbcb]">—</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {/* Specific tests — key (directive) / value (pass answer) */}
                  {t.parsed.specificTests.length > 0 && (
                    <div className="px-3 py-2.5 border-t border-[#eaeaea]">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1.5">
                        Specific tests
                      </div>
                      <div className="space-y-2">
                        {t.parsed.specificTests.map((s, i) => (
                          <div
                            key={i}
                            className="rounded-md border border-[#eaeaea] bg-[#fafafa] px-2.5 py-2"
                          >
                            <div className="flex items-start gap-2">
                              <span className="flex-shrink-0 w-4 h-4 mt-0.5 rounded-full bg-[#171717] text-white text-[9px] font-semibold grid place-items-center tabular-nums">
                                {i + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="text-[12.5px] font-medium text-[#171717] leading-snug break-words">
                                  {s.directive}
                                </div>
                                {s.system && (
                                  <span className="inline-block mt-1 rounded bg-[#eef3ff] text-[#1d4ed8] text-[10px] font-semibold px-1.5 py-0.5">
                                    {s.system}
                                  </span>
                                )}
                                {s.pass && (
                                  <div className="mt-1 text-[11.5px] text-[#15803d] leading-snug break-words">
                                    {s.pass}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw fallback when nothing parsed. */}
                  {t.parsed.genericPattern.length === 0 &&
                    t.parsed.specificTests.length === 0 &&
                    t.expected && (
                      <div className="px-3 py-2.5 border-t border-[#eaeaea] text-[12.5px] text-[#525252] whitespace-pre-wrap break-words">
                        {t.expected}
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
