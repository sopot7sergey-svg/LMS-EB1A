'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import type { DocumentBuilderStatus } from '@aipas/shared';

const STATUS_STYLES: Record<DocumentBuilderStatus, string> = {
  not_started: 'bg-background-tertiary text-foreground-secondary',
  in_progress: 'bg-primary/15 text-primary',
  added: 'bg-sky-500/15 text-sky-300',
  created: 'bg-violet-500/15 text-violet-300',
  completed: 'bg-success/15 text-success',
};

const STATUS_LABELS: Record<DocumentBuilderStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  added: 'Added',
  created: 'Created',
  completed: 'Completed',
};

const UPLOAD_DISABLED_MESSAGE =
  'Direct document uploads are not available in this version. If you need upload access, please contact the administrator.';

interface DocumentActionBarProps {
  status: DocumentBuilderStatus;
  progress?: number;
  onAdd: () => void;
  onCreate: () => void;
  onTemplate: () => void;
  primaryActionLabel?: string;
  uploadDisabled?: boolean;
}

export function UploadDisabledPopover({
  anchorRef,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - 288),
    });
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popRef.current &&
        !popRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  if (!pos) return null;

  return (
    <div
      ref={popRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="w-72 rounded-lg border border-border bg-background-card p-3 shadow-xl"
    >
      <p className="text-xs text-foreground-secondary leading-relaxed">
        {UPLOAD_DISABLED_MESSAGE}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 text-xs text-primary hover:underline"
      >
        Dismiss
      </button>
    </div>
  );
}

export function DocumentActionBar({
  status,
  progress,
  onAdd,
  onCreate,
  onTemplate,
  primaryActionLabel = 'Create',
  uploadDisabled = false,
}: DocumentActionBarProps) {
  const [showUploadMsg, setShowUploadMsg] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => setShowUploadMsg(false), []);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
        {STATUS_LABELS[status]}
        {typeof progress === 'number' && progress > 0 && status !== 'completed' ? ` ${progress}%` : ''}
      </span>
      <Button
        ref={addBtnRef}
        type="button"
        size="sm"
        variant="ghost"
        className={uploadDisabled ? 'opacity-50 cursor-not-allowed' : ''}
        onClick={() => {
          if (uploadDisabled) {
            setShowUploadMsg((v) => !v);
          } else {
            onAdd();
          }
        }}
      >
        Add
      </Button>
      {showUploadMsg && (
        <UploadDisabledPopover anchorRef={addBtnRef} onClose={handleClose} />
      )}
      <Button type="button" size="sm" variant="ghost" onClick={onCreate}>
        {primaryActionLabel}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onTemplate}>
        Template
      </Button>
    </div>
  );
}
