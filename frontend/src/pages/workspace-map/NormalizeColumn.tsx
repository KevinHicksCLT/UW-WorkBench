import { LAYERS, GREEN, AMBER, INDIGO } from './types';
import type {
  Finding,
  Layer,
  LayerExpansion,
  LayerPads,
  NormalizationEntry,
  NormalizeScope,
} from './types';
import { ColumnHeads, EntryCard, PassThroughCard, entryAppIds } from './NormalizeCards';
import { CORE_AREA } from './compare';

/** Functional-area model for the "all screens" walk (null = single-screen walk). */
export type AreaModel = { areaOf: Map<string, string>; order: string[] } | null;

// Middle column — the heart of the board. Each layer is a collapsible T-chart:
// one column per legacy source application, a NORMALIZED column on the right.
// Multi-source boards compare the sources row by row (per the design comp);
// a single-application board is a pass-through — every step carries into the
// normalized model 1→1, still at paper-thin detail (summary, code location).
//
// SCRUM-222: entries fed by 2+ applications ("shared" — consolidation
// candidates) group separately from single-application entries ("unique" —
// migrate-as-is candidates), so the many-to-one story reads at a glance.
//
// Colour is semantic only: green = same/carries over, amber = needs review,
// red = moves, indigo = the normalized model. Everything else is neutral.

interface Props {
  board: NormalizeScope;
  activeLayer: Layer | null;
  /** Findings in the comparison scope (every picked application) — Normalize always aggregates the full comparison. */
  findings: Finding[];
  /** "All screens" walk: cards sub-group under computed functional areas. */
  areas?: AreaModel;
  /** Re-fetch the board after a REVIEW/HELD entry is approved or held. */
  onResolved: () => void;
  /** Per-layer top spacing that lines this column's rows up with the others (SCRUM-222). */
  layerPads?: LayerPads;
  /** Per-card top spacing (keyed by the card's connector anchor) that levels
   *  each card with its brownfield step (SCRUM-259). */
  cardPads?: Record<string, number>;
  /** Shared per-layer expansion — one toggle opens the layer in every column. */
  expandedLayers: LayerExpansion;
  onToggleLayer: (layer: Layer) => void;
}

/** What the layer covers, in the section subtitle (mirrors the design comp). */
const LAYER_TITLE: Record<Layer, string> = {
  UI: 'UI Components / Fields',
  Integration: 'Integration Logic',
  'Business Service': 'Business Service Logic',
  Data: 'Data Schema & Payload',
  Infrastructure: 'Infra Security Rules & Logs',
};

/** Small group divider: shared / application-specific / pass-through. */
function GroupHead({ kind, count }: { kind: 'shared' | 'unique' | 'passthrough'; count: number }) {
  const shared = kind === 'shared';
  const label = shared
    ? `Shared across applications (${count})`
    : kind === 'unique'
      ? `Application-specific (${count})`
      : `Carries over 1→1 (${count})`;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: shared ? 0 : 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        color: shared ? INDIGO : '#64748b',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          background: shared ? '#c7d2fe' : '#e2e8f0',
          border: `1px solid ${shared ? INDIGO : '#94a3b8'}`,
        }}
      />
      {label}
      <span style={{ flex: 1, height: 1, background: shared ? '#e0e7ff' : '#e2e8f0' }} />
    </div>
  );
}

/** Functional-area divider inside a layer (the "all screens" walk). */
function AreaHead({ name, count }: { name: string; count: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: '.05em',
        textTransform: 'uppercase',
        color: '#171717',
      }}
    >
      {name}
      <span style={{ fontWeight: 600, color: '#a3a3a3', fontVariantNumeric: 'tabular-nums' }}>
        {count}
      </span>
      <span style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
    </div>
  );
}

