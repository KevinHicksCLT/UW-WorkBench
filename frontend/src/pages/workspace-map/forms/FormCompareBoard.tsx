// The Workspace's Forms lens — the two actual documents side by side with the
// wording differences highlighted red, over the PolicyForm library. The
// PRIMARY flow compares one form across two of its versions (version pickers
// appear when a form has editions); any two forms compare the same way.
// Scoping reuses the Products lens' spine cascade (Segment › LOB › Offering ›
// State › Version) — the server's forms register for that scope decides which
// library forms the pickers offer. Picks live in the URL
// (?formA=&formB=&verA=&verB=) so the Products heat-map drill deep-links in.
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorMessage, LoadingState, Select } from '../../../components/ui';
import { useApi } from '../../../lib/useApi';
import { useViewState } from '../../../lib/viewState';
import LensBar, { type WorkspaceLens } from '../LensBar';
import SpineFilterBar, {
  EMPTY_FILTERS,
  normalizeFilters,
  type SpineFilters,
} from '../product/SpineFilterBar';
import { leanLobOptions, scopeQuery, type BoardPayload } from '../product/boardApi';
import { formLabel, type ComparePayload, type FormOption } from './compareApi';
import DiffSummary from './DiffSummary';
import FormDiffView from './FormDiffView';

