import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../../lib/api';
import {
  CATEGORY_LABELS,
  changeLabel,
  DOMAIN_META,
  isDestructive,
  lensForKind,
  RECOMMENDATION_META,
  SEVERITY_META,
  type ChangeLens,
  type DecisionScore,
  type GoalProgress,
  type Impact,
  type ImpactSection,
  type ImpactSeverity,
  type Stakeholder,
} from './types';
import { AiAssessment, IMPACT_ANIM_CSS, LOGO_BLUE, ScannerView, useAiAnalysis } from './aiAnalysis';
import type { ImpactGate } from './useImpactGate';

// The per-lens change-type catalog (GET /impact/taxonomy), fetched once and
// shared across every panel open — reference data that never changes in a
// session, so a module-level promise is the whole cache.
type TaxonomyEntry = { token: string; label: string; changeClass: string };
type Taxonomy = Record<string, TaxonomyEntry[]>;
let taxonomyPromise: Promise<Taxonomy> | null = null;
function loadTaxonomy(): Promise<Taxonomy> {
  if (!taxonomyPromise) {
    taxonomyPromise = api
      .get<{ byLens: Taxonomy }>('/impact/taxonomy')
      .then((r) => r.byLens)
      .catch(() => {
        // Let a transient failure retry on the next open rather than caching {}.
        taxonomyPromise = null;
        return {} as Taxonomy;
      });
  }
  return taxonomyPromise;
}

/** The lens change-type picker — a pure assessment lets the reviewer pick which
 *  change they're weighing, and the report reshapes to that verb's blast-radius
 *  profile (Change Impact v2, Workstream A / AC1). Board gates don't render
 *  this; they pass a fixed verb. */
