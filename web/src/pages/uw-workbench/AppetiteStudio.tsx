// Appetite Studio (CAP-03) — appetite as a governed, versioned, effective-dated
// artifact. The Sheet lists every statement version; the publish form always
// creates ref@version+1 (INV-3 — in-place mutation is structurally impossible)
// and surfaces the divergence pairs + re-evaluated submission count returned by
// the publish endpoint.
import { useState } from 'react';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import { fmt } from '../../lib/format';
import { Sheet, SheetCell, type SheetCol } from '../../components/Sheet';
import {
  Button,
  Card,
  ErrorMessage,
  Input,
  Label,
  Select,
  StatusPill,
  Textarea,
} from '../../components/ui';
import { UW_LOBS, errMsg, stanceTone, type AppetiteStatement, type DivergencePair } from './types';

const DASH = '—';

const cols: SheetCol<AppetiteStatement>[] = [
  { key: 'ref', label: 'Ref', width: '80px', hideable: false, value: (s) => s.ref },
  {
    key: 'version',
    label: 'Ver',
    width: '56px',
    align: 'center',
    filterable: false,
    value: (s) => String(s.version),
    render: (s) => <SheetCell text={`v${s.version}`} dim />,
  },
  {
    key: 'stance',
    label: 'Stance',
    width: '110px',
    align: 'center',
    value: (s) => s.stance,
    render: (s) => <StatusPill tone={stanceTone(s.stance)}>{s.stance}</StatusPill>,
  },
  { key: 'lob', label: 'LOB', width: '64px', align: 'center', value: (s) => s.lob },
  {
    key: 'segment',
    label: 'Segment',
    width: 'minmax(120px,1fr)',
    value: (s) => s.segment ?? DASH,
    dim: true,
  },
  { key: 'naics', label: 'NAICS', width: '110px', value: (s) => s.naicsCodes ?? DASH, dim: true },
  {
    key: 'geo',
    label: 'Geographies',
    width: 'minmax(110px,1fr)',
    value: (s) => s.geographies ?? DASH,
    dim: true,
  },
  {
    key: 'tivMax',
    label: 'TIV max',
    width: '90px',
    align: 'right',
    filterable: false,
    value: (s) => (s.tivMax != null ? String(s.tivMax) : ''),
    render: (s) => <SheetCell text={fmt.currency(s.tivMax, { compact: true })} dim />,
  },
  {
    key: 'window',
    label: 'Effective',
    width: '150px',
    filterable: false,
    value: (s) => s.effectiveFrom,
    render: (s) => (
      <SheetCell
        text={`${fmt.date(s.effectiveFrom)} → ${s.effectiveTo ? fmt.date(s.effectiveTo) : 'open'}`}
        dim
      />
    ),
  },
  {
    key: 'status',
    label: 'Status',
    width: '100px',
    align: 'center',
    value: (s) => s.status,
    render: (s) => (
      <StatusPill tone={s.status === 'ACTIVE' ? 'green' : 'slate'}>{s.status}</StatusPill>
    ),
  },
  {
    key: 'rationale',
    label: 'Rationale',
    width: 'minmax(160px,1.4fr)',
    filterable: false,
    sortable: false,
    value: (s) => s.rationale,
    render: (s) => <SheetCell text={s.rationale} dim title={s.rationale} />,
  },
];

type FormState = {
  ref: string;
  stance: string;
  lob: string;
  segment: string;
  naicsCodes: string;
  geographies: string;
  tivMax: string;
  effectiveFrom: string;
  effectiveTo: string;
  rationale: string;
};

const EMPTY_FORM: FormState = {
  ref: '',
  stance: 'TARGET',
  lob: 'CP',
  segment: '',
  naicsCodes: '',
  geographies: '',
  tivMax: '',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: '',
  rationale: '',
};