function LayerSection({
  layer,
  board,
  dim,
  findings,
  areas,
  onResolved,
  padTop,
  cardPads,
  open,
  onToggle,
}: {
  layer: Layer;
  board: NormalizeScope;
  dim: boolean;
  findings: Finding[];
  areas?: AreaModel;
  onResolved: () => void;
  padTop: number;
  cardPads?: Record<string, number>;
  open: boolean;
  onToggle: () => void;
}) {
  const legacyApps = board.apps.filter((a) => a.kind === 'LEGACY');
  const apps = legacyApps.length ? legacyApps : board.apps;
  const rows = findings.filter((f) => f.layer === layer);
  const scopeIds = new Set(rows.map((f) => f.id));
  // Authored entries only count when they touch a finding in scope.
  const entries = board.normalizationEntries.filter(
    (e) => e.layer === layer && e.findingIds.some((id) => scopeIds.has(id)),
  );
  const findingsById = new Map(board.findings.map((f) => [f.id, f]));
  // SCRUM-222 grouping: shared (2+ source apps) first, then single-app entries.
  const sharedEntries = entries.filter((e) => entryAppIds(e, findingsById).length > 1);
  const uniqueEntries = entries.filter((e) => entryAppIds(e, findingsById).length <= 1);
  // Cross-board comparisons mix authored boards with pass-through boards in
  // one layer: findings no entry covers still carry 1→1 into the model, so
  // they stay counted and listed (otherwise a whole application would vanish
  // from Normalize while Greenfield keeps landing it).
  const covered = new Set(entries.flatMap((e) => e.findingIds));
  const uncovered = entries.length > 0 ? rows.filter((r) => !covered.has(r.id)) : [];
  const grouped =
    apps.length > 1 &&
    sharedEntries.length > 0 &&
    (uniqueEntries.length > 0 || uncovered.length > 0);
  const normalizedCount = entries.length > 0 ? entries.length + uncovered.length : rows.length;
  // "current" = the source findings this section actually SHOWS: every source
  // of a rendered entry (a shared entry drags its partner sources in even when
  // the scope only touched one of them — 7 in → 5 out, not 5 → 5) plus the
  // pass-through rows.
  const sourceIds = new Set(uncovered.map((f) => f.id));
  for (const e of entries)
    for (const id of e.findingIds) if (findingsById.has(id)) sourceIds.add(id);
  const currentCount = entries.length > 0 ? sourceIds.size : rows.length;
  // Authored entries compare the sources column by column; pass-through mode
  // treats the whole board as ONE application, so a single source column.
  const headNames =
    entries.length > 0 ? apps.map((a) => a.name) : [board.application || board.name];
  // "All screens" walk: sub-group this layer's cards under functional areas so
  // the full comparison stays readable without hiding anything. Single-area
  // layers render flat.
  const areaOfEntry = (e: NormalizationEntry): string => {
    const f = e.findingIds.map((id) => findingsById.get(id)).find(Boolean);
    return f ? (areas?.areaOf.get(f.id) ?? CORE_AREA) : CORE_AREA;
  };
  const areaOfFinding = (f: Finding): string => areas?.areaOf.get(f.id) ?? CORE_AREA;
  const areaSections = (() => {
    if (!areas) return null;
    const passPool = entries.length > 0 ? uncovered : rows;
    const names = new Set<string>([...entries.map(areaOfEntry), ...passPool.map(areaOfFinding)]);
    if (names.size <= 1) return null;
    const orderedNames = [
      ...areas.order.filter((a) => names.has(a)),
      ...[...names].filter((n) => !areas.order.includes(n)),
    ];
    return orderedNames
      .map((area) => ({
        area,
        shared: sharedEntries.filter((e) => areaOfEntry(e) === area),
        unique: uniqueEntries.filter((e) => areaOfEntry(e) === area),
        pass: passPool.filter((f) => areaOfFinding(f) === area),
      }))
      .filter((s) => s.shared.length + s.unique.length + s.pass.length > 0);
  })();
  if (rows.length === 0 && entries.length === 0) return null;

  return (
    <div
      data-anchor={`nz:${layer}`}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.04)',
        opacity: dim ? 0.45 : 1,
        transition: 'opacity .15s',
        overflow: 'hidden',
        marginTop: padTop || undefined,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          padding: '10px 12px',
          background: '#fafafa',
          border: 'none',
          borderBottom: open ? '1px solid #e2e8f0' : 'none',
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700 }}>
          <span
            style={{
              color: '#a3a3a3',
              fontSize: 11,
              display: 'inline-block',
              transform: open ? 'none' : 'rotate(-90deg)',
              marginRight: 6,
            }}
          >
            ▾
          </span>
          {LAYER_TITLE[layer]}
        </span>
        <span style={{ fontSize: 12, color: '#525252', fontVariantNumeric: 'tabular-nums' }}>
          {apps.length > 1 && (
            <span style={{ color: '#a3a3a3' }}>
              {sharedEntries.length} shared ·{' '}
              {entries.length > 0 ? uniqueEntries.length + uncovered.length : rows.length} unique
              ·{' '}
            </span>
          )}
          {currentCount} current →{' '}
          <b style={{ fontWeight: 800, color: INDIGO, fontSize: 15 }}>{normalizedCount}</b>
        </span>
      </button>
      {open && areaSections && (
        <div style={{ padding: '0 12px 12px' }}>
          <ColumnHeads names={headNames} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
            {areaSections.map((s) => (
              <div key={s.area} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <AreaHead name={s.area} count={s.shared.length + s.unique.length + s.pass.length} />
                {s.shared.map((e) => (
                  <EntryCard
                    key={e.id}
                    entry={e}
                    apps={apps}
                    findingsById={findingsById}
                    onResolved={onResolved}
                    padTop={cardPads?.[`nz:e:${e.id}`]}
                  />
                ))}
                {s.unique.map((e) => (
                  <EntryCard
                    key={e.id}
                    entry={e}
                    apps={apps}
                    findingsById={findingsById}
                    onResolved={onResolved}
                    padTop={cardPads?.[`nz:e:${e.id}`]}
                  />
                ))}
                {s.pass.map((f) => (
                  <PassThroughCard key={f.id} finding={f} padTop={cardPads?.[`nz:f:${f.id}`]} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      {open && !areaSections && (
        <div style={{ padding: '0 12px 12px' }}>
          <ColumnHeads names={headNames} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {entries.length > 0 ? (
              <>
                {grouped && <GroupHead kind="shared" count={sharedEntries.length} />}
                {sharedEntries.map((e) => (
                  <EntryCard
                    key={e.id}
                    entry={e}
                    apps={apps}
                    findingsById={findingsById}
                    onResolved={onResolved}
                    padTop={cardPads?.[`nz:e:${e.id}`]}
                  />
                ))}
                {grouped && uniqueEntries.length > 0 && (
                  <GroupHead kind="unique" count={uniqueEntries.length} />
                )}
                {uniqueEntries.map((e) => (
                  <EntryCard
                    key={e.id}
                    entry={e}
                    apps={apps}
                    findingsById={findingsById}
                    onResolved={onResolved}
                    padTop={cardPads?.[`nz:e:${e.id}`]}
                  />
                ))}
                {uncovered.length > 0 && (
                  <>
                    {grouped && <GroupHead kind="passthrough" count={uncovered.length} />}
                    {uncovered.map((f) => (
                      <PassThroughCard key={f.id} finding={f} padTop={cardPads?.[`nz:f:${f.id}`]} />
                    ))}
                  </>
                )}
              </>
            ) : (
              rows.map((f) => (
                <PassThroughCard key={f.id} finding={f} padTop={cardPads?.[`nz:f:${f.id}`]} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NormalizeColumn({
  board,
  activeLayer,
  findings,
  areas,
  onResolved,
  layerPads,
  cardPads,
  expandedLayers,
  onToggleLayer,
}: Props) {
  const legacyApps = board.apps.filter((a) => a.kind === 'LEGACY');
  const apps = legacyApps.length ? legacyApps : board.apps;
  const passThrough = board.normalizationEntries.length === 0;
  // The header pill totals the full comparison scope (every picked app);
  // findings no entry covers pass through 1→1 and stay counted.
  const scopeIds = new Set(findings.map((f) => f.id));
  const scopedEntries = board.normalizationEntries.filter((e) =>
    e.findingIds.some((id) => scopeIds.has(id)),
  );
  const covered = new Set(scopedEntries.flatMap((e) => e.findingIds));
  const normalized =
    scopedEntries.length > 0
      ? scopedEntries.length + findings.filter((f) => !covered.has(f.id)).length
      : findings.length;
  // The "current" side counts every source the column shows: a scoped entry
  // drags all of its sources in (see LayerSection), so in ≥ out reads true.
  const boardFindingIds = new Set(board.findings.map((f) => f.id));
  const pillSources = new Set(findings.filter((f) => !covered.has(f.id)).map((f) => f.id));
  for (const e of scopedEntries)
    for (const id of e.findingIds) if (boardFindingIds.has(id)) pillSources.add(id);
  const current = scopedEntries.length > 0 ? pillSources.size : findings.length;
  const awaiting = scopedEntries.filter(
    (e) => e.matchStatus === 'REVIEW' || e.matchStatus === 'HELD',
  ).length;
  // Comparison verdict: with several applications in scope and not a single
  // shared entry, say so plainly — nothing consolidates, everything migrates
  // application-specific.
  const findingsById = new Map(board.findings.map((f) => [f.id, f]));
  const sharedTotal = scopedEntries.filter((e) => entryAppIds(e, findingsById).length > 1).length;

  return (
    <div style={{ width: 560, flexShrink: 0, alignSelf: 'flex-start' }}>
      <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        Normalize
        {!passThrough && (
          <span style={{ fontWeight: 400, fontSize: 12, color: '#a3a3a3' }}>
            {' '}
            · legacy sources → one normalized model
          </span>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid #eaeaea',
            borderRadius: 999,
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,.05)',
            padding: '3px 12px',
            fontSize: 12,
            color: '#525252',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <b style={{ fontWeight: 700, color: '#171717' }}>{current} current combined steps</b> →{' '}
          <b style={{ fontWeight: 700, color: GREEN }}>{normalized} normalized steps</b>
          {awaiting > 0 && (
            <>
              {' '}
              · <b style={{ fontWeight: 600, color: AMBER }}>{awaiting} awaiting review</b>
            </>
          )}
          {apps.length > 1 && sharedTotal === 0 && (
            <>
              {' '}
              ·{' '}
              <b style={{ fontWeight: 600, color: '#64748b' }}>
                no shared steps between these applications
              </b>
            </>
          )}
        </span>
      </div>
      {/* SCRUM-222 legend — only meaningful on a multi-application board. */}
      {!passThrough && apps.length > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 14,
            marginBottom: 8,
            fontSize: 10.5,
            color: '#64748b',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: '#c7d2fe',
                border: `1px solid ${INDIGO}`,
              }}
            />
            shared across apps — consolidate
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: '#e2e8f0',
                border: '1px solid #94a3b8',
              }}
            />
            single application — migrate as-is
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {LAYERS.map((layer) => (
          <LayerSection
            key={layer}
            layer={layer}
            board={board}
            dim={activeLayer != null && activeLayer !== layer}
            findings={findings}
            areas={areas}
            onResolved={onResolved}
            padTop={layerPads?.[layer] ?? 0}
            cardPads={cardPads}
            open={!!expandedLayers[layer]}
            onToggle={() => onToggleLayer(layer)}
          />
        ))}
      </div>
    </div>
  );
}
