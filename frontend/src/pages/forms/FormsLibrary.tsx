import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { useViewState } from '../../lib/viewState';
import PageHeader from '../../components/PageHeader';
import { Sheet, type SheetCol } from '../../components/Sheet';
import {
  Button,
  Card,
  Chip,
  DrawerShell,
  ErrorMessage,
  Input,
  Label,
  LinkButton,
  Select,
  StatusPill,
  Textarea,
  type PillTone,
} from '../../components/ui';
import type { FormDetail, FormsInsights, PolicyFormRow } from './types';

// Forms Library (FORMS-LIB) — the governed system of record for proprietary
// policy forms: insight tiles, the canonical Sheet list, a detail drawer with
// versions/clauses/dispositions/links, and create + ingest flows.
// Data: GET /forms, GET /forms/insights, GET /forms/:id.

const DASH = '—';

const FILING_TONE: Record<string, PillTone> = {
  Draft: 'slate',
  Filed: 'blue',
  Approved: 'green',
  Withdrawn: 'red',
};

export default function FormsLibrary() {
  const { data, error, loading, refetch } = useApi<PolicyFormRow[]>('/forms');
  const { data: insights, refetch: refetchInsights } = useApi<FormsInsights>('/forms/insights');
  const rows = data ?? [];
  const [selectedId, setSelectedId] = useViewState<string | null>('forms.selected', null);
  const [adding, setAdding] = useState(false);

  const cols: SheetCol<PolicyFormRow>[] = [
    { key: 'number', label: 'Form #', width: '110px', value: (f) => f.formNumber, hideable: false },
    { key: 'title', label: 'Title', width: 'minmax(0,1.4fr)', value: (f) => f.title },
    { key: 'lob', label: 'LOB', width: '150px', value: (f) => f.lob ?? DASH, dim: true },
    {
      key: 'states',
      label: 'States',
      width: '120px',
      values: (f) => (f.states && f.states.length > 0 ? f.states : ['Countrywide']),
      render: (f) => (
        <span className="truncate text-[12px] text-[#737373]">
          {f.states && f.states.length > 0 ? f.states.join(', ') : 'Countrywide'}
        </span>
      ),
    },
    {
      key: 'edition',
      label: 'Edition',
      width: '90px',
      value: (f) => f.editionDate ?? DASH,
      dim: true,
    },
    {
      key: 'filing',
      label: 'Filing',
      width: '110px',
      value: (f) => f.filingStatus,
      render: (f) => (
        <StatusPill tone={FILING_TONE[f.filingStatus] ?? 'slate'}>{f.filingStatus}</StatusPill>
      ),
    },
    {
      key: 'provenance',
      label: 'Provenance',
      width: '110px',
      value: (f) => f.provenance,
      render: (f) =>
        f.provenance === 'iso-flagged' ? (
          <StatusPill tone="amber">ISO-flagged</StatusPill>
        ) : (
          <span className="truncate text-[12px] text-[#737373]">client</span>
        ),
    },
    {
      key: 'version',
      label: 'Ver',
      width: '70px',
      align: 'right',
      value: (f) => (f.latestVersion ? `v${f.latestVersion.versionNo}` : DASH),
      render: (f) => (
        <span
          className={
            'truncate text-[12px] ' +
            (f.latestVersion?.status === 'quarantined' ? 'text-[#b45309]' : 'text-[#737373]')
          }
          title={
            f.latestVersion?.status === 'quarantined'
              ? 'Quarantined: low segmentation confidence'
              : undefined
          }
        >
          {f.latestVersion
            ? `v${f.latestVersion.versionNo}${f.latestVersion.status === 'quarantined' ? ' ⚠' : ''}`
            : DASH}
        </span>
      ),
    },
    {
      key: 'clauses',
      label: 'Clauses',
      width: '80px',
      align: 'right',
      value: (f) => String(f.clauseCount),
      dim: true,
    },
    {
      key: 'fields',
      label: 'Fields',
      width: '70px',
      align: 'right',
      value: (f) => String(f.fieldCount),
      dim: true,
    },
    {
      key: 'owner',
      label: 'Owner role',
      width: 'minmax(0,1fr)',
      value: (f) => f.ownerRole?.displayValue ?? DASH,
      dim: true,
    },
  ];

  if (error) return <ErrorMessage>{error}</ErrorMessage>;

  const refresh = () => {
    refetch();
    refetchInsights();
  };

  return (
    <div>
      <PageHeader
        title="Forms"
        subtitle="Policy forms as a governed, machine-readable library — what your forms say, and what they ask."
        actions={<Button onClick={() => setAdding(true)}>Add form</Button>}
      />
      {insights && <InsightTiles insights={insights} />}

      <Sheet
        sheetKey="forms-library"
        rows={rows}
        cols={cols}
        rowKey={(f) => f.id}
        loading={loading}
        unit="forms"
        emptyText="No forms yet — add a form, then ingest its text as version 1."
        onRowClick={(f) => setSelectedId(f.id)}
        summarize={(v) =>
          `${new Set(v.map((f) => f.lob).filter(Boolean)).size} lines of business · ${v.filter((f) => f._count.dispositions > 0).length} with dispositions`
        }
      />

      {selectedId && (
        <FormDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={refresh} />
      )}
      {adding && (
        <AddFormDrawer
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function InsightTiles({ insights }: { insights: FormsInsights }) {
  const needsHuman =
    (insights.rationalization.findingsByStatus['needs-human'] ?? 0) +
    (insights.fieldPlane.mappingsByStatus['needs-human'] ?? 0);
  const tiles = [
    { label: 'Forms', value: insights.library.forms },
    { label: 'Clauses', value: insights.library.clauses },
    { label: 'Clusters', value: insights.rationalization.clusters },
    { label: 'Preferred wordings', value: insights.rationalization.preferredWordings },
    {
      label: 'Disposition coverage',
      value: `${Math.round(insights.rationalization.dispositionCoverage * 100)}%`,
    },
    { label: 'Needs human review', value: needsHuman, warn: needsHuman > 0 },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
      {tiles.map((t) => (
        <Card key={t.label} className="px-4 py-3">
          <div className={'text-xl font-bold ' + (t.warn ? 'text-[#b45309]' : 'text-[#171717]')}>
            {t.value}
          </div>
          <div className="text-[11px] text-[#737373] mt-0.5">{t.label}</div>
        </Card>
      ))}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">
        {label}
      </div>
      <div className="text-sm text-[#171717]">{children}</div>
    </div>
  );
}

function FormDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data: form, error, refetch } = useApi<FormDetail>(`/forms/${id}`);
  const [ingesting, setIngesting] = useState(false);
  const navigate = useNavigate();
  if (error) return null;

  return (
    <DrawerShell
      onClose={onClose}
      width={720}
      maxWidth="94vw"
      header={
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.10em] text-[#a3a3a3] mb-1">
            {form?.lob ?? 'Policy form'}
          </div>
          <h2 className="text-[16px] font-bold text-[#171717] leading-snug">
            {form ? `${form.formNumber} — ${form.title}` : 'Loading…'}
          </h2>
        </div>
      }
    >
      {form && (
        <div className="space-y-5">
          {form.latestSourceText && (
            <LinkButton onClick={() => navigate(`/forms/${form.id}/document`)}>
              View form document →
            </LinkButton>
          )}
          <div className="grid grid-cols-3 gap-4">
            <Section label="Filing status">
              <StatusPill tone={FILING_TONE[form.filingStatus] ?? 'slate'}>
                {form.filingStatus}
              </StatusPill>
            </Section>
            <Section label="Provenance">
              {form.provenance === 'iso-flagged' ? (
                <StatusPill tone="amber">ISO-flagged (blocked from grounding)</StatusPill>
              ) : (
                'Client-owned'
              )}
            </Section>
            <Section label="Owner role">{form.ownerRole?.displayValue ?? DASH}</Section>
          </div>

          <Section label={`Versions (${form.versions.length})`}>
            {form.versions.length === 0 ? (
              <span className="text-[#a3a3a3] italic">
                No versions — ingest the form text to create v1.
              </span>
            ) : (
              <ul className="space-y-1">
                {form.versions.map((v) => (
                  <li key={v.id} className="flex items-center gap-2 text-[13px]">
                    <span className="font-medium">v{v.versionNo}</span>
                    <StatusPill
                      tone={
                        v.status === 'ready'
                          ? 'green'
                          : v.status === 'quarantined'
                            ? 'amber'
                            : 'slate'
                      }
                    >
                      {v.status}
                    </StatusPill>
                    <span className="text-[#a3a3a3] text-[12px]">
                      seg. confidence {(v.segConfidence * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {form.latestClauses.length > 0 && (
            <Section label={`Latest clauses (${form.latestClauses.length})`}>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {form.latestClauses.map((c) => (
                  <div key={c.id} className="border border-[#eaeaea] rounded-md p-2.5">
                    <div className="text-[11px] font-semibold text-[#525252] mb-1">
                      {c.ordinal}. {c.heading ?? 'Clause'}
                    </div>
                    <div className="text-[12px] text-[#404040] whitespace-pre-wrap">{c.text}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {(form.applications.length > 0 || form.processLinks.length > 0) && (
            <Section label="Six-dimension links">
              <div className="flex flex-wrap gap-1.5">
                {form.applications.map((a) => (
                  <Chip key={a.id} title={a.role_}>
                    ⚙ {a.application.name}
                  </Chip>
                ))}
                {form.processLinks.map((l) => (
                  <Chip key={l.id} title={l.role_}>
                    {l.processNode.isTask ? '☑' : '⇄'} {l.processNode.displayValue}
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          {form.dispositions.length > 0 && (
            <Section label="Dispositions">
              <ul className="space-y-1">
                {form.dispositions.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-[13px]">
                    <Chip>{d.type}</Chip>
                    <StatusPill
                      tone={
                        d.status === 'executed' ? 'green' : d.status === 'rejected' ? 'red' : 'blue'
                      }
                    >
                      {d.status}
                    </StatusPill>
                    {d.rationale && (
                      <span className="text-[#737373] text-[12px] truncate">{d.rationale}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="pt-2 border-t border-[#eaeaea]">
            {ingesting ? (
              <IngestPanel
                formId={form.id}
                onDone={() => {
                  setIngesting(false);
                  refetch();
                  onChanged();
                }}
                onCancel={() => setIngesting(false)}
              />
            ) : (
              <Button variant="secondary" onClick={() => setIngesting(true)}>
                Ingest new version
              </Button>
            )}
          </div>
        </div>
      )}
    </DrawerShell>
  );
}

function IngestPanel({
  formId,
  onDone,
  onCancel,
}: {
  formId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.post(`/forms/${formId}/versions`, { sourceText: text });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ingest failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <Label>Form text (clauses are segmented automatically on ingest)</Label>
      <Textarea
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the form's full text…"
      />
      {err && <ErrorMessage>{err}</ErrorMessage>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy || text.trim().length === 0}>
          {busy ? 'Ingesting…' : 'Ingest'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

const LOBS = ['General Liability', 'Property', 'Auto', 'Workers Comp', 'Umbrella', 'Professional'];

function AddFormDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [formNumber, setFormNumber] = useState('');
  const [title, setTitle] = useState('');
  const [lob, setLob] = useState('');
  const [editionDate, setEditionDate] = useState('');
  const [states, setStates] = useState('');
  const [provenance, setProvenance] = useState('client');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.post('/forms', {
        formNumber,
        title,
        lob: lob || undefined,
        editionDate: editionDate || undefined,
        states: states
          ? states
              .split(',')
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean)
          : undefined,
        provenance,
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerShell
      onClose={onClose}
      width={480}
      maxWidth="94vw"
      header={<h2 className="text-[16px] font-bold text-[#171717]">Add form</h2>}
    >
      <div className="space-y-4">
        <div>
          <Label>Form number</Label>
          <Input
            value={formNumber}
            onChange={(e) => setFormNumber(e.target.value)}
            placeholder="CG 20 10"
          />
        </div>
        <div>
          <Label>Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Additional Insured — Owners, Lessees or Contractors"
          />
        </div>
        <div>
          <Label>Line of business</Label>
          <Select value={lob} onChange={(e) => setLob(e.target.value)}>
            <option value="">—</option>
            {LOBS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Edition</Label>
            <Input
              value={editionDate}
              onChange={(e) => setEditionDate(e.target.value)}
              placeholder="04 13"
            />
          </div>
          <div>
            <Label>States (comma-sep; blank = countrywide)</Label>
            <Input
              value={states}
              onChange={(e) => setStates(e.target.value)}
              placeholder="NY, CA"
            />
          </div>
        </div>
        <div>
          <Label>Provenance</Label>
          <Select value={provenance} onChange={(e) => setProvenance(e.target.value)}>
            <option value="client">Client-owned</option>
            <option value="iso-flagged">ISO-flagged (excluded from grounding)</option>
          </Select>
        </div>
        {err && <ErrorMessage>{err}</ErrorMessage>}
        <Button onClick={submit} disabled={busy || !formNumber.trim() || !title.trim()}>
          {busy ? 'Creating…' : 'Create form'}
        </Button>
      </div>
    </DrawerShell>
  );
}
