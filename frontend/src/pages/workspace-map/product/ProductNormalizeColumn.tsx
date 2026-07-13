import { useState } from 'react';
import { GREEN, AMBER, INDIGO } from '../types';
import { MATCH_META } from './spine';
import type { Comparison, ComponentRow, ElementGroup, MatchStatus, VersionColumn } from './spine';

// Middle column of the Products board. Each model component is a collapsible
// T-chart: one column per compared version, a NORMALIZED column on the right.
// A group that every version carries folds N→1 automatically; a group only
// some versions carry is flagged for review — normalize up (adopt everywhere)
// or keep as a jurisdiction/version variant.

interface Props {
  versions: VersionColumn[];
  comparison: Comparison;
  matchFilter: MatchStatus | null;
  activeComponent: string | null;
}

function ColumnHeads({ names }: { names: string[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${names.length}, 1fr) 140px`,
        borderBottom: `2px solid ${INDIGO}`,
        background: 'rgba(255,255,255,.75)',
        borderRadius: '5px 5px 0 0',
        marginTop: 6,
      }}
    >
      {names.map((n) => (
        <div
          key={n}
          style={{
            textAlign: 'center',
            padding: '3px 6px 4px',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '.08em',
            color: '#171717',
            textTransform: 'uppercase',
            borderRight: '1px solid #e2e8f0',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {n}
        </div>
      ))}
      <div
        style={{
          textAlign: 'center',
          padding: '3px 0 4px',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '.08em',
          color: INDIGO,
          textTransform: 'uppercase',
        }}
      >
        Normalized
      </div>
    </div>
  );
}

function NormalizedCell({
  name,
  detail,
  badge,
  tone,
}: {
  name: string;
  detail: string;
  badge: string;
  tone: 'same' | 'review';
}) {
  const review = tone === 'review';
  return (
    <div
      style={{
        borderLeft: `3px solid ${review ? '#f59e0b' : INDIGO}`,
        background: review ? '#fffbeb' : '#f5f6ff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
        padding: '6px 9px',
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: '#1e1b4b', lineHeight: 1.25 }}>
        {name}
      </span>
      <span style={{ fontSize: 10, color: '#525252' }}>{detail}</span>
      <span
        style={{
          alignSelf: 'flex-start',
          marginTop: 2,
          padding: '1px 6px',
          borderRadius: 4,
          background: review ? AMBER : '#fff',
          border: `1px solid ${review ? AMBER : '#86efac'}`,
          color: review ? '#fff' : '#15803d',
          fontSize: 9,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        {badge}
      </span>
    </div>
  );
}

function CardFooter({ kind, text }: { kind: 'same' | 'different'; text: string }) {
  const palette =
    kind === 'same'
      ? { bg: '#f0fdf4', fg: '#166534', label: 'Same:' }
      : { bg: '#fffbeb', fg: '#92400e', label: 'Different:' };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 9px',
        background: palette.bg,
        fontSize: 10.5,
        color: palette.fg,
        lineHeight: 1.4,
      }}
    >
      <b style={{ fontWeight: 700 }}>{palette.label}</b>
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {text}
      </span>
    </div>
  );
}

function GroupCard({ group, versions }: { group: ElementGroup; versions: VersionColumn[] }) {
  const review = group.status === 'PARTIAL' || group.status === 'UNIQUE';
  const border = review ? '#fcd34d' : '#bbf7d0';
  const missing = versions.filter((v) => !group.perVersion[v.id]);
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 6,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1fr 140px',
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${versions.length}, 1fr)` }}>
          {versions.map((v) => {
            const el = group.perVersion[v.id];
            return (
              <div
                key={v.id}
                style={{ padding: '4px 9px', borderRight: '1px solid #e2e8f0', minWidth: 0 }}
              >
                {!el ? (
                  <span style={{ fontSize: 10.5, color: '#a3a3a3' }}>—</span>
                ) : (
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {el.element}
                    </div>
                    {el.livesIn && (
                      <div
                        style={{
                          fontSize: 9.5,
                          color: '#a3a3a3',
                          fontFamily: 'ui-monospace, monospace',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={el.livesIn}
                      >
                        {el.livesIn}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <CardFooter
          kind={review ? 'different' : 'same'}
          text={
            group.status === 'COMMON'
              ? `all ${versions.length} versions carry this — folds into one element`
              : group.status === 'SINGLE'
                ? 'single version — carries straight into the model'
                : `only in ${group.presentIn} of ${versions.length} — adopt everywhere or keep as ${
                    missing.length > 0 ? 'a version variant' : 'variant'
                  }`
          }
        />
      </div>
      <NormalizedCell
        name={group.name}
        detail={`${group.presentIn} source${group.presentIn === 1 ? '' : 's'} · 1 element`}
        badge={
          group.status === 'COMMON'
            ? `${group.presentIn}→1 · AUTO`
            : group.status === 'SINGLE'
              ? '1→1 · PASS-THROUGH'
              : 'REVIEW'
        }
        tone={review ? 'review' : 'same'}
      />
    </div>
  );
}

function ComponentSection({
  row,
  versions,
  matchFilter,
  dim,
}: {
  row: ComponentRow;
  versions: VersionColumn[];
  matchFilter: MatchStatus | null;
  dim: boolean;
}) {
  const [open, setOpen] = useState(false);
  const groups = matchFilter ? row.groups.filter((g) => g.status === matchFilter) : row.groups;
  const raw = row.groups.reduce((a, g) => a + g.presentIn, 0);
  if (row.groups.length === 0) return null;

  return (
    <div
      data-anchor={`nz:${row.component}`}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.04)',
        opacity: dim || (matchFilter != null && groups.length === 0) ? 0.45 : 1,
        transition: 'opacity .15s',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
          {row.component}
        </span>
        <span style={{ fontSize: 12, color: '#525252', fontVariantNumeric: 'tabular-nums' }}>
          {raw} raw →{' '}
          <b style={{ fontWeight: 800, color: INDIGO, fontSize: 15 }}>{row.groups.length}</b>
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          <ColumnHeads names={versions.map((v) => v.name)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {groups.map((g) => (
              <GroupCard key={g.key} group={g} versions={versions} />
            ))}
            {groups.length === 0 && (
              <span style={{ fontSize: 11, color: '#a3a3a3', padding: '6px 2px' }}>
                nothing matches the current filter
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductNormalizeColumn({
  versions,
  comparison,
  matchFilter,
  activeComponent,
}: Props) {
  return (
    <div style={{ width: 560, flexShrink: 0, alignSelf: 'flex-start' }}>
      <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        Normalize
        <span style={{ fontWeight: 400, fontSize: 12, color: '#a3a3a3' }}>
          {' '}
          · {versions.length === 1 ? 'one version → the model' : 'versions → one product model'}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
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
          <b style={{ fontWeight: 700, color: '#171717' }}>{comparison.rawCount} raw elements</b> →{' '}
          <b style={{ fontWeight: 700, color: GREEN }}>{comparison.normalizedCount} normalized</b>
          {comparison.reviewCount > 0 && (
            <>
              {' '}
              ·{' '}
              <b style={{ fontWeight: 600, color: MATCH_META.PARTIAL.fg }}>
                {comparison.reviewCount} need review
              </b>
            </>
          )}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {comparison.rows.map((row) => (
          <ComponentSection
            key={row.component}
            row={row}
            versions={versions}
            matchFilter={matchFilter}
            dim={activeComponent != null && activeComponent !== row.component}
          />
        ))}
      </div>
    </div>
  );
}
