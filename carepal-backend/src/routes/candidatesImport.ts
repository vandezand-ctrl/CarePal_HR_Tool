import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { parseCandidatesSheet } from '../logic/candidateImport.js';
import { createCandidate, Candidate } from '../models/candidate.js';
import { getRequisition } from '../models/requisition.js';

export const candidatesImportRouter = Router();

// Files are small (KB-range), keep in memory. 5 MB cap.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * POST /api/candidates/import?dryRun=true|false
 * Accepts a single multipart field named "file" (xlsx or csv).
 * dryRun=true (default): parse + validate + FK-check, return preview only.
 * dryRun=false: also inserts the valid rows.
 */
candidatesImportRouter.post(
  '/api/candidates/import',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Missing file (field name: "file")' });

      const dryRun = String(req.query.dryRun ?? 'true').toLowerCase() !== 'false';
      const parsed = parseCandidatesSheet(req.file.buffer);

      // FK check on reqId for the rows that passed schema validation.
      const uniqueReqIds = [...new Set(parsed.valid.map((v) => v.input.reqId))];
      const reqExistence = await Promise.all(uniqueReqIds.map((id) => getRequisition(id)));
      const missingReqIds = new Set<string>();
      reqExistence.forEach((r, i) => { if (!r) missingReqIds.add(uniqueReqIds[i]); });

      const fkFailed = parsed.valid.filter((v) => missingReqIds.has(v.input.reqId));
      const fkPassed = parsed.valid.filter((v) => !missingReqIds.has(v.input.reqId));

      // Move FK-failed rows into the invalid bucket with a clear reason
      const invalid = [
        ...parsed.invalid,
        ...fkFailed.map((v) => ({
          rowIndex: v.rowIndex,
          raw: v.input as unknown as Record<string, unknown>,
          errors: [`reqId: Requisition ${v.input.reqId} does not exist`],
        })),
      ].sort((a, b) => a.rowIndex - b.rowIndex);

      if (dryRun) {
        return res.json({
          dryRun: true,
          totalRows: parsed.totalRows,
          validCount: fkPassed.length,
          invalidCount: invalid.length,
          valid: fkPassed,
          invalid,
        });
      }

      // Commit mode — insert the valid rows, collect failures (per-row, not all-or-nothing).
      const created: Candidate[] = [];
      const insertFailures: { rowIndex: number; error: string }[] = [];
      for (const v of fkPassed) {
        try {
          const c = await createCandidate(v.input);
          created.push(c);
        } catch (err) {
          insertFailures.push({
            rowIndex: v.rowIndex,
            error: err instanceof Error ? err.message : 'unknown error',
          });
        }
      }

      return res.json({
        dryRun: false,
        totalRows: parsed.totalRows,
        createdCount: created.length,
        invalidCount: invalid.length,
        insertFailures,
        created,
        invalid,
      });
    } catch (err) {
      return next(err);
    }
  },
);

candidatesImportRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[candidates-import]', err);
  res.status(500).json({ error: 'Internal server error' });
});
