'use client';

import { Dialog } from '@/components/ui/dialog';
import type { ToolId } from './tool-cards';

interface ToolModalProps {
  toolId: ToolId | null;
  onClose: () => void;
  caseId: string;
}

const CREATOR_TEMPLATES = [
  'Recommendation letter (by author type)',
  'Judging outreach email + organizer confirmation request',
  'Media pitch + press bio',
  'Exhibit caption/context page',
  'Criterion narrative (½–1 page)',
  'Contribution claims brief',
  'Market comparison memo (salary)',
  'Comparable evidence rationale memo',
  'Cover letter sections (criterion blocks + overall merits)',
];

export function CreatorModal({ toolId, onClose, caseId }: ToolModalProps) {
  if (toolId !== 'creator') return null;

  return (
    <Dialog open={true} onClose={onClose} title="Creator" className="max-w-xl">
      <div className="p-6 space-y-4">
        <p className="text-sm text-foreground-secondary">
          Create / draft documents, narratives, exhibits, letters. Choose a template below.
        </p>
        <div className="space-y-2">
          {CREATOR_TEMPLATES.map((t) => (
            <button
              key={t}
              type="button"
              className="w-full rounded-lg border border-border bg-background-secondary px-4 py-3 text-left text-sm hover:border-primary/50 transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-xs text-foreground-muted">
          Flow: Choose template → fill quick fields → generate → edit → Save to case (pick checklist section + criterion + slot)
        </p>
      </div>
    </Dialog>
  );
}

export function FormsFillerModal({ toolId, onClose, caseId }: ToolModalProps) {
  if (toolId !== 'forms-filler') return null;

  return (
    <Dialog open={true} onClose={onClose} title="Forms Filler" className="max-w-xl">
      <div className="p-6 space-y-4">
        <p className="text-sm text-foreground-secondary">
          Case Profile Data intake → map fields → fill I-140 form structure.
        </p>
        <div className="space-y-2">
          <button
            type="button"
            className="w-full rounded-lg border border-border bg-primary/10 px-4 py-3 text-left text-sm font-medium text-primary hover:border-primary/50 transition-colors"
          >
            Fill Form I-140 from Case Profile
          </button>
          <p className="text-xs text-foreground-muted">
            Export: PDF draft + JSON data. Basic validation: required fields missing; name/date inconsistencies.
          </p>
        </div>
      </div>
    </Dialog>
  );
}

export function AdvisorChatModal({ toolId, onClose, caseId }: ToolModalProps) {
  if (toolId !== 'advisor-chat') return null;

  return (
    <Dialog open={true} onClose={onClose} title="Advisor Chat" className="max-w-xl">
      <div className="p-6 space-y-4">
        <p className="text-sm text-foreground-secondary">
          Procedural Q&A only. Explains criteria, evidence types, translations, organization, responding to USCIS letters.
        </p>
        <div className="rounded-lg border border-border bg-background-secondary p-4">
          <p className="text-xs text-foreground-muted mb-2">
            <strong>Rules:</strong> No approval predictions, no odds, no case strength assessments.
          </p>
          <textarea
            placeholder="Ask a procedural question..."
            className="w-full rounded-lg border border-border bg-background-tertiary px-3 py-2 text-sm placeholder:text-foreground-muted focus:border-primary focus:outline-none"
            rows={3}
          />
          <button
            type="button"
            className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            Send
          </button>
        </div>
      </div>
    </Dialog>
  );
}
