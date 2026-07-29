import { Sheet, type SheetCol } from '../../components/Sheet';
import type {
  FwCatalogRow,
  FwCoverage,
  FwEntity,
  FwLever,
  FwLifecycleRow,
  FwMatrixRow,
  FwSegment,
  FwSourceRow,
  FwTaskMapRow,
} from './frameworkTypes';

// The Sheet-backed sections of the Product Model Framework view — every flat
// list of the reference workbook rendered in the app's canonical spreadsheet
// format (combobox filters + sortable grid), full row detail via expansion
// where a row carries long-form content.

function longText(text: string) {
  return (
    <div className="text-[12px] leading-relaxed text-[#404040] whitespace-pre-wrap">{text}</div>
  );
}

export function SegmentsSheet({ rows }: { rows: FwSegment[] }) {
  const cols: SheetCol<FwSegment>[] = [
    { key: 'dimension', label: 'Dimension', width: '150px', value: (r) => r.dimension },
    {
      key: 'segment',
      label: 'Segment / unit',
      width: '180px',
      value: (r) => r.segment,
      hideable: false,
    },
    { key: 'sub', label: 'Sub-segment', width: '160px', value: (r) => r.subSegment },
    { key: 'serves', label: 'Who it serves', width: 'minmax(160px,1fr)', value: (r) => r.serves },
    {
      key: 'channels',
      label: 'How it reaches market',
      width: 'minmax(180px,1fr)',
      value: (r) => r.channels,
    },
    { key: 'brands', label: 'Brand(s)', width: '160px', value: (r) => r.brands },
    { key: 'conf', label: 'Conf.', width: '58px', value: (r) => r.confidence, align: 'center' },
  ];
  return (
    <Sheet
      rows={rows}
      cols={cols}
      rowKey={(r) => `${r.segment}|${r.subSegment}|${r.dimension}`}
      unit="segments"
      sheetKey="product-framework-segments"
      expand={(r) => longText(r.evidence)}
    />
  );
}

export function CatalogSheet({ rows }: { rows: FwCatalogRow[] }) {
  const cols: SheetCol<FwCatalogRow>[] = [
    { key: 'unit', label: 'Business unit', width: '170px', value: (r) => r.unit },
    { key: 'subUnit', label: 'Sub-unit', width: '150px', value: (r) => r.subUnit },
    { key: 'family', label: 'Product family', width: '160px', value: (r) => r.family },
    {
      key: 'offering',
      label: 'Product / offering',
      width: 'minmax(200px,1fr)',
      value: (r) => r.offering,
      hideable: false,
    },
    { key: 'buyer', label: 'Primary buyer', width: '160px', value: (r) => r.buyer },
    { key: 'distribution', label: 'Distribution', width: '170px', value: (r) => r.distribution },
    {
      key: 'archetype',
      label: 'Archetype',
      width: '90px',
      value: (r) => r.archetype,
      align: 'center',
    },
    { key: 'conf', label: 'Conf.', width: '58px', value: (r) => r.confidence, align: 'center' },
  ];
  return (
    <Sheet
      rows={rows}
      cols={cols}
      rowKey={(r) => `${r.unit}|${r.offering}`}
      unit="offerings"
      sheetKey="product-framework-catalog"
      summarize={(v) => `${new Set(v.map((r) => r.family)).size} families`}
      expand={(r) => longText(r.evidence)}
    />
  );
}

