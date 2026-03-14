'use client';

import { Dialog } from '@/components/ui/dialog';
import type { DocumentBuilderSlotConfig } from '@aipas/shared';

interface DocumentTemplateViewerProps {
  open: boolean;
  config: DocumentBuilderSlotConfig | null;
  onClose: () => void;
}

export function DocumentTemplateViewer({
  open,
  config,
  onClose,
}: DocumentTemplateViewerProps) {
  if (!open || !config) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${config.shortLabel} Template`}
      className="max-w-4xl"
    >
      <div className="space-y-6 p-6">
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-background-secondary p-4">
            <h3 className="mb-2 text-sm font-semibold text-white">What this document is</h3>
            <p className="text-sm text-foreground-secondary">{config.template.whatItIs}</p>
          </div>
          <div className="rounded-lg border border-border bg-background-secondary p-4">
            <h3 className="mb-2 text-sm font-semibold text-white">Why it matters</h3>
            <p className="text-sm text-foreground-secondary">{config.template.whyItMatters}</p>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-background-secondary p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Required structure / sections</h3>
          <ul className="space-y-2 text-sm text-foreground-secondary">
            {config.template.requiredSections.map((section) => (
              <li key={section} className="rounded-md bg-background-tertiary px-3 py-2">
                {section}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-background-secondary p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">Example of a strong version</h3>
          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground-secondary">
            {config.template.strongExample}
          </p>
        </section>

        {config.template.notes?.length ? (
          <section className="rounded-lg border border-border bg-background-secondary p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Optional notes / instructions</h3>
            <ul className="space-y-2 text-sm text-foreground-secondary">
              {config.template.notes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}
