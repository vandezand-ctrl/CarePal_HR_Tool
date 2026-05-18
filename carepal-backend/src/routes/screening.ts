import { Router, Request, Response, NextFunction } from 'express';
import { getCandidate, updateCandidate } from '../models/candidate.js';
import { getRequisition } from '../models/requisition.js';
import {
  listDocumentsForCandidate,
  getDocumentRowForDownload,
} from '../models/document.js';
import { readFile } from '../services/storage.js';
import { extractText } from '../services/textExtract.js';
import { screenCv, isScreeningConfigured } from '../services/cvScreener.js';

export const screeningRouter = Router();

/**
 * POST /api/candidates/:id/screen — run the Claude API screening for a
 * candidate's latest Resume against their linked requisition.
 *
 * Soft failures (no API key, no CV, image-only PDF, missing requisition)
 * return 200 with { screened: false, reason } so the UI can show a friendly
 * message — they're expected conditions, not bugs. Same pattern as
 * reject-notify.
 *
 * Success path returns the full updated Candidate (with aiScore +
 * aiScoreExplanation populated) so the frontend can patch its local state
 * without a refetch.
 */
screeningRouter.post('/api/candidates/:id/screen', async (req, res, next) => {
  try {
    const candidate = await getCandidate(req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Not found' });

    // TA scoping — TAs can only screen candidates assigned to them.
    // Matches the pattern in GET /api/candidates/:id and reject-notify.
    if (req.user!.role === 'ta' && !candidate.assignedTas.some((t) => t.id === req.user!.id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!isScreeningConfigured()) {
      return res.json({
        screened: false,
        reason: 'AI screening is not configured (ANTHROPIC_API_KEY missing)',
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

    let cvText: string;
    try {
      const buffer = await readFile(docRow.storage_key);
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
      return res.json({
        screened: false,
        reason: `Linked requisition ${candidate.reqId} not found`,
      });
    }

    const result = await screenCv(cvText, requisition);

    const updated = await updateCandidate(candidate.id, {
      aiScore: result.score,
      aiScoreExplanation: result.explanation,
    });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

screeningRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[screening]', err);
  res.status(500).json({ error: 'Internal server error' });
});
