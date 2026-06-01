import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import DrillCanvas, { type DrillItem, type DrillParent, type DivsByGroup } from '../viz/DrillCanvas';
import DrillBreadcrumb, { type Frame } from '../components/DrillBreadcrumb';
import Inspector from '../components/Inspector';
import PersonBoard from '../components/PersonBoard';
import TaskBoard from '../components/TaskBoard';
import type { DrillNodeType } from '../viz/nodes/DrillNode';

type Seg = { type: DrillNodeType; id: string };
const key = (type: string, id: string) => `${type}:${id}`;
const urlFor = (tail: Seg[]) => (tail.length ? '/n/' + tail.map((t) => `${t.type}:${t.id}`).join('/') : '/');

export default function Explorer() {
  const loc = useLocation();
  const navigate = useNavigate();

  // node payload cache (key → payload) + name hints (instant breadcrumb labels)
  const cache = useRef<Map<string, any>>(new Map());
  const inflight = useRef<Set<string>>(new Set());
  const nameHints = useRef<Map<string, string>>(new Map());
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);
  const [focus, setFocus] = useState<Seg | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => { api.get('/explorer/overview').then((o) => setCompany(o.company)).catch(() => {}); }, []);

  const ensureNode = useCallback((type: string, id: string) => {
    const k = key(type, id);
    if (cache.current.has(k) || inflight.current.has(k)) return;
    inflight.current.add(k);
    api.get(`/explorer/node/${type}/${id}`)
      .then((n) => { cache.current.set(k, n); if (n?.name) nameHints.current.set(k, n.name); bump(); })
      .catch(() => {})
      .finally(() => { inflight.current.delete(k); });
  }, [bump]);

  // parse the URL splat into the drill tail (company is always the implicit root)
  const tail: Seg[] = useMemo(() => {
    const rest = loc.pathname.startsWith('/n/') ? loc.pathname.slice(3) : '';
    return rest.split('/').filter(Boolean).map((seg) => {
      const idx = seg.indexOf(':');
      return { type: seg.slice(0, idx) as DrillNodeType, id: seg.slice(idx + 1) };
    });
  }, [loc.pathname]);

  const nameFor = (type: string, id: string) => cache.current.get(key(type, id))?.name ?? nameHints.current.get(key(type, id)) ?? '…';

  // Extract the CEO domain category from a loaded node (division/department carry higherCategory).
  const domainFor = (type: string, id: string): string | undefined => {
    const n = cache.current.get(key(type, id));
    return n?.higherCategory ?? undefined;
  };

  const frames: Frame[] = useMemo(() => {
    if (!company) return [];
    const f: Frame[] = [{ type: 'company', id: company.id, name: company.name }];
    for (const t of tail) f.push({ type: t.type, id: t.id, name: nameFor(t.type, t.id), domainCategory: domainFor(t.type, t.id) });
    return f;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, tail, version]);

  const openFrame = frames[frames.length - 1];

  // load every frame's payload (deep-link restore) + reset focus when level changes
  useEffect(() => { for (const fr of frames) ensureNode(fr.type, fr.id); }, [frames, ensureNode]);
  useEffect(() => { setFocus(null); }, [openFrame?.type, openFrame?.id]);
  useEffect(() => { if (focus) ensureNode(focus.type, focus.id); }, [focus, ensureNode]);

  const openNode = openFrame ? cache.current.get(key(openFrame.type, openFrame.id)) : null;
  const inspectSeg = focus ?? (openFrame ? { type: openFrame.type, id: openFrame.id } : null);
  const inspectNode = inspectSeg ? cache.current.get(key(inspectSeg.type, inspectSeg.id)) : null;

  const drill = useCallback((item: { type: DrillNodeType; id: string; name: string }) => {
    nameHints.current.set(key(item.type, item.id), item.name);
    navigate(urlFor([...tail, { type: item.type, id: item.id }]));
  }, [navigate, tail]);

  const jump = useCallback((index: number) => {
    setFocus(null);
    navigate(urlFor(tail.slice(0, index)));
  }, [navigate, tail]);

  const inspect = useCallback((item: DrillItem) => setFocus({ type: item.type, id: item.id }), []);
  const hover = useCallback((item: DrillItem) => ensureNode(item.type, item.id), [ensureNode]);

  const loadMore = useCallback(() => {
    if (!openNode?.children?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    api.get(`/explorer/node/${openFrame.type}/${openFrame.id}/children?cursor=${openNode.children.nextCursor}`)
      .then((more) => {
        const k = key(openFrame.type, openFrame.id);
        const cur = cache.current.get(k);
        if (cur) cache.current.set(k, { ...cur, children: { ...more, items: [...cur.children.items, ...more.items] } });
        bump();
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [openNode, openFrame, loadingMore, bump]);

  // divsByGroup is only present on the company node — the CEO's three-domain org split.
  const divsByGroup: DivsByGroup | undefined = openNode?.divsByGroup;

  // The open node's domain category (for division/department parent nodes).
  const openDomainCategory: string | undefined = openNode?.higherCategory ?? undefined;

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] lg:h-full min-h-0">
      <header className="flex-shrink-0 px-4 sm:px-6 pt-4 pb-3 border-b border-slate-200/70 bg-white/70 backdrop-blur">
        <div className="text-eyebrow uppercase text-slate-400 mb-1">Operating Model Explorer</div>
        {frames.length > 0 ? (
          <DrillBreadcrumb frames={frames} onJump={jump} />
        ) : (
          <div className="skeleton h-6 w-64" />
        )}
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <section className="flex-1 min-h-0 p-3 sm:p-4">
          {!openNode ? (
            <div className="h-full grid place-items-center rounded-2xl border border-slate-200/70 bg-surface-sunken">
              <div className="text-sm text-slate-400 animate-pulse">Loading {openFrame?.type ?? 'company'}…</div>
            </div>
          ) : openNode.type === 'person' ? (
            <PersonBoard node={openNode} onInspect={inspect} />
          ) : openNode.type === 'task' ? (
            <TaskBoard node={openNode} />
          ) : (
            <DrillCanvas
              parent={{
                type: openNode.type,
                id: openNode.id,
                name: openNode.name,
                subtitle: openNode.subtitle,
                illustrative: openNode.illustrative,
                domainCategory: openDomainCategory,
              } as DrillParent}
              children={openNode.children}
              focusId={focus?.id ?? null}
              divsByGroup={divsByGroup}
              onInspect={inspect}
              onDrill={(it) => drill({ type: it.type, id: it.id, name: it.name })}
              onHover={hover}
              onLoadMore={loadMore}
            />
          )}
        </section>

        <aside className="lg:w-[400px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200/70 bg-white overflow-y-auto p-4">
          <Inspector node={inspectNode} loading={!!inspectSeg && !inspectNode} error="" onDrill={drill} />
        </aside>
      </div>
    </div>
  );
}
