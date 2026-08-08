// Packs Library — the crowdsourced commodity. Lists the bundled content packs
// (GET /uw/packs), imports one into the active company (POST /uw/packs/import,
// versioned never-mutate discipline — INV-3), accepts raw community pack JSON,
// and exports the company's ACTIVE estate as a shareable pack to contribute
// back to the commons.
import { useState } from 'react';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { useDialogs } from '../../lib/dialogs';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorMessage,
  Input,
  Label,
  SkeletonLoader,
  Textarea,
} from '../../components/ui';
import { errMsg } from './types';

type PackSummary = {
  name: string;
  slug: string;
  version: string;
  description: string;
  author: string;
  license: string;
  lobs: string[];
  counts: {
    appetiteStatements: number;
    guidelineRules: number;
    authorityGrantTemplates: number;
    enrichmentSources: number;
  };
};

type ImportResult = {
  pack: { slug: string; version: string };
  result: {
    appetiteStatements: number;
    guidelineRules: number;
    authorityGrants: number;
    enrichmentSources: number;
    unresolvedRoles: string[];
  };
};

function importSummary(r: ImportResult): string {
  const c = r.result;
  return (
    `Imported ${r.pack.slug}@${r.pack.version}: ${c.appetiteStatements} appetite statement(s), ` +
    `${c.guidelineRules} guideline rule(s), ${c.authorityGrants} authority grant(s), ` +
    `${c.enrichmentSources} enrichment source(s).` +
    (c.unresolvedRoles.length
      ? ` Unresolved role templates (no matching role yet): ${c.unresolvedRoles.join(', ')}.`
      : '') +
    ' Existing artifacts with the same refs were superseded as v+1 — never mutated (INV-3).'
  );
}

type ExportForm = { name: string; slug: string; version: string; description: string; author: string };

const EMPTY_EXPORT: ExportForm = {
  name: '',
  slug: '',
  version: '1.0.0',
  description: '',
  author: '',
};

