// Spreadsheet bulk-import of users (.xlsx/.csv, first sheet). User-admin
// gated with the same escalation/scope guards as manual CRUD. ?dryRun=1
// parses + resolves + validates without writing. Commits run sequentially
// through services/userProvisioning (the single user write path), with a
// second pass wiring reportsTo references that point at rows in the same file.
import type { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { prisma } from '../../db/prisma.js';
import { requirePermission, requireUserAdmin } from '../../middleware/permissions.js';
import {
  parseRows,
  resolveRefs,
  type ImportLookups,
  type ResolvedRow,
} from '../../services/userImport.js';
import { upsertUser } from '../../services/userProvisioning.js';
import { escalationError } from './helpers.js';
import { logger } from '../../lib/logger.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/** Wrap multer so its errors (size cap, unexpected field) surface as 400s. */
const singleFile: RequestHandler = (req, res, next) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err)
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
    next();
  });
};

const ACCEPTED_EXTENSIONS = /\.(xlsx|csv)$/i;

async function buildLookups(tenantId: string): Promise<ImportLookups> {
  const [orgUnits, roles, streams, users] = await Promise.all([
    prisma.orgUnit.findMany({
      where: { company: { tenantId } },
      select: { id: true, dbValue: true, displayValue: true },
    }),
    prisma.role.findMany({
      where: { company: { tenantId } },
      select: { id: true, dbValue: true, displayValue: true },
    }),
    prisma.processNode.findMany({
      where: { company: { tenantId }, processLevelType: { levelNumber: 2 } },
      select: { id: true, dbValue: true, displayValue: true },
    }),
    prisma.user.findMany({ where: { tenantId }, select: { id: true, email: true } }),
  ]);

  const byNames = (rows: { id: string; dbValue: string; displayValue: string }[]) => {
    const map = new Map<string, string>();
    // displayValue first so a dbValue collision prefers the canonical name.
    for (const r of rows) map.set(r.displayValue.toLowerCase().trim(), r.id);
    for (const r of rows) map.set(r.dbValue.toLowerCase().trim(), r.id);
    return map;
  };

  return {
    orgUnitsByName: byNames(orgUnits),
    rolesByName: byNames(roles),
    valueStreamsByName: byNames(streams),
    usersByEmail: new Map(users.map((u) => [u.email.toLowerCase(), u.id])),
  };
}

type RowResult = {
  row: number;
  action: 'create' | 'update' | 'skip';
  email: string | null;
  errors: string[];
};

/** Apply the same escalation/scope guards as manage.ts POST, as row errors. */
function applyRowGuards(req: Request, rows: ResolvedRow[]): void {
  for (const row of rows) {
    if (!row.data) continue;
    const escalation = escalationError(req, {
      role: row.data.role,
      orgUnitId: row.data.orgUnitId ?? null,
      orgUnitProvided: true,
    });
    if (escalation) {
      row.errors.push(escalation);
      delete row.data;
    }
  }
}

export function registerImportRoutes(router: Router): void {
  const guards: RequestHandler[] = [requirePermission('user-admin.users'), requireUserAdmin()];

  router.post(
    '/import',
    ...guards,
    singleFile,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file)
          return res.status(400).json({ error: 'Missing file (multipart field "file")' });
        if (!ACCEPTED_EXTENSIONS.test(req.file.originalname)) {
          return res.status(400).json({ error: 'Only .xlsx and .csv files are accepted' });
        }

        let sheetRows: Record<string, unknown>[];
        try {
          const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
          const first = workbook.SheetNames[0];
          if (!first) return res.status(400).json({ error: 'Workbook has no sheets' });
          sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[first], {
            defval: '',
          });
        } catch {
          return res.status(400).json({ error: 'Could not parse the uploaded file' });
        }
        if (sheetRows.length === 0)
          return res.status(400).json({ error: 'The sheet has no data rows' });

        const lookups = await buildLookups(req.tenantId);
        const resolved = resolveRefs(parseRows(sheetRows), lookups);
        applyRowGuards(req, resolved);

        const actionFor = (row: ResolvedRow): RowResult['action'] => {
          if (!row.data) return 'skip';
          return lookups.usersByEmail.has(row.data.email) ? 'update' : 'create';
        };

        if (req.query.dryRun === '1') {
          const rows: RowResult[] = resolved.map((r) => ({
            row: r.rowNumber,
            action: actionFor(r),
            email: r.data?.email ?? null,
            errors: r.errors,
          }));
          const valid = rows.filter((r) => r.action !== 'skip').length;
          return res.json({ total: rows.length, valid, invalid: rows.length - valid, rows });
        }

        // ── Commit: pass 1 upserts every valid row (sequential; reportsTo
        // references to in-file rows are deferred), pass 2 wires those up.
        const results: RowResult[] = [];
        const idByEmail = new Map(lookups.usersByEmail);
        const deferred: { row: ResolvedRow; email: string; managerEmail: string }[] = [];

        for (const row of resolved) {
          const action = actionFor(row);
          if (!row.data) {
            results.push({ row: row.rowNumber, action: 'skip', email: null, errors: row.errors });
            continue;
          }
          try {
            const { user } = await upsertUser({
              tenantId: req.tenantId,
              actorLabel: req.user.email,
              source: 'IMPORT',
              data: {
                email: row.data.email,
                name: row.data.name,
                role: row.data.role,
                orgUnitId: row.data.orgUnitId ?? null,
                geography: row.data.geography ?? null,
                operatingRoleId: row.data.operatingRoleId ?? null,
                ...(row.data.isManager !== undefined ? { isManager: row.data.isManager } : {}),
                ...(row.data.isApprover !== undefined ? { isApprover: row.data.isApprover } : {}),
                ...(row.data.reportsToId !== undefined
                  ? { reportsToId: row.data.reportsToId }
                  : {}),
                valueStreamIds: row.data.valueStreamIds,
              },
            });
            idByEmail.set(row.data.email, user.id);
            if (row.data.deferredReportsToEmail) {
              deferred.push({
                row,
                email: row.data.email,
                managerEmail: row.data.deferredReportsToEmail,
              });
            }
            results.push({ row: row.rowNumber, action, email: row.data.email, errors: [] });
          } catch (e) {
            logger.warn({ err: e, row: row.rowNumber }, 'user import row failed');
            results.push({
              row: row.rowNumber,
              action: 'skip',
              email: row.data.email,
              errors: [e instanceof Error ? e.message : 'Import failed'],
            });
          }
        }

        for (const d of deferred) {
          const userId = idByEmail.get(d.email);
          const managerId = idByEmail.get(d.managerEmail);
          const result = results.find((r) => r.row === d.row.rowNumber);
          if (!userId || !managerId) {
            result?.errors.push(`could not resolve reportsTo "${d.managerEmail}"`);
            continue;
          }
          try {
            await upsertUser({
              tenantId: req.tenantId,
              actorLabel: req.user.email,
              source: 'IMPORT',
              byId: userId,
              data: { reportsToId: managerId },
            });
          } catch (e) {
            logger.warn({ err: e, row: d.row.rowNumber }, 'user import reportsTo pass failed');
            result?.errors.push(`could not set reportsTo "${d.managerEmail}"`);
          }
        }

        const valid = results.filter((r) => r.action !== 'skip').length;
        res.json({ total: results.length, valid, invalid: results.length - valid, rows: results });
      } catch (e) {
        next(e);
      }
    },
  );
}
