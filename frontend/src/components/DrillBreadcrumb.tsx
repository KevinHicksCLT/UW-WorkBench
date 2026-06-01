import type { DrillNodeType } from '../viz/nodes/DrillNode';
import { DOMAIN_HEX } from '../viz/nodes/DrillNode';

export type Frame = { type: DrillNodeType; id: string; name: string; domainCategory?: string };

const TYPE_LABEL: Record<DrillNodeType, string> = {
  company: 'Company', domain: 'Domain', division: 'Division', department: 'Department', valueStream: 'Value Stream',
  subValueStream: 'Sub-Value Stream', processStep: 'Process Step', application: 'Application', initiative: 'Initiative',
  role: 'Role', person: 'Person', task: 'Task',
};

// Derive a persistent domain color from a frame — once we're inside a division or
// department the domain hue carries forward so the CEO always knows which domain
// they're exploring. Earlier frames in the path may not have a domain.
function resolveDomainColor(frames: Frame[], upTo: number): string | undefined {
  for (let i = upTo; i >= 0; i--) {
    const cat = frames[i].domainCategory;
    if (cat && DOMAIN_HEX[cat]) return DOMAIN_HEX[cat];
  }
  return undefined;
}

// Path chips (= back). The last chip is the open level (non-interactive).
export default function DrillBreadcrumb({ frames, onJump }: { frames: Frame[]; onJump: (index: number) => void }) {
  return (
    <nav className="flex items-center gap-1 flex-wrap text-sm" aria-label="Drill path">
      {frames.map((f, i) => {
        const last = i === frames.length - 1;
        const domainColor = resolveDomainColor(frames, i);
        return (
          <span key={`${f.type}:${f.id}:${i}`} className="flex items-center gap-1 min-w-0">
            {i > 0 && <span className="text-slate-300 select-none px-0.5">/</span>}
            <button
              onClick={() => !last && onJump(i)}
              disabled={last}
              title={`${TYPE_LABEL[f.type]}: ${f.name}`}
              className={
                'group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 max-w-[15rem] transition-colors ' +
                (last
                  ? 'bg-accent-50 text-accent-800 cursor-default'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800')
              }
            >
              {/* Domain color dot — visible when inside a CEO domain */}
              {domainColor && (
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: domainColor }}
                  aria-hidden="true"
                />
              )}
              <span className="text-[9px] uppercase tracking-widest font-bold opacity-60">{TYPE_LABEL[f.type]}</span>
              <span className="truncate font-semibold">{f.name}</span>
            </button>
          </span>
        );
      })}
    </nav>
  );
}
