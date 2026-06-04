// Lightweight, dependency-free chart renderer for the assistant. The model can
// emit a ```chart fenced block holding a small JSON spec; we render it as an
// inline SVG bar / line / pie chart. Kept self-contained (no charting lib) so it
// stays robust and matches the app's neutral + indigo visual language.

type Datum = { label: string; value: number };
type ChartSpec = {
  type?: 'bar' | 'line' | 'pie';
  title?: string;
  unit?: string;
  data?: Datum[];
};

const PALETTE = ['#4338ca', '#0891b2', '#16a34a', '#d97706', '#db2777', '#6366f1', '#0d9488', '#ca8a04'];

// Parse the JSON spec defensively — the model occasionally adds stray prose.
function parseSpec(raw: string): ChartSpec | null {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    const spec = JSON.parse(raw.slice(start, end + 1)) as ChartSpec;
    const data = (spec.data ?? []).filter((d) => d && typeof d.value === 'number' && isFinite(d.value));
    if (data.length === 0) return null;
    return { ...spec, data };
  } catch {
    return null;
  }
}

function fmt(n: number, unit?: string): string {
  const s = Math.abs(n) >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) : String(Math.round(n * 100) / 100);
  return unit ? `${s}${unit.startsWith('%') ? '' : ' '}${unit}` : s;
}

export default function ChartBlock({ source }: { source: string }) {
  const spec = parseSpec(source);
  if (!spec) {
    // Fall back to showing the raw block rather than swallowing it.
    return <pre className="text-[11px] text-[#737373] bg-[#fafafa] border border-[#eaeaea] rounded-lg p-2.5 overflow-x-auto">{source}</pre>;
  }
  const data = spec.data!;
  const type = spec.type ?? 'bar';

  return (
    <figure className="my-2 rounded-xl border border-[#eaeaea] bg-white p-3">
      {spec.title && <figcaption className="text-xs font-semibold text-[#171717] mb-2">{spec.title}</figcaption>}
      {type === 'pie' ? <Pie data={data} unit={spec.unit} /> : type === 'line' ? <Line data={data} unit={spec.unit} /> : <Bars data={data} unit={spec.unit} />}
    </figure>
  );
}

// Horizontal bars — readable labels, good for rankings and counts.
function Bars({ data, unit }: { data: Datum[]; unit?: string }) {
  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  return (
    <div className="flex flex-col gap-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-28 shrink-0 truncate text-[11px] text-[#525252]" title={d.label}>{d.label}</div>
          <div className="flex-1 h-5 rounded bg-[#f5f5f5] overflow-hidden">
            <div
              className="h-full rounded flex items-center justify-end pr-1.5"
              style={{ width: `${Math.max((d.value / max) * 100, 2)}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
            >
              <span className="text-[10px] font-medium text-white tnum">{fmt(d.value, unit)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Simple line chart over the data points.
function Line({ data, unit }: { data: Datum[]; unit?: string }) {
  const W = 320, H = 120, P = 8;
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value), 0);
  const span = max - min || 1;
  const x = (i: number) => P + (i / Math.max(data.length - 1, 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        <polyline points={pts} fill="none" stroke="#4338ca" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r="2.5" fill="#4338ca" />)}
      </svg>
      <div className="flex justify-between mt-1 text-[10px] text-[#a3a3a3]">
        {data.map((d, i) => <span key={i} className="truncate max-w-[3.5rem]" title={`${d.label}: ${fmt(d.value, unit)}`}>{d.label}</span>)}
      </div>
    </div>
  );
}

// Pie / donut chart with a side legend.
function Pie({ data, unit }: { data: Datum[]; unit?: string }) {
  const total = data.reduce((s, d) => s + Math.max(d.value, 0), 0) || 1;
  const R = 52, C = 60;
  let acc = 0;
  const arcs = data.map((d, i) => {
    const frac = Math.max(d.value, 0) / total;
    const a0 = acc * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    const a1 = acc * 2 * Math.PI - Math.PI / 2;
    const large = frac > 0.5 ? 1 : 0;
    const path = `M ${C} ${C} L ${C + R * Math.cos(a0)} ${C + R * Math.sin(a0)} A ${R} ${R} 0 ${large} 1 ${C + R * Math.cos(a1)} ${C + R * Math.sin(a1)} Z`;
    return { path, color: PALETTE[i % PALETTE.length], frac, d };
  });
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0" role="img">
        {arcs.map((a, i) => <path key={i} d={a.path} fill={a.color} stroke="white" strokeWidth="1" />)}
      </svg>
      <ul className="flex flex-col gap-1 min-w-0">
        {arcs.map((a, i) => (
          <li key={i} className="flex items-center gap-1.5 text-[11px] text-[#525252] min-w-0">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: a.color }} />
            <span className="truncate" title={a.d.label}>{a.d.label}</span>
            <span className="text-[#a3a3a3] tnum shrink-0">{fmt(a.d.value, unit)} ({Math.round(a.frac * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
