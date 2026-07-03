import { useState } from 'react';
import { api } from '../../lib/api';
import { Button, Card, ErrorMessage, Input, Label, StatusPill, type PillTone } from '../ui';
import type { ImportResult } from './types';

// UserImportAdmin — User Admin → Import: spreadsheet bulk-import of users.
// Pick a .xlsx/.csv, dry-run it (POST /users/import?dryRun=1) to preview
// per-row actions and errors, then commit the valid rows (same endpoint
// without dryRun — the response shape is identical).

const ACTION_TONE: Record<ImportResult['rows'][number]['action'], PillTone> = {
  create: 'green',
  update: 'blue',
  skip: 'slate',
};

// The column contract parsed by backend services/userImport.
const COLUMNS: { name: string; note: string }[] = [
  { name: 'email', note: 'required — the upsert key' },
  { name: 'name', note: 'required' },
  { name: 'userType', note: 'e.g. MEMBER, SUPER_USER' },
  { name: 'orgUnit', note: 'org unit name' },
  { name: 'geography', note: 'NORTH_AMERICA, UK_EUROPE, APAC, LATAM' },
  { name: 'operatingRole', note: 'operating-model role name' },
  { name: 'isManager', note: 'true/false' },
  { name: 'reportsTo', note: 'manager email (may be another row in the file)' },
  { name: 'isApprover', note: 'true/false' },
  { name: 'valueStreams', note: 'semicolon-separated value-stream names' },
];

export default function UserImportAdmin() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [committed, setCommitted] = useState(false);
  const [busy, setBusy] = useState<'dry' | 'commit' | null>(null);
  const [error, setError] = useState('');

  const run = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(dryRun ? 'dry' : 'commit');
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = (await api.upload(
        dryRun ? '/users/import?dryRun=1' : '/users/import',
        fd,
      )) as ImportResult;
      setResult(res);
      setCommitted(!dryRun);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <Card className="p-4">
        <Label htmlFor="ui-file">Spreadsheet (.xlsx or .csv)</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="ui-file"
            type="file"
            accept=".xlsx,.csv"
            className="max-w-xs"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
              setCommitted(false);
              setError('');
            }}
          />
          <Button
            variant="secondary"
            disabled={!file || busy !== null}
            onClick={() => void run(true)}
          >
            {busy === 'dry' ? 'Checking…' : 'Dry run'}
          </Button>
          <Button
            disabled={!file || busy !== null || !result || committed || result.valid === 0}
            onClick={() => void run(false)}
          >
            {busy === 'commit' ? 'Importing…' : `Import ${result?.valid ?? 0} valid rows`}
          </Button>
        </div>
        <p className="text-[11px] text-[#a3a3a3] mt-2">
          Run a dry run first — it validates every row without writing anything.
        </p>
      </Card>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      {result && (
        <Card className="p-0">
          <div className="px-4 py-2.5 border-b border-[#eaeaea] flex items-center gap-3 text-sm">
            <span className="font-medium text-[#171717]">
              {result.valid} of {result.total} rows valid · {result.invalid}{' '}
              {result.invalid === 1 ? 'error' : 'errors'}
            </span>
            {committed && <span className="text-[#16a34a] text-[12px]">Import complete.</span>}
            {!committed && (
              <span className="text-[#a3a3a3] text-[12px]">Dry run — nothing written yet.</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#eaeaea] bg-[#fafafa] text-left">
                  <th className="px-3 py-1.5 font-semibold text-[10px] uppercase tracking-[0.10em] text-[#a3a3a3] w-14">
                    Row
                  </th>
                  <th className="px-3 py-1.5 font-semibold text-[10px] uppercase tracking-[0.10em] text-[#a3a3a3]">
                    Email
                  </th>
                  <th className="px-3 py-1.5 font-semibold text-[10px] uppercase tracking-[0.10em] text-[#a3a3a3] w-24">
                    Action
                  </th>
                  <th className="px-3 py-1.5 font-semibold text-[10px] uppercase tracking-[0.10em] text-[#a3a3a3]">
                    Errors
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.row} className="border-b border-[#f5f5f5] last:border-0">
                    <td className="px-3 py-1.5 text-[#737373] tnum">{r.row}</td>
                    <td className="px-3 py-1.5 text-[#171717]">{r.email ?? '—'}</td>
                    <td className="px-3 py-1.5">
                      <StatusPill tone={ACTION_TONE[r.action]}>{r.action}</StatusPill>
                    </td>
                    <td className="px-3 py-1.5 text-[#be123c]">{r.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-[#171717] mb-1.5">Expected columns</h3>
        <p className="text-[12px] text-[#666666] mb-2">
          First sheet of the workbook; one user per row. Names and roles match by display name.
        </p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {COLUMNS.map((c) => (
            <div key={c.name} className="flex items-baseline gap-2 text-[12px]">
              <dt className="font-mono text-[#171717]">{c.name}</dt>
              <dd className="text-[#a3a3a3]">{c.note}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
