'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const DEFAULT_ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
};

const DOCUMENT_ONLY_ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
};

const ACCEPTED_LABEL = 'PDF, JPG, PNG, GIF, DOC, DOCX, TXT';
const DOCUMENT_ONLY_LABEL = 'PDF, DOC, DOCX, TXT';

interface DocumentUploadBlockProps {
  caseId: string;
  category: string;
  builderStateId?: string;
  source?: 'upload' | 'generated' | 'source_upload';
  acceptedLabel?: string;
  acceptedMode?: 'default' | 'documents_only';
  onUploadSuccess: (uploadedDocuments?: Array<{ id: string; originalName?: string }>) => void;
  onClose: () => void;
}

export function DocumentUploadBlock({
  caseId,
  category,
  builderStateId,
  source,
  acceptedLabel = ACCEPTED_LABEL,
  acceptedMode = 'default',
  onUploadSuccess,
  onClose,
}: DocumentUploadBlockProps) {
  const { token } = useAuthStore();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!token || !caseId) return;

      setIsUploading(true);
      setError(null);

      try {
        const uploadedDocuments: Array<{ id: string; originalName?: string }> = [];
        for (const file of acceptedFiles) {
          const uploadedDocument = await api.documents.upload(caseId, file, category, token, {
            builderStateId,
            source,
          });
          uploadedDocuments.push(uploadedDocument);
        }
        onUploadSuccess(uploadedDocuments);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setIsUploading(false);
      }
    },
    [token, caseId, category, builderStateId, source, onUploadSuccess]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedMode === 'documents_only' ? DOCUMENT_ONLY_ACCEPTED_TYPES : DEFAULT_ACCEPTED_TYPES,
    maxSize: 50 * 1024 * 1024,
    disabled: isUploading,
  });

  return (
    <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground-secondary">
          Загрузить документ ({acceptedLabel})
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-foreground-muted hover:bg-background-tertiary hover:text-foreground"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/50'
        } ${isUploading ? 'pointer-events-none opacity-70' : ''}`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-2 h-8 w-8 text-foreground-muted" />
        {isUploading ? (
          <p className="text-sm text-foreground-secondary">Загрузка...</p>
        ) : (
          <p className="text-sm text-foreground-secondary">
            {isDragActive ? 'Отпустите файлы здесь...' : 'Перетащите или нажмите для выбора'}
          </p>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-error">{error}</p>
      )}
    </div>
  );
}
