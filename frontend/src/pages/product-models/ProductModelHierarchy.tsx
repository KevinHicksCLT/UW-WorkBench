import { useSearchParams } from 'react-router-dom';
import ProductDrillToc from '../../components/ProductDrillToc';
import ProductListExplorer from '../../components/ProductListExplorer';
import ProductMapCanvas from '../../viz/product-map/ProductMapCanvas';
import { ViewPills } from '../../components/TocView';
import ProductFrameworkView from './ProductFrameworkView';

// Product Models tab — mirrors the Organization / Value Streams tabs: a
// segmented control toggles views of the SAME product spine
// (ProductLevelType + ProductNode: segment → LOB / product family → product →
// version / jurisdiction → model component):
//   TOC  — (default) table of contents descent, one TocView per level.
//   Map  — spatial drill-down map (ProductMapCanvas), like the org map.
//   List — Excel-like drill-down grid with the component detail sidebar.
//   Framework — the normalized product-model reference (segments, catalog,
//               8 dimensions, archetypes, matrix, libraries, task map).
type View = 'toc' | 'list' | 'map' | 'framework';

export default function ProductModelHierarchy() {
  // View state lives in the URL (`?view=map|list|framework`) so back/forward
  // and reload land the user back on the same spot.
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const view: View =
    viewParam === 'map' || viewParam === 'list' || viewParam === 'framework' ? viewParam : 'toc';

  const setView = (v: View) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === 'toc') next.delete('view');
        else next.set('view', v);
        return next;
      },
      { replace: true },
    );
  };

  const pillOptions = [
    { key: 'toc' as const, label: 'TOC' },
    { key: 'map' as const, label: 'Map' },
    { key: 'list' as const, label: 'List' },
    { key: 'framework' as const, label: 'Framework' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* TOC hosts the pills inline in its header strip; the full-bleed
            surfaces (map/list) get the floating toggle. */}
        {view !== 'toc' && (
          <ViewPills floating options={pillOptions} view={view} onChange={setView} />
        )}

        {view === 'toc' ? (
          <div className="h-full overflow-auto">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-6">
              <ProductDrillToc
                leading={<ViewPills options={pillOptions} view={view} onChange={setView} />}
              />
            </div>
          </div>
        ) : view === 'list' ? (
          <ProductListExplorer />
        ) : view === 'framework' ? (
          <div className="h-full min-h-0 px-4 pt-14 pb-4 sm:px-6 lg:px-8">
            <ProductFrameworkView />
          </div>
        ) : (
          <ProductMapCanvas />
        )}
      </div>
    </div>
  );
}
