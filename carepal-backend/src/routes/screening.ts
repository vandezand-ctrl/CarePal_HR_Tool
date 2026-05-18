import { Router, Request, Response, NextFunction } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getCandidate, setScreeningResult } from '../models/candidate.js';
import { getRequisition } from '../models/requisition.js';
import {
  listDocumentsForCandidate,
  getDocumentRowForDownload,
} from '../models/document.js';
import { readFile } from '../services/storage.js';
import { extractText } from '../services/textExtract.js';
import { screenCv, isScreeningConfigured } from '../services/cvScreener.js';

export const screeningRouter = Router();

// Per-candidate in-flight guard. Prevents a double-click or two-tab race
// from spending money on two simultaneous Claude calls whose results then
// race to overwrite each other. Holds candidate IDs for the duration of
// one screening; cleared in a finally block.
const inFlight = new Set<string>();

/**
 * POST /api/candidates/:id/screen — run AI screening for a candidate.
 *
 * Soft failures (200 + { screened: false, reason }) are reserved for
 * conditions the TA can act on: no API key, no Resume uploaded, image-only
 * PDF. A missing linked requisition is treated as a real bug (500) since
 * it indicates referential-integrity corruption.
 *
 * Mirrors the soft-failure idiom of POST /api/candidates/:id/reject-notify.
 */
screeningRouter.post('/api/candidates/:id/screen', async (req, res, next) => {
  const candidateId = req.params.id;
  let acquired = false;
  try {
    const candidate = await getCandidate(candidateId);
    if (!candidate) return res.status(404).json({ error: 'Not found' });

    // TA scoping — TAs can only screen candidates assigned to them.
    if (req.user!.role === 'ta' && !candidate.assignedTas.some((t) => t.id === req.user!.id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!isScreeningConfigured()) {
      return res.json({
        screened: false,
        reason: 'AI screening is not configured (ANTHROPIC_API_KEY missing)',
      });
    }

    if (inFlight.has(candidateId)) {
      return res.status(409).json({
        error: 'A screening is already in progress for this candidate — please wait.',
      });
    }

    const docs = await listDocumentsForCandidate(candidate.id);
    const resume = docs.find((d) => d.docType === 'Resume');
    if (!resume) {
      return res.json({
        screened: false,
        reason: 'No Resume uploaded for this candidate — upload one to enable screening',
      });
    }

    const docRow = await getDocumentRowForDownload(resume.id);
    if (!docRow) {
      return res.json({
        screened: false,
        reason: 'Resume document record could not be loaded',
      });
    }

    // Storage and extraction are separate failure modes:
    //   readFile fails → infra problem (S3 outage, missing local file) → 503
    //   extractText fails → bad document (corrupt PDF) → 422
    let buffer: Buffer;
    try {
      buffer = await readFile(docRow.storage_key);
    } catch (err) {
      console.error('[screening] storage read failed:', err);
      return res.status(503).json({
        error: 'Document storage is temporarily unavailable. Retry in a moment.',
      });
    }

    let cvText: string;
    try {
      cvText = await extractText(buffer, docRow.mime_type);
    } catch (err) {
      console.error('[screening] CV text extraction failed:', err);
      return res.status(422).json({
        error: 'Could not read the Resume file. It may be corrupted or in an unsupported format.',
      });
    }

    if (!cvText || cvText.trim().length < 30) {
      return res.json({
        screened: false,
        reason: 'No readable text in the Resume (likely image-based / scanned PDF)',
      });
    }

    const requisition = await getRequisition(candidate.reqId);
    if (!requisition) {
      // FK should make this impossible; if it happens we want a loud signal
      // (and don't waste a paid Claude call on it).
      console.error(
        `[screening] candidate ${candidate.id} references missing requisition ${candidate.reqId}`,
      );
      return res.status(500).json({
        error: 'Linked requisition could not be loaded — data integrity issue, please contact admin.',
      });
    }

    inFlight.add(candidateId);
    acquired = true;

    let result;
    try {
      result = await screenCv(cvText, requisition);
    } catch (err) {
      // Differentiate transient/billing/upstream issues from the generic 500.
      // The TA needs to know whether to retry, escalate, or report.
      if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.APIConnectionError) {
        console.warn('[screening] transient Anthropic error:', err);
        return res.status(503).json({
          error: 'AI service is temporarily unavailable. Try again in a minute.',
        });
      }
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        console.error('[screening] Anthropic auth/permission error:', err);
        return res.status(500).json({
          error: 'AI service is misconfigured — please contact admin.',
        });
      }
      if (err instanceof Error && /Screener returned/.test(err.message)) {
        console.error('[screening] model returned malformed output:', err);
        return res.status(502).json({
          error: 'AI returned an unparseable response. Try again, or report the candidate if it keeps failing.',
        });
      }
      throw err;
    }

    const updated = await setScreeningResult(candidate.id, result.score, result.explanation);
    if (!updated) {
      console.error('[screening] candidate vanished mid-screening:', candidate.id);
      return res.status(404).json({ error: 'Not found' });
    }
    return res.json(updated);
  } catch (err) {
    return next(err);
  } finally {
    if (acquired) inFlight.delete(candidateId);
  }
});

screeningRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[screening]', err);
  res.status(500).json({ error: 'Internal server error' });
});