export function MatrixSheet({ rows }: { rows: FwMatrixRow[] }) {
  const cols: SheetCol<FwMatrixRow>[] = [
    {
      key: 'product',
      label: 'Representative product',
      width: '190px',
      value: (r) => r.product,
      hideable: false,
    },
    {
      key: 'archetype',
      label: 'Archetype',
      width: '90px',
      value: (r) => r.archetype,
      align: 'center',
    },
    { key: 'unit', label: 'Unit', width: '140px', value: (r) => r.unit },
    { key: 'txn', label: 'Txn volume', width: '100px', value: (r) => r.txnVolume },
    {
      key: 'auto',
      label: 'Automation potential',
      width: '140px',
      value: (r) => r.automationPotential,
    },
    {
      key: 'challenge',
      label: 'Dominant modelling challenge',
      width: 'minmax(240px,1fr)',
      value: (r) => r.challenge,
    },
  ];
  return (
    <Sheet
      rows={rows}
      cols={cols}
      rowKey={(r) => r.product}
      unit="products"
      sheetKey="product-framework-matrix"
      expand={(r) => (
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(r.dimensions).map(([dim, text]) => (
            <div key={dim} className="rounded-lg border border-neutral-200 bg-white p-2.5">
              <div className="text-[11px] font-semibold text-[#171717]">{dim}</div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-[#404040]">{text}</div>
            </div>
          ))}
        </div>
      )}
    />
  );
}

export function CoveragesSheet({ rows }: { rows: FwCoverage[] }) {
  const cols: SheetCol<FwCoverage>[] = [
    { key: 'parent', label: 'Parent product', width: '170px', value: (r) => r.parent },
    { key: 'group', label: 'Coverage group', width: '150px', value: (r) => r.group },
    {
      key: 'coverage',
      label: 'Coverage / endorsement (as marketed)',
      width: 'minmax(240px,1fr)',
      value: (r) => r.coverage,
      hideable: false,
    },
    { key: 'base', label: 'Base or optional', width: '190px', value: (r) => r.baseOrOptional },
    {
      key: 'note',
      label: 'Structural note',
      width: 'minmax(200px,1fr)',
      value: (r) => r.structuralNote,
    },
    { key: 'conf', label: 'Conf.', width: '58px', value: (r) => r.confidence, align: 'center' },
  ];
  return (
    <Sheet
      rows={rows}
      cols={cols}
      rowKey={(r) => `${r.parent}|${r.coverage}`}
      unit="coverages"
      sheetKey="product-framework-coverages"
      summarize={(v) => `${new Set(v.map((r) => r.parent)).size} parent products`}
    />
  );
}

export function LeversSheet({ rows }: { rows: FwLever[] }) {
  const cols: SheetCol<FwLever>[] = [
    { key: 'product', label: 'Product / segment', width: '170px', value: (r) => r.product },
    { key: 'type', label: 'Lever type', width: '140px', value: (r) => r.leverType },
    {
      key: 'lever',
      label: 'Rating variable / discount / structure',
      width: 'minmax(240px,1fr)',
      value: (r) => r.lever,
      hideable: false,
    },
    {
      key: 'dimension',
      label: 'Belongs to dimension',
      width: '150px',
      value: (r) => r.dimension,
      hint: 'Keeping rating (filed, deterministic) apart from pricing (commercial judgement) is the point of this column',
    },
    { key: 'conf', label: 'Conf.', width: '58px', value: (r) => r.confidence, align: 'center' },
  ];
  return (
    <Sheet
      rows={rows}
      cols={cols}
      rowKey={(r) => `${r.product}|${r.lever}`}
      unit="levers"
      sheetKey="product-framework-levers"
      expand={(r) => longText(r.evidence)}
    />
  );
}

export function LifecycleSheet({ rows }: { rows: FwLifecycleRow[] }) {
  const archetypes = rows.length ? Object.keys(rows[0].byArchetype) : [];
  const cols: SheetCol<FwLifecycleRow>[] = [
    { key: 'phase', label: 'Phase', width: '110px', value: (r) => r.phase },
    {
      key: 'event',
      label: 'Lifecycle event',
      width: 'minmax(190px,1fr)',
      value: (r) => r.event,
      hideable: false,
    },
    { key: 'actor', label: 'Primary actor', width: '150px', value: (r) => r.actor },
    ...archetypes.map((a): SheetCol<FwLifecycleRow> => ({
      key: a,
      label: a.split(' ')[0],
      hint: a,
      width: '64px',
      align: 'center',
      value: (r) => r.byArchetype[a] ?? '',
      render: (r) => {
        const v = r.byArchetype[a] ?? '';
        const tone =
          v === 'Y' ? 'text-emerald-700' : v === 'N' ? 'text-neutral-300' : 'text-amber-600';
        return <span className={`text-[11px] font-semibold ${tone}`}>{v || '—'}</span>;
      },
    })),
  ];
  return (
    <Sheet
      rows={rows}
      cols={cols}
      rowKey={(r) => `${r.phase}|${r.event}`}
      unit="events"
      sheetKey="product-framework-lifecycle"
      expand={(r) => longText(r.whyItMatters)}
    />
  );
}