const A_PARAM = 'formA';
const B_PARAM = 'formB';
const AV_PARAM = 'verA';
const BV_PARAM = 'verB';

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
  const verA = params.get(AV_PARAM);
  const verB = params.get(BV_PARAM);
  const apply = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, id] of Object.entries(changes)) {
      if (id) next.set(key, id);
      else next.delete(key);
    }
    setParams(next, { replace: false });
  };
  // Picking a form resets that side's version pick (it belongs to the old
  // form). The PRIMARY flow — version-vs-version of one form — self-arranges:
  // picking a multi-version form as A with no B yet compares its two latest
  // editions against each other.
  const pickForm = (side: 'a' | 'b', id: string | null) => {
    const changes: Record<string, string | null> =
      side === 'a' ? { [A_PARAM]: id, [AV_PARAM]: null } : { [B_PARAM]: id, [BV_PARAM]: null };
    const picked = id ? (forms ?? []).find((f) => f.id === id) : null;
    if (side === 'a' && picked && !formB && picked.versions.length > 1) {
      changes[B_PARAM] = picked.id;
      changes[AV_PARAM] = picked.versions[0].id;
      changes[BV_PARAM] = picked.versions[1].id;
    }
    apply(changes);
  };

  // The Products lens' spine cascade scopes the picker pool: the board's
  // server-derived forms register for the scope lists the library forms that
  // scope carries. Filters + search persist per session.
  const [rawFilters, setFilters] = useViewState<SpineFilters>(
    'workspace.formCompare.spineFilters',
    EMPTY_FILTERS,
  );
  const filters = useMemo(() => normalizeFilters(rawFilters), [rawFilters]);
  const [search, setSearch] = useViewState('workspace.formCompare.search', '');
  const [hideIdentical, setHideIdentical] = useViewState(
    'workspace.formCompare.changedOnly',
    false,
  );
  // The primary flow is one form across its editions — this narrows the
  // pickers to the forms that HAVE a version history to compare.
  const [multiVersion, setMultiVersion] = useViewState('workspace.formCompare.multiVersion', false);
  const { data: board } = useApi<BoardPayload>(`/product-spine/board?${scopeQuery(filters, 0)}`);
  const lobs = useMemo(() => (board ? leanLobOptions(board.spine) : []), [board]);
  const scoping = Object.values(filters).some((level) => level.length > 0);
  const scopedFormIds = useMemo(() => {
    if (!scoping || !board?.forms) return null;
    return new Set(
      board.forms.sections.flatMap((s) =>
        s.rows.map((r) => r.formId).filter((id): id is string => Boolean(id)),
      ),
    );
  }, [scoping, board]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (forms ?? []).filter((f) => {
      if (scopedFormIds && !scopedFormIds.has(f.id)) return false;
      if (multiVersion && f.versions.length < 2) return false;
      if (needle && !`${f.formNumber} ${f.title}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [forms, search, scopedFormIds, multiVersion]);

  // A picked form stays pickable even when the current filters hide it —
  // filters narrow the MENU, they never silently drop an active comparison.
  // The other side's form stays listed too when it has a version history, so
  // the same form can be put on both sides and compared edition vs edition.
  const optionsFor = (pickedId: string | null) => {
    const otherId = pickedId === formA ? formB : formA;
    const other = (forms ?? []).find((f) => f.id === otherId);
    const list = filtered.filter((f) => f.id !== otherId || (other?.versions.length ?? 0) > 1);
    const picked = (forms ?? []).find((f) => f.id === pickedId);
    if (picked && !list.some((f) => f.id === picked.id)) return [picked, ...list];
    return list;
  };

  // Same form on both sides needs two DIFFERENT versions before fetching —
  // default both pickers sensibly instead of asking the server to 400.
  const sameForm = Boolean(formA && formA === formB);
  const pickedA = (forms ?? []).find((f) => f.id === formA);
  const pickedB = (forms ?? []).find((f) => f.id === formB);
  const effVerA = verA ?? pickedA?.versions[0]?.id ?? null;
  const effVerB =
    verB ?? (sameForm ? (pickedB?.versions[1]?.id ?? null) : (pickedB?.versions[0]?.id ?? null));
  const ready = Boolean(
    formA && formB && (!sameForm || (effVerA && effVerB && effVerA !== effVerB)),
  );
  const comparePath = ready
    ? `/forms/compare?a=${encodeURIComponent(formA as string)}&b=${encodeURIComponent(formB as string)}` +
      (effVerA ? `&av=${encodeURIComponent(effVerA)}` : '') +
      (effVerB ? `&bv=${encodeURIComponent(effVerB)}` : '')
    : null;
  const { data: payload, loading, error } = useApi<ComparePayload>(comparePath);

  return (
    <div>
      <LensBar lens={lens} onLens={onLens} boards={[]} boardId={null} onBoard={() => undefined} />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <SpineFilterBar
          lobs={lobs}
          filters={filters}
          onChange={setFilters}
          search={search}
          onSearch={setSearch}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginLeft: 'auto',
            flexShrink: 0,
            height: 30,
          }}
        >
          <span style={{ fontSize: 11, color: '#737373' }}>
            {filtered.length} of {(forms ?? []).length} forms
          </span>
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
            title="only forms with more than one ingested version — the ones comparable edition against edition"
          >
            <input
              type="checkbox"
              checked={multiVersion}
              onChange={(e) => setMultiVersion(e.target.checked)}
            />
            With version history
          </label>
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
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <SidePicker
          label="Form A"
          formValue={formA}
          options={optionsFor(formA)}
          onForm={(id) => pickForm('a', id)}
          form={pickedA}
          versionValue={effVerA}
          onVersion={(id) => apply({ [AV_PARAM]: id })}
        />
        <button
          type="button"
          title="swap the two sides"
          onClick={() =>
            apply({
              [A_PARAM]: formB,
              [B_PARAM]: formA,
              [AV_PARAM]: verB ?? effVerB,
              [BV_PARAM]: verA ?? effVerA,
            })
          }
          style={{
            font: 'inherit',
            fontSize: 13,
            height: 34,
            padding: '0 10px',
            border: '1px solid #eaeaea',
            borderRadius: 6,
            background: '#fff',
            color: '#525252',
            cursor: 'pointer',
          }}
        >
          ⇄
        </button>
        <SidePicker
          label="Form B"
          formValue={formB}
          options={optionsFor(formB)}
          onForm={(id) => pickForm('b', id)}
          form={pickedB}
          versionValue={effVerB}
          onVersion={(id) => apply({ [BV_PARAM]: id })}
        />
      </div>
      {sameForm && !ready && pickedA && (
        <ErrorMessage>
          {pickedA.versions.length > 1
            ? 'Pick two different versions of this form to compare.'
            : 'This form has only one ingested version — pick another form (or ingest a new version from the Forms library) to compare against.'}
        </ErrorMessage>
      )}
      {listError && <ErrorMessage>{listError}</ErrorMessage>}
      {listLoading && !forms && <LoadingState message="Loading the form library…" />}
      {!comparePath && !listLoading && !listError && !sameForm && (
        <EmptyState message="Pick a form above to compare its versions (or pick two different forms) — the documents render side by side with every wording difference highlighted." />
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

/** One side of the comparison: the form pick + (when the form has editions)
 *  its version pick, sized so the label never clips. */
function SidePicker({
  label,
  formValue,
  options,
  onForm,
  form,
  versionValue,
  onVersion,
}: {
  label: string;
  formValue: string | null;
  options: FormOption[];
  onForm: (id: string | null) => void;
  form: FormOption | undefined;
  versionValue: string | null;
  onVersion: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <Select
        aria-label={label}
        title={label}
        value={formValue ?? ''}
        onChange={(e) => onForm(e.target.value || null)}
        style={{ flex: 1, minWidth: 0, height: 34, fontSize: 13 }}
      >
        <option value="">{label} — pick a form…</option>
        {options.map((f) => (
          <option key={f.id} value={f.id}>
            {formLabel(f)}
          </option>
        ))}
      </Select>
      {form && form.versions.length > 1 && (
        <Select
          aria-label={`${label} version`}
          title={`${label} version`}
          value={versionValue ?? ''}
          onChange={(e) => onVersion(e.target.value)}
          style={{ width: 'auto', minWidth: 76, height: 34, fontSize: 13, flexShrink: 0 }}
        >
          {form.versions.map((v) => (
            <option key={v.id} value={v.id}>
              v{v.versionNo}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
