import fs from 'fs';
import path from 'path';

export interface StoredDocumentRef {
  caseId: string;
  filename: string;
  s3Key?: string | null;
}

const DOCUMENT_STORAGE_ROOT = path.join(process.cwd(), 'uploads', 'documents');

export function ensureCaseDocumentDir(caseId: string): string {
  const dir = path.join(DOCUMENT_STORAGE_ROOT, caseId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getCanonicalDocumentPath(caseId: string, filename: string): string {
  return path.join(DOCUMENT_STORAGE_ROOT, caseId, filename);
}

export function getDocumentPathCandidates(document: StoredDocumentRef): string[] {
  const candidates = [
    getCanonicalDocumentPath(document.caseId, document.filename),
  ];

  if (document.s3Key) {
    candidates.push(path.resolve(process.cwd(), 'uploads', document.s3Key));
    candidates.push(path.resolve(process.cwd(), '..', 'uploads', document.s3Key));
  }

  candidates.push(path.resolve(process.cwd(), 'uploads', document.caseId, document.filename));
  candidates.push(path.resolve(process.cwd(), '..', 'uploads', document.caseId, document.filename));

  return Array.from(new Set(candidates.map((candidate) => path.resolve(candidate))));
}

export function resolveStoredDocumentPath(document: StoredDocumentRef): {
  resolvedPath: string | null;
  attemptedPaths: string[];
} {
  const attemptedPaths = getDocumentPathCandidates(document);
  const resolvedPath = attemptedPaths.find((candidate) => fs.existsSync(candidate)) ?? null;
  return { resolvedPath, attemptedPaths };
}

export function deleteStoredDocumentFile(document: StoredDocumentRef): boolean {
  const { resolvedPath } = resolveStoredDocumentPath(document);
  if (!resolvedPath) return false;
  fs.unlinkSync(resolvedPath);
  return true;
}