export function EntitiesSheet({ rows, note }: { rows: FwEntity[]; note: string }) {
  const cols: SheetCol<FwEntity>[] = [
    {
      key: 'name',
      label: 'Underwriting company (legal entity)',
      width: 'minmax(240px,1fr)',
      value: (r) => r.name,
      hideable: false,
    },
    { key: 'naic', label: 'NAIC #', width: '90px', value: (r) => r.naic, align: 'center' },
    { key: 'domicile', label: 'Domicile', width: '140px', value: (r) => r.domicile },
    {
      key: 'footprint',
      label: 'Licensed footprint (as published)',
      width: 'minmax(260px,1fr)',
      value: (r) => r.footprint,
    },
  ];
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {note && (
        <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
          {note}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <Sheet
          rows={rows}
          cols={cols}
          rowKey={(r) => r.name}
          unit="entities"
          sheetKey="product-framework-entities"
        />
      </div>
    </div>
  );
}

export function TaskMapSheet({ rows }: { rows: FwTaskMapRow[] }) {
  const cols: SheetCol<FwTaskMapRow>[] = [
    {
      key: 'dimension',
      label: 'Product-model dimension',
      width: '150px',
      value: (r) => r.dimension,
    },
    { key: 'process', label: 'Process', width: '190px', value: (r) => r.process },
    { key: 'actor', label: 'Actor (role)', width: '170px', value: (r) => r.actor },
    {
      key: 'tasks',
      label: 'Click-level task cluster',
      width: 'minmax(240px,1fr)',
      value: (r) => r.tasks,
      hideable: false,
    },
    { key: 'artifact', label: 'Work product / artefact', width: '190px', value: (r) => r.artifact },
    {
      key: 'apps',
      label: 'Application(s)',
      width: 'minmax(180px,1fr)',
      value: (r) => r.applications,
    },
  ];
  return (
    <Sheet
      rows={rows}
      cols={cols}
      rowKey={(r) => `${r.dimension}|${r.actor}|${r.tasks}`}
      unit="task clusters"
      sheetKey="product-framework-taskmap"
      expand={(r) => longText(`Instrumentation — what to measure: ${r.instrumentation}`)}
    />
  );
}

export function SourcesSheet({ rows, note }: { rows: FwSourceRow[]; note: string }) {
  const cols: SheetCol<FwSourceRow>[] = [
    {
      key: 'source',
      label: 'Source',
      width: 'minmax(220px,1fr)',
      value: (r) => r.source,
      hideable: false,
    },
    {
      key: 'url',
      label: 'URL',
      width: 'minmax(220px,1fr)',
      value: (r) => r.url,
      render: (r) => (
        <a
          href={r.url}
          target="_blank"
          rel="noreferrer"
          className="truncate text-[12px] text-[#0070AD] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {r.url}
        </a>
      ),
    },
    { key: 'retrieved', label: 'Retrieved', width: '110px', value: (r) => r.retrieved },
    {
      key: 'evidenced',
      label: 'What it evidenced',
      width: 'minmax(240px,1fr)',
      value: (r) => r.evidenced,
    },
  ];
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {note && (
        <div className="shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] leading-relaxed text-neutral-600">
          {note}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <Sheet
          rows={rows}
          cols={cols}
          rowKey={(r) => r.url || r.source}
          unit="sources"
          sheetKey="product-framework-sources"
        />
      </div>
    </div>
  );
}
