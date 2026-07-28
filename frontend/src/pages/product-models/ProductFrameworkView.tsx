import { useSearchParams } from 'react-router-dom';
import { ErrorMessage, LoadingState } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import {
  CatalogSheet,
  CoveragesSheet,
  EntitiesSheet,
  LeversSheet,
  LifecycleSheet,
  MatrixSheet,
  SegmentsSheet,
  SourcesSheet,
  TaskMapSheet,
} from './FrameworkSheets';
import type { Framework, FwArchetype, FwDimension } from './frameworkTypes';

// The Product Model tab's FRAMEWORK view — the normalized product-model
// reference extraction, every sheet of the source workbook in full detail:
// public segment structure, the complete product catalogue, the 8-dimension
// meta-model with its atomic data elements, how each of the 7 archetypes
// instantiates the dimensions, the 12-product scoring matrix, the coverage and
// rating-lever libraries, lifecycle events by archetype, the underwriting
// entities behind every filing, the dimension→process→actor→task map, and the
// sources. The same framework feeds the Workspace Products grid (dimension
// definitions in the cell modal).

type Section =
  | 'overview'
  | 'segments'
  | 'catalog'
  | 'dimensions'
  | 'archetypes'
  | 'matrix'
  | 'coverages'
  | 'levers'
  | 'lifecycle'
  | 'entities'
  | 'taskmap'
  | 'sources';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'segments', label: 'Segments' },
  { key: 'catalog', label: 'Product catalog' },
  { key: 'dimensions', label: '8 dimensions' },
  { key: 'archetypes', label: 'Archetypes' },
  { key: 'matrix', label: 'Product matrix' },
  { key: 'coverages', label: 'Coverage library' },
  { key: 'levers', label: 'Rating & pricing levers' },
  { key: 'lifecycle', label: 'Lifecycle' },
  { key: 'entities', label: 'Underwriting entities' },
  { key: 'taskmap', label: 'Atomic task map' },
  { key: 'sources', label: 'Sources' },
];

