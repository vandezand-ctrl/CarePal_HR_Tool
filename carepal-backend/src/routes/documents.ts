import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  DOC_TYPES,
  DocType,
  listDocumentsForCandidate,
  getDocumentRowForDownload,
  uploadDocument,
  deleteDocument,
} from '../models/document.js';
import { readFile } from '../services/storage.js';
import { getCandidate } from '../models/candidate.js';
import { requireRole } from '../middleware/rbac.js';

export const documentsRouter = Router();

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp',
]);

// 10 MB cap per document.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error(`File type not allowed: ${file.mimetype} (${ext})`));
      return;
    }
    cb(null, true);
  },
});

const uploadSchema = z.object({
  docType: z.enum(DOC_TYPES),
});

// GET /api/candidates/:id/documents — list docs for a candidate.
documentsRouter.get('/api/candidates/:id/documents', async (req, res, next) => {
  try {
    const docs = await listDocumentsForCandidate(req.params.id);
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

// POST /api/candidates/:id/documents — upload (upsert per doc type).
// Multipart: "file" = binary, "docType" = one of DOC_TYPES.
documentsRouter.post(
  '/api/candidates/:id/documents',
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Missing file (field name: "file")' });
      if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

      const { docType } = uploadSchema.parse({ docType: req.body.docType });
      const candidate = await getCandidate(req.params.id);
      if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

      const doc = await uploadDocument({
        candidateId: candidate.id,
        docType: docType as DocType,
        filename: req.file.originalname,
        mimeType: req.file.mimetype || 'application/octet-stream',
        buffer: req.file.buffer,
        uploadedByUserId: req.user.id,
      });
      return res.status(201).json(doc);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', issues: err.issues });
      }
      return next(err);
    }
  },
);

// GET /api/documents/:id/download — stream the file bytes with original filename.
documentsRouter.get('/api/documents/:id/download', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid document id' });
    const row = await getDocumentRowForDownload(id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const buffer = await readFile(row.storage_key);
    res.setHeader('Content-Type', row.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.filename)}"`);
    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/documents/:id — remove row + file.
documentsRouter.delete('/api/documents/:id', requireRole('ta'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid document id' });
    const ok = await deleteDocument(id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

documentsRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError || err.message?.startsWith('File type not allowed')) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error('[documents]', err);
  res.status(500).json({ error: 'Internal server error' });
});