export default function AppetiteStudio() {
  const dialogs = useDialogs();
  const { data, error, loading, refetch } = useApi<AppetiteStatement[]>(
    '/uw/appetite/statements',
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function publish() {
    if (form.ref && !/^AS-\d{3}$/.test(form.ref)) {
      await dialogs.alert('Ref must match AS-### (leave blank to mint a new statement family).');
      return;
    }
    if (!form.effectiveFrom) {
      await dialogs.alert('Effective-from date is required.');
      return;
    }
    if (form.rationale.trim().length < 20) {
      await dialogs.alert(
        'Rationale must be at least 20 characters — it is cited on every verdict.',
      );
      return;
    }
    const tivMax = form.tivMax ? Number(form.tivMax) : undefined;
    if (tivMax !== undefined && (Number.isNaN(tivMax) || tivMax <= 0)) {
      await dialogs.alert('TIV max must be a positive number.');
      return;
    }
    setBusy(true);
    try {
      const res = (await api.post('/uw/appetite/statements', {
        ref: form.ref || undefined,
        stance: form.stance,
        lob: form.lob,
        segment: form.segment || undefined,
        naicsCodes: form.naicsCodes || undefined,
        geographies: form.geographies || undefined,
        tivMax,
        effectiveFrom: new Date(form.effectiveFrom).toISOString(),
        effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : undefined,
        rationale: form.rationale.trim(),
      })) as {
        statement: AppetiteStatement;
        divergencePairs: DivergencePair[];
        reevaluatedSubmissions: number;
      };
      await dialogs.alert({
        title: `Published ${res.statement.ref} v${res.statement.version}`,
        message:
          `${res.reevaluatedSubmissions} open submission(s) re-evaluated against the new statement.` +
          (res.divergencePairs.length
            ? ` Divergence detected: ${res.divergencePairs.map((p) => `${p.ref} (weight ${p.weight})`).join(', ')} — see the Rationalization tab.`
            : ''),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      refetch();
    } catch (e) {
      await dialogs.alert({ title: 'Publish blocked', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && (
        <ErrorMessage className="mb-3">Failed to load appetite statements: {error}</ErrorMessage>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <p className="text-[11px] text-[#737373]">
          Edits create v+1, never mutate (INV-3) · verdicts always cite statement IDs
        </p>
        <div className="flex-1" />
        <Button className="text-xs" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close form' : 'Publish statement'}
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 mb-4">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <Label htmlFor="as-ref">Ref (blank = new family)</Label>
              <Input
                id="as-ref"
                value={form.ref}
                onChange={(e) => set('ref')(e.target.value)}
                placeholder="AS-114"
              />
            </div>
            <div>
              <Label htmlFor="as-stance">Stance</Label>
              <Select
                id="as-stance"
                value={form.stance}
                onChange={(e) => set('stance')(e.target.value)}
              >
                {['TARGET', 'ACCEPTABLE', 'REFER', 'DECLINE'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="as-lob">LOB</Label>
              <Select id="as-lob" value={form.lob} onChange={(e) => set('lob')(e.target.value)}>
                {UW_LOBS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="as-segment">Segment</Label>
              <Input
                id="as-segment"
                value={form.segment}
                onChange={(e) => set('segment')(e.target.value)}
                placeholder="Middle market"
              />
            </div>
            <div>
              <Label htmlFor="as-naics">NAICS codes (comma list)</Label>
              <Input
                id="as-naics"
                value={form.naicsCodes}
                onChange={(e) => set('naicsCodes')(e.target.value)}
                placeholder="4451, 4452"
              />
            </div>
            <div>
              <Label htmlFor="as-geo">Geographies (comma list)</Label>
              <Input
                id="as-geo"
                value={form.geographies}
                onChange={(e) => set('geographies')(e.target.value)}
                placeholder="NC, SC, GA"
              />
            </div>
            <div>
              <Label htmlFor="as-tiv">TIV max (USD)</Label>
              <Input
                id="as-tiv"
                type="number"
                min={0}
                value={form.tivMax}
                onChange={(e) => set('tivMax')(e.target.value)}
                placeholder="25000000"
              />
            </div>
            <div>
              <Label htmlFor="as-from">Effective from</Label>
              <Input
                id="as-from"
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => set('effectiveFrom')(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="as-to">Effective to (optional)</Label>
              <Input
                id="as-to"
                type="date"
                value={form.effectiveTo}
                onChange={(e) => set('effectiveTo')(e.target.value)}
              />
            </div>
            <div className="sm:col-span-3 lg:col-span-4">
              <Label htmlFor="as-rationale">Rationale (min 20 characters)</Label>
              <Textarea
                id="as-rationale"
                rows={2}
                value={form.rationale}
                onChange={(e) => set('rationale')(e.target.value)}
                placeholder="Why this stance — recorded on the statement version and cited on every verdict"
              />
            </div>
          </div>
          <div className="mt-3">
            <Button className="text-xs" disabled={busy} onClick={publish}>
              Publish v+1
            </Button>
          </div>
        </Card>
      )}

      <Sheet
        sheetKey="uw.appetite"
        rows={data ?? []}
        cols={cols}
        rowKey={(s) => s.id}
        loading={loading}
        unit="statement versions"
        defaultSort={{ col: 'ref', dir: 1 }}
        emptyText="No appetite statements published yet."
        summarize={(v) =>
          `${new Set(v.map((s) => s.ref)).size} families · ${v.filter((s) => s.status === 'ACTIVE').length} active`
        }
      />
    </div>
  );
}
