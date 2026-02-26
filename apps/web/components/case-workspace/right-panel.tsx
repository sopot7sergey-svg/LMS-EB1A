'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, MessageCircle, ClipboardCheck } from 'lucide-react';

const STAGE_OPTIONS = [
  { value: 'M0', label: 'M0: Case Axis and Strategy' },
  { value: 'M1', label: 'M1: Diagnostic Across the 10 Criteria' },
  { value: 'M2', label: 'M2: Building Evidence for 3-6 Criteria' },
  { value: 'M3', label: 'M3: Recommendation Letters' },
  { value: 'M4', label: 'M4: Petition Packaging and Final Assembly' },
  { value: 'M5', label: 'M5: Filing I-140 and Post-Filing Process' },
  { value: 'M6', label: 'M6: Officer-Style Review' },
] as const;

interface RightPanelProps {
  stage: string;
  onStageChange: (stage: string) => void;
  nextActions: string[];
  openTasks: string[];
  onGenerateNarrative: () => void;
  onAskAdvisor: () => void;
  onSubmitForReview: () => void;
}

export function RightPanel({
  stage,
  onStageChange,
  nextActions,
  openTasks,
  onGenerateNarrative,
  onAskAdvisor,
  onSubmitForReview,
}: RightPanelProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Guided Next Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground-secondary mb-2">
              Current Stage
            </label>
            <select
              value={stage}
              onChange={(e) => onStageChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {STAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Next 3 actions</h4>
            <ul className="space-y-1 text-sm text-foreground-secondary">
              {nextActions.length > 0 ? (
                nextActions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary">{i + 1}.</span>
                    {a}
                  </li>
                ))
              ) : (
                <li className="text-foreground-muted">Complete checklist items</li>
              )}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Open tasks</h4>
            <ul className="space-y-1 text-sm text-foreground-secondary">
              {openTasks.length > 0 ? (
                openTasks.map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-warning">•</span>
                    {t}
                  </li>
                ))
              ) : (
                <li className="text-foreground-muted">No open tasks</li>
              )}
            </ul>
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={onGenerateNarrative}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate narrative for selected criterion
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={onAskAdvisor}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Ask about this requirement
            </Button>
            <Button
              className="w-full justify-start"
              onClick={onSubmitForReview}
            >
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Submit for review
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
