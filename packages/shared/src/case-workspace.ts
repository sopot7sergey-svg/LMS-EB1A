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
  { id: 's0', title: 'Case Profile Data', subtitle: 'Structured fields for Creator + Forms Filler' },
  { id: 's1', title: 'Core Forms, Fees, and Filing Components', subtitle: 'I-140 Packet' },
  { id: 's2', title: 'Personal / Identity / Immigration Status Docs', subtitle: '' },
  { id: 's3', title: 'Case Axis & Proposed Endeavor', subtitle: 'Continuing Work' },
  { id: 's4', title: 'Petition Writing Pack', subtitle: 'What officer reads first' },
  { id: 's5', title: 'Evidence Checklist', subtitle: 'All 10 criteria + Comparable Evidence' },
  { id: 's6', title: 'Comparable Evidence', subtitle: '' },
  { id: 's7', title: 'Recommendation Letters Pack', subtitle: 'Master folder' },
  { id: 's8', title: 'Translations & Certifications', subtitle: '+ Filing Hygiene' },
  { id: 's9', title: 'Officer Review Iterations', subtitle: 'EER Reports' },
  { id: 's10', title: 'Filing Plan + Post-Filing', subtitle: 'Optional / Later' },
] as const;