export default function PacksLibrary() {
  const dialogs = useDialogs();
  const { data, error, loading, refetch } = useApi<PackSummary[]>('/uw/packs');
  const [busy, setBusy] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportForm, setExportForm] = useState<ExportForm>(EMPTY_EXPORT);
  const set = (k: keyof ExportForm) => (v: string) => setExportForm((f) => ({ ...f, [k]: v }));

  async function importPack(slug: string) {
    const ok = await dialogs.confirm({
      title: `Import ${slug}?`,
      message:
        'The pack applies on top of your current estate. Artifacts sharing a ref are superseded and re-published as version+1 — nothing is mutated or deleted.',
      confirmLabel: 'Import pack',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = (await api.post('/uw/packs/import', { slug })) as ImportResult;
      await dialogs.alert({ title: 'Pack imported', message: importSummary(res) });
      refetch();
    } catch (e) {
      await dialogs.alert({ title: 'Import failed', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function importJson() {
    const raw = await dialogs.prompt({
      title: 'Import pack JSON',
      message:
        'Paste a community pack (the JSON exported by any UW Workbench estate). It is validated against the pack schema before anything is applied.',
      label: 'Pack JSON',
      placeholder: '{"packFormat": 1, "name": "…", "slug": "…", …}',
      confirmLabel: 'Import',
    });
    if (raw === null) return;
    let pack: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('not an object');
      }
      pack = parsed as Record<string, unknown>;
    } catch {
      await dialogs.alert('That is not a valid JSON object — paste the full pack file contents.');
      return;
    }
    setBusy(true);
    try {
      const res = (await api.post('/uw/packs/import', { pack })) as ImportResult;
      await dialogs.alert({ title: 'Pack imported', message: importSummary(res) });
      refetch();
    } catch (e) {
      await dialogs.alert({ title: 'Import failed', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function exportEstate() {
    if (exportForm.name.trim().length < 3) {
      await dialogs.alert('Pack name must be at least 3 characters.');
      return;
    }
    if (!/^[a-z0-9-]{3,60}$/.test(exportForm.slug)) {
      await dialogs.alert('Slug must be 3–60 lowercase letters, digits, and hyphens.');
      return;
    }
    if (!/^\d+\.\d+\.\d+$/.test(exportForm.version)) {
      await dialogs.alert('Version must be semver, e.g. 1.0.0.');
      return;
    }
    if (exportForm.description.trim().length < 10) {
      await dialogs.alert('Description must be at least 10 characters — it is the pack’s shop window.');
      return;
    }
    if (!exportForm.author.trim()) {
      await dialogs.alert('Author is required (your name or org — credit travels with the pack).');
      return;
    }
    setBusy(true);
    try {
      const pack = await api.post('/uw/packs/export', {
        name: exportForm.name.trim(),
        slug: exportForm.slug,
        version: exportForm.version,
        description: exportForm.description.trim(),
        author: exportForm.author.trim(),
      });
      // Download the returned JSON as a file.
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportForm.slug}-${exportForm.version}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      await dialogs.alert({
        title: 'Estate exported',
        message: `Downloaded ${exportForm.slug}-${exportForm.version}.json — your ACTIVE appetite, rules, grants, and enrichment sources as a shareable pack. PR it to the packs/ directory to share it with everyone.`,
      });
      setExportForm(EMPTY_EXPORT);
      setShowExport(false);
    } catch (e) {
      await dialogs.alert({ title: 'Export failed', message: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  const packs = data ?? [];

  return (
    <div>
      {error && <ErrorMessage className="mb-3">Failed to load packs: {error}</ErrorMessage>}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <p className="max-w-2xl text-[11px] text-[#737373]">
          Content packs are the crowdsourced commodity — import a starting book, reshape it, export
          yours, PR it back. Imports follow the same never-mutate versioning as the studio (INV-3).
        </p>
        <div className="flex-1" />
        <Button variant="secondary" className="text-xs" disabled={busy} onClick={importJson}>
          Import JSON…
        </Button>
        <Button className="text-xs" onClick={() => setShowExport((v) => !v)}>
          {showExport ? 'Close export' : 'Export my estate'}
        </Button>
      </div>

      {showExport && (
        <Card className="p-4 mb-4">
          <h3 className="mb-3 text-sm font-semibold text-[#171717]">
            Export the ACTIVE estate as a pack
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="pk-name">Pack name</Label>
              <Input
                id="pk-name"
                value={exportForm.name}
                onChange={(e) => set('name')(e.target.value)}
                placeholder="Midwest Habitational Book"
              />
            </div>
            <div>
              <Label htmlFor="pk-slug">Slug</Label>
              <Input
                id="pk-slug"
                value={exportForm.slug}
                onChange={(e) => set('slug')(e.target.value)}
                placeholder="midwest-habitational"
              />
            </div>
            <div>
              <Label htmlFor="pk-version">Version</Label>
              <Input
                id="pk-version"
                value={exportForm.version}
                onChange={(e) => set('version')(e.target.value)}
                placeholder="1.0.0"
              />
            </div>
            <div>
              <Label htmlFor="pk-author">Author</Label>
              <Input
                id="pk-author"
                value={exportForm.author}
                onChange={(e) => set('author')(e.target.value)}
                placeholder="Your name or org"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Label htmlFor="pk-desc">Description (min 10 characters)</Label>
              <Textarea
                id="pk-desc"
                rows={2}
                value={exportForm.description}
                onChange={(e) => set('description')(e.target.value)}
                placeholder="What book of business this estate is tuned for, and what makes it worth forking"
              />
            </div>
          </div>
          <div className="mt-3">
            <Button className="text-xs" disabled={busy} onClick={exportEstate}>
              Export & download JSON
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <SkeletonLoader count={2} height={180} className="grid gap-3 md:grid-cols-2" />
      ) : packs.length === 0 ? (
        <Card className="p-8 text-center">
          <EmptyState
            baseClassName="text-sm text-[#a3a3a3]"
            message="No bundled packs found — add pack JSON files under packs/starter/ in the repo, or paste one with Import JSON."
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {packs.map((p) => (
            <Card key={p.slug} className="p-4 flex flex-col gap-2.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#171717]">{p.name}</h3>
                  <p className="text-[11px] text-[#737373]">
                    {p.slug}@{p.version} · {p.author} · {p.license}
                  </p>
                </div>
                <div className="flex-1" />
                <Button
                  className="text-xs shrink-0"
                  disabled={busy}
                  onClick={() => importPack(p.slug)}
                >
                  Import
                </Button>
              </div>
              <p className="text-[12px] leading-relaxed text-[#525252]">{p.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {p.lobs.map((l) => (
                  <Chip key={l}>{l}</Chip>
                ))}
              </div>
              <div className="mt-auto border-t border-[#f0f0f0] pt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#737373] tnum">
                <span>
                  <span className="font-semibold text-[#171717]">{p.counts.appetiteStatements}</span>{' '}
                  appetite statements
                </span>
                <span>
                  <span className="font-semibold text-[#171717]">{p.counts.guidelineRules}</span>{' '}
                  guideline rules
                </span>
                <span>
                  <span className="font-semibold text-[#171717]">
                    {p.counts.authorityGrantTemplates}
                  </span>{' '}
                  authority grants
                </span>
                <span>
                  <span className="font-semibold text-[#171717]">{p.counts.enrichmentSources}</span>{' '}
                  enrichment sources
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
