'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CRITERIA, CRITERION_SLOTS } from '@lms-eb1a/shared';
import type { CriterionEvidenceStatus } from '@lms-eb1a/shared';

const CRITERION_STATUS_OPTIONS: { value: CriterionEvidenceStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'supported', label: 'Supported' },
  { value: 'strongly_supported', label: 'Strongly supported' },
  { value: 'not_pursued', label: 'Not pursued' },
];

interface CriterionSectionProps {
  criteriaStatuses: Record<string, CriterionEvidenceStatus>;
  onStatusChange: (criterionId: string, status: CriterionEvidenceStatus) => void;
  onAddEvidence: (sectionId: string, criterionId: string | null, slotType: string) => void;
  onGenerateNarrative: (criterionId: string) => void;
}

export function CriterionSection({
  criteriaStatuses,
  onStatusChange,
  onAddEvidence,
  onGenerateNarrative,
}: CriterionSectionProps) {
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set(['C1']));

  const toggleCriterion = (id: string) => {
    setExpandedCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {Object.entries(CRITERIA).map(([criterionId, label]) => {
        const isExpanded = expandedCriteria.has(criterionId);
        const status = criteriaStatuses[criterionId] || 'not_started';
        const slots = CRITERION_SLOTS[criterionId] || [];

        return (
          <div
            key={criterionId}
            className="rounded-lg border border-border bg-background-secondary/30 overflow-hidden"
          >
            <div className="flex items-center gap-2 p-3">
              <button
                type="button"
                onClick={() => toggleCriterion(criterionId)}
                className="shrink-0 text-foreground-muted hover:text-foreground"
              >
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </button>
              <span className="font-medium text-primary">{criterionId}</span>
              <span className="flex-1 truncate text-sm text-foreground-secondary">
                {label}
              </span>
              <select
                value={status}
                onChange={(e) =>
                  onStatusChange(criterionId, e.target.value as CriterionEvidenceStatus)
                }
                className={cn(
                  'rounded border border-border bg-background-tertiary px-2 py-1 text-sm',
                  'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                )}
              >
                {CRITERION_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {isExpanded && (
              <div className="border-t border-border px-4 py-3 pl-12">
                <div className="space-y-2">
                  {slots.map((slotLabel) => (
                    <div
                      key={slotLabel}
                      className="flex items-center justify-between rounded border border-border/50 bg-background-tertiary/30 px-3 py-2"
                    >
                      <span className="text-sm">{slotLabel}</span>
                      <div className="flex items-center gap-2">
                        {slotLabel === 'Narrative' && (
                          <button
                            type="button"
                            onClick={() => onGenerateNarrative(criterionId)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Generate with Creator
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            onAddEvidence('s5', criterionId, slotLabel.toLowerCase().replace(/\s+/g, '_'))
                          }
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
