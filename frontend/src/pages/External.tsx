import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';

// External Interactions — read-only view of the external dependency rows
// (vendors, regulators, partners ↔ internal owner roles ↔ value streams).
// Data: GET /external-interactions.

type Interaction = {
  id: string;
  partyType: string;
  externalRole: string;
  internalRoleId: string | null;
  internalRoleName: string | null;
  divisionFunction: string | null;
  interactionType: string | null;
  inputs: string | null;
  outputs: string | null;
  relatedValueStream: string | null;
  dependencyType: string | null;
  frequency: string | null;
  notes: string | null;
};

function Dropdown({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="min-w-[160px]">
      <label className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-1">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none w-full rounded-lg border border-[#eaeaea] bg-white pl-3 pr-8 py-1.5 text-sm text-[#171717] cursor-pointer hover:border-[#d4d4d4] focus:outline-none focus:ring-1 focus:ring-[#171717] transition-colors duration-150"
        >
          {['All', ...options].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a3a3a3]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}

export default function External() {
  const { data, error, loading } = useApi<Interaction[]>('/external-interactions');
  const [partyType, setPartyType] = useState('All');
  const [valueStream, setValueStream] = useState('All');
  const [expanded, setExpanded] = useState<string | null>(null);

  const items = data ?? [];
  const partyTypes = useMemo(() => [...new Set(items.map((i) => i.partyType).filter(Boolean))].sort(), [items]);
  const valueStreams = useMemo(() => [...new Set(items.map((i) => i.relatedValueStream).filter((v): v is string => !!v))].sort(), [items]);

  const filtered = items.filter((i) =>
    (partyType === 'All' || i.partyType === partyType)
    && (valueStream === 'All' || i.relatedValueStream === valueStream)
  );

  if (loading) return <div className="text-sm text-[#a3a3a3]">Loading external interactions…</div>;
  if (error) return <div className="text-sm text-[#be123c]">{error}</div>;

  return (
    <div>
      <PageHeader
        title="Third-Parties"
        subtitle="External parties the operating model depends on — who they touch internally, across which value streams."
      />

      <div className="flex items-end gap-3 flex-wrap mb-5">
        <div className="card px-4 py-3 min-w-[160px]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">External interactions</div>
          <div className="text-2xl font-bold text-[#171717] tnum mt-0.5">{items.length}</div>
        </div>
        <Dropdown label="Party type" value={partyType} onChange={setPartyType} options={partyTypes} />
        <Dropdown label="Value stream" value={valueStream} onChange={setValueStream} options={valueStreams} />
        <span className="text-[11px] text-[#a3a3a3] tnum pb-2 ml-auto">{filtered.length} of {items.length} shown</span>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="border-b border-[#eaeaea] bg-[#fafafa] text-left">
                {['External party', 'Party type', 'Value stream', 'Internal owner', 'Interaction', 'Dependency'].map((h) => (
                  <th key={h} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[#a3a3a3] italic">No interactions match the filters.</td></tr>
              ) : (
                filtered.map((i) => (
                  <Fragment key={i.id}>
                    <tr
                      onClick={() => setExpanded(expanded === i.id ? null : i.id)}
                      className="border-b border-[#f5f5f5] hover:bg-[#fafafa] cursor-pointer align-top"
                    >
                      <td className="px-3 py-2.5 text-[#171717] font-medium max-w-[260px]">
                        <div className="flex items-center gap-1.5">
                          <svg className={'flex-shrink-0 text-[#a3a3a3] transition-transform duration-150 ' + (expanded === i.id ? 'rotate-90' : '')} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                          <span className="leading-tight">{i.externalRole}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#f5f5f5] text-[11px] text-[#525252]">{i.partyType}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[#525252] max-w-[200px] truncate" title={i.relatedValueStream ?? ''}>{i.relatedValueStream ?? '—'}</td>
                      <td className="px-3 py-2.5 text-[#525252] max-w-[220px]">
                        {i.internalRoleId ? (
                          <Link to={`/roles/${i.internalRoleId}`} onClick={(e) => e.stopPropagation()} className="text-[#4338ca] hover:underline">{i.internalRoleName}</Link>
                        ) : (
                          i.internalRoleName ?? '—'
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[#525252] max-w-[200px] truncate" title={i.interactionType ?? ''}>{i.interactionType ?? '—'}</td>
                      <td className="px-3 py-2.5 text-[#525252] whitespace-nowrap">{i.dependencyType ?? '—'}</td>
                    </tr>
                    {expanded === i.id && (
                      <tr className="border-b border-[#f5f5f5] bg-[#fafafa]">
                        <td colSpan={6} className="px-3 py-3">
                          <div className="ml-4 space-y-1.5 text-xs text-[#525252]">
                            {i.divisionFunction && (
                              <div className="flex gap-1.5">
                                <span className="flex-shrink-0 font-semibold text-[#171717]">Division / function:</span>
                                <span>{i.divisionFunction}</span>
                              </div>
                            )}
                            <div className="flex gap-1.5">
                              <span className="flex-shrink-0 rounded bg-[#171717] text-white text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 leading-[14px]">Inputs</span>
                              <span>{i.inputs ?? '—'}</span>
                            </div>
                            <div className="flex gap-1.5">
                              <span className="flex-shrink-0 rounded bg-[#404040] text-white text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 leading-[14px]">Outputs</span>
                              <span>{i.outputs ?? '—'}</span>
                            </div>
                            {i.notes && (
                              <div className="flex gap-1.5">
                                <span className="flex-shrink-0 font-semibold text-[#171717]">Notes:</span>
                                <span>{i.notes}</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
