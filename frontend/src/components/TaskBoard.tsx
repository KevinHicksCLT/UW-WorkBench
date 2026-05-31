const STATUS_TONE: Record<string, string> = {
  'Done': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'In Progress': 'bg-accent-50 text-accent-700 border-accent-200',
  'To Do': 'bg-slate-100 text-slate-600 border-slate-200',
  'Blocked': 'bg-red-50 text-red-700 border-red-200',
};

// Leaf level: a single task. No further children.
export default function TaskBoard({ node }: { node: any }) {
  const what = node.lenses.what ?? {};
  const who = node.lenses.who ?? {};
  return (
    <div className="h-full w-full grid place-items-center rounded-2xl border border-slate-200/70 bg-surface-sunken p-6 animate-fade-in">
      <div className="card-elevated p-6 max-w-lg w-full">
        <div className="flex items-center gap-2 mb-3">
          <span className={`chip border ${STATUS_TONE[what.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{what.status}</span>
          <span className="illustrative-badge ml-auto">Illustrative</span>
        </div>
        <h2 className="text-h3 text-slate-900">{node.name}</h2>
        {who.assignee && <div className="text-sm text-slate-500 mt-2">Assigned to {who.assignee.name}</div>}
      </div>
    </div>
  );
}
