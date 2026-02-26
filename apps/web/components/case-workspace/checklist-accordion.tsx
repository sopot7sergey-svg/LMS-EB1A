'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHECKLIST_SECTIONS } from '@lms-eb1a/shared';
import { CriterionSection } from './criterion-section';
import { CRITERIA } from '@lms-eb1a/shared';
import type { CriterionEvidenceStatus } from '@lms-eb1a/shared';

interface ChecklistAccordionProps {
  caseId: string;
  criteriaStatuses: Record<string, CriterionEvidenceStatus>;
  onCriteriaStatusChange: (criterionId: string, status: CriterionEvidenceStatus) => void;
  onAddEvidence: (sectionId: string, criterionId: string | null, slotType: string) => void;
  onGenerateNarrative: (criterionId: string) => void;
}

export function ChecklistAccordion({
  caseId,
  criteriaStatuses,
  onCriteriaStatusChange,
  onAddEvidence,
  onGenerateNarrative,
}: ChecklistAccordionProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['s0', 's5']));

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-1">
      {CHECKLIST_SECTIONS.map((section) => {
        const isOpen = openSections.has(section.id);
        const isEvidenceSection = section.id === 's5';

        return (
          <div
            key={section.id}
            className="rounded-lg border border-border bg-background-card overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-background-secondary/50 transition-colors"
            >
              {isOpen ? (
                <ChevronDown className="h-5 w-5 shrink-0 text-foreground-muted" />
              ) : (
                <ChevronRight className="h-5 w-5 shrink-0 text-foreground-muted" />
              )}
              <div className="min-w-0 flex-1">
                <span className="font-medium">{section.title}</span>
                {section.subtitle && (
                  <span className="ml-2 text-sm text-foreground-secondary">
                    — {section.subtitle}
                  </span>
                )}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-border px-4 py-4">
                {isEvidenceSection ? (
                  <CriterionSection
                    criteriaStatuses={criteriaStatuses}
                    onStatusChange={onCriteriaStatusChange}
                    onAddEvidence={onAddEvidence}
                    onGenerateNarrative={onGenerateNarrative}
                  />
                ) : (
                  <ChecklistSectionContent
                    sectionId={section.id}
                    onAddEvidence={onAddEvidence}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChecklistSectionContent({
  sectionId,
  onAddEvidence,
}: {
  sectionId: string;
  onAddEvidence: (sectionId: string, criterionId: string | null, slotType: string) => void;
}) {
  const slotConfigs: Record<string, { label: string; slotType: string }[]> = {
    s0: [
      { label: 'Full legal name (passport exact) + aliases', slotType: 'legal_name' },
      { label: 'DOB, citizenship, country of birth', slotType: 'demographics' },
      { label: 'Passport number + expiration', slotType: 'passport' },
      { label: 'Current address/phone/email', slotType: 'contact' },
      { label: 'A-Number, USCIS online account number', slotType: 'uscis_ids' },
      { label: 'Current US status, I-94, last entry', slotType: 'immigration_status' },
      { label: 'Employment, education, awards, publications', slotType: 'background' },
      { label: 'Proposed endeavor summary + keywords', slotType: 'endeavor' },
    ],
    s1: [
      { label: 'Form I-140 (completed + signed)', slotType: 'i140' },
      { label: 'Filing fee payment method record', slotType: 'fee' },
      { label: 'Form G-1145 (optional e-notification)', slotType: 'g1145' },
      { label: 'Cover Letter / Legal Brief', slotType: 'cover_letter' },
      { label: 'Table of Contents + Exhibit List', slotType: 'toc' },
      { label: 'All Exhibits (labeled, tabbed)', slotType: 'exhibits' },
      { label: 'Optional: Premium Processing (I-907)', slotType: 'i907' },
    ],
    s2: [
      { label: 'Passport biographic page', slotType: 'passport_page' },
      { label: 'US visa stamp (if any)', slotType: 'visa' },
      { label: 'I-94 record (most recent)', slotType: 'i94' },
      { label: 'I-797 approval notices (if any)', slotType: 'i797' },
      { label: 'EAD (if any), SSN (optional)', slotType: 'ead_ssn' },
      { label: 'Birth certificate (optional)', slotType: 'birth_cert' },
      { label: 'Updated CV/Resume', slotType: 'cv' },
    ],
    s3: [
      { label: 'Case Axis Statement (1 page)', slotType: 'case_axis' },
      { label: 'Proposed Endeavor Statement (150–250 words)', slotType: 'endeavor_stmt' },
      { label: 'Job offer (optional)', slotType: 'job_offer' },
      { label: 'Contracts/LOIs', slotType: 'contracts' },
      { label: 'Business/project plan', slotType: 'business_plan' },
      { label: 'Speaking schedule / advisory roles', slotType: 'continuation' },
    ],
    s4: [
      { label: 'Executive Summary (optional)', slotType: 'exec_summary' },
      { label: 'Overall merits narrative', slotType: 'merits_narrative' },
      { label: 'Exhibit Map: claim → criterion → exhibit IDs', slotType: 'exhibit_map' },
      { label: 'Draft criterion narratives', slotType: 'criterion_narratives' },
    ],
    s6: [
      { label: 'Rationale memo: why standard criteria don\'t fit', slotType: 'rationale' },
      { label: 'Proposed comparable evidence set', slotType: 'comparable_set' },
      { label: 'Independent verification slots', slotType: 'verification' },
      { label: 'Narrative', slotType: 'narrative' },
    ],
    s7: [
      { label: 'Letters list (6–10 target)', slotType: 'letters_list' },
      { label: 'Draft + final signed versions per letter', slotType: 'letter_versions' },
      { label: 'Author bio/CV proof of authority', slotType: 'author_bio' },
      { label: 'Attachments to author (talking points, brief)', slotType: 'attachments' },
    ],
    s8: [
      { label: 'Translations + translator certification', slotType: 'translations' },
      { label: 'Name/date/title consistency checks', slotType: 'consistency' },
      { label: 'File naming convention', slotType: 'naming' },
      { label: 'Bookmarks/tabs and readability', slotType: 'readability' },
    ],
    s9: [
      { label: 'EER Report v1, v2, v3… (versioned)', slotType: 'eer_reports' },
      { label: 'Resolution Notes log', slotType: 'resolution_notes' },
    ],
    s10: [
      { label: 'Filing address/method reference', slotType: 'filing_address' },
      { label: 'Premium (if used)', slotType: 'premium' },
      { label: 'Post-filing tracker', slotType: 'post_filing' },
    ],
  };

  const slots = slotConfigs[sectionId] || [];

  return (
    <div className="space-y-2">
      {slots.map(({ label, slotType }) => (
        <div
          key={slotType}
          className="flex items-center justify-between rounded-lg border border-border bg-background-secondary/50 px-3 py-2"
        >
          <span className="text-sm">{label}</span>
          <button
            type="button"
            onClick={() => onAddEvidence(sectionId, null, slotType)}
            className="text-sm font-medium text-primary hover:underline"
          >
            + Add
          </button>
        </div>
      ))}
    </div>
  );
}