function LensPicker({
  lens,
  value,
  disabled,
  onPick,
}: {
  lens: ChangeLens;
  value: string;
  disabled: boolean;
  onPick: (token: string) => void;
}) {
  const [options, setOptions] = useState<TaxonomyEntry[]>([]);
  useEffect(() => {
    let alive = true;
    loadTaxonomy().then((tax) => {
      if (alive) setOptions(tax[lens] ?? []);
    });
    return () => {
      alive = false;
    };
  }, [lens]);
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onPick(e.target.value)}
      aria-label="Change type"
      style={{
        font: 'inherit',
        fontSize: 11.5,
        fontWeight: 600,
        color: '#171717',
        padding: '3px 8px',
        borderRadius: 7,
        border: `1px solid ${LOGO_BLUE}44`,
        background: '#fff',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {/* Keep the current token selectable even before the catalog lands. */}
      {options.length === 0 && <option value={value}>{changeLabel(value)}</option>}
      {options.map((o) => (
        <option key={o.token} value={o.token}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// The common change-impact panel — rendered by every lens's decision surface
// over the same gate. The report reads as the knock-on impact assessment from
// the outlier decision workflow: one card per impact domain (Product ›
// Technology › Data › Operational › Compliance › Testing), every domain
// always shown so an empty card reads as "checked — no impact". The
// deterministic graph walk fills the cards instantly; the AI deep-dive
// (useAiAnalysis) then derives further specific knock-on effects for every
// domain while each card shows an analyzing animation. Brand accents use the
// Capgemini logo blue. zIndex 70: stacks ABOVE ReviewModal (60), which stays
// open underneath while the user weighs the report.

const SEVERITIES: ImpactSeverity[] = ['BREAKING', 'HIGH', 'MEDIUM', 'LOW'];
const severityRank = (s: ImpactSeverity) => SEVERITIES.indexOf(s);

/** Severity totals — the compact strip under the header that preserves the
 *  Breaking › High › Medium › Info read now the body is organized by domain.
 *  Counts the merged (graph + derived) lines, i.e. what the cards show. */
function SeverityTotals({ impacts }: { impacts: Impact[] }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
      {SEVERITIES.map((sev) => {
        const m = SEVERITY_META[sev];
        const n = impacts.filter((i) => i.severity === sev).length;
        return (
          <span
            key={sev}
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 999,
              border: `1px solid ${n ? m.border : '#f1f5f9'}`,
              background: n ? m.bg : '#fafafa',
              fontSize: 10,
              fontWeight: 700,
              color: n ? m.fg : '#94a3b8',
            }}
          >
            {m.label}
            <span style={{ fontSize: 11.5 }}>{n}</span>
          </span>
        );
      })}
    </div>
  );
}

/** The quantified decision aid: one figure that says how confidently the
 *  evidence points at Standardize / Retain / Retire, with the plain-English
 *  factors behind it. Rendered only when the report carries a score (product
 *  decisions). */
function ScoreCard({ score }: { score: DecisionScore }) {
  const meta = RECOMMENDATION_META[score.recommendation];
  return (
    <div
      style={{
        margin: '10px 16px 0',
        display: 'flex',
        gap: 14,
        alignItems: 'stretch',
        borderRadius: 10,
        border: `1px solid ${meta.tone}33`,
        background: '#fff',
        padding: '10px 14px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 96,
          gap: 3,
        }}
      >
        <span style={{ fontSize: 26, fontWeight: 800, color: meta.tone, lineHeight: 1 }}>
          {score.value}%
        </span>
        <span
          style={{
            padding: '2px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            background: meta.tone,
          }}
        >
          {meta.label}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#525252', letterSpacing: 0.5 }}>
          DECISION SCORE — {score.value}% confidence to {meta.verb}
        </div>
        <div style={{ fontSize: 12.5, color: '#171717', lineHeight: 1.45, marginTop: 3 }}>
          {score.headline}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 16px', marginTop: 6 }}>
          {score.factors.map((f) => (
            <span key={f.label} style={{ fontSize: 11, color: '#525252' }}>
              <b style={{ color: '#404040' }}>{f.label}:</b> {f.detail}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 5 }}>
          Derived from carriage, in-force exposure and this assessment — review with your
          underwriting team before applying.
        </div>
      </div>
    </div>
  );
}

/** The north-star strip: the end goal this decision moves toward and how far
 *  the line of business already is. Decisions are saved automatically, so the
 *  figure holds across workflows and sessions. */
function GoalStrip({ goal }: { goal: GoalProgress }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        margin: '0 16px 12px',
        padding: '7px 12px',
        borderRadius: 8,
        background: '#f0f7fb',
        border: '1px solid #dbeafe',
      }}
    >
      <span aria-hidden style={{ fontSize: 13 }}>
        🎯
      </span>
      <span style={{ fontSize: 11.5, color: '#334155', flex: 1, lineHeight: 1.4 }}>
        <b style={{ color: LOGO_BLUE }}>End goal:</b> {goal.label}. {goal.lobName} is{' '}
        <b>{goal.pct}% normalized</b> ({goal.decided} of {goal.need} decisions made) — this decision
        is saved automatically and counts toward it.
      </span>
      <span
        style={{
          width: 90,
          height: 6,
          borderRadius: 9,
          background: '#e2e8f0',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: 'block',
            height: 6,
            width: `${goal.pct}%`,
            background: LOGO_BLUE,
          }}
        />
      </span>
    </div>
  );
}

/** The review function each stakeholder kind maps onto — the docs prescribe
 *  exactly these five (Process Owner, Business Architect, Operations Leader,
 *  Risk, Technology). Colour keeps them scannable in the reviewer strip. */
const STAKEHOLDER_TONE: Record<Stakeholder['kind'], string> = {
  'Process Owner': '#4f46e5',
  'Business Architect': '#0891b2',
  'Operations Leader': '#0f766e',
  'Risk & Compliance': '#b91c1c',
  Technology: '#7c3aed',
};

/** Auto-identified reviewers — who must sign off, derived from the graph (owner
 *  roles, org units, Risk on control-touching, Technology on app-touching).
 *  Present on every v2 report so the change never proceeds without its
 *  reviewers named. */
