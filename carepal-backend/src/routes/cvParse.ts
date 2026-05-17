import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
import { extractFieldsFromText } from '../logic/cvExtractor.js';
import { requireRole } from '../middleware/rbac.js';

export const cvParseRouter = Router();

// Only PDF and DOCX — mammoth does not support legacy binary .doc format.
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx']);

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

async function extractText(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === 'application/pdf') {
    // pdf-parse v2 uses a class-based API:
    //   new PDFParse({ data: buffer }) → parser.getText() → result.text
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy().catch(() => {});
    return result.text;
  }
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

cvParseRouter.post(
  '/api/cv-parse',
  requireRole('ta'),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Missing file (field name: "file")' });
      const rawText = await extractText(req.file.buffer, req.file.mimetype);
      if (!rawText || rawText.trim().length < 10) {
        return res.status(400).json({ error: 'Could not extract text from file' });
      }
      const fields = extractFieldsFromText(rawText);
      return res.json(fields);
    } catch (err) {
      return next(err);
    }
  },
);

cvParseRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError || err.message?.startsWith('File type not allowed')) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error('[cv-parse]', err);
  res.status(500).json({ error: 'Internal server error' });
});
