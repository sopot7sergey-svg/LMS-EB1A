'use client';

import { useState } from 'react';
import { FileText, Paperclip, Plus, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentUploadBlock } from './document-upload-block';

export interface AttachableDocument {
  id: string;
  originalName: string;
  mimeType?: string;
  category?: string;
  metadata?: Record<string, unknown>;
}

interface DocumentAttachmentPickerProps {
  caseId: string;
  documents: AttachableDocument[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onUploadSuccess?: () => void;
  maxSelections?: number;
  label?: string;
  compact?: boolean;
}

export function DocumentAttachmentPicker({
  caseId,
  documents,
  selectedIds,
  onSelectionChange,
  onUploadSuccess,
  maxSelections,
  label = 'Attach documents',
  compact = false,
}: DocumentAttachmentPickerProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const selectedDocs = documents.filter((d) => selectedIds.includes(d.id));
  const unselectedDocs = documents.filter((d) => !selectedIds.includes(d.id));

  const toggleDocument = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    } else if (!maxSelections || selectedIds.length < maxSelections) {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const removeDocument = (id: string) => {
    onSelectionChange(selectedIds.filter((x) => x !== id));
  };

  if (compact) {
    return (
      <div className="space-y-2">
        {selectedDocs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedDocs.map((doc) => (
              <span
                key={doc.id}
                className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-white"
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="max-w-[160px] truncate">{doc.originalName}</span>
                <button
                  type="button"
                  onClick={() => removeDocument(doc.id)}
                  className="ml-0.5 rounded hover:text-error"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setShowPicker(!showPicker)}
          >
            <Paperclip className="mr-1.5 h-3.5 w-3.5" />
            {label}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setShowUpload(!showUpload)}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Upload new
          </Button>
        </div>

        {showPicker && unselectedDocs.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background-secondary p-2 space-y-1">
            {unselectedDocs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => toggleDocument(doc.id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-background-tertiary"
              >
                <Plus className="h-3 w-3 shrink-0 text-primary" />
                <span className="truncate text-foreground-secondary">{doc.originalName}</span>
                {doc.category && (
                  <span className="ml-auto shrink-0 text-[10px] text-foreground-muted">
                    {doc.category}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {showPicker && unselectedDocs.length === 0 && (
          <p className="text-xs text-foreground-muted">No other documents available.</p>
        )}

        {showUpload && (
          <DocumentUploadBlock
            caseId={caseId}
            category="Case Intake & Profile"
            acceptedMode="documents_only"
            acceptedLabel="PDF, DOC, DOCX, TXT"
            onUploadSuccess={() => {
              setShowUpload(false);
              onUploadSuccess?.();
            }}
            onClose={() => setShowUpload(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background-secondary p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">{label}</h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setShowPicker(!showPicker)}
          >
            <Paperclip className="mr-1.5 h-3.5 w-3.5" />
            Select existing
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setShowUpload(!showUpload)}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Upload new
          </Button>
        </div>
      </div>

      {selectedDocs.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-foreground-muted">
            {selectedDocs.length} document{selectedDocs.length > 1 ? 's' : ''} attached
          </p>
          {selectedDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-sm text-white">{doc.originalName}</span>
              </div>
              <button
                type="button"
                onClick={() => removeDocument(doc.id)}
                className="ml-2 shrink-0 rounded p-1 text-foreground-muted hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showPicker && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-2 space-y-1">
          {unselectedDocs.length > 0 ? (
            unselectedDocs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => toggleDocument(doc.id)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-background-tertiary"
              >
                <Plus className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-foreground-secondary">{doc.originalName}</span>
                {doc.category && (
                  <span className="ml-auto shrink-0 text-xs text-foreground-muted">
                    {doc.category}
                  </span>
                )}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-foreground-muted">
              No other documents available. Upload a new one.
            </p>
          )}
        </div>
      )}

      {showUpload && (
        <DocumentUploadBlock
          caseId={caseId}
          category="Case Intake & Profile"
          acceptedMode="documents_only"
          acceptedLabel="PDF, DOC, DOCX, TXT"
          onUploadSuccess={() => {
            setShowUpload(false);
            onUploadSuccess?.();
          }}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}
