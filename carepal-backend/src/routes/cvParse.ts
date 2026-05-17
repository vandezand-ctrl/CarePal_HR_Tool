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
    await parser.destroy().catch((e: unknown) => {
      console.warn('[cv-parse] parser.destroy() failed (non-fatal):', e);
    });
    return result?.text ?? '';
  }
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// Cap text length to avoid expensive regex on very large documents.
const MAX_TEXT_LENGTH = 50_000;

cvParseRouter.post(
  '/api/cv-parse',
  requireRole('ta'),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Missing file (field name: "file")' });

      let rawText: string;
      try {
        rawText = await extractText(req.file.buffer, req.file.mimetype);
      } catch (extractErr) {
        console.error('[cv-parse] text extraction failed:', extractErr);
        return res.status(422).json({
          error: 'Could not read the file. It may be corrupted, password-protected, or in an unsupported format.',
        });
      }

      if (!rawText || rawText.trim().length < 10) {
        return res.status(400).json({
          error: 'Could not extract text from file — the document may be image-based (scanned). Only text-based PDFs and DOCX files are supported.',
        });
      }

      const fields = extractFieldsFromText(rawText.slice(0, MAX_TEXT_LENGTH));
      return res.json(fields);
    } catch (err) {
      return next(err);
    }
  },
);

cvParseRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large. Maximum size is 10 MB.'
      : err.message;
    res.status(400).json({ error: message });
    return;
  }
  if (err.message?.includes('File type not allowed')) {
    res.status(400).json({ error: 'Only PDF and DOCX files are supported.' });
    return;
  }
  console.error('[cv-parse]', err);
  res.status(500).json({ error: 'Internal server error' });
});
