'use client';

import { Button } from '@/components/ui/button';

export interface EditableDraftSection {
  id: string;
  label: string;
  content: string;
}

interface DocumentDraftEditorProps {
  sections: EditableDraftSection[];
  onSectionChange: (sectionId: string, content: string) => void;
  onRegenerateSection: (sectionId: string) => void;
  isRegenerating?: boolean;
}

export function DocumentDraftEditor({
  sections,
  onSectionChange,
  onRegenerateSection,
  isRegenerating,
}: DocumentDraftEditorProps) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.id} className="rounded-lg border border-border bg-background-secondary p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-white">{section.label}</h3>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              isLoading={isRegenerating}
              onClick={() => onRegenerateSection(section.id)}
            >
              Regenerate section
            </Button>
          </div>
          <textarea
            className="input min-h-[180px] leading-6"
            value={section.content}
            onChange={(event) => onSectionChange(section.id, event.target.value)}
          />
        </div>
      ))}
      {!sections.length ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-foreground-muted">
          Создайте черновик для редактирования.
        </div>
      ) : null}
    </div>
  );
}
