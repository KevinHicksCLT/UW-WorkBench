import { useSearchParams } from 'react-router-dom';
import WorkspaceMap from '../workspace-map/WorkspaceMap';

// Workspace — the interactive rationalization map (brown-field decomposition →
// Normalize → green-field target), rebuilt 2026-07-12 against the live
// /rationalization API after the previous board was retired. Rendered bare —
// no Card wrapper: the toolbar sits directly under the app breadcrumb and the
// map canvas is the page's single card, filling the viewport.
//
// Deep links carry the lens in ?domain= (applications | value-streams | roles
// | products | form-compare — `product-models` is accepted as an alias for
// products); unknown values fall back to applications. The form-compare lens
// also reads ?formA=/?formB= (PolicyForm ids) to land pre-selected.
// ?workspace=<id> is accepted for old links (the map validates it against the
// board list).
export default function Portfolio() {
  const [params] = useSearchParams();
  const domain = params.get('domain') ?? undefined;

  return <WorkspaceMap initialDomain={domain} />;
}
