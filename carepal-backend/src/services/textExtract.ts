import { createRequire } from 'node:module';

// pdf-parse and mammoth are CommonJS — use createRequire so the ESM build
// doesn't try to import them as ES modules.
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract plain text from a PDF or DOCX buffer. Used by both the CV-parse
 * route (which feeds the candidate-adding form) and the AI screener.
 *
 * Returns the empty string for unsupported MIME types — callers must check
 * the result length and surface "no readable text" to the user themselves.
 */
export async function extractText(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === 'application/pdf') {
    // pdf-parse v2 uses a class-based API:
    //   new PDFParse({ data: buffer }) → parser.getText() → result.text
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy().catch((e: unknown) => {
      console.warn('[textExtract] parser.destroy() failed (non-fatal):', e);
    });
    return result?.text ?? '';
  }
  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? '';
  }
  if (mimetype.startsWith('text/plain')) {
    return buffer.toString('utf-8');
  }
  return '';
}
