// Governance & Audit (CAP-10, NFR-04) — the audit IS the event log: an
// append-only spine every human, agent, and system action lands on (INV-5).
// Top sheet: the event stream (server-filtered by eventType, keyset-paginated —
// this view shows the newest page). Bottom sheet: the agent-action inbox with
// disposition state (ADR-02).
import { useState } from 'react';
import { useApi } from '../../lib/useApi';
import { Sheet, SheetCell, type SheetCol } from '../../components/Sheet';
import { ErrorMessage, LinkButton, Select, StatusPill } from '../../components/ui';
import { actorTone, fmtDateTime, type AgentAction, type GovernanceEvent } from './types';

const DASH = '—';

// The 15 event types on the spine (schema comment, UwGovernanceEvent.eventType).
const EVENT_TYPES = [
  'SubmissionCreated',
  'ExtractionCompleted',
  'ClearanceCompleted',
  'AppetiteEvaluated',
  'TriageScored',
  'EnrichmentRecorded',
  'ProposalIssued',
  'DecisionRecorded',
  'ReferralOpened',
  'ReferralResolved',
  'QuoteProposed',
  'BindExecuted',
  'DivergenceDetected',
  'RationalizationActioned',
  'AgentControl',
];

const actionCols: SheetCol<AgentAction>[] = [
  { key: 'agentId', label: 'Agent', width: 'minmax(110px,1fr)', value: (a) => a.agentId },
  { key: 'kind', label: 'Kind', width: '110px', value: (a) => a.kind, align: 'center' },
  {
    key: 'modelRef',
    label: 'Model',
    width: 'minmax(130px,1fr)',
    value: (a) => a.modelRef,
    dim: true,
  },
  {
    key: 'confidence',
    label: 'Confidence',
    width: '90px',
    align: 'center',
    filterable: false,
    value: (a) => (a.confidence != null ? String(a.confidence) : ''),
    render: (a) => (
      <SheetCell text={a.confidence != null ? `${(a.confidence * 100).toFixed(0)}%` : DASH} dim />
    ),
  },
  {
    key: 'disposition',
    label: 'Disposition',
    width: '110px',
    align: 'center',
    value: (a) => a.disposition,
    render: (a) => (
      <StatusPill
        tone={
          a.disposition === 'PENDING'
            ? 'amber'
            : a.disposition === 'ACCEPTED' || a.disposition === 'MODIFIED'
              ? 'green'
              : a.disposition === 'REJECTED'
                ? 'red'
                : 'slate'
        }
      >
        {a.disposition}
      </StatusPill>
    ),
  },
  {
    key: 'by',
    label: 'Dispositioned by',
    width: 'minmax(140px,1fr)',
    value: (a) => a.dispositionedBy ?? DASH,
    dim: true,
  },
  {
    key: 'sub',
    label: 'Submission',
    width: '100px',
    value: (a) => a.submission?.ref ?? DASH,
    dim: true,
  },
  {
    key: 'createdAt',
    label: 'Created',
    width: '120px',
    filterable: false,
    value: (a) => a.createdAt,
    render: (a) => <SheetCell text={fmtDateTime(a.createdAt)} dim />,
  },
];

export default function GovernanceAudit({
  onOpenSubmission,
}: {
  onOpenSubmission: (id: string) => void;
}) {
  const [eventType, setEventType] = useState('');
  const events = useApi<{ events: GovernanceEvent[]; nextCursor: string | null }>(
    `/uw/events?limit=200${eventType ? `&eventType=${encodeURIComponent(eventType)}` : ''}`,
  );
  const actions = useApi<AgentAction[]>('/uw/agent-actions');

  const eventCols: SheetCol<GovernanceEvent>[] = [
    {
      key: 'at',
      label: 'At',
      width: '130px',
      hideable: false,
      filterable: false,
      value: (e) => e.at,
      render: (e) => <SheetCell text={fmtDateTime(e.at)} dim />,
    },
    { key: 'eventType', label: 'Event', width: 'minmax(160px,1.2fr)', value: (e) => e.eventType },
    {
      key: 'actorKind',
      label: 'Actor kind',
      width: '92px',
      align: 'center',
      value: (e) => e.actorKind,
      render: (e) => <StatusPill tone={actorTone(e.actorKind)}>{e.actorKind}</StatusPill>,
    },
    {
      key: 'actorId',
      label: 'Actor',
      width: 'minmax(150px,1.2fr)',
      value: (e) => e.actorId,
      dim: true,
    },
    {
      key: 'correlationId',
      label: 'Correlation',
      width: '110px',
      hint: 'Correlation id stitches intake → bind across modules (NFR-04)',
      filterable: false,
      sortable: false,
      value: (e) => e.correlationId,
      render: (e) => (
        <SheetCell text={e.correlationId.slice(0, 10) + '…'} dim title={e.correlationId} />
      ),
    },
    {
      key: 'submission',
      label: 'Submission',
      width: '96px',
      align: 'center',
      filterable: false,
      sortable: false,
      render: (e) =>
        e.submissionId ? (
          <LinkButton
            className="text-[12px]"
            onClick={(ev) => {
              ev.stopPropagation();
              onOpenSubmission(e.submissionId as string);
            }}
          >
            open
          </LinkButton>
        ) : (
          <SheetCell text={DASH} dim />
        ),
    },
  ];

  return (
    <div>
      <p className="text-[11px] text-[#737373] mb-3">
        The audit IS the event log — append-only governance spine (NFR-04, INV-5). Every human,
        agent, and system action lands here; agent actions carry a 1-to-1 audited-by event.
      </p>

      {events.error && (
        <ErrorMessage className="mb-3">Failed to load events: {events.error}</ErrorMessage>
      )}
      <Sheet
        sheetKey="uw.events"
        rows={events.data?.events ?? []}
        cols={eventCols}
        rowKey={(e) => e.id}
        loading={events.loading}
        unit="events"
        defaultSort={{ col: 'at', dir: -1 }}
        emptyText="No governance events yet."
        summarize={() => (events.data?.nextCursor ? 'newest 200 (more available)' : 'full history')}
        leading={
          <label className="flex items-center gap-2 text-[11px] text-[#737373]">
            Event type
            <Select
              className="text-xs py-1"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              aria-label="Filter by event type"
            >
              <option value="">All</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </label>
        }
      />

      <h3 className="text-sm font-semibold text-[#171717] mt-6 mb-2">
        Agent actions — proposal envelopes &amp; dispositions (ADR-02)
      </h3>
      {actions.error && (
        <ErrorMessage className="mb-3">Failed to load agent actions: {actions.error}</ErrorMessage>
      )}
      <Sheet
        sheetKey="uw.agentActions"
        rows={actions.data ?? []}
        cols={actionCols}
        rowKey={(a) => a.id}
        loading={actions.loading}
        unit="agent actions"
        defaultSort={{ col: 'createdAt', dir: -1 }}
        emptyText="No agent actions recorded."
        summarize={(v) => `${v.filter((a) => a.disposition === 'PENDING').length} pending`}
      />
    </div>
  );
}
