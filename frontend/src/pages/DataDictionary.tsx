import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { GLOSSARY, type GlossaryGroup } from '../lib/glossary';
import { Card, Input } from '../components/ui';

// Data dictionary — a plain-language glossary of the terms used across the
// application, defined in the context of the operating model. Authored content
// lives in lib/glossary.ts; this page just renders and filters it.

const anchorId = (group: string) => 'g-' + group.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// `embedded` skips the page header so the dictionary can be hosted inside another
// page (e.g. the Data Admin tab) without a duplicate title.
export default function DataDictionary({ embedded = false }: { embedded?: boolean } = {}) {
  const [filter, setFilter] = useState('');

  // Filter terms by a case-insensitive match on the term, its alias, or its
  // definition. A group is kept only if it has at least one matching term.
  const shown = useMemo<GlossaryGroup[]>(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return GLOSSARY;
    return GLOSSARY
      .map((g) => ({
        ...g,
        terms: g.terms.filter(
          (t) =>
            t.term.toLowerCase().includes(q) ||
            (t.aka?.toLowerCase().includes(q) ?? false) ||
            t.definition.toLowerCase().includes(q) ||
            (t.values?.some((v) => v.toLowerCase().includes(q)) ?? false),
        ),
      }))
      .filter((g) => g.terms.length > 0);
  }, [filter]);

  const totalTerms = GLOSSARY.reduce((n, g) => n + g.terms.length, 0);

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Data Dictionary"
          subtitle={`Plain-language definitions of the ${totalTerms} terms used across the platform — what each one means in our operating model.`}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Jump-list sidebar */}
        <aside className="lg:w-56 flex-shrink-0">
          <div className="lg:sticky lg:top-4 space-y-3">
            <Input
              className="w-full"
              placeholder="Search terms…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <Card variant="elevated" className="p-2 max-h-[70vh] overflow-y-auto">
              <nav className="space-y-0.5">
                {shown.map((g) => (
                  <a
                    key={g.group}
                    href={`#${anchorId(g.group)}`}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-sm text-[#525252] hover:bg-[#fafafa] hover:text-[#171717] transition-colors duration-150"
                  >
                    <span className="truncate">{g.group}</span>
                    <span className="text-[10px] tnum text-[#a3a3a3] flex-shrink-0">{g.terms.length}</span>
                  </a>
                ))}
                {shown.length === 0 && (
                  <p className="px-3 py-2 text-xs text-[#a3a3a3] italic">No matches.</p>
                )}
              </nav>
            </Card>
          </div>
        </aside>

        {/* Glossary */}
        <section className="flex-1 min-w-0 space-y-6">
          {shown.map((g) => (
            <Card key={g.group} id={anchorId(g.group)} variant="elevated" className="overflow-hidden scroll-mt-4">
              <div className="px-5 py-3 border-b border-[#eaeaea] bg-[#fafafa]">
                <h2 className="text-sm font-semibold text-[#171717]">{g.group}</h2>
                <p className="text-[11px] text-[#666666] mt-0.5">{g.blurb}</p>
              </div>
              <dl className="divide-y divide-[#f5f5f5]">
                {g.terms.map((t) => (
                  <div key={t.term} className="px-5 py-4 sm:flex sm:gap-6">
                    <dt className="sm:w-48 flex-shrink-0 mb-1 sm:mb-0">
                      <span className="text-sm font-semibold text-[#171717]">{t.term}</span>
                      {t.aka && <span className="block text-[11px] text-[#a3a3a3] mt-0.5">{t.aka}</span>}
                    </dt>
                    <dd className="min-w-0 flex-1">
                      <p className="text-sm text-[#525252] leading-relaxed">{t.definition}</p>
                      {t.values && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {t.values.map((v) => (
                            <span
                              key={v}
                              className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#f5f5f5] text-[11px] text-[#525252]"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
          {shown.length === 0 && (
            <Card variant="elevated" className="px-5 py-10 text-center text-sm text-[#a3a3a3] italic">
              No terms match “{filter}”.
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
