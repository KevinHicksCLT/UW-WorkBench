import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Edge, Node, NodeMouseHandler } from '@xyflow/react';
import { useApi } from '../lib/useApi';
import PageHeader from '../components/PageHeader';
import FlowCanvas from '../viz/FlowCanvas';
import { layoutGraph } from '../viz/layout';

type Kind = 'company' | 'division' | 'department' | 'role';
type T = { id: string; label: string; href?: string; kind: Kind; badge?: string; children: string[] };

const KIND_STYLE: Record<Kind, CSSProperties> = {
  company: { background: '#1f3253', color: '#fff', border: '1px solid #141f37' },
  division: { background: '#e3eaf6', border: '1px solid #92b1da' },
  department: { background: '#ffffff', border: '1px solid #cbd5e1' },
  role: { background: '#f8fafc', border: '1px solid #e2e8f0' },
};

export default function OrgChart() {
  const { data: companies } = useApi<any[]>('/companies');
  const company = companies?.[0];
  const { data: tree, loading, error } = useApi<any>(company ? `/companies/${company.id}/tree` : null);
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Flat tree map of the whole org.
  const flat = useMemo(() => {
    const m = new Map<string, T>();
    if (!tree) return m;
    const divIds: string[] = [];
    for (const d of tree.divisions) {
      const divId = `division:${d.id}`;
      divIds.push(divId);
      const deptIds: string[] = [];
      let divRoles = 0;
      for (const dept of d.departments) {
        const deptId = `department:${dept.id}`;
        deptIds.push(deptId);
        divRoles += dept.roles.length;
        const roleIds = dept.roles.map((r: any) => `role:${r.id}`);
        for (const r of dept.roles) {
          m.set(`role:${r.id}`, { id: `role:${r.id}`, label: r.name, href: `/roles/${r.id}`, kind: 'role', children: [] });
        }
        m.set(deptId, { id: deptId, label: dept.name, href: `/departments/${dept.id}`, kind: 'department', badge: `${dept.roles.length}`, children: roleIds });
      }
      m.set(divId, { id: divId, label: d.name, href: `/divisions/${d.id}`, kind: 'division', badge: `${deptIds.length} dept · ${divRoles}`, children: deptIds });
    }
    m.set('company', { id: 'company', label: tree.name, kind: 'company', children: divIds });
    return m;
  }, [tree]);

  // Initial view: company + divisions (divisions and departments collapsed).
  useEffect(() => {
    if (!tree || initialized) return;
    const c = new Set<string>();
    for (const d of tree.divisions) {
      c.add(`division:${d.id}`);
      for (const dept of d.departments) c.add(`department:${dept.id}`);
    }
    setCollapsed(c);
    setInitialized(true);
  }, [tree, initialized]);

  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];
    if (flat.size === 0) return { nodes: ns, edges: es };

    const make = (t: T): Node => ({
      id: t.id,
      position: { x: 0, y: 0 },
      width: 210,
      height: 46,
      style: { ...KIND_STYLE[t.kind], borderRadius: 8, padding: 6, width: 210, fontSize: 12 },
      data: {
        label: (
          <div className="flex items-center gap-1.5 text-left">
            {t.children.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); toggle(t.id); }}
                className="w-4 flex-shrink-0 opacity-60 hover:opacity-100"
                aria-label={collapsed.has(t.id) ? 'Expand' : 'Collapse'}
              >
                {collapsed.has(t.id) ? '▸' : '▾'}
              </button>
            )}
            <div className="min-w-0 leading-tight">
              <div className="font-medium truncate">{t.label}</div>
              {t.badge && <div className="text-[10px] opacity-60">{t.badge}</div>}
            </div>
          </div>
        ),
      },
    });

    const visit = (id: string) => {
      const t = flat.get(id);
      if (!t) return;
      ns.push(make(t));
      if (!collapsed.has(id)) {
        for (const cid of t.children) {
          es.push({ id: `${id}->${cid}`, source: id, target: cid, style: { stroke: '#94a3b8' } });
          visit(cid);
        }
      }
    };
    visit('company');
    return { nodes: layoutGraph(ns, es, { direction: 'TB', nodeWidth: 210, nodeHeight: 46, ranksep: 55, nodesep: 14 }), edges: es };
  }, [flat, collapsed, toggle]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_e, node) => {
      const href = (node.data as any)?.href as string | undefined;
      if (href) navigate(href);
    },
    [navigate]
  );

  if (loading) return <div className="text-slate-500">Loading org chart…</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div>
      <PageHeader
        title="Org Chart"
        subtitle="Division → department → role. ▸/▾ to expand; click a node to open it."
      />
      <FlowCanvas nodes={nodes} edges={edges} onNodeClick={onNodeClick} height={680} />
    </div>
  );
}
