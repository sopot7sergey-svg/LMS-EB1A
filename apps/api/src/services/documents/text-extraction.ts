import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { PDFParse } from 'pdf-parse';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'documents');

export interface ExtractableDocumentRef {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  caseId: string;
}

export interface DocumentExtractionResult {
  documentId: string;
  fileName: string;
  mimeType: string;
  extractedText: string;
  extractedTextLength: number;
  extractionSucceeded: boolean;
  appearsScanned: boolean;
  preview: string;
  sourceUsed: 'attached_document_text' | 'attached_document_metadata_only';
  failureReason?: string;
}

export function getDocumentFilePath(doc: ExtractableDocumentRef): string {
  return path.join(UPLOADS_DIR, doc.caseId, doc.filename);
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildPreview(text: string): string {
  return normalizeExtractedText(text).slice(0, 220);
}

function detectScannedPdf(text: string): boolean {
  const normalized = normalizeExtractedText(text);
  if (!normalized) return true;
  const alphaChars = (normalized.match(/[A-Za-z]/g) || []).length;
  const longWords = normalized.split(/\s+/).filter((w) => w.length >= 4).length;
  const lines = normalized.split('\n').filter(Boolean).length;
  return normalized.length < 300 || alphaChars < 120 || longWords < 25 || lines < 3;
}

async function extractPdfText(filePath: string): Promise<{ text: string; appearsScanned: boolean }> {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    const text = normalizeExtractedText(parsed.text || '');
    return {
      text,
      appearsScanned: detectScannedPdf(text),
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function extractOfficeText(filePath: string): string {
  const text = execFileSync('textutil', ['-convert', 'txt', '-stdout', filePath], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return normalizeExtractedText(text || '');
}

export async function extractDocumentTextDetailed(
  doc: ExtractableDocumentRef,
): Promise<DocumentExtractionResult> {
  const filePath = getDocumentFilePath(doc);
  if (!fs.existsSync(filePath)) {
    return {
      documentId: doc.id,
      fileName: doc.originalName,
      mimeType: doc.mimeType,
      extractedText: '',
      extractedTextLength: 0,
      extractionSucceeded: false,
      appearsScanned: false,
      preview: '',
      sourceUsed: 'attached_document_metadata_only',
      failureReason: 'File not found on disk',
    };
  }

  try {
    if (doc.mimeType === 'text/plain') {
      const text = normalizeExtractedText(fs.readFileSync(filePath, 'utf-8')).slice(0, 100_000);
      return {
        documentId: doc.id,
        fileName: doc.originalName,
        mimeType: doc.mimeType,
        extractedText: text,
        extractedTextLength: text.length,
        extractionSucceeded: text.length > 0,
        appearsScanned: false,
        preview: buildPreview(text),
        sourceUsed: text.length > 0 ? 'attached_document_text' : 'attached_document_metadata_only',
        failureReason: text.length > 0 ? undefined : 'Text file was empty',
      };
    }

    if (doc.mimeType === 'application/pdf') {
      const { text, appearsScanned } = await extractPdfText(filePath);
      return {
        documentId: doc.id,
        fileName: doc.originalName,
        mimeType: doc.mimeType,
        extractedText: text.slice(0, 100_000),
        extractedTextLength: text.length,
        extractionSucceeded: text.length > 0 && !appearsScanned,
        appearsScanned,
        preview: buildPreview(text),
        sourceUsed: text.length > 0 && !appearsScanned ? 'attached_document_text' : 'attached_document_metadata_only',
        failureReason:
          text.length === 0
            ? 'No extractable PDF text found'
            : appearsScanned
              ? 'PDF appears scanned or image-based; extracted text is too thin'
              : undefined,
      };
    }

    if (
      doc.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      doc.mimeType === 'application/msword'
    ) {
      const text = extractOfficeText(filePath).slice(0, 100_000);
      return {
        documentId: doc.id,
        fileName: doc.originalName,
        mimeType: doc.mimeType,
        extractedText: text,
        extractedTextLength: text.length,
        extractionSucceeded: text.length > 0,
        appearsScanned: false,
        preview: buildPreview(text),
        sourceUsed: text.length > 0 ? 'attached_document_text' : 'attached_document_metadata_only',
        failureReason: text.length > 0 ? undefined : 'Word document did not yield text output',
      };
    }

    return {
      documentId: doc.id,
      fileName: doc.originalName,
      mimeType: doc.mimeType,
      extractedText: '',
      extractedTextLength: 0,
      extractionSucceeded: false,
      appearsScanned: false,
      preview: '',
      sourceUsed: 'attached_document_metadata_only',
      failureReason: `No extractor implemented for MIME type ${doc.mimeType}`,
    };
  } catch (error) {
    return {
      documentId: doc.id,
      fileName: doc.originalName,
      mimeType: doc.mimeType,
      extractedText: '',
      extractedTextLength: 0,
      extractionSucceeded: false,
      appearsScanned: doc.mimeType === 'application/pdf',
      preview: '',
      sourceUsed: 'attached_document_metadata_only',
      failureReason: error instanceof Error ? error.message : 'Unknown extraction error',
    };
  }
}
