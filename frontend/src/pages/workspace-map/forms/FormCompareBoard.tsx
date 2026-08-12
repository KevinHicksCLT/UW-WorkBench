// The Workspace's Form Comparison lens — a Beyond-Compare-style two-pane
// verbiage diff over the PolicyForm library. Filters (search / LOB / state)
// narrow the picker lists, the A/B pickers choose the two forms, and the
// panes + summary render GET /forms/compare. The picks live in the URL
// (?formA=&formB=) so the Products heat-map drill can deep-link straight in.
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorMessage, Input, LoadingState, Select } from '../../../components/ui';
import { useApi } from '../../../lib/useApi';
import { useViewState } from '../../../lib/viewState';
import LensBar, { type WorkspaceLens } from '../LensBar';
import { formLabel, type ComparePayload, type FormOption } from './compareApi';
import DiffSummary from './DiffSummary';
import FormDiffView from './FormDiffView';

const A_PARAM = 'formA';
const B_PARAM = 'formB';

/** Countrywide sentinel for the state filter (PolicyForm.states = null). */
const CW = 'CW';

export default function FormCompareBoard({
  lens,
  onLens,
}: {
  lens: WorkspaceLens;
  onLens: (l: WorkspaceLens) => void;
}) {
  const { data: forms, loading: listLoading, error: listError } = useApi<FormOption[]>('/forms');

  // Picks ride in the URL so heat-map drill links land pre-selected and the
  // browser back button steps out of a comparison.
  const [params, setParams] = useSearchParams();
  const formA = params.get(A_PARAM);
  const formB = params.get(B_PARAM);
  const setPick = (key: string, id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set(key, id);
    else next.delete(key);
    setParams(next, { replace: false });
  };

  // Filters persist per session like every other workspace control.
  const [search, setSearch] = useViewState('workspace.formCompare.search', '');
  const [lob, setLob] = useViewState('workspace.formCompare.lob', '');
  const [state, setState] = useViewState('workspace.formCompare.state', '');
  const [hideIdentical, setHideIdentical] = useViewState(
    'workspace.formCompare.changedOnly',
    false,
  );

  const lobs = useMemo(
    () => [...new Set((forms ?? []).map((f) => f.lob).filter((l): l is string => !!l))].sort(),
    [forms],
  );
  const states = useMemo(
    () => [...new Set((forms ?? []).flatMap((f) => f.states ?? []))].sort(),
    [forms],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (forms ?? []).filter((f) => {
      if (lob && f.lob !== lob) return false;
      // A state pick keeps that state's forms AND countrywide forms (they
      // apply everywhere); the CW pick keeps countrywide forms only.
      if (state === CW && f.states && f.states.length > 0) return false;
      if (state && state !== CW && f.states && !f.states.includes(state)) return false;
      if (needle && !`${f.formNumber} ${f.title}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [forms, search, lob, state]);

  // A picked form stays pickable even when the current filters hide it —
  // filters narrow the MENU, they never silently drop an active comparison.
  const optionsFor = (pickedId: string | null) => {
    const list = filtered.filter((f) => f.id !== (pickedId === formA ? formB : formA));
    const picked = (forms ?? []).find((f) => f.id === pickedId);
    if (picked && !list.some((f) => f.id === picked.id)) return [picked, ...list];
    return list;
  };

  const comparePath =
    formA && formB
      ? `/forms/compare?a=${encodeURIComponent(formA)}&b=${encodeURIComponent(formB)}`
      : null;
  const { data: payload, loading, error } = useApi<ComparePayload>(comparePath);

  return (
    <div>
      <LensBar lens={lens} onLens={onLens} boards={[]} boardId={null} onBoard={() => undefined} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <Input
          aria-label="Search forms"
          placeholder="Search form number or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 240, height: 30, fontSize: 12.5 }}
        />
        <Select
          aria-label="Line of business"
          title="Line of business"
          value={lob}
          onChange={(e) => setLob(e.target.value)}
          style={{ width: 'auto', minWidth: 150, height: 30, fontSize: 12.5 }}
        >
          <option value="">All lines of business</option>
          {lobs.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
        <Select
          aria-label="State"
          title="State"
          value={state}
          onChange={(e) => setState(e.target.value)}
          style={{ width: 'auto', minWidth: 120, height: 30, fontSize: 12.5 }}
        >
          <option value="">All states</option>
          <option value={CW}>Countrywide only</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <span style={{ fontSize: 11, color: '#737373' }}>
          {filtered.length} of {(forms ?? []).length} forms
        </span>
        <div style={{ flex: 1 }} />
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11.5,
            fontWeight: 500,
            color: '#525252',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={hideIdentical}
            onChange={(e) => setHideIdentical(e.target.checked)}
          />
          Changed clauses only
        </label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <FormPick
          label="Form A"
          value={formA}
          options={optionsFor(formA)}
          onPick={(id) => setPick(A_PARAM, id)}
        />
        <button
          type="button"
          title="swap the two forms"
          onClick={() => {
            const next = new URLSearchParams(params);
            if (formB) next.set(A_PARAM, formB);
            else next.delete(A_PARAM);
            if (formA) next.set(B_PARAM, formA);
            else next.delete(B_PARAM);
            setParams(next, { replace: false });
          }}
          style={{
            font: 'inherit',
            fontSize: 13,
            height: 30,
            padding: '0 10px',
            border: '1px solid #eaeaea',
            borderRadius: 6,
            background: '#fff',
            color: '#525252',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          ⇄
        </button>
        <FormPick
          label="Form B"
          value={formB}
          options={optionsFor(formB)}
          onPick={(id) => setPick(B_PARAM, id)}
        />
      </div>
      {listError && <ErrorMessage>{listError}</ErrorMessage>}
      {listLoading && !forms && <LoadingState message="Loading the form library…" />}
      {!comparePath && !listLoading && !listError && (
        <EmptyState message="Pick two forms above (narrow the list with the filters) to see every wording difference between them, Beyond-Compare style." />
      )}
      {comparePath && loading && !payload && <LoadingState message="Comparing the two forms…" />}
      {comparePath && error && <ErrorMessage>{error}</ErrorMessage>}
      {comparePath && payload && (
        <>
          <FormDiffView payload={payload} hideIdentical={hideIdentical} />
          <DiffSummary payload={payload} />
        </>
      )}
    </div>
  );
}

function FormPick({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: string | null;
  options: FormOption[];
  onPick: (id: string | null) => void;
}) {
  return (
    <Select
      aria-label={label}
      title={label}
      value={value ?? ''}
      onChange={(e) => onPick(e.target.value || null)}
      style={{ flex: 1, minWidth: 0, height: 30, fontSize: 12.5 }}
    >
      <option value="">{label} — pick a form…</option>
      {options.map((f) => (
        <option key={f.id} value={f.id}>
          {formLabel(f)}
        </option>
      ))}
    </Select>
  );
}