function Overview({ fw }: { fw: Framework }) {
  return (
    <div className="mx-auto max-w-[1100px] space-y-4 px-1 pb-6">
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="text-[15px] font-bold text-[#171717]">{fw.source.title}</div>
        <div className="mt-1 text-[12px] text-neutral-500">{fw.source.prepared}</div>
        <div className="mt-2 text-[12px] leading-relaxed text-neutral-600">{fw.source.note}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fw.readMe.counters.map((c) => (
          <div key={c.label} className="rounded-xl border border-neutral-200 bg-white p-3">
            <div className="text-[20px] font-bold text-[#171717]">{c.value}</div>
            <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">{c.label}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          TL;DR
        </div>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          {fw.readMe.tldr.map((t) => (
            <li key={t.slice(0, 40)} className="text-[12.5px] leading-relaxed text-[#404040]">
              {t}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function DimensionCard({ d }: { d: FwDimension }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#171717] text-[11px] font-bold text-white">
          {d.n}
        </span>
        <span className="text-[14px] font-bold text-[#171717]">{d.name}</span>
        <span className="text-[12px] text-neutral-500">{d.definition}</span>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">
            Atomic data elements to capture
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {d.atomicElements.map((el) => (
              <span
                key={el}
                className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-[#404040]"
              >
                {el}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div>
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">
              Natural key ·{' '}
            </span>
            <span className="text-[11.5px] text-[#404040]">{d.naturalKey}</span>
          </div>
          <div>
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">
              Cardinality ·{' '}
            </span>
            <span className="text-[11.5px] text-[#404040]">{d.cardinality}</span>
          </div>
          <div>
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">
              System of record ·{' '}
            </span>
            <span className="text-[11.5px] text-[#404040]">{d.systemOfRecord}</span>
          </div>
        </div>
      </div>
      {d.designNote && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-amber-900">
          <b>Design note / trap:</b> {d.designNote}
        </div>
      )}
    </div>
  );
}

function ArchetypeCard({ a }: { a: FwArchetype }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline gap-2.5">
        <span className="rounded-md bg-[#171717] px-2 py-0.5 text-[11px] font-bold text-white">
          {a.code}
        </span>
        <span className="text-[14px] font-bold text-[#171717]">{a.name}</span>
      </div>
      <div className="mt-1.5 text-[12px] text-neutral-600">
        <b className="text-neutral-500">Products in scope:</b> {a.productsInScope}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(a.dimensions).map(([dim, text]) => (
          <div key={dim} className="rounded-lg border border-neutral-100 bg-neutral-50 p-2.5">
            <div className="text-[10.5px] font-semibold text-[#171717]">{dim}</div>
            <div className="mt-1 text-[11px] leading-relaxed text-[#525252]">{text}</div>
          </div>
        ))}
      </div>
      {a.rationale && (
        <div className="mt-3 text-[11.5px] leading-relaxed text-neutral-600">
          <b className="text-neutral-500">Why modelled separately:</b> {a.rationale}
        </div>
      )}
    </div>
  );
}

export default function ProductFrameworkView() {
  const { data: fw, loading, error } = useApi<Framework>('/product-spine/framework');
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('section');
  const section: Section = SECTIONS.some((s) => s.key === raw) ? (raw as Section) : 'overview';
  const setSection = (s: Section) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (s === 'overview') next.delete('section');
        else next.set('section', s);
        return next;
      },
      { replace: true },
    );

  if (loading) return <LoadingState message="Loading the product-model framework…" />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!fw) return null;

  const scrolling = section === 'overview' || section === 'dimensions' || section === 'archetypes';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1.5 px-1 pb-3">
        {SECTIONS.map((s) => {
          const on = section === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              className={
                'rounded-md border px-2.5 py-1 text-[11.5px] transition-colors ' +
                (on
                  ? 'border-[#171717] bg-[#171717] font-semibold text-white'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300')
              }
            >
              {s.label}
            </button>
          );
        })}
        <div className="flex-1" />
        <span className="text-[11px] text-neutral-400">
          {fw.source.carrier} — public-website extraction · example carrier
        </span>
      </div>

      <div className={'min-h-0 flex-1 ' + (scrolling ? 'overflow-auto' : '')}>
        {section === 'overview' && <Overview fw={fw} />}
        {section === 'segments' && <SegmentsSheet rows={fw.segments} />}
        {section === 'catalog' && <CatalogSheet rows={fw.catalog} />}
        {section === 'dimensions' && (
          <div className="mx-auto max-w-[1100px] space-y-4 px-1 pb-6">
            {fw.dimensions.map((d) => (
              <DimensionCard key={d.n} d={d} />
            ))}
            {fw.frameworkNote && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[11.5px] leading-relaxed text-neutral-600">
                {fw.frameworkNote}
              </div>
            )}
          </div>
        )}
        {section === 'archetypes' && (
          <div className="mx-auto max-w-[1200px] space-y-4 px-1 pb-6">
            {fw.archetypes.map((a) => (
              <ArchetypeCard key={a.code} a={a} />
            ))}
          </div>
        )}
        {section === 'matrix' && <MatrixSheet rows={fw.matrix} />}
        {section === 'coverages' && <CoveragesSheet rows={fw.coverages} />}
        {section === 'levers' && <LeversSheet rows={fw.levers} />}
        {section === 'lifecycle' && <LifecycleSheet rows={fw.lifecycle} />}
        {section === 'entities' && <EntitiesSheet rows={fw.entities} note={fw.entitiesNote} />}
        {section === 'taskmap' && <TaskMapSheet rows={fw.taskMap} />}
        {section === 'sources' && <SourcesSheet rows={fw.sources} note={fw.sourcesNote} />}
      </div>
    </div>
  );
}
