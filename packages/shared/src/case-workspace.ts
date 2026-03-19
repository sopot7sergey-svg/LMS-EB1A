/**
 * Case Workspace types for EB-1A LMS Dashboard
 */

export type CaseLifecycleStatus =
  | 'draft'
  | 'building'
  | 'review_ready'
  | 'in_review'
  | 'iterating'
  | 'filing_ready'
  | 'filed';

export type CriterionEvidenceStatus =
  | 'not_started'
  | 'in_progress'
  | 'supported'
  | 'strongly_supported'
  | 'not_pursued';

export type EvidenceItemType = 'file' | 'link' | 'text';

export type EvidenceQualityTag = 'strong' | 'medium' | 'weak';

export type EvidenceSourceTag = 'independent' | 'internal';

export type EvidenceVerifiabilityTag = 'verifiable' | 'hard_to_verify';

export interface CaseProfileData {
  fullLegalName?: string;
  aliases?: string[];
  dateOfBirth?: string;
  citizenship?: string;
  countryOfBirth?: string;
  passportNumber?: string;
  passportExpiration?: string;
  currentAddress?: string;
  phone?: string;
  email?: string;
  aNumber?: string;
  uscisOnlineAccountNumber?: string;
  currentUSStatus?: string;
  i94Number?: string;
  lastEntryDate?: string;
  lastEntryPort?: string;
  lastEntryClass?: string;
  employmentHistory?: string;
  education?: string;
  awards?: string;
  publications?: string;
  memberships?: string;
  proposedEndeavorSummary?: string;
  fieldNarrativeKeywords?: string[];
}

export interface EvidenceItem {
  id: string;
  caseId: string;
  sectionId: string;
  criterionId?: string;
  slotType: string;
  type: EvidenceItemType;
  value: string; // filename, URL, or text content
  tags?: {
    source?: EvidenceSourceTag;
    verifiability?: EvidenceVerifiabilityTag;
    strength?: EvidenceQualityTag;
  };
  notes?: string;
  createdAt: string;
}

export interface EERReportItem {
  id: string;
  severity: 'critical' | 'recommended' | 'optional';
  criterionId?: string;
  issue: string;
  whyItMatters: string;
  requestedFix: string;
  suggestedTemplate?: string;
  status: 'open' | 'resolved';
  resolutionNote?: string;
  linkedEvidenceIds?: string[];
  deepLink?: { sectionId: string; criterionId?: string; slotType: string };
}

export interface EERReport {
  id: string;
  caseId: string;
  version: number;
  createdAt: string;
  items: EERReportItem[];
  criticalItems: EERReportItem[];
  recommendedItems: EERReportItem[];
  optionalItems: EERReportItem[];
}

/** Criterion slot templates - minimum viable slots per criterion */
export const CRITERION_SLOTS: Record<string, string[]> = {
  C1: [
    'Award certificate/proof',
    'Award rules + selection criteria',
    'Jury/committee proof',
    'Competitiveness stats (if available)',
    'Proof of reputation (media/website)',
    'Narrative',
  ],
  C2: [
    'Membership confirmation',
    'Bylaws/admission criteria',
    'Selectivity proof (peer review/criteria)',
    'Acceptance rate/quotas (if available)',
    'Plan B / alternative evidence note',
    'Narrative',
  ],
  C3: [
    'Article/interview/profile copy',
    'Publication credibility proof',
    'Metadata (date/author/URL)',
    'Screenshot/PDF preservation',
    'Translation/certification',
    'Narrative',
  ],
  C4: [
    'Invitation/appointment',
    'Guidelines/rubric',
    'Proof of participation',
    'Judging log table',
    'Narrative',
  ],
  C5: [
    'Contribution claims (2–4) brief',
    'Metrics/KPI proof',
    'Adoption/rollout proof',
    'Independent corroboration',
    'Narrative',
  ],
  C6: [
    'Articles PDFs/links',
    'Publication credibility proof',
    'Indexing/citations/views (if applicable)',
    'Acceptance/editorial proof (if available)',
    'Narrative',
  ],
  C7: [
    'Proof of display',
    'Selection/curation proof',
    'Venue credibility proof',
    'Curator/organizer letter',
    'Narrative',
  ],
  C8: [
    'Role letter / employment verification',
    'Org chart / scope proof',
    'Project briefs + impact metrics',
    'Distinguished org proof (press/rankings/funding)',
    'Performance evidence (optional)',
    'Narrative',
  ],
  C9: [
    'Offer letters/contracts',
    'Pay stubs/W-2/tax docs (redacted)',
    'Bonus/equity docs',
    'Market benchmark sources',
    'Comparison memo',
    'Narrative',
  ],
  C10: [
    'Sales/box office/streams/charts',
    'Contracts/royalty statements',
    'Third-party reports',
    'Media proof',
    'Narrative',
  ],
};

/** Checklist section definitions */
export const CHECKLIST_SECTIONS = [
  { id: 's1', title: '1. Анкета и профиль дела', subtitle: '' },
  { id: 's2', title: '2. Формы и сборы', subtitle: '' },
  { id: 's3', title: '3. Идентичность и статус', subtitle: '' },
  { id: 's4', title: '4. Сопроводительное письмо / Legal Brief', subtitle: '' },
  { id: 's5', title: '5. Доказательства (критерии)', subtitle: '' },
  { id: 's6', title: '6. Сопоставимые доказательства', subtitle: '' },
  { id: 's7', title: '7. Экспертные письма', subtitle: '' },
  { id: 's8', title: '8. Переводы', subtitle: '' },
  { id: 's9', title: '9. Ответы USCIS (RFE/NOID)', subtitle: '' },
  { id: 's10', title: '10. Подача и отслеживание', subtitle: '' },
  { id: 's11', title: '11. Сборка пакета и проверка', subtitle: '' },
] as const;
