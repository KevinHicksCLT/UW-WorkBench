import type { DrillNodeType } from '../viz/nodes/DrillNode';

export type Frame = { type: DrillNodeType; id: string; name: string };

const TYPE_LABEL: Record<DrillNodeType, string> = {
  company: 'Company', domain: 'Domain', division: 'Division', department: 'Department', valueStream: 'Value Stream',
  subValueStream: 'Sub-Value Stream', processStep: 'Process Step', application: 'Application', initiative: 'Initiative',
  role: 'Role', person: 'Person', task: 'Task',
};

// Path chips (= back). The last chip is the open level (non-interactive).
export default function DrillBreadcrumb({ frames, onJump }: { frames: Frame[]; onJump: (index: number) => void }) {
  return (
    <nav className="flex items-center gap-1 flex-wrap text-sm" aria-label="Drill path">
      {frames.map((f, i) => {
        const last = i === frames.length - 1;
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
              <span className="text-[9px] uppercase tracking-widest font-bold opacity-60">{TYPE_LABEL[f.type]}</span>
              <span className="truncate font-semibold">{f.name}</span>
            </button>
          </span>
        );
      })}
    </nav>
  );
}