function Stakeholders({ stakeholders }: { stakeholders: Stakeholder[] }) {
  return (
    <div style={{ margin: '10px 16px 0' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#525252', letterSpacing: 0.5 }}>
        STAKEHOLDERS — who reviews this change
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        {stakeholders.map((sh, i) => {
          const tone = STAKEHOLDER_TONE[sh.kind] ?? '#525252';
          // The chip's bold label is the review function (kind); the secondary
          // text names the concrete thing reviewed. Suppress it when it would
          // just echo the function (e.g. old "Technology · Technology" packets).
          const showName = !!sh.name && sh.name.toLowerCase() !== sh.kind.toLowerCase();
          return (
            <span
              key={`${sh.kind}:${sh.entityId ?? sh.name}:${i}`}
              title={sh.why}
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 5,
                maxWidth: '100%',
                padding: '3px 9px',
                borderRadius: 999,
                border: `1px solid ${tone}33`,
                background: `${tone}0d`,
                fontSize: 11,
              }}
            >
              <span style={{ fontWeight: 700, color: tone }}>{sh.kind}</span>
              {showName && (
                <span
                  style={{
                    color: '#404040',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <span aria-hidden style={{ color: `${tone}80`, marginRight: 4 }}>
                    ·
                  </span>
                  {sh.name}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** A lens-specific staged artifact — Producers / Consumers / Information
 *  Components for a deliverable, Milestone / Funding impact for a plan, etc.
 *  One generic renderer covers every lens's stages (Workstream C). */
function SectionCard({ section }: { section: ImpactSection }) {
  return (
    <div
      style={{
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        background: '#fff',
        padding: '9px 11px',
      }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#171717' }}>{section.title}</div>
      {section.blurb && (
        <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2, lineHeight: 1.4 }}>
          {section.blurb}
        </div>
      )}
      {section.rows.length === 0 ? (
        <div style={{ fontSize: 11, color: '#a3a3a3', marginTop: 6 }}>None identified.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 7 }}>
          {section.rows.map((r, i) => (
            <div
              key={`${r.label}:${r.entityId ?? i}`}
              style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 11.5 }}
            >
              <span style={{ fontWeight: 600, color: '#334155', flexShrink: 0 }}>{r.label}</span>
              {r.detail && <span style={{ color: '#64748b', lineHeight: 1.4 }}>{r.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The staged-artifact block — the named artifacts the docs prescribe per lens
 *  (Dependency Map, Producers/Consumers, Milestone Impact, …), rendered under
 *  the six-domain blast-radius grid. */
function SectionStack({ sections }: { sections: ImpactSection[] }) {
  return (
    <div style={{ margin: '4px 16px 12px' }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#525252',
          letterSpacing: 0.5,
          marginBottom: 7,
        }}
      >
        ANALYSIS ARTIFACTS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sections.map((section) => (
          <SectionCard key={section.key} section={section} />
        ))}
      </div>
    </div>
  );
}

/** One knock-on impact domain. Always rendered — an empty card states its
 *  fixed coverage areas and "No impact detected". */
function DomainCard({ label, areas, items }: { label: string; areas: string; items: Impact[] }) {
  const worst = items.length ? SEVERITY_META[items[0].severity] : null;
  return (
    <div
      style={{
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        borderRadius: 8,
        border: `1px solid ${items.length ? '#e2e8f0' : '#f1f5f9'}`,
        borderTop: `3px solid ${worst ? worst.fg : '#e2e8f0'}`,
        background: items.length ? '#fff' : '#fafafa',
        padding: 8,
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              flex: 1,
              fontSize: 10.5,
              fontWeight: 700,
              color: items.length ? '#171717' : '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}
          >
            {label}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: worst ? worst.fg : '#cbd5e1' }}>
            {items.length}
          </span>
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1, lineHeight: 1.35 }}>
          {areas}
        </div>
      </div>
      {items.length === 0 && (
        <div style={{ fontSize: 11, color: '#a3a3a3' }}>Checked — no impact found.</div>
      )}
      {items.map((impact, i) => {
        const m = SEVERITY_META[impact.severity];
        return (
          <div
            key={`${impact.category}:${impact.entityId ?? impact.entityName}:${i}`}
            style={{
              background: m.bg,
              border: `1px solid ${m.border}`,
              borderRadius: 7,
              padding: '6px 8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#171717',
                  lineHeight: 1.3,
                }}
              >
                {impact.entityName}
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: m.fg,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {m.label}
              </span>
            </div>
            <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 1 }}>
              {CATEGORY_LABELS[impact.category] ?? impact.category}
            </div>
            <div style={{ fontSize: 11.5, color: '#404040', lineHeight: 1.5, marginTop: 3 }}>
              {impact.description}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ImpactPanel({ gate }: { gate: ImpactGate }) {
  const s = gate.state;
  const report = s?.report ?? null;
  // A reopened packet shows its stored snapshot verbatim — never re-walk the
  // graph or re-run the AI, so the saved view is stable and reproducible.
  const savedView = !!s?.saved;
  // The AI deep-dive kicks off as soon as the deterministic report lands and
  // its derived lines merge into the domain cards (graph lines first). Skipped
  // for a reopened packet — its snapshot already carries what was assessed.
  const ai = useAiAnalysis(report, savedView ? null : (s?.request ?? null));
  // Save-assessment state (pure assessments) — reset whenever the subject or
  // change type changes so a reshaped report can be saved afresh.
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const saveKey = s
    ? `${s.request.subject.kind}:${s.request.changeType}:${JSON.stringify(s.request.subject)}`
    : '';
  useEffect(() => {
    setSaveStatus('idle');
  }, [saveKey]);
  if (!s) return null;
  const verb = changeLabel(s.request.changeType);
  const destructive = isDestructive(s.request.changeType, report?.changeClass);
  const pickable = !!s.request.pickable;
  const lens = lensForKind(s.request.subject.kind);
  // Product decisions: the panel IS the decision point — the footer offers
  // Retain · Standardize · Retire directly (no verb tag, no generic Proceed).
  const productDecision = s.request.subject.kind === 'product-element';
  const recommendedKey =
    report?.score &&
    ({ STANDARDIZE: 'APPROVED', RETAIN: 'HELD', RETIRE: 'RETIRED' } as const)[
      report.score.recommendation
    ];
  const subjectName = report?.subject.name ?? s.request.label ?? 'this change';
  // One scan phase covers both the graph walk and the AI deep-dive — the
  // report view appears only when the full analysis is in.
  const scanning = s.loading || ai.loading;
  const merged = report
    ? [
        ...report.impacts,
        ...[...ai.impacts].sort((a, b) => severityRank(a.severity) - severityRank(b.severity)),
      ]
    : [];

  // Persist the packet (Workstream D) — snapshot the derived report and its
  // staged artifacts as opaque jsonb. Saved in ASSESSED state; governance
  // (RECOMMEND → maker-checker APPROVE) happens on the assessment record.
  // On success the panel closes: the packet now lives in the subject's
  // assessment history, from where it can be reopened.
  const saveAssessment = async () => {
    if (!report) return;
    setSaveStatus('saving');
    try {
      await api.post('/impact/assessments', {
        subject: s.request.subject,
        subjectName: report.subject.name,
        changeType: report.changeType,
        status: 'ASSESSED',
        ...(report.score ? { recommendation: report.score.recommendation } : {}),
        report,
        ...(report.sections ? { artifacts: { sections: report.sections } } : {}),
      });
      gate.cancel();
    } catch {
      setSaveStatus('error');
    }
  };

  return createPortal(
    <div
      role="presentation"
      onClick={gate.cancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.4)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 60,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Change impact assessment — ${subjectName}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 1020,
          maxWidth: 'calc(100% - 48px)',
          maxHeight: 'calc(100vh - 100px)',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(15,23,42,.3)',
          overflow: 'hidden',
        }}
      >
        <style>{IMPACT_ANIM_CSS}</style>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #eaeaea' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: LOGO_BLUE, letterSpacing: 0.4 }}>
            CHANGE IMPACT
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: '#171717', flex: 1 }}>
              {subjectName}
            </span>
            {pickable && !productDecision && !savedView ? (
              <LensPicker
                lens={lens}
                value={s.request.changeType}
                disabled={s.busy || scanning}
                onPick={gate.reassess}
              />
            ) : (
              !productDecision && (
                <span
                  style={{
                    padding: '2px 9px',
                    borderRadius: 999,
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#fff',
                    background: destructive ? '#dc2626' : LOGO_BLUE,
                  }}
                >
                  {verb}
                </span>
              )
            )}
          </div>
          {report?.subject.context && (
            <div style={{ fontSize: 11, color: '#737373', marginTop: 2 }}>
              {report.subject.context}
            </div>
          )}
          {!scanning && merged.length > 0 && <SeverityTotals impacts={merged} />}
        </div>

        {/* Body — full-screen scanner while assessing/deriving, the six-card
            report only once everything has landed. */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {scanning && !s.error && <ScannerView subjectName={subjectName} />}
          {!s.loading && s.error && !report && (
            <div
              style={{
                margin: 14,
                padding: '9px 12px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: 11.5,
              }}
            >
              Impact assessment unavailable — {s.error}. You can still proceed, but the consequences
              have not been reviewed.
            </div>
          )}
          {report && !scanning && (
            <>
              {report.score && <ScoreCard score={report.score} />}
              {report.stakeholders && report.stakeholders.length > 0 && (
                <Stakeholders stakeholders={report.stakeholders} />
              )}
              <AiAssessment report={report} />
              {merged.length === 0 ? (
                <div style={{ padding: '18px 16px', fontSize: 12.5, color: '#737373' }}>
                  Nothing else in the model touches this — the change is self-contained.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 10,
                    padding: '12px 16px 14px',
                    alignItems: 'start',
                  }}
                >
                  {DOMAIN_META.map((d) => (
                    <DomainCard
                      key={d.key}
                      label={d.label}
                      areas={d.areas}
                      items={merged.filter((i) => i.domain === d.key)}
                    />
                  ))}
                </div>
              )}
              {report.sections && report.sections.length > 0 && (
                <SectionStack sections={report.sections} />
              )}
              {report.goal && <GoalStrip goal={report.goal} />}
            </>
          )}
          {report && s.error && (
            <div
              style={{
                margin: '0 16px 10px',
                padding: '7px 11px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: 11.5,
              }}
            >
              {s.error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '10px 16px',
            borderTop: '1px solid #eaeaea',
            background: '#fafafa',
          }}
        >
          <button
            type="button"
            onClick={gate.cancel}
            disabled={s.busy}
            style={{
              font: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: 7,
              border: '1px solid #e5e5e5',
              background: '#fff',
              color: '#525252',
              cursor: 'pointer',
            }}
          >
            {pickable || savedView ? 'Close' : 'Cancel'}
          </button>
          {savedView ? null : pickable ? (
            // A pure assessment — persist the decision packet (Workstream D) and
            // close. The packet lands in the subject's assessment history, where
            // governance (RECOMMEND → maker-checker approval) runs and from where
            // it can be reopened. Saveable any time a report is on screen.
            <button
              type="button"
              onClick={saveAssessment}
              disabled={!report || scanning || saveStatus === 'saving'}
              style={{
                font: 'inherit',
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 16px',
                borderRadius: 7,
                border: 'none',
                background: saveStatus === 'error' ? '#dc2626' : LOGO_BLUE,
                color: '#fff',
                cursor: !report || scanning || saveStatus === 'saving' ? 'default' : 'pointer',
                opacity: !report || scanning ? 0.6 : 1,
              }}
            >
              {saveStatus === 'saving'
                ? 'Saving…'
                : saveStatus === 'error'
                  ? 'Retry save'
                  : 'Save assessment'}
            </button>
          ) : productDecision ? (
            // The three board decisions, made from the report itself. They
            // unlock — and the recommended one earns its star — only once the
            // FULL analysis (graph walk + AI deep-dive) has landed.
            (
              [
                ['HELD', 'Retain', '#0f766e'],
                ['APPROVED', 'Standardize', '#4f46e5'],
                ['RETIRED', 'Retire', '#dc2626'],
              ] as const
            ).map(([key, label, tone]) => {
              const starred = !scanning && recommendedKey === key;
              const locked = s.busy || scanning;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    gate.confirm(key).catch(() => {
                      /* surfaced via gate.state.error */
                    });
                  }}
                  disabled={locked}
                  title={
                    scanning
                      ? 'Available once the impact analysis completes'
                      : starred
                        ? 'Recommended by the decision score'
                        : undefined
                  }
                  style={{
                    font: 'inherit',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '6px 16px',
                    borderRadius: 7,
                    border: 'none',
                    background: tone,
                    color: '#fff',
                    cursor: locked ? 'default' : 'pointer',
                    opacity: locked ? 0.5 : 1,
                    boxShadow: starred ? `0 0 0 2.5px ${tone}55` : undefined,
                  }}
                >
                  {s.busy ? 'Applying…' : starred ? `${label} ★` : label}
                </button>
              );
            })
          ) : (
            <button
              type="button"
              onClick={() => {
                gate.confirm().catch(() => {
                  /* surfaced via gate.state.error */
                });
              }}
              disabled={s.busy || s.loading}
              style={{
                font: 'inherit',
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 16px',
                borderRadius: 7,
                border: 'none',
                background: destructive ? '#dc2626' : LOGO_BLUE,
                color: '#fff',
                cursor: s.busy || s.loading ? 'default' : 'pointer',
                opacity: s.busy || s.loading ? 0.6 : 1,
              }}
            >
              {s.busy ? 'Applying…' : 'Proceed'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
