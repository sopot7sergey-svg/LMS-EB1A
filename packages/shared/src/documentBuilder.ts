import { CHECKLIST_SECTIONS } from './case-workspace';
import type { DocumentCategory } from './documentCategories';

export type DocumentBuilderStatus =
  | 'not_started'
  | 'in_progress'
  | 'added'
  | 'created'
  | 'completed';

export type DocumentBuilderAction = 'add' | 'create' | 'template';

export type DocumentBuilderInputMode = 'manual' | 'source_upload' | 'voice_transcript';
export const DOCUMENT_BUILDER_VOICE_TRANSCRIPT_KEY = '__voiceTranscript';

export type DocumentAssistantMode = 'create' | 'fill';
export type DocumentMetadataSource = 'upload' | 'generated' | 'source_upload';

export type DocumentBuilderQuestionType =
  | 'short_text'
  | 'long_text'
  | 'date'
  | 'select'
  | 'repeatable'
  | 'multi_select'
  | 'file_upload';

export interface DocumentQuestionHelp {
  whatItMeans: string;
  whatToEnter: string;
  whatNotToEnter?: string;
  example?: string;
  sourceDocument?: string;
}

export interface DocumentTemplateContent {
  whatItIs: string;
  whyItMatters: string;
  requiredSections: string[];
  strongExample: string;
  notes?: string[];
}

export interface DocumentDraftSection {
  id: string;
  label: string;
  content: string;
}

export interface DocumentOutputSection {
  id: string;
  label: string;
  description?: string;
}

/** Intake Questionnaire only: section-level context for strategic intake */
export interface IntakeSectionMeta {
  id: string;
  label: string;
  purpose: string;
  whatThisEvaluates: string;
  evidenceToUpload: string;
  strongAnswerLooksLike: string;
  critical?: boolean;
}

/** Intake Strategy Summary produced after questionnaire completion */
export interface IntakeStrategySummary {
  probableCaseAxis: string;
  likelyStrongCriteria: string[];
  likelyWeakCriteria: string[];
  missingEvidence: string[];
  riskFactors: string[];
  strategyNotes: string[];
}

/** Reusable structured intake data for downstream document prefill */
export interface IntakeReusableDataset {
  basicIdentity?: Record<string, unknown>;
  fieldDefinition?: Record<string, unknown>;
  careerTimeline?: Record<string, unknown>;
  coreAchievements?: Record<string, unknown>;
  criteriaSignals?: Record<string, unknown>;
  usIntent?: Record<string, unknown>;
  evidenceInventory?: Record<string, unknown>;
  weaknessesGaps?: Record<string, unknown>;
  [key: string]: Record<string, unknown> | undefined;
}

export type DocumentBuilderAnswers = Record<string, unknown>;

/** Cover Letter only: structured result when generation is blocked */
export interface CoverLetterBlockedResult {
  status: 'blocked';
  whyBlocked: string;
  missingRequiredInputs: string[];
  missingRequiredEvidence: string[];
  criticalDeficiencies: string[];
  requiredNextActions: string[];
  missingInputWarnings?: string[];
  weakEvidenceWarnings?: string[];
  recommendedNextDocuments?: string[];
}

export interface DocumentDraftPayload {
  title: string;
  summary: string;
  sections: DocumentDraftSection[];
  suggestedNextSteps?: string[];
  strategySummary?: IntakeStrategySummary;
  reusableDataset?: IntakeReusableDataset;
  /** Cover Letter only: when generation blocked, do not write prose */
  coverLetterBlocked?: CoverLetterBlockedResult;
}

interface DocumentBuilderQuestionBase {
  id: string;
  label: string;
  type: DocumentBuilderQuestionType;
  helpText?: string;
  placeholder?: string;
  required?: boolean;
  assistantHelp?: DocumentQuestionHelp;
  /** Intake only: section this question belongs to */
  sectionId?: string;
  /** Intake only: why we ask this question */
  whyWeAskThis?: string;
  /** Intake only: what evidence this supports */
  evidenceHint?: string;
  /** Intake only: prompt encouraging dates, names, orgs, numbers */
  answerPrompt?: string;
  /** Future-facing support for transcript-assisted answers */
  allowsVoiceTranscript?: boolean;
}

export interface ShortTextQuestion extends DocumentBuilderQuestionBase {
  type: 'short_text' | 'long_text' | 'date';
}

export interface SelectQuestion extends DocumentBuilderQuestionBase {
  type: 'select';
  options: string[];
}

export interface MultiSelectQuestion extends DocumentBuilderQuestionBase {
  type: 'multi_select';
  options: string[];
}

export interface FileUploadQuestion extends DocumentBuilderQuestionBase {
  type: 'file_upload';
  acceptedMimeTypes?: string[];
}

export interface RepeatableQuestion extends DocumentBuilderQuestionBase {
  type: 'repeatable';
  itemLabel: string;
  fields: Array<{
    id: string;
    label: string;
    type: 'short_text' | 'long_text' | 'date';
    placeholder?: string;
    required?: boolean;
  }>;
}

export type DocumentBuilderQuestion =
  | ShortTextQuestion
  | SelectQuestion
  | MultiSelectQuestion
  | FileUploadQuestion
  | RepeatableQuestion;

export type DocumentBuilderSectionId = (typeof CHECKLIST_SECTIONS)[number]['id'];

export interface DocumentBuilderDocumentLike {
  metadata?: {
    slotType?: string;
    source?: DocumentMetadataSource;
    builderStatus?: DocumentBuilderStatus;
  } | null;
}

export interface DocumentBuilderStateLike {
  slotType: string;
  status: DocumentBuilderStatus;
  progress?: number | null;
  sectionId?: string | null;
}

export interface DocumentBuilderSlotConfig {
  slotType: string;
  assistantMode: DocumentAssistantMode;
  sectionId: DocumentBuilderSectionId;
  category: DocumentCategory;
  label: string;
  shortLabel: string;
  description: string;
  purpose: string;
  usageInCase: string;
  completionOutcome: string;
  actions: DocumentBuilderAction[];
  acceptedMimeTypes: string[];
  inputModes: DocumentBuilderInputMode[];
  templateUrl?: string;
  prefillFromSlots?: string[];
  sharedAnswerKeys?: string[];
  strategyImpact?: boolean;
  template: DocumentTemplateContent;
  questions: DocumentBuilderQuestion[];
  questionGroups?: Array<{
    id: string;
    title: string;
    description?: string;
    questionIds: string[];
  }>;
  outputSections: DocumentOutputSection[];
  priority: 'priority' | 'standard';
  /** Intake Questionnaire only: section metadata for UX and progress */
  intakeSections?: IntakeSectionMeta[];
  /** Intake only: section IDs that count as critical for progress / strategy readiness */
  criticalSectionIds?: string[];
}

const DOC_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

const INTAKE_CRITICAL_SECTION_IDS = [
  's1_basic_identity',
  's2_field_definition',
  's3_career_timeline',
  's4_core_achievements',
  's9_original_contributions',
  's11_leading_role',
  's18_evidence_inventory',
  's19_weaknesses',
  's21_final_strategy',
];

function getIntakeQuestionnaireConfig(): DocumentBuilderSlotConfig {
  const intakeSections: IntakeSectionMeta[] = [
    {
      id: 's1_basic_identity',
      label: '1. Basic Identity & Case Overview',
      purpose: 'Establish who the beneficiary is and current immigration context.',
      whatThisEvaluates: 'Eligibility baseline, identity consistency, and case framing.',
      evidenceToUpload: 'Passport bio page, visa/I-94, current status docs if relevant.',
      strongAnswerLooksLike: 'Full legal name, DOB, citizenship, current status, and key dates—no gaps.',
      critical: true,
    },
    {
      id: 's2_field_definition',
      label: '2. Field Definition & Positioning',
      purpose: 'Define the field of endeavor and how the beneficiary is positioned within it.',
      whatThisEvaluates: 'Clarity of field, niche, and “top of field” positioning for EB1A.',
      evidenceToUpload: 'CV, bio, or one-pager that defines your field.',
      strongAnswerLooksLike: 'Specific niche (e.g. “distributed systems for financial infra”), not “tech” or “business.”',
      critical: true,
    },
    {
      id: 's3_career_timeline',
      label: '3. Career Timeline',
      purpose: 'Chronological roles and progression to support consistency across the case.',
      whatThisEvaluates: 'Timeline coherence, seniority progression, and role clarity.',
      evidenceToUpload: 'Resume, LinkedIn export, or employment history draft.',
      strongAnswerLooksLike: 'Employer, title, month/year start and end, and 1–2 line impact per role.',
      critical: true,
    },
    {
      id: 's4_core_achievements',
      label: '4. Core Achievements Summary',
      purpose: 'Top 3–5 signature achievements that anchor the case narrative.',
      whatThisEvaluates: 'Strength of accomplishments and their relevance to EB1A criteria.',
      evidenceToUpload: 'Awards, press, project summaries, or performance reviews.',
      strongAnswerLooksLike: 'Concrete outcomes with names, dates, organizations, and measurable impact.',
      critical: true,
    },
    {
      id: 's5_awards',
      label: '5. Awards, Honors, Prizes',
      purpose: 'Catalog awards and prizes for Criterion 1 (lesser nationally/internationally recognized awards).',
      whatThisEvaluates: 'Award selectivity, reputation, and competitiveness.',
      evidenceToUpload: 'Certificates, announcements, criteria, selection stats.',
      strongAnswerLooksLike: 'Award name, issuer, date, number of recipients/selectivity, and why it matters.',
    },
    {
      id: 's6_memberships',
      label: '6. Memberships',
      purpose: 'Memberships requiring outstanding achievement (Criterion 2).',
      whatThisEvaluates: 'Selectivity of membership and proof of outstanding achievement.',
      evidenceToUpload: 'Membership letters, bylaws, admission criteria.',
      strongAnswerLooksLike: 'Organization, admission basis, selectivity evidence, and date joined.',
    },
    {
      id: 's7_published_material',
      label: '7. Published Material About You',
      purpose: 'Media and publications about the beneficiary (Criterion 3).',
      whatThisEvaluates: 'Quality and independence of coverage.',
      evidenceToUpload: 'Articles, interviews, press clips, URLs/screenshots.',
      strongAnswerLooksLike: 'Outlet, title, date, URL, and why the outlet is credible or significant.',
    },
    {
      id: 's8_judging',
      label: '8. Judging the Work of Others',
      purpose: 'Judging and peer review activity (Criterion 4).',
      whatThisEvaluates: 'Recognition of expertise through judging invitations.',
      evidenceToUpload: 'Invitations, review assignments, confirmations.',
      strongAnswerLooksLike: 'Event/journal name, date, what was judged, and proof (invitation/confirmation).',
    },
    {
      id: 's9_original_contributions',
      label: '9. Original Contributions of Major Significance',
      purpose: 'Contributions with impact beyond immediate team (Criterion 5).',
      whatThisEvaluates: 'Originality, adoption, and major significance.',
      evidenceToUpload: 'Patents, product docs, adoption metrics, third-party proof.',
      strongAnswerLooksLike: 'Contribution, evidence of adoption/impact, and independent corroboration.',
      critical: true,
    },
    {
      id: 's10_scholarly',
      label: '10. Scholarly Articles / Authorship',
      purpose: 'Scholarly authorship (Criterion 6).',
      whatThisEvaluates: 'Publication quality, venue, and role.',
      evidenceToUpload: 'Papers, acceptance letters, citations.',
      strongAnswerLooksLike: 'Title, venue, date, role, and impact/citations if any.',
    },
    {
      id: 's11_leading_role',
      label: '11. Leading or Critical Role',
      purpose: 'Leading or critical role in distinguished organizations (Criterion 7).',
      whatThisEvaluates: 'Criticality of role and distinction of organization.',
      evidenceToUpload: 'Org charts, role letters, project briefs.',
      strongAnswerLooksLike: 'Organization, role, scope, impact, and proof of criticality.',
      critical: true,
    },
    {
      id: 's12_salary',
      label: '12. High Salary / Remuneration',
      purpose: 'High salary or remuneration (Criterion 8).',
      whatThisEvaluates: 'Compensation level and market comparison.',
      evidenceToUpload: 'Offer letters, pay stubs, W-2, benchmarks (anonymized).',
      strongAnswerLooksLike: 'Role, compensation, and benchmark context (e.g. percentiles).',
    },
    {
      id: 's13_commercial_success',
      label: '13. Commercial Success',
      purpose: 'Commercial success in performing arts if applicable (Criterion 9).',
      whatThisEvaluates: 'Relevance only for performing arts; otherwise N/A.',
      evidenceToUpload: 'Sales, box office, streaming, charts.',
      strongAnswerLooksLike: 'Metrics, time period, and source of data.',
    },
    {
      id: 's14_speaking',
      label: '14. Speaking, Conferences, Teaching, Invitations',
      purpose: 'Speaking and expert invitations.',
      whatThisEvaluates: 'Recognition via invited talks and teaching.',
      evidenceToUpload: 'Invitations, programs, bios, attendance stats.',
      strongAnswerLooksLike: 'Event, role, date, audience size/type, and selectivity.',
    },
    {
      id: 's15_media',
      label: '15. Media, Online Presence, Reputation',
      purpose: 'Media presence and reputation signals.',
      whatThisEvaluates: 'Public profile and independent recognition.',
      evidenceToUpload: 'Profiles, mentions, follower/engagement metrics.',
      strongAnswerLooksLike: 'Platform, reach, and why it matters for the case.',
    },
    {
      id: 's16_recommenders',
      label: '16. Reference Letters / Recommenders',
      purpose: 'Potential recommenders and letter strategy.',
      whatThisEvaluates: 'Coverage of criteria and independence of recommenders.',
      evidenceToUpload: 'List of potential signers and their credentials.',
      strongAnswerLooksLike: 'Name, org, relationship, which criteria they can address, independent vs. dependent.',
    },
    {
      id: 's17_us_intent',
      label: '17. Intent to Continue Work in the U.S.',
      purpose: 'Proposed U.S. endeavor and continuity of work.',
      whatThisEvaluates: 'Clarity and credibility of future U.S. plan.',
      evidenceToUpload: 'Offer letters, LOIs, project plans if any.',
      strongAnswerLooksLike: 'Concrete plan: what, where, with whom, and how it continues your field.',
    },
    {
      id: 's18_evidence_inventory',
      label: '18. Evidence Inventory',
      purpose: 'What evidence exists and what is missing.',
      whatThisEvaluates: 'Readiness and gaps for petition assembly.',
      evidenceToUpload: 'Existing exhibits list or folder structure.',
      strongAnswerLooksLike: 'Document or evidence item, what it supports, status (have/need/draft).',
      critical: true,
    },
    {
      id: 's19_weaknesses',
      label: '19. Weaknesses, Risks, Gaps',
      purpose: 'Known weaknesses and risks so they can be addressed.',
      whatThisEvaluates: 'Awareness and mitigation planning.',
      evidenceToUpload: 'RFE/NOID history or prior legal notes if any.',
      strongAnswerLooksLike: 'Specific gap or risk and one possible mitigation or alternative evidence.',
      critical: true,
    },
    {
      id: 's20_self_assessment',
      label: '20. Self-Assessment Against EB1A Criteria',
      purpose: 'Beneficiary’s view of strength per criterion.',
      whatThisEvaluates: 'Alignment with later strategy and evidence mapping.',
      evidenceToUpload: 'None required.',
      strongAnswerLooksLike: 'Per criterion: strong / possible / gap / N/A with brief reason.',
    },
    {
      id: 's21_final_strategy',
      label: '21. Final Strategy Questions',
      purpose: 'Open-ended strategy and positioning.',
      whatThisEvaluates: 'Case theme and narrative direction.',
      evidenceToUpload: 'None required.',
      strongAnswerLooksLike: 'Clear case theme, top 3–4 criteria to lead with, and one sentence positioning.',
      critical: true,
    },
  ];

  const intakeTemplate: DocumentTemplateContent = {
    whatItIs:
      'The Intake Questionnaire is a 21-section strategic intake that captures your identity, field, career, achievements, evidence across all ten EB1A criteria, recommenders, U.S. intent, evidence inventory, risks, and strategy. It is the primary input for case axis and criteria recommendation.',
    whyItMatters:
      'This is the strategic starting point of the entire EB1A case. Your answers drive case axis, strengths analysis, likely criteria, missing evidence roadmap, and prefill for every other Case Intake document. Completing it well reduces rework and improves consistency across the petition.',
    requiredSections: intakeSections.map((s) => s.label),
    strongExample:
      'Strong answers use concrete facts: full names, dates, organizations, numbers, links, and measurable outcomes. Avoid vague summaries. This questionnaire should feel like a structured first strategic consultation—detailed enough for an advisor to recommend case axis and next steps.',
    notes: [
      'Prepare: current resume/CV, list of awards and publications, any existing evidence list or prior RFE/NOID.',
      'Answer with dates, names, and metrics where possible; we use this to prefill Master Bio, CV, Employment History, Awards List, and Evidence Tracker.',
      'This document affects all later case-building steps; completeness here improves strategy and downstream drafts.',
    ],
  };

  const intakeQuestions: DocumentBuilderQuestion[] = [
    // 1. Basic Identity & Case Overview
    {
      id: 'legal_name',
      sectionId: 's1_basic_identity',
      label: 'Full legal name (as in passport)',
      type: 'short_text',
      required: true,
      placeholder: 'First, middle, last',
      helpText: 'Must match passport and official documents.',
      whyWeAskThis: 'Identity consistency across all petition materials.',
      evidenceHint: 'Passport biographic page.',
      answerPrompt: 'Use exact spelling and order from passport.',
    },
    {
      id: 'date_of_birth',
      sectionId: 's1_basic_identity',
      label: 'Date of birth',
      type: 'date',
      placeholder: 'YYYY-MM-DD',
      whyWeAskThis: 'Required for forms and consistency checks.',
      evidenceHint: 'Passport, birth certificate.',
      answerPrompt: 'Use official date format.',
    },
    {
      id: 'citizenship',
      sectionId: 's1_basic_identity',
      label: 'Citizenship / nationality',
      type: 'short_text',
      placeholder: 'e.g. India, China, Brazil',
      whyWeAskThis: 'Eligibility and visa history context.',
      answerPrompt: 'Country of citizenship.',
    },
    {
      id: 'current_status',
      sectionId: 's1_basic_identity',
      label: 'Current U.S. immigration status',
      type: 'short_text',
      placeholder: 'H-1B, O-1, F-1 OPT, L-1, B-1/B-2, outside U.S., etc.',
      helpText: 'Status at time of filing (or expected).',
      whyWeAskThis: 'Determines I-140 filing scenario and dependents.',
      evidenceHint: 'I-94, visa stamp, I-797.',
      answerPrompt: 'Status type and key dates (e.g. H-1B until 2026).',
    },
    {
      id: 'case_overview_summary',
      sectionId: 's1_basic_identity',
      label: 'Brief case overview (2–3 sentences)',
      type: 'long_text',
      placeholder: 'Who you are, your field, and why you are pursuing EB1A.',
      whyWeAskThis: 'High-level framing for the entire case.',
      answerPrompt: 'Include field, top achievement, and U.S. goal.',
    },
    // 2. Field Definition & Positioning
    {
      id: 'field_definition',
      sectionId: 's2_field_definition',
      label: 'How do you define your field of endeavor?',
      type: 'long_text',
      required: true,
      placeholder: 'e.g. Distributed systems for high-assurance financial infrastructure; not "tech" or "software."',
      helpText: 'Be specific: niche, subfield, and domain.',
      whyWeAskThis: 'EB1A requires a clear field; officers evaluate "top of field" within it.',
      evidenceHint: 'CV, bio, publications, or expert letters that use this language.',
      answerPrompt: 'Use 1–2 sentences. Names of methodologies, domains, or standards help.',
    },
    {
      id: 'field_positioning',
      sectionId: 's2_field_definition',
      label: 'How would you position yourself within that field?',
      type: 'long_text',
      placeholder: 'e.g. Recognized for X; known for Y; invited to Z.',
      whyWeAskThis: 'Supports "sustained acclaim" and "top of field" narrative.',
      answerPrompt: 'Concrete roles, recognitions, or invitations.',
    },
    // 3. Career Timeline
    {
      id: 'career_timeline_entries',
      sectionId: 's3_career_timeline',
      label: 'Career timeline (roles and dates)',
      type: 'repeatable',
      required: true,
      itemLabel: 'Role',
      whyWeAskThis: 'Consistency across forms, letters, and narrative; avoids timeline gaps.',
      evidenceHint: 'Resume, LinkedIn, employment letters.',
      answerPrompt: 'Organization, title, start and end (month/year), and 1–2 line impact.',
      fields: [
        { id: 'organization', label: 'Organization', type: 'short_text', required: true },
        { id: 'title', label: 'Title', type: 'short_text', required: true },
        { id: 'start_date', label: 'Start (month/year)', type: 'date', required: true },
        { id: 'end_date', label: 'End (month/year)', type: 'date' },
        { id: 'impact', label: 'Impact or key responsibility', type: 'long_text', required: true },
      ],
    },
    {
      id: 'career_timeline_notes',
      sectionId: 's3_career_timeline',
      label: 'Timeline notes (gaps, overlaps, consulting)',
      type: 'long_text',
      placeholder: 'Explain any gaps or overlapping roles.',
      whyWeAskThis: 'Proactive explanation reduces RFE risk.',
      answerPrompt: 'Brief, factual.',
    },
    // 4. Core Achievements Summary
    {
      id: 'signature_contributions',
      sectionId: 's4_core_achievements',
      label: 'Top 3–5 signature contributions or achievements',
      type: 'repeatable',
      required: true,
      itemLabel: 'Achievement',
      whyWeAskThis: 'Anchors the case narrative and maps to criteria.',
      evidenceHint: 'Awards, press, project docs, performance reviews.',
      answerPrompt: 'Title, date, organization, outcome, and measurable impact (numbers, scale, adoption).',
      fields: [
        { id: 'title', label: 'Achievement title', type: 'short_text', required: true },
        { id: 'date', label: 'Date or period', type: 'date' },
        { id: 'context', label: 'Context (org, role, project)', type: 'short_text', required: true },
        { id: 'impact', label: 'Impact and metrics', type: 'long_text', required: true },
        { id: 'evidence', label: 'Evidence you have or plan to get', type: 'long_text' },
      ],
    },
    // 5. Awards
    {
      id: 'awards_entries',
      sectionId: 's5_awards',
      label: 'Awards, honors, prizes',
      type: 'repeatable',
      itemLabel: 'Award',
      whyWeAskThis: 'Supports Criterion 1 (nationally/internationally recognized awards).',
      evidenceHint: 'Certificate, announcement, selection criteria, number of recipients.',
      answerPrompt: 'Name, issuer, date, selectivity (e.g. 5 of 200), and why it matters.',
      fields: [
        { id: 'name', label: 'Award name', type: 'short_text', required: true },
        { id: 'issuer', label: 'Issuing organization', type: 'short_text', required: true },
        { id: 'date', label: 'Date received', type: 'date' },
        { id: 'selectivity', label: 'Selectivity / competitiveness', type: 'long_text' },
        { id: 'evidence', label: 'Evidence you have', type: 'short_text' },
      ],
    },
    // 6. Memberships
    {
      id: 'memberships_entries',
      sectionId: 's6_memberships',
      label: 'Memberships (requiring outstanding achievement)',
      type: 'repeatable',
      itemLabel: 'Membership',
      whyWeAskThis: 'Supports Criterion 2 (membership in associations requiring outstanding achievement).',
      evidenceHint: 'Membership letter, bylaws, admission criteria.',
      answerPrompt: 'Organization, basis for admission, date, selectivity proof.',
      fields: [
        { id: 'organization', label: 'Organization', type: 'short_text', required: true },
        { id: 'basis', label: 'Basis for admission', type: 'long_text' },
        { id: 'date', label: 'Date joined', type: 'date' },
        { id: 'evidence', label: 'Evidence of selectivity', type: 'short_text' },
      ],
    },
    // 7. Published material about you
    {
      id: 'published_material_entries',
      sectionId: 's7_published_material',
      label: 'Published material about you (articles, interviews, profiles)',
      type: 'repeatable',
      itemLabel: 'Publication / mention',
      whyWeAskThis: 'Supports Criterion 3 (published material about the beneficiary).',
      evidenceHint: 'Article PDF, URL, screenshot, circulation/audience proof.',
      answerPrompt: 'Outlet, title, date, URL, and audience/reputation.',
      fields: [
        { id: 'outlet', label: 'Outlet / publication', type: 'short_text', required: true },
        { id: 'title', label: 'Title of piece', type: 'short_text', required: true },
        { id: 'date', label: 'Date', type: 'date' },
        { id: 'url_or_ref', label: 'URL or reference', type: 'short_text' },
        { id: 'notes', label: 'Audience / reputation notes', type: 'long_text' },
      ],
    },
    // 8. Judging
    {
      id: 'judging_entries',
      sectionId: 's8_judging',
      label: 'Judging / peer review activity',
      type: 'repeatable',
      itemLabel: 'Judging activity',
      whyWeAskThis: 'Supports Criterion 4 (judging the work of others).',
      evidenceHint: 'Invitation, assignment, confirmation letter.',
      answerPrompt: 'Event or journal, date, what you judged, and proof (invitation/confirmation).',
      fields: [
        { id: 'activity', label: 'Activity (e.g. panel judge, peer reviewer)', type: 'short_text', required: true },
        { id: 'organization', label: 'Organization / event / journal', type: 'short_text', required: true },
        { id: 'date', label: 'Date', type: 'date' },
        { id: 'what_judged', label: 'What you judged', type: 'long_text' },
        { id: 'evidence', label: 'Proof you have', type: 'short_text' },
      ],
    },
    // 9. Original contributions
    {
      id: 'original_contributions_entries',
      sectionId: 's9_original_contributions',
      label: 'Original contributions of major significance',
      type: 'repeatable',
      required: true,
      itemLabel: 'Contribution',
      whyWeAskThis: 'Supports Criterion 5; must show impact beyond your immediate team.',
      evidenceHint: 'Patents, product docs, adoption metrics, third-party corroboration.',
      answerPrompt: 'Contribution, evidence of adoption/scale, and independent proof.',
      fields: [
        { id: 'contribution', label: 'Contribution (innovation, system, method)', type: 'short_text', required: true },
        { id: 'adoption_impact', label: 'Adoption / impact', type: 'long_text', required: true },
        { id: 'evidence', label: 'Evidence (patent, deployment, third-party)', type: 'long_text' },
      ],
    },
    // 10. Scholarly articles
    {
      id: 'scholarly_entries',
      sectionId: 's10_scholarly',
      label: 'Scholarly articles / authorship',
      type: 'repeatable',
      itemLabel: 'Publication',
      whyWeAskThis: 'Supports Criterion 6 (scholarly authorship).',
      evidenceHint: 'Paper, acceptance letter, citations.',
      answerPrompt: 'Title, venue, date, role, citations if any.',
      fields: [
        { id: 'title', label: 'Title', type: 'short_text', required: true },
        { id: 'venue', label: 'Venue / journal / conference', type: 'short_text', required: true },
        { id: 'date', label: 'Date', type: 'date' },
        { id: 'role', label: 'Your role (first author, etc.)', type: 'short_text' },
        { id: 'citations', label: 'Citations or impact', type: 'short_text' },
      ],
    },
    // 11. Leading/critical role
    {
      id: 'leading_role_entries',
      sectionId: 's11_leading_role',
      label: 'Leading or critical roles in distinguished organizations',
      type: 'repeatable',
      required: true,
      itemLabel: 'Role',
      whyWeAskThis: 'Supports Criterion 7 (leading or critical role).',
      evidenceHint: 'Org chart, role letter, project scope, org reputation.',
      answerPrompt: 'Organization, your role, why critical, and proof of distinction of org.',
      fields: [
        { id: 'organization', label: 'Organization', type: 'short_text', required: true },
        { id: 'role', label: 'Your role / title', type: 'short_text', required: true },
        { id: 'criticality', label: 'Why role was critical', type: 'long_text', required: true },
        { id: 'evidence', label: 'Evidence (letter, org chart, project)', type: 'long_text' },
      ],
    },
    // 12. High salary
    {
      id: 'salary_summary',
      sectionId: 's12_salary',
      label: 'High salary / remuneration (if claiming Criterion 8)',
      type: 'long_text',
      placeholder: 'Current or recent compensation, benchmark context (e.g. percentile).',
      whyWeAskThis: 'Supports Criterion 8; only if you plan to claim it.',
      evidenceHint: 'Offer letter, pay stubs, W-2, market data (anonymized).',
      answerPrompt: 'Numbers and benchmark (e.g. top 10% for role/region).',
    },
    // 13. Commercial success
    {
      id: 'commercial_success',
      sectionId: 's13_commercial_success',
      label: 'Commercial success (performing arts only; otherwise leave blank)',
      type: 'long_text',
      placeholder: 'Sales, box office, streaming, charts—if applicable.',
      whyWeAskThis: 'Criterion 9 applies only to performing arts.',
      answerPrompt: 'Metrics and time period.',
    },
    // 14. Speaking / conferences
    {
      id: 'speaking_entries',
      sectionId: 's14_speaking',
      label: 'Speaking, conferences, teaching, invitations',
      type: 'repeatable',
      itemLabel: 'Speaking engagement',
      whyWeAskThis: 'Shows recognition via invited talks and teaching.',
      evidenceHint: 'Invitation, program, bio, attendance.',
      answerPrompt: 'Event, role, date, audience size/type, selectivity.',
      fields: [
        { id: 'event', label: 'Event or venue', type: 'short_text', required: true },
        { id: 'role', label: 'Your role (keynote, panelist, instructor)', type: 'short_text', required: true },
        { id: 'date', label: 'Date', type: 'date' },
        { id: 'audience', label: 'Audience / selectivity', type: 'long_text' },
      ],
    },
    // 15. Media / reputation
    {
      id: 'media_entries',
      sectionId: 's15_media',
      label: 'Media, online presence, reputation',
      type: 'repeatable',
      itemLabel: 'Mention or profile',
      whyWeAskThis: 'Independent recognition and public profile.',
      evidenceHint: 'Profile URL, mention, follower/engagement metrics.',
      answerPrompt: 'Platform, reach, and relevance to field.',
      fields: [
        { id: 'platform', label: 'Platform or outlet', type: 'short_text', required: true },
        { id: 'description', label: 'Description (profile, mention, interview)', type: 'long_text' },
        { id: 'reach', label: 'Reach or metrics', type: 'short_text' },
      ],
    },
    // 16. Recommenders
    {
      id: 'recommenders_entries',
      sectionId: 's16_recommenders',
      label: 'Potential recommenders',
      type: 'repeatable',
      itemLabel: 'Recommender',
      whyWeAskThis: 'Letter coverage and independence balance.',
      evidenceHint: 'CV or bio of signer.',
      answerPrompt: 'Name, org, relationship, which criteria they can address, independent vs. dependent.',
      fields: [
        { id: 'name', label: 'Name', type: 'short_text', required: true },
        { id: 'organization', label: 'Organization / title', type: 'short_text', required: true },
        { id: 'relationship', label: 'Relationship to you', type: 'short_text' },
        { id: 'criteria', label: 'Criteria they can address', type: 'long_text' },
        { id: 'independent', label: 'Independent or dependent?', type: 'short_text' },
      ],
    },
    // 17. U.S. intent
    {
      id: 'us_endeavor',
      sectionId: 's17_us_intent',
      label: 'Intent to continue your work in the U.S.',
      type: 'long_text',
      required: true,
      placeholder: 'What work you will continue or expand in the U.S.; with whom, where, how.',
      whyWeAskThis: 'Required for EB1A; must be concrete and credible.',
      evidenceHint: 'Offer letter, LOI, project plan.',
      answerPrompt: 'Specific plan: role, organization, type of work, continuity with past expertise.',
    },
    // 18. Evidence inventory
    {
      id: 'evidence_inventory_entries',
      sectionId: 's18_evidence_inventory',
      label: 'Evidence inventory (what you have vs. need)',
      type: 'repeatable',
      required: true,
      itemLabel: 'Evidence item',
      whyWeAskThis: 'Tracks readiness and gaps for petition assembly.',
      evidenceHint: 'Existing exhibits or folder list.',
      answerPrompt: 'Document/item, what it supports, status (have / need / draft).',
      fields: [
        { id: 'item', label: 'Document or evidence item', type: 'short_text', required: true },
        { id: 'supports', label: 'What it supports (criterion/section)', type: 'short_text' },
        { id: 'status', label: 'Status (have / need / draft)', type: 'short_text', required: true },
      ],
    },
    // 19. Weaknesses / risks
    {
      id: 'weaknesses_risks',
      sectionId: 's19_weaknesses',
      label: 'Known weaknesses, risks, or gaps',
      type: 'long_text',
      required: true,
      placeholder: 'What could hurt the case; what evidence is missing; how you might address it.',
      whyWeAskThis: 'Enables mitigation and alternative evidence planning.',
      answerPrompt: 'Be specific; suggest one mitigation or alternative per gap if possible.',
    },
    // 20. Self-assessment
    {
      id: 'criteria_self_assessment',
      sectionId: 's20_self_assessment',
      label: 'Self-assessment against the 10 EB1A criteria',
      type: 'long_text',
      placeholder: 'For each criterion: strong / possible / gap / N/A with brief reason.',
      whyWeAskThis: 'Aligns with strategy and evidence mapping.',
      answerPrompt: 'C1–C10: one line each with your assessment.',
    },
    {
      id: 'criteria_signals',
      sectionId: 's20_self_assessment',
      label: 'Which evidence areas do you already have?',
      type: 'multi_select',
      options: [
        'Awards (C1)',
        'Memberships (C2)',
        'Published material about you (C3)',
        'Judging (C4)',
        'Original contributions (C5)',
        'Scholarly articles (C6)',
        'Leading/critical role (C7)',
        'High salary (C8)',
        'Commercial success (C9)',
        'Speaking / conferences',
        'Patents / products / projects',
      ],
    },
    // 21. Final strategy
    {
      id: 'final_strategy_theme',
      sectionId: 's21_final_strategy',
      label: 'Case theme / positioning (one sentence)',
      type: 'long_text',
      required: true,
      placeholder: 'e.g. Recognized leader in X who has done Y and will continue Z in the U.S.',
      whyWeAskThis: 'Drives narrative and exhibit organization.',
      answerPrompt: 'Clear, memorable theme tying field, achievement, and U.S. plan.',
    },
    {
      id: 'final_strategy_criteria_lead',
      sectionId: 's21_final_strategy',
      label: 'Top 3–4 criteria you plan to lead with',
      type: 'long_text',
      placeholder: 'e.g. C5, C7, C1, C3—with brief reason.',
      whyWeAskThis: 'Prioritizes evidence and letter coverage.',
      answerPrompt: 'Criterion numbers and one-line rationale.',
    },
    {
      id: 'known_gaps',
      sectionId: 's19_weaknesses',
      label: 'Additional known gaps (if not covered above)',
      type: 'long_text',
      placeholder: 'Anything else missing or weak.',
    },
  ];

  const intakeOutputSections: DocumentOutputSection[] = [
    { id: 'profile', label: 'Beneficiary profile' },
    { id: 'field', label: 'Field definition and positioning' },
    { id: 'career', label: 'Career timeline' },
    { id: 'achievements', label: 'Core achievements' },
    { id: 'criteria_signals', label: 'Evidence by criterion' },
    { id: 'us_intent', label: 'U.S. endeavor' },
    { id: 'evidence_inventory', label: 'Evidence inventory' },
    { id: 'gaps', label: 'Known gaps and next steps' },
    { id: 'strategy', label: 'Strategy inputs' },
  ];

  return {
    slotType: 'intake_questionnaire',
    assistantMode: 'create',
    sectionId: 's1',
    category: 'Case Intake & Profile',
    label: 'Intake Questionnaire (completed PDF/Doc)',
    shortLabel: 'Intake Questionnaire',
    description: 'Strategic 21-section intake for case axis, criteria recommendation, and downstream prefill.',
    purpose: intakeTemplate.whatItIs,
    usageInCase: intakeTemplate.whyItMatters,
    completionOutcome:
      'A completed Intake Questionnaire document, an Intake Strategy Summary (case axis, likely criteria, gaps, risks), and a reusable dataset for Master Bio, CV, and other Case Intake documents.',
    actions: ['add', 'create', 'template'],
    acceptedMimeTypes: [...DOC_FILE_TYPES],
    inputModes: ['manual', 'source_upload'],
    prefillFromSlots: undefined,
    strategyImpact: true,
    template: intakeTemplate,
    questions: intakeQuestions,
    outputSections: intakeOutputSections,
    priority: 'priority',
    intakeSections,
    criticalSectionIds: INTAKE_CRITICAL_SECTION_IDS,
  };
}

function buildStandardConfig(
  slotType: string,
  label: string,
  shortLabel: string,
  description: string,
  template: DocumentTemplateContent,
  questions: DocumentBuilderQuestion[],
  outputSections: DocumentOutputSection[],
  overrides: Partial<
    Pick<
      DocumentBuilderSlotConfig,
      'prefillFromSlots' | 'sharedAnswerKeys' | 'strategyImpact' | 'priority' | 'inputModes' | 'sectionId' | 'category'
    >
  > = {}
): DocumentBuilderSlotConfig {
  return {
    slotType,
    assistantMode: 'create',
    sectionId: overrides.sectionId ?? 's1',
    category: overrides.category ?? 'Case Intake & Profile',
    label,
    shortLabel,
    description,
    purpose: template.whatItIs,
    usageInCase: template.whyItMatters,
    completionOutcome: `A structured ${shortLabel} draft saved in the app and available for download later.`,
    actions: ['add', 'create', 'template'],
    acceptedMimeTypes: [...DOC_FILE_TYPES],
    inputModes: overrides.inputModes ?? ['manual', 'source_upload', 'voice_transcript'],
    prefillFromSlots: overrides.prefillFromSlots,
    sharedAnswerKeys: overrides.sharedAnswerKeys,
    strategyImpact: overrides.strategyImpact,
    template,
    questions,
    outputSections,
    priority: overrides.priority ?? 'standard',
  };
}

function buildFormFillConfig(
  slotType: string,
  shortLabel: string,
  description: string,
  templateUrl: string,
  questions: DocumentBuilderQuestion[],
  questionGroups: NonNullable<DocumentBuilderSlotConfig['questionGroups']>
): DocumentBuilderSlotConfig {
  return {
    slotType,
    assistantMode: 'fill',
    sectionId: 's2',
    category: 'Forms & Fees',
    label: shortLabel,
    shortLabel,
    description,
    purpose: `Guided interview for ${shortLabel}.`,
    usageInCase: `Use Document Assistant to answer the key gaps for ${shortLabel}, then transfer the saved answers into the official USCIS form.`,
    completionOutcome: `Saved step-by-step answers for ${shortLabel}, ready for manual entry into the official USCIS PDF.`,
    actions: ['add', 'create', 'template'],
    acceptedMimeTypes: [...DOC_FILE_TYPES],
    inputModes: ['manual'],
    templateUrl,
    template: {
      whatItIs: `${shortLabel} is an official USCIS filing form used in the petition package.`,
      whyItMatters: 'This guided flow helps you collect the right answers before completing the official PDF.',
      requiredSections: questionGroups.map((group) => group.title),
      strongExample: 'A strong draft uses the exact legal names, case details, and filing choices that match the supporting documents in the case file.',
      notes: [
        'This MVP saves structured answers only. It does not auto-fill or export the USCIS PDF yet.',
        'Use the Template button to open the official USCIS PDF in a separate tab.',
      ],
    },
    questions,
    questionGroups,
    outputSections: questionGroups.map((group) => ({ id: group.id, label: group.title })),
    priority: 'priority',
  };
}

export const CASE_INTAKE_DOCUMENT_BUILDERS: DocumentBuilderSlotConfig[] = [
  getIntakeQuestionnaireConfig(),
  buildStandardConfig(
    'beneficiary_master_bio',
    'Beneficiary Master Bio (1–2 pages)',
    'Master Bio',
    'A concise narrative bio highlighting trajectory, expertise, impact, and positioning.',
    {
      whatItIs:
        'A polished 1–2 page professional biography that summarizes the beneficiary’s background, expertise, major contributions, and current role.',
      whyItMatters:
        'It provides a reusable narrative anchor for letters, media materials, and the cover letter while keeping the case positioning consistent.',
      requiredSections: [
        'Current role and specialization',
        'Career trajectory',
        'Signature contributions',
        'Independent recognition / impact',
        'Forward-looking U.S. endeavor',
      ],
      strongExample:
        'A strong bio is specific, metric-backed, and written in a professional narrative voice. It does not read like a job description or a generic self-summary.',
      notes: ['Use facts and measurable impact wherever possible.'],
    },
    [
      {
        id: 'headline',
        label: 'Professional headline',
        type: 'short_text',
        required: true,
        placeholder: 'AI infrastructure leader focused on scalable security systems',
      },
      {
        id: 'career_arc',
        label: 'Career arc',
        type: 'long_text',
        required: true,
        placeholder: 'Summarize your career evolution and major roles.',
      },
      {
        id: 'key_contributions',
        label: 'Key contributions',
        type: 'repeatable',
        itemLabel: 'Contribution',
        fields: [
          { id: 'title', label: 'Contribution title', type: 'short_text', required: true },
          { id: 'context', label: 'Context', type: 'long_text' },
          { id: 'impact', label: 'Impact', type: 'long_text', required: true },
        ],
      },
      {
        id: 'recognition',
        label: 'Recognition and credibility signals',
        type: 'long_text',
        placeholder: 'Awards, press, judging, publications, leadership, speaking, etc.',
      },
      {
        id: 'future_focus',
        label: 'Future focus in the U.S.',
        type: 'long_text',
        placeholder: 'What future work should the bio point toward?',
      },
    ],
    [
      { id: 'overview', label: 'Professional overview' },
      { id: 'trajectory', label: 'Career trajectory' },
      { id: 'impact', label: 'Signature impact' },
      { id: 'future', label: 'Future focus' },
    ],
    {
      priority: 'priority',
      prefillFromSlots: ['intake_questionnaire'],
      sharedAnswerKeys: [
        'legal_name',
        'field_definition',
        'field_positioning',
        'signature_contributions',
        'criteria_signals',
        'us_endeavor',
      ],
    }
  ),
  buildStandardConfig(
    'master_cv_resume',
    'Master CV / Resume (latest version)',
    'Master CV / Resume',
    'A complete editable CV/resume that can support case drafting and later petition assembly.',
    {
      whatItIs:
        'A current, comprehensive CV or resume covering roles, education, publications, talks, awards, and notable projects.',
      whyItMatters:
        'It is a core source document used across the petition package and can prefill many later documents and forms.',
      requiredSections: [
        'Contact and headline',
        'Professional experience',
        'Education',
        'Key projects and impact',
        'Awards / publications / speaking / memberships as applicable',
      ],
      strongExample:
        'A strong CV is complete, current, and impact-oriented. It includes dates, organizations, titles, and high-value accomplishments without leaving chronology gaps.',
      notes: ['This builder should favor editable structured output over formatting-heavy final design.'],
    },
    [
      {
        id: 'current_headline',
        label: 'Current title / professional headline',
        type: 'short_text',
        required: true,
      },
      {
        id: 'experience_entries',
        label: 'Professional experience',
        type: 'repeatable',
        required: true,
        itemLabel: 'Role',
        fields: [
          { id: 'organization', label: 'Organization', type: 'short_text', required: true },
          { id: 'title', label: 'Title', type: 'short_text', required: true },
          { id: 'startDate', label: 'Start date', type: 'date' },
          { id: 'endDate', label: 'End date', type: 'date' },
          { id: 'highlights', label: 'Highlights', type: 'long_text', required: true },
        ],
      },
      {
        id: 'education_entries',
        label: 'Education',
        type: 'repeatable',
        itemLabel: 'Education item',
        fields: [
          { id: 'institution', label: 'Institution', type: 'short_text', required: true },
          { id: 'degree', label: 'Degree', type: 'short_text' },
          { id: 'date', label: 'Completion date', type: 'date' },
        ],
      },
      {
        id: 'supporting_materials',
        label: 'Optional source files',
        type: 'file_upload',
        helpText: 'Upload an older resume, LinkedIn export, or notes to help prefill.',
      },
    ],
    [
      { id: 'summary', label: 'Summary' },
      { id: 'experience', label: 'Experience' },
      { id: 'education', label: 'Education' },
      { id: 'selectedAchievements', label: 'Selected achievements' },
    ],
    {
      priority: 'priority',
      prefillFromSlots: ['intake_questionnaire', 'beneficiary_master_bio'],
      sharedAnswerKeys: [
        'legal_name',
        'field_definition',
        'field_positioning',
        'career_timeline_entries',
        'career_timeline_notes',
        'signature_contributions',
        'scholarly_entries',
        'awards_entries',
        'speaking_entries',
      ],
    }
  ),
  buildStandardConfig(
    'employment_history_sheet',
    'Employment History Sheet',
    'Employment History',
    'A structured chronology of roles, employers, dates, and responsibilities.',
    {
      whatItIs:
        'A detailed employment chronology that captures all relevant roles, dates, employers, and impact highlights.',
      whyItMatters:
        'It supports consistency across forms, letters, and the petition narrative while reducing timeline gaps or title mismatches.',
      requiredSections: [
        'Employer / organization',
        'Role / title',
        'Dates',
        'Location',
        'Responsibilities and impact highlights',
      ],
      strongExample:
        'A strong employment sheet is cleanly chronological, free of date gaps, and aligned with the CV, LinkedIn, and employer letters.',
      notes: ['Use exact month/year where available.'],
    },
    [
      {
        id: 'employment_entries',
        label: 'Employment history',
        type: 'repeatable',
        required: true,
        itemLabel: 'Employment entry',
        fields: [
          { id: 'organization', label: 'Employer', type: 'short_text', required: true },
          { id: 'title', label: 'Title', type: 'short_text', required: true },
          { id: 'startDate', label: 'Start date', type: 'date', required: true },
          { id: 'endDate', label: 'End date', type: 'date' },
          { id: 'summary', label: 'Responsibilities / impact', type: 'long_text' },
        ],
      },
      {
        id: 'timeline_notes',
        label: 'Timeline notes',
        type: 'long_text',
        placeholder: 'Explain any gaps, consulting overlaps, or title changes.',
      },
    ],
    [
      { id: 'chronology', label: 'Employment chronology' },
      { id: 'highlights', label: 'Role highlights' },
      { id: 'notes', label: 'Gap / overlap notes' },
    ],
    {
      priority: 'priority',
      prefillFromSlots: ['master_cv_resume', 'intake_questionnaire'],
      sharedAnswerKeys: ['career_timeline_entries', 'career_timeline_notes', 'signature_contributions'],
    }
  ),
  buildStandardConfig(
    'education_history_sheet',
    'Education History Sheet',
    'Education History',
    'A detailed education chronology covering institutions, degrees, dates, and honors.',
    {
      whatItIs:
        'A structured education history sheet that records institutions, degrees, programs, and notable distinctions.',
      whyItMatters:
        'It keeps forms, resumes, and support letters aligned and is often needed for petition package completeness.',
      requiredSections: ['Institution', 'Program / degree', 'Dates', 'Location', 'Honors / notes'],
      strongExample:
        'A strong education sheet is complete, date-aligned, and explains incomplete programs or overlapping study/work periods clearly.',
      notes: ['Include certifications or specialized training if strategically relevant.'],
    },
    [
      {
        id: 'education_entries',
        label: 'Education history',
        type: 'repeatable',
        required: true,
        itemLabel: 'Education entry',
        fields: [
          { id: 'institution', label: 'Institution', type: 'short_text', required: true },
          { id: 'program', label: 'Degree / program', type: 'short_text', required: true },
          { id: 'startDate', label: 'Start date', type: 'date' },
          { id: 'endDate', label: 'End date', type: 'date' },
          { id: 'notes', label: 'Honors / notes', type: 'long_text' },
        ],
      },
    ],
    [
      { id: 'chronology', label: 'Education chronology' },
      { id: 'distinctions', label: 'Honors / distinctions' },
    ],
    { prefillFromSlots: ['master_cv_resume'] }
  ),
  buildStandardConfig(
    'awards_honors_list',
    'Awards & Honors List',
    'Awards & Honors',
    'A structured list of prizes, honors, recognitions, and selection context.',
    {
      whatItIs:
        'A curated awards and honors tracker capturing award name, issuer, date, competitiveness, and why the recognition matters.',
      whyItMatters:
        'It helps evaluate the awards criterion, build narratives, and quickly identify which recognitions are worth documenting in the petition.',
      requiredSections: [
        'Award / honor name',
        'Issuing body',
        'Date',
        'Competitiveness / selectivity',
        'Why it matters',
      ],
      strongExample:
        'A strong list prioritizes independent, selective, and field-recognized honors, including evidence notes about criteria, recipients, and issuer reputation.',
      notes: ['Include internal recognitions only if they are truly significant and well-documented.'],
    },
    [
      {
        id: 'award_entries',
        label: 'Awards and honors',
        type: 'repeatable',
        required: true,
        itemLabel: 'Award',
        fields: [
          { id: 'name', label: 'Award name', type: 'short_text', required: true },
          { id: 'issuer', label: 'Issuer', type: 'short_text', required: true },
          { id: 'date', label: 'Date', type: 'date' },
          { id: 'selectivity', label: 'Selectivity / context', type: 'long_text' },
          { id: 'impact', label: 'Why it matters', type: 'long_text' },
        ],
      },
    ],
    [
      { id: 'catalog', label: 'Awards catalog' },
      { id: 'strengthNotes', label: 'Strength notes' },
      { id: 'evidenceNeeds', label: 'Evidence needs' },
    ],
    {
      priority: 'priority',
      prefillFromSlots: ['intake_questionnaire', 'master_cv_resume'],
      sharedAnswerKeys: ['awards_entries', 'criteria_signals', 'criteria_self_assessment', 'signature_contributions'],
    }
  ),
  buildStandardConfig(
    'publications_list',
    'Publications List',
    'Publications',
    'A publications tracker for scholarly and professional authorship.',
    {
      whatItIs:
        'A list of authored works with venue, date, role, and impact notes.',
      whyItMatters:
        'It supports the authorship criterion and helps distinguish scholarly publications from other authored materials.',
      requiredSections: ['Title', 'Venue', 'Date', 'Role / author order', 'Notes / impact'],
      strongExample:
        'A strong list clearly separates peer-reviewed, invited, and other publication types and preserves citations or venue credibility notes.',
      notes: ['Flag citations, indexing, and notable readership where available.'],
    },
    [
      {
        id: 'publication_entries',
        label: 'Publications',
        type: 'repeatable',
        itemLabel: 'Publication',
        fields: [
          { id: 'title', label: 'Title', type: 'short_text', required: true },
          { id: 'venue', label: 'Venue', type: 'short_text', required: true },
          { id: 'date', label: 'Date', type: 'date' },
          { id: 'notes', label: 'Notes / impact', type: 'long_text' },
        ],
      },
    ],
    [{ id: 'catalog', label: 'Publication catalog' }]
  ),
  buildStandardConfig(
    'media_press_mentions_list',
    'Media / Press Mentions List',
    'Media / Press Mentions',
    'A list of articles, interviews, and media coverage about the beneficiary.',
    {
      whatItIs:
        'A press tracker covering articles, interviews, profiles, and mentions about the beneficiary in qualifying outlets.',
      whyItMatters:
        'It supports the published material criterion and helps prioritize coverage that best demonstrates recognition in the field.',
      requiredSections: ['Outlet', 'Article / mention title', 'Date', 'URL / source', 'Audience / reputation notes'],
      strongExample:
        'A strong list emphasizes independent media, keeps preservation links/screenshots, and notes why the outlet is credible or significant.',
      notes: ['Focus on material about the beneficiary, not by the beneficiary.'],
    },
    [
      {
        id: 'media_entries',
        label: 'Media mentions',
        type: 'repeatable',
        itemLabel: 'Media mention',
        fields: [
          { id: 'outlet', label: 'Outlet', type: 'short_text', required: true },
          { id: 'title', label: 'Title', type: 'short_text', required: true },
          { id: 'date', label: 'Date', type: 'date' },
          { id: 'notes', label: 'Audience / reputation notes', type: 'long_text' },
        ],
      },
    ],
    [{ id: 'catalog', label: 'Media catalog' }]
  ),
  buildStandardConfig(
    'speaking_conferences_list',
    'Speaking / Conferences List',
    'Speaking / Conferences',
    'A list of talks, panels, presentations, and conference participation.',
    {
      whatItIs:
        'A speaking and conference appearances list with event, role, date, audience, and topic.',
      whyItMatters:
        'It helps show visibility, expertise recognition, and industry standing, and can support multiple evidence narratives.',
      requiredSections: ['Event', 'Role', 'Date', 'Topic', 'Audience / significance notes'],
      strongExample:
        'A strong list clarifies whether the event was selective, high-profile, or expert-facing and captures attendance or credibility details.',
      notes: ['Separate invited talks from general attendance.'],
    },
    [
      {
        id: 'speaking_entries',
        label: 'Speaking / conferences',
        type: 'repeatable',
        itemLabel: 'Speaking item',
        fields: [
          { id: 'event', label: 'Event', type: 'short_text', required: true },
          { id: 'role', label: 'Role', type: 'short_text', required: true },
          { id: 'date', label: 'Date', type: 'date' },
          { id: 'notes', label: 'Audience / significance', type: 'long_text' },
        ],
      },
    ],
    [{ id: 'catalog', label: 'Speaking catalog' }]
  ),
  buildStandardConfig(
    'memberships_list',
    'Memberships List',
    'Memberships',
    'A membership tracker focused on selective associations and qualification criteria.',
    {
      whatItIs:
        'A list of memberships, associations, committees, and professional affiliations with notes about admission requirements and selectivity.',
      whyItMatters:
        'It helps quickly identify which memberships may support the associations criterion and which are merely background context.',
      requiredSections: ['Association', 'Membership type', 'Admission basis', 'Date', 'Selectivity notes'],
      strongExample:
        'A strong list distinguishes selective memberships from ordinary paid memberships and records proof of criteria or peer-reviewed admission.',
      notes: ['If a membership is not selective, record it but do not overstate it.'],
    },
    [
      {
        id: 'membership_entries',
        label: 'Memberships',
        type: 'repeatable',
        itemLabel: 'Membership',
        fields: [
          { id: 'association', label: 'Association', type: 'short_text', required: true },
          { id: 'membershipType', label: 'Membership type', type: 'short_text' },
          { id: 'date', label: 'Date', type: 'date' },
          { id: 'notes', label: 'Selectivity notes', type: 'long_text' },
        ],
      },
    ],
    [{ id: 'catalog', label: 'Membership catalog' }]
  ),
  buildStandardConfig(
    'judging_peer_review_list',
    'Judging / Peer Review Activity List',
    'Judging / Peer Review',
    'A tracker for judging, reviewing, and evaluation activities.',
    {
      whatItIs:
        'A list of formal judging, peer review, review board, and evaluator activities.',
      whyItMatters:
        'It supports the judging criterion and also helps identify missing supporting proof such as invitations or confirmations.',
      requiredSections: ['Activity', 'Organization / event', 'Date', 'What was judged', 'Proof available'],
      strongExample:
        'A strong list captures invitations, review assignments, proof of participation, and the authority of the journal, event, or platform.',
      notes: ['Document both the invitation and the actual performance when possible.'],
    },
    [
      {
        id: 'judging_entries',
        label: 'Judging activities',
        type: 'repeatable',
        itemLabel: 'Judging activity',
        fields: [
          { id: 'activity', label: 'Activity', type: 'short_text', required: true },
          { id: 'organization', label: 'Organization / event', type: 'short_text' },
          { id: 'date', label: 'Date', type: 'date' },
          { id: 'notes', label: 'Proof / notes', type: 'long_text' },
        ],
      },
    ],
    [{ id: 'catalog', label: 'Judging catalog' }]
  ),
  buildStandardConfig(
    'patents_products_projects_list',
    'Patents / Products / Projects List (if applicable)',
    'Patents / Products / Projects',
    'A tracker for inventions, products, systems, and major projects tied to impact claims.',
    {
      whatItIs:
        'A list of patents, products, systems, and major projects that may support contributions, critical role, or commercial impact narratives.',
      whyItMatters:
        'It helps connect innovation claims to real-world outputs, adoption, and measurable significance.',
      requiredSections: ['Project / patent', 'Role', 'Date / timeline', 'Impact', 'Proof / attachments'],
      strongExample:
        'A strong list ties each item to adoption, scale, or influence and identifies third-party or internal proof that can substantiate significance.',
      notes: ['Not every project belongs in the final petition; use this tracker to triage.'],
    },
    [
      {
        id: 'project_entries',
        label: 'Patents / products / projects',
        type: 'repeatable',
        itemLabel: 'Project',
        fields: [
          { id: 'name', label: 'Project / patent', type: 'short_text', required: true },
          { id: 'role', label: 'Role', type: 'short_text' },
          { id: 'date', label: 'Date / timeline', type: 'date' },
          { id: 'impact', label: 'Impact', type: 'long_text' },
        ],
      },
    ],
    [{ id: 'catalog', label: 'Project catalog' }]
  ),
  buildStandardConfig(
    'reference_contacts_list',
    'Reference Contacts List (recommenders + organizations)',
    'Reference Contacts',
    'A structured list of recommenders, collaborators, and organizations relevant to letters and corroboration.',
    {
      whatItIs:
        'A contacts sheet for recommenders, collaborators, institutions, and organizations that may provide letters or corroboration.',
      whyItMatters:
        'It helps organize recommendation letter outreach, corroboration planning, and institutional context.',
      requiredSections: ['Name', 'Organization', 'Role / relationship', 'Email / contact', 'Why this contact matters'],
      strongExample:
        'A strong contacts list distinguishes independent and dependent recommenders and tracks what each contact can credibly support.',
      notes: ['Do not include private information you do not intend to use.'],
    },
    [
      {
        id: 'contact_entries',
        label: 'Reference contacts',
        type: 'repeatable',
        itemLabel: 'Contact',
        fields: [
          { id: 'name', label: 'Name', type: 'short_text', required: true },
          { id: 'organization', label: 'Organization', type: 'short_text' },
          { id: 'relationship', label: 'Role / relationship', type: 'short_text' },
          { id: 'contact', label: 'Email / contact', type: 'short_text' },
          { id: 'notes', label: 'Why this contact matters', type: 'long_text' },
        ],
      },
    ],
    [{ id: 'catalog', label: 'Reference contact catalog' }]
  ),
  buildStandardConfig(
    'case_notes_gaps_log',
    'Case Notes & Gaps Log',
    'Case Notes & Gaps Log',
    'A working log of open questions, weaknesses, blockers, and follow-up actions.',
    {
      whatItIs:
        'A case-working log for recording missing evidence, risks, open questions, and action items.',
      whyItMatters:
        'It keeps the case organized over time and helps maintain continuity across multiple drafting sessions.',
      requiredSections: ['Issue / gap', 'Why it matters', 'Priority', 'Owner / next step', 'Status'],
      strongExample:
        'A strong gaps log is concise, actionable, and updated as the case evolves rather than treated as static notes.',
      notes: ['This is an internal working document and can stay practical and direct.'],
    },
    [
      {
        id: 'gap_entries',
        label: 'Case notes and gaps',
        type: 'repeatable',
        itemLabel: 'Gap item',
        fields: [
          { id: 'issue', label: 'Issue / gap', type: 'short_text', required: true },
          { id: 'why', label: 'Why it matters', type: 'long_text' },
          { id: 'nextStep', label: 'Next step', type: 'long_text' },
          { id: 'status', label: 'Status', type: 'short_text' },
        ],
      },
    ],
    [{ id: 'log', label: 'Gap log' }]
  ),
  buildStandardConfig(
    'document_inventory_evidence_tracker',
    'Document Inventory / Evidence Tracker',
    'Evidence Tracker',
    'A working inventory linking evidence, location, criterion relevance, and follow-up needs.',
    {
      whatItIs:
        'A case inventory that tracks each known document or evidence item, where it lives, what it supports, and whether it still needs cleanup.',
      whyItMatters:
        'It is essential for organizing the petition package, identifying missing proof, and keeping evidence reusable across criteria and future drafts.',
      requiredSections: [
        'Document / evidence item',
        'Category or criterion relevance',
        'Current location / source',
        'Status / quality',
        'Follow-up needed',
      ],
      strongExample:
        'A strong tracker makes it obvious what evidence exists, what is missing, what is draft-only, and what still needs corroboration or formatting.',
      notes: ['Use this as the operational inventory for case assembly.'],
    },
    [
      {
        id: 'inventory_entries',
        label: 'Evidence tracker items',
        type: 'repeatable',
        required: true,
        itemLabel: 'Evidence item',
        fields: [
          { id: 'name', label: 'Document / evidence item', type: 'short_text', required: true },
          { id: 'supports', label: 'What it supports', type: 'short_text' },
          { id: 'location', label: 'Current location / source', type: 'short_text' },
          { id: 'status', label: 'Status / quality', type: 'short_text' },
          { id: 'nextStep', label: 'Follow-up needed', type: 'long_text' },
        ],
      },
      {
        id: 'inventory_notes',
        label: 'Inventory notes',
        type: 'long_text',
        placeholder: 'Any global notes about evidence organization or gaps',
      },
    ],
    [
      { id: 'inventory', label: 'Inventory' },
      { id: 'gaps', label: 'Missing evidence' },
      { id: 'nextActions', label: 'Next actions' },
    ],
    {
      priority: 'priority',
      prefillFromSlots: ['intake_questionnaire', 'case_notes_gaps_log'],
      sharedAnswerKeys: ['evidence_inventory_entries', 'known_gaps', 'weaknesses_risks', 'criteria_signals'],
    }
  ),
];

export const FORMS_FEES_DOCUMENT_BUILDERS: DocumentBuilderSlotConfig[] = [
  buildFormFillConfig(
    'form_i140_final',
    'Form I-140 (Final Signed)',
    'Guided answers for the final signed I-140 before someone completes the official USCIS PDF.',
    'https://www.uscis.gov/sites/default/files/document/forms/i-140.pdf',
    [
      {
        id: 'petitioner_name',
        label: 'Petitioner legal name',
        type: 'short_text',
        required: true,
        placeholder: 'Legal name of employer or self-petitioner',
        helpText: 'Use the exact legal name that should appear on the petition.',
        assistantHelp: {
          whatItMeans: 'This is the legal name of the party filing the I-140.',
          whatToEnter: 'Enter the employer legal name, or the beneficiary’s legal name if this is a self-petitioning EB-1A case.',
          whatNotToEnter: 'Do not use nicknames, internal shorthand, or the beneficiary name here if an employer is the actual petitioner.',
          example: 'Example: "Acme Robotics, Inc." or "Jane Alexandra Doe" for an EB-1A self-petition.',
          sourceDocument: 'Use employer formation records, prior USCIS filings, or the beneficiary passport/legal-name documents for self-petitions.',
        },
      },
      {
        id: 'beneficiary_name',
        label: 'Beneficiary full legal name',
        type: 'short_text',
        required: true,
        placeholder: 'Full passport name',
        helpText: 'This should match the beneficiary’s identity documents.',
        assistantHelp: {
          whatItMeans: 'This is the person for whom immigrant classification is being requested.',
          whatToEnter: 'Enter the beneficiary’s full legal name exactly as it appears in the passport and related identity documents.',
          whatNotToEnter: 'Do not shorten the name, omit middle names if they are used in the passport, or swap in an English nickname.',
          example: 'Example: "Jane Alexandra Doe."',
          sourceDocument: 'Use the passport biographic page and any current immigration identity records.',
        },
      },
      {
        id: 'classification',
        label: 'Requested classification',
        type: 'short_text',
        required: true,
        placeholder: 'EB-1A extraordinary ability',
        helpText: 'State the immigrant classification being requested on this petition.',
        assistantHelp: {
          whatItMeans: 'This identifies the employment-based immigrant category USCIS should adjudicate.',
          whatToEnter: 'For this product flow, use the EB-1A extraordinary ability classification language that matches the filing strategy.',
          whatNotToEnter: 'Do not mix this up with a nonimmigrant status like H-1B or O-1, and do not list multiple classifications.',
          example: 'Example: "Alien of extraordinary ability (EB-1A)."',
          sourceDocument: 'Use the filing strategy, cover letter, and attorney drafting notes for the petition category.',
        },
      },
      {
        id: 'case_axis_summary',
        label: 'One-sentence case axis',
        type: 'long_text',
        placeholder: 'Short positioning statement for the petition',
        helpText: 'Keep this short and consistent with the case strategy.',
        assistantHelp: {
          whatItMeans: 'This is the short plain-English positioning summary that explains who the beneficiary is and why the case is strong.',
          whatToEnter: 'Enter one sentence that names the field, the standout contributions, and the overall EB-1A positioning.',
          whatNotToEnter: 'Do not paste a full legal argument, resume summary, or unsupported claims that are not backed by the case evidence.',
          example: 'Example: "AI infrastructure leader with original distributed systems contributions, judging activity, and documented industry impact."',
          sourceDocument: 'Use the case axis statement, intake questionnaire, and draft cover letter strategy.',
        },
      },
      {
        id: 'premium_processing',
        label: 'Will this I-140 include premium processing?',
        type: 'select',
        options: ['Yes', 'No', 'Still deciding'],
        helpText: 'This helps decide whether Form I-907 should be included.',
        assistantHelp: {
          whatItMeans: 'This records whether the filing package will request USCIS Premium Processing Service.',
          whatToEnter: 'Choose Yes if Form I-907 will be filed with or added to this I-140, No if not, or Still deciding if the filing decision is not final yet.',
          whatNotToEnter: 'Do not guess. If the client has not decided or eligibility is unclear, use "Still deciding."',
          example: 'Example: "Yes" when the filing package includes Form I-907 and the premium processing fee.',
          sourceDocument: 'Use attorney filing instructions, the fee worksheet, and the premium-processing decision for this case.',
        },
      },
    ],
    [
      {
        id: 'i140-parties',
        title: 'Petitioner and Beneficiary',
        description: 'Confirm the exact legal identities on the petition.',
        questionIds: ['petitioner_name', 'beneficiary_name'],
      },
      {
        id: 'i140-basis',
        title: 'Classification and Case Summary',
        description: 'Capture the EB-1A basis and one-sentence positioning.',
        questionIds: ['classification', 'case_axis_summary'],
      },
      {
        id: 'i140-filing',
        title: 'Filing Choices',
        description: 'Record whether premium processing will be included.',
        questionIds: ['premium_processing'],
      },
    ]
  ),
  buildFormFillConfig(
    'form_i140_draft',
    'Form I-140 (Draft / Working Copy)',
    'Internal draft answers for the working-copy I-140 before final review and signature.',
    'https://www.uscis.gov/sites/default/files/document/forms/i-140.pdf',
    [
      {
        id: 'internal_draft_notes',
        label: 'Internal draft notes',
        type: 'long_text',
        placeholder: 'Open questions, missing items, or review notes',
        helpText: 'Use this as an internal prep field for the draft version only.',
        assistantHelp: {
          whatItMeans: 'This is a working-notes field for unresolved issues before the final I-140 is completed.',
          whatToEnter: 'List missing facts, fields that need confirmation, signature issues, or evidence still being collected.',
          whatNotToEnter: 'Do not treat this as text that belongs on the final USCIS form, and do not include unrelated case brainstorming.',
          example: 'Example: "Confirm petitioner EIN, verify beneficiary middle name format, and decide whether I-907 will be filed."',
          sourceDocument: 'Use internal drafting notes, checklist gaps, and attorney review comments.',
        },
      },
    ],
    [
      {
        id: 'i140-draft-notes',
        title: 'Draft Notes',
        description: 'Track unresolved items before the final version is prepared.',
        questionIds: ['internal_draft_notes'],
      },
    ]
  ),
  buildFormFillConfig(
    'form_g1145',
    'Form G-1145 (E-Notification)',
    'Guided answers for the USCIS e-notification cover sheet.',
    'https://www.uscis.gov/sites/default/files/document/forms/g-1145.pdf',
    [
      {
        id: 'applicant_name',
        label: 'Applicant / petitioner name on G-1145',
        type: 'short_text',
        required: true,
        placeholder: 'Name to appear on the e-notification form',
        helpText: 'Use the name that should receive the lockbox acceptance notice.',
        assistantHelp: {
          whatItMeans: 'This identifies the applicant or petitioner tied to the package receiving the e-notification.',
          whatToEnter: 'Enter the full name that should appear on the G-1145 exactly as the package is being filed.',
          whatNotToEnter: 'Do not use a nickname, and do not put an unrelated contact name just because they will monitor the email.',
          example: 'Example: "Jane Alexandra Doe."',
          sourceDocument: 'Use the main filing form and the final package cover materials.',
        },
      },
      {
        id: 'email',
        label: 'E-notification email address',
        type: 'short_text',
        required: true,
        placeholder: 'name@example.com',
        helpText: 'USCIS sends the acceptance e-notification to this address.',
        assistantHelp: {
          whatItMeans: 'USCIS uses this email to send the lockbox acceptance notice and receipt number.',
          whatToEnter: 'Enter the email that should reliably receive the acceptance notice for this filing.',
          whatNotToEnter: 'Do not use an address that is inactive, temporary, or not monitored during filing.',
          example: 'Example: "immigration@lawfirm.com" or the agreed client email.',
          sourceDocument: 'Use the final filing contact plan agreed by the client and preparer.',
        },
      },
      {
        id: 'phone',
        label: 'Mobile phone number for text alerts',
        type: 'short_text',
        placeholder: 'U.S. mobile number',
        helpText: 'Text messages are only useful if a valid mobile number will receive them.',
        assistantHelp: {
          whatItMeans: 'USCIS can send a text message acceptance alert to this mobile number when the package is accepted.',
          whatToEnter: 'Enter the mobile phone number designated to receive USCIS acceptance texts for this package.',
          whatNotToEnter: 'Do not enter a landline, office main line, or a number that cannot receive text messages.',
          example: 'Example: "(415) 555-0123".',
          sourceDocument: 'Use the filing contact instructions for the package owner or law office.',
        },
      },
    ],
    [
      {
        id: 'g1145-contact',
        title: 'Notification Details',
        description: 'Capture the name and contact details for USCIS lockbox e-notifications.',
        questionIds: ['applicant_name', 'email', 'phone'],
      },
    ]
  ),
  buildFormFillConfig(
    'form_i907',
    'Form I-907 (Premium Processing)',
    'Guided answers for requesting premium processing when the case will include Form I-907.',
    'https://www.uscis.gov/sites/default/files/document/forms/i-907.pdf',
    [
      {
        id: 'request_premium',
        label: 'Are you requesting premium processing?',
        type: 'select',
        options: ['Yes', 'No', 'Need eligibility check'],
        helpText: 'Premium processing should only be selected when it will actually be requested for the related filing.',
        assistantHelp: {
          whatItMeans: 'This records whether the filing package will ask USCIS to process the related petition using Premium Processing Service.',
          whatToEnter: 'Choose Yes if premium processing will be requested, No if it will not, or Need eligibility check if the decision depends on USCIS availability or strategy.',
          whatNotToEnter: 'Do not choose Yes unless the related case and filing plan actually include an I-907 request and fee.',
          example: 'Example: "Yes" when the I-140 package will include Form I-907 and the premium-processing fee.',
          sourceDocument: 'Use the filing strategy memo, fee worksheet, and current USCIS premium-processing availability.',
        },
      },
      {
        id: 'petitioner_name',
        label: 'Petitioner name on I-907',
        type: 'short_text',
        required: true,
        placeholder: 'Same filing party as the related petition',
        helpText: 'This should match the related petition or application requestor.',
        assistantHelp: {
          whatItMeans: 'This is the requestor name USCIS uses to match the I-907 to the related immigration filing.',
          whatToEnter: 'Enter the same petitioner or requestor legal name used for the related I-140 or other premium-eligible filing.',
          whatNotToEnter: 'Do not enter a different business nickname or a contact person instead of the actual requestor.',
          example: 'Example: "Jane Alexandra Doe" for a self-petitioned EB-1A case.',
          sourceDocument: 'Use the related petition draft and final filing packet details.',
        },
      },
      {
        id: 'contact_person',
        label: 'Contact person for premium-processing correspondence',
        type: 'short_text',
        placeholder: 'Primary case contact',
        helpText: 'Use the person or office that should receive follow-up about the premium request.',
        assistantHelp: {
          whatItMeans: 'This is the point of contact for questions or correspondence tied to the premium-processing request.',
          whatToEnter: 'Enter the primary contact person or office handling follow-up on the premium request.',
          whatNotToEnter: 'Do not list someone who is not monitoring the case or who should not receive time-sensitive USCIS follow-up.',
          example: 'Example: "John Smith, Immigration Counsel".',
          sourceDocument: 'Use the filing cover sheet, attorney representation details, or internal case contact plan.',
        },
      },
    ],
    [
      {
        id: 'i907-request',
        title: 'Premium Request',
        description: 'Confirm whether the case will use premium processing.',
        questionIds: ['request_premium'],
      },
      {
        id: 'i907-contact',
        title: 'Related Case and Contact',
        description: 'Match the request to the related case and the correct follow-up contact.',
        questionIds: ['petitioner_name', 'contact_person'],
      },
    ]
  ),
];

export const CASE_INTAKE_DOCUMENT_BUILDER_MAP = Object.fromEntries(
  CASE_INTAKE_DOCUMENT_BUILDERS.map((config) => [config.slotType, config])
) as Record<string, DocumentBuilderSlotConfig>;

// ---------------------------------------------------------------------------
// Section 4 — Cover Letter / Legal Brief builders
// ---------------------------------------------------------------------------

export const COVER_LETTER_DOCUMENT_BUILDERS: DocumentBuilderSlotConfig[] = [
  buildStandardConfig(
    'cover_letter_draft',
    'Cover Letter / Legal Brief (Draft)',
    'Cover Letter Draft',
    'A structured draft of the EB-1A cover letter or legal brief.',
    {
      whatItIs: 'A working draft of the petition cover letter that frames the case, walks through criteria, and ties evidence to the legal standard.',
      whyItMatters: 'The cover letter is the primary organizing document for the petition. It tells the officer what the case is about and guides their review of exhibits.',
      requiredSections: [
        'Introduction and case positioning',
        'Beneficiary background',
        'Criteria walkthrough',
        'Final merits argument',
        'Conclusion and prayer',
      ],
      strongExample: 'A strong cover letter draft is structured by criterion, uses specific exhibit references, and reads as a persuasive legal argument without conclusory language.',
    },
    [
      { id: 'case_theme', label: 'Case positioning theme', type: 'long_text', required: true, placeholder: 'One-paragraph case positioning statement.' },
      { id: 'criteria_to_address', label: 'Criteria to address in the brief', type: 'multi_select', options: ['C1 — Awards', 'C2 — Memberships', 'C3 — Published material', 'C4 — Judging', 'C5 — Original contributions', 'C6 — Scholarly articles', 'C7 — Leading/critical role', 'C8 — High salary', 'C9 — Commercial success', 'C10 — Comparable evidence'] },
      { id: 'proposed_endeavor', label: 'Proposed U.S. endeavor summary', type: 'long_text', placeholder: 'What work the beneficiary will continue in the U.S.' },
      { id: 'key_evidence_summary', label: 'Key evidence highlights per criterion', type: 'long_text', placeholder: 'Brief summary of strongest evidence for each criterion being claimed.' },
      { id: 'tone_notes', label: 'Tone and style notes', type: 'long_text', placeholder: 'Professional, persuasive, fact-based. Avoid hyperbole.' },
    ],
    [
      { id: 'intro', label: 'Introduction' },
      { id: 'background', label: 'Beneficiary background' },
      { id: 'criteria', label: 'Criteria analysis' },
      { id: 'merits', label: 'Final merits' },
      { id: 'conclusion', label: 'Conclusion' },
    ],
    { sectionId: 's4', category: 'Cover Letter / Legal Brief', priority: 'priority', prefillFromSlots: ['intake_questionnaire', 'beneficiary_master_bio', 'master_cv_resume'] }
  ),
  buildStandardConfig(
    'positioning_summary',
    'Positioning Summary',
    'Positioning Summary',
    'A concise case-axis and positioning summary for internal use and letter prefill.',
    {
      whatItIs: 'A short document that captures the case axis, field definition, key narrative anchors, and overall positioning strategy.',
      whyItMatters: 'It provides a reusable positioning reference that keeps the cover letter, expert letters, and evidence narrative consistent.',
      requiredSections: ['Case axis statement', 'Field definition', 'Top achievements', 'Narrative anchors', 'Positioning notes'],
      strongExample: 'A strong positioning summary is 1–2 pages, fact-dense, and clearly distinguishes the beneficiary within their specific field.',
    },
    [
      { id: 'case_axis', label: 'Case axis (one sentence)', type: 'long_text', required: true, placeholder: 'e.g. "Leading distributed systems architect whose contributions to financial infrastructure have been adopted industry-wide."' },
      { id: 'field_definition', label: 'Field of endeavor definition', type: 'long_text', required: true },
      { id: 'top_achievements', label: 'Top 3–5 achievements', type: 'repeatable', itemLabel: 'Achievement', fields: [{ id: 'title', label: 'Achievement', type: 'short_text', required: true }, { id: 'why', label: 'Why it matters', type: 'long_text' }] },
      { id: 'narrative_anchors', label: 'Narrative anchors (key themes to repeat)', type: 'long_text' },
    ],
    [
      { id: 'axis', label: 'Case axis' },
      { id: 'positioning', label: 'Positioning notes' },
      { id: 'evidence_map', label: 'Evidence map' },
    ],
    { sectionId: 's4', category: 'Cover Letter / Legal Brief', prefillFromSlots: ['intake_questionnaire'] }
  ),
];

// ---------------------------------------------------------------------------
// Section 5 — Evidence (Criteria) builders
// ---------------------------------------------------------------------------

export const EVIDENCE_DOCUMENT_BUILDERS: DocumentBuilderSlotConfig[] = [
  buildStandardConfig(
    'claim_memo',
    'Claim Memo',
    'Claim Memo',
    'A per-criterion evidence summary memo linking claims to specific exhibits.',
    {
      whatItIs: 'A structured memo for a single EB-1A criterion that maps the claim, supporting evidence, exhibit references, and any gaps.',
      whyItMatters: 'Claim memos are the building blocks for the cover letter criteria sections and help organize evidence before drafting.',
      requiredSections: ['Criterion claimed', 'Claim statement', 'Supporting evidence with exhibit refs', 'Gaps or weaknesses', 'Strength assessment'],
      strongExample: 'A strong claim memo names the criterion, states the claim in one sentence, and lists each piece of evidence with its exhibit code and probative value.',
    },
    [
      { id: 'criterion', label: 'Criterion', type: 'select', required: true, options: ['C1 — Awards', 'C2 — Memberships', 'C3 — Published material', 'C4 — Judging', 'C5 — Original contributions', 'C6 — Scholarly articles', 'C7 — Leading/critical role', 'C8 — High salary', 'C9 — Commercial success'] },
      { id: 'claim_statement', label: 'Claim statement (one sentence)', type: 'long_text', required: true, placeholder: 'What is being claimed for this criterion.' },
      { id: 'evidence_items', label: 'Supporting evidence', type: 'repeatable', itemLabel: 'Evidence item', fields: [{ id: 'description', label: 'Evidence description', type: 'short_text', required: true }, { id: 'exhibit_ref', label: 'Exhibit reference', type: 'short_text' }, { id: 'probative_value', label: 'Probative value note', type: 'long_text' }] },
      { id: 'gaps', label: 'Known gaps or weaknesses', type: 'long_text' },
      { id: 'strength', label: 'Overall strength assessment', type: 'select', options: ['Strong', 'Moderate', 'Weak', 'Needs more evidence'] },
    ],
    [
      { id: 'claim', label: 'Claim statement' },
      { id: 'evidence', label: 'Evidence analysis' },
      { id: 'assessment', label: 'Strength assessment' },
    ],
    { sectionId: 's5', category: 'Evidence (Criteria)', prefillFromSlots: ['intake_questionnaire'] }
  ),
  buildStandardConfig(
    'evidence_mapping_sheet',
    'Evidence Mapping Sheet',
    'Evidence Map',
    'A cross-reference sheet mapping evidence items to criteria and exhibit codes.',
    {
      whatItIs: 'A structured mapping table connecting each piece of evidence to the criterion it supports, its exhibit location, and its current status.',
      whyItMatters: 'It is essential for organizing the petition exhibit structure and ensuring no criterion is left unsupported.',
      requiredSections: ['Evidence item', 'Criterion mapping', 'Exhibit code', 'Status', 'Notes'],
      strongExample: 'A strong mapping sheet makes it immediately clear which criteria have strong evidence, which are thin, and which exhibits still need formatting or corroboration.',
    },
    [
      { id: 'mapping_entries', label: 'Evidence-to-criterion mappings', type: 'repeatable', required: true, itemLabel: 'Mapping entry', fields: [{ id: 'evidence', label: 'Evidence item', type: 'short_text', required: true }, { id: 'criterion', label: 'Criterion(s) supported', type: 'short_text', required: true }, { id: 'exhibit_code', label: 'Exhibit code', type: 'short_text' }, { id: 'status', label: 'Status (have / draft / need)', type: 'short_text' }, { id: 'notes', label: 'Notes', type: 'long_text' }] },
    ],
    [
      { id: 'map', label: 'Evidence map' },
      { id: 'coverage', label: 'Coverage summary' },
    ],
    { sectionId: 's5', category: 'Evidence (Criteria)', priority: 'priority', prefillFromSlots: ['intake_questionnaire', 'document_inventory_evidence_tracker'] }
  ),
  buildStandardConfig(
    'contribution_summary',
    'Contribution Summary',
    'Contribution Summary',
    'A structured summary of original contributions of major significance (Criterion 5).',
    {
      whatItIs: 'A focused document outlining each original contribution, its impact, adoption evidence, and third-party corroboration.',
      whyItMatters: 'Criterion 5 is one of the most commonly claimed and most scrutinized criteria. A clear contribution summary helps structure the argument.',
      requiredSections: ['Contribution description', 'Originality', 'Adoption and impact', 'Independent corroboration', 'Significance assessment'],
      strongExample: 'A strong contribution summary names each contribution clearly, provides measurable impact (users, revenue, deployments), and includes at least one independent proof source per contribution.',
    },
    [
      { id: 'contributions', label: 'Original contributions', type: 'repeatable', required: true, itemLabel: 'Contribution', fields: [{ id: 'title', label: 'Contribution title', type: 'short_text', required: true }, { id: 'description', label: 'What it is', type: 'long_text', required: true }, { id: 'originality', label: 'What makes it original', type: 'long_text' }, { id: 'impact', label: 'Impact and adoption', type: 'long_text', required: true }, { id: 'corroboration', label: 'Independent corroboration', type: 'long_text' }] },
    ],
    [
      { id: 'contributions', label: 'Contributions' },
      { id: 'impact', label: 'Impact analysis' },
      { id: 'gaps', label: 'Evidence gaps' },
    ],
    { sectionId: 's5', category: 'Evidence (Criteria)', prefillFromSlots: ['intake_questionnaire'] }
  ),
];

// ---------------------------------------------------------------------------
// Section 6 — Comparable Evidence builders
// ---------------------------------------------------------------------------

export const COMPARABLE_EVIDENCE_BUILDERS: DocumentBuilderSlotConfig[] = [
  buildStandardConfig(
    'comparable_evidence_memo',
    'Comparable Evidence Memo',
    'Comparable Evidence Memo',
    'A structured memo explaining why standard criteria do not readily apply and what comparable evidence is being submitted.',
    {
      whatItIs: 'A formal argument document explaining why the standard EB-1A criteria cannot adequately capture the beneficiary\'s achievements and presenting comparable evidence.',
      whyItMatters: 'Comparable evidence claims (8 CFR 204.5(h)(4)) require explicit argumentation. Without a clear memo, officers may dismiss the evidence.',
      requiredSections: ['Why standard criteria don\'t fit', 'Comparable evidence being submitted', 'How it is comparable to the listed criteria', 'Supporting exhibits'],
      strongExample: 'A strong comparable evidence memo clearly identifies which criteria are being addressed, explains the gap, and presents specific evidence that is functionally equivalent.',
    },
    [
      { id: 'standard_criteria_gaps', label: 'Why standard criteria don\'t apply', type: 'long_text', required: true, placeholder: 'Explain which criteria cannot be met in the traditional way and why.' },
      { id: 'comparable_items', label: 'Comparable evidence items', type: 'repeatable', required: true, itemLabel: 'Comparable item', fields: [{ id: 'evidence', label: 'Evidence being submitted', type: 'short_text', required: true }, { id: 'comparable_to', label: 'Comparable to which criterion', type: 'short_text', required: true }, { id: 'explanation', label: 'Why it is comparable', type: 'long_text', required: true }] },
      { id: 'supporting_context', label: 'Industry or field context', type: 'long_text', placeholder: 'Describe the field norms that make standard criteria inapplicable.' },
    ],
    [
      { id: 'argument', label: 'Comparability argument' },
      { id: 'evidence', label: 'Evidence mapping' },
    ],
    { sectionId: 's6', category: 'Comparable Evidence', priority: 'priority' }
  ),
  buildStandardConfig(
    'comparability_mapping_sheet',
    'Comparability Mapping Sheet',
    'Comparability Map',
    'A mapping table connecting comparable evidence items to standard criteria equivalents.',
    {
      whatItIs: 'A structured cross-reference table that maps each piece of comparable evidence to the standard criterion it addresses.',
      whyItMatters: 'It provides a clear visual map for the officer and supports the comparable evidence memo with organized references.',
      requiredSections: ['Evidence item', 'Standard criterion equivalent', 'Exhibit reference', 'Notes'],
      strongExample: 'A strong mapping sheet has one row per comparable evidence item, with a clear link to the criterion it replaces and an exhibit code.',
    },
    [
      { id: 'mappings', label: 'Comparability mappings', type: 'repeatable', required: true, itemLabel: 'Mapping', fields: [{ id: 'evidence', label: 'Comparable evidence', type: 'short_text', required: true }, { id: 'criterion', label: 'Standard criterion equivalent', type: 'short_text', required: true }, { id: 'exhibit_ref', label: 'Exhibit reference', type: 'short_text' }, { id: 'notes', label: 'Notes', type: 'long_text' }] },
    ],
    [{ id: 'map', label: 'Comparability map' }],
    { sectionId: 's6', category: 'Comparable Evidence' }
  ),
];

// ---------------------------------------------------------------------------
// Section 7 — Expert Letters builders
// ---------------------------------------------------------------------------

export const EXPERT_LETTER_BUILDERS: DocumentBuilderSlotConfig[] = [
  buildStandardConfig(
    'expert_letter_draft',
    'Expert Letter Draft',
    'Expert Letter Draft',
    'A structured draft of an expert recommendation letter for the petition.',
    {
      whatItIs: 'A working draft of a recommendation or expert opinion letter that addresses specific criteria and contributions.',
      whyItMatters: 'Expert letters are critical corroboration for most EB-1A criteria. A well-structured draft ensures the letter addresses the right points with specificity.',
      requiredSections: ['Expert identification', 'Relationship to beneficiary', 'Criteria addressed', 'Specific contributions discussed', 'Expert\'s assessment of significance'],
      strongExample: 'A strong expert letter draft names specific contributions, explains their significance in the expert\'s own words, and avoids generic or conclusory language.',
    },
    [
      { id: 'expert_name', label: 'Expert name and title', type: 'short_text', required: true },
      { id: 'expert_affiliation', label: 'Expert affiliation', type: 'short_text', required: true },
      { id: 'relationship', label: 'Relationship to beneficiary', type: 'select', required: true, options: ['Independent (no direct work relationship)', 'Dependent (current/former colleague, supervisor, or collaborator)'] },
      { id: 'criteria_addressed', label: 'Criteria this letter will address', type: 'multi_select', options: ['C1 — Awards', 'C2 — Memberships', 'C3 — Published material', 'C4 — Judging', 'C5 — Original contributions', 'C6 — Scholarly articles', 'C7 — Leading/critical role', 'C8 — High salary'] },
      { id: 'contributions_to_discuss', label: 'Specific contributions or achievements the expert should discuss', type: 'repeatable', required: true, itemLabel: 'Contribution', fields: [{ id: 'contribution', label: 'Contribution / achievement', type: 'short_text', required: true }, { id: 'talking_points', label: 'Talking points for the expert', type: 'long_text' }] },
      { id: 'expert_credentials_summary', label: 'Expert qualifications summary (why they are qualified to opine)', type: 'long_text' },
      { id: 'independence_notes', label: 'Independence notes (how expert knows of the work if independent)', type: 'long_text' },
    ],
    [
      { id: 'intro', label: 'Expert introduction' },
      { id: 'credentials', label: 'Expert credentials' },
      { id: 'contributions', label: 'Contributions discussed' },
      { id: 'assessment', label: 'Expert assessment' },
      { id: 'conclusion', label: 'Conclusion' },
    ],
    { sectionId: 's7', category: 'Expert Letters', priority: 'priority', prefillFromSlots: ['intake_questionnaire', 'reference_contacts_list'] }
  ),
  buildStandardConfig(
    'expert_request_draft',
    'Expert Request Draft',
    'Expert Request',
    'A request letter or outreach template for soliciting an expert recommendation.',
    {
      whatItIs: 'A structured outreach template for requesting an expert or recommender to write or sign a recommendation letter.',
      whyItMatters: 'A clear request packet increases the likelihood of a timely, specific, and useful letter from the expert.',
      requiredSections: ['Request context', 'What the letter should cover', 'Talking points provided', 'Timeline and format instructions'],
      strongExample: 'A strong request draft provides the expert with a clear scope, specific talking points, a deadline, and format guidance.',
    },
    [
      { id: 'expert_name', label: 'Expert name', type: 'short_text', required: true },
      { id: 'request_context', label: 'Context for the request (what you\'re asking and why)', type: 'long_text', required: true },
      { id: 'talking_points', label: 'Talking points or topics the letter should cover', type: 'long_text', required: true },
      { id: 'deadline', label: 'Requested deadline', type: 'date' },
      { id: 'format_notes', label: 'Format and delivery instructions', type: 'long_text', placeholder: 'e.g. Signed PDF on letterhead, emailed to...' },
    ],
    [
      { id: 'request', label: 'Request letter' },
      { id: 'attachments', label: 'Suggested attachments' },
    ],
    { sectionId: 's7', category: 'Expert Letters' }
  ),
  buildStandardConfig(
    'expert_summary_sheet',
    'Expert Summary Sheet',
    'Expert Summary',
    'A tracking sheet for all expert letters: who, what criteria, status.',
    {
      whatItIs: 'A reference table tracking each expert letter: the expert, their independence status, criteria covered, and letter status.',
      whyItMatters: 'It helps ensure adequate criterion coverage, proper balance between independent and dependent experts, and no gaps in letter coverage.',
      requiredSections: ['Expert name', 'Independence status', 'Criteria covered', 'Letter status'],
      strongExample: 'A strong summary sheet makes it immediately obvious which criteria are covered by letters, which experts are independent, and which letters are still pending.',
    },
    [
      { id: 'experts', label: 'Expert letters', type: 'repeatable', required: true, itemLabel: 'Expert', fields: [{ id: 'name', label: 'Expert name', type: 'short_text', required: true }, { id: 'affiliation', label: 'Affiliation', type: 'short_text' }, { id: 'independence', label: 'Independent / Dependent', type: 'short_text', required: true }, { id: 'criteria', label: 'Criteria covered', type: 'short_text' }, { id: 'status', label: 'Status (requested / draft / signed / received)', type: 'short_text', required: true }] },
    ],
    [{ id: 'summary', label: 'Expert coverage summary' }],
    { sectionId: 's7', category: 'Expert Letters', priority: 'priority', prefillFromSlots: ['reference_contacts_list'] }
  ),
];

// ---------------------------------------------------------------------------
// Section 8 — Translations builders
// ---------------------------------------------------------------------------

export const TRANSLATION_BUILDERS: DocumentBuilderSlotConfig[] = [
  buildStandardConfig(
    'translation_certification_template',
    'Translation Certification',
    'Translation Cert',
    'A structured translation certification statement for foreign-language documents.',
    {
      whatItIs: 'A template for the required USCIS translation certification statement that must accompany every translated document.',
      whyItMatters: 'USCIS requires a signed certification for every translation. Missing or deficient certifications can trigger an RFE.',
      requiredSections: ['Translator name', 'Language pair', 'Document identified', 'Certification statement', 'Signature block'],
      strongExample: 'A strong certification clearly identifies the translated document, states the language pair, certifies accuracy, and is signed with date and contact information.',
    },
    [
      { id: 'translator_name', label: 'Translator full name', type: 'short_text', required: true },
      { id: 'source_language', label: 'Source language', type: 'short_text', required: true, placeholder: 'e.g. Mandarin Chinese' },
      { id: 'target_language', label: 'Target language', type: 'short_text', required: true, placeholder: 'e.g. English' },
      { id: 'document_description', label: 'Document being translated', type: 'short_text', required: true, placeholder: 'e.g. Award certificate from XYZ Organization, dated 2023-06-15' },
      { id: 'translator_address', label: 'Translator address', type: 'long_text' },
      { id: 'certification_date', label: 'Certification date', type: 'date' },
    ],
    [
      { id: 'certification', label: 'Certification statement' },
      { id: 'signature', label: 'Signature block' },
    ],
    { sectionId: 's8', category: 'Translations', priority: 'priority' }
  ),
  buildStandardConfig(
    'translation_cover_sheet',
    'Translation Cover Sheet / Index',
    'Translation Index',
    'An index and cover sheet listing all translated documents in the petition package.',
    {
      whatItIs: 'A cover sheet that lists every translated document in the packet, its source language, and its exhibit location.',
      whyItMatters: 'An organized translation index helps the officer quickly locate translated materials and their certifications, reducing confusion.',
      requiredSections: ['Document title', 'Source language', 'Exhibit location', 'Certification status'],
      strongExample: 'A strong translation index is a clean table with one row per translated document, clearly showing where each translation and its certification can be found.',
    },
    [
      { id: 'translations', label: 'Translated documents', type: 'repeatable', required: true, itemLabel: 'Translation', fields: [{ id: 'document', label: 'Document title', type: 'short_text', required: true }, { id: 'language', label: 'Source language', type: 'short_text', required: true }, { id: 'exhibit_ref', label: 'Exhibit location', type: 'short_text' }, { id: 'cert_status', label: 'Certification status', type: 'short_text' }] },
    ],
    [{ id: 'index', label: 'Translation index' }],
    { sectionId: 's8', category: 'Translations' }
  ),
];

export const DOCUMENT_ASSISTANT_BUILDERS: DocumentBuilderSlotConfig[] = [
  ...CASE_INTAKE_DOCUMENT_BUILDERS,
  ...FORMS_FEES_DOCUMENT_BUILDERS,
  ...COVER_LETTER_DOCUMENT_BUILDERS,
  ...EVIDENCE_DOCUMENT_BUILDERS,
  ...COMPARABLE_EVIDENCE_BUILDERS,
  ...EXPERT_LETTER_BUILDERS,
  ...TRANSLATION_BUILDERS,
];

export const DOCUMENT_ASSISTANT_BUILDER_MAP = Object.fromEntries(
  DOCUMENT_ASSISTANT_BUILDERS.map((config) => [config.slotType, config])
) as Record<string, DocumentBuilderSlotConfig>;

export function getDocumentBuilderConfigsForSection(
  sectionId: DocumentBuilderSectionId
): DocumentBuilderSlotConfig[] {
  return DOCUMENT_ASSISTANT_BUILDERS.filter((config) => config.sectionId === sectionId);
}

export function getDocumentBuilderConfig(slotType: string): DocumentBuilderSlotConfig | undefined {
  return DOCUMENT_ASSISTANT_BUILDER_MAP[slotType];
}

export function getDocumentBuilderStateForSlot<T extends DocumentBuilderStateLike>(
  slotType: string,
  builderStates: T[]
): T | undefined {
  return builderStates.find((state) => state.slotType === slotType);
}

export function getDocumentsForBuilderSlot<T extends DocumentBuilderDocumentLike>(
  slotType: string,
  documents: T[]
): T[] {
  return documents.filter((document) => document.metadata?.slotType === slotType);
}

export function resolveDocumentBuilderStatus(
  slotType: string,
  documents: DocumentBuilderDocumentLike[] = [],
  builderStates: DocumentBuilderStateLike[] = []
): DocumentBuilderStatus {
  const builderState = getDocumentBuilderStateForSlot(slotType, builderStates);
  const slotDocuments = getDocumentsForBuilderSlot(slotType, documents);

  if (builderState?.status === 'completed') return 'completed';
  if (
    builderState?.status === 'created' ||
    slotDocuments.some((document) => document.metadata?.source === 'generated')
  ) {
    return 'created';
  }
  if (builderState?.status === 'in_progress') return 'in_progress';
  if (builderState?.status === 'added' || slotDocuments.length > 0) return 'added';
  return 'not_started';
}

export function resolveDocumentBuilderProgress(
  slotType: string,
  documents: DocumentBuilderDocumentLike[] = [],
  builderStates: DocumentBuilderStateLike[] = []
): number {
  const builderState = getDocumentBuilderStateForSlot(slotType, builderStates);
  const status = resolveDocumentBuilderStatus(slotType, documents, builderStates);

  if (status === 'completed') return 100;
  if (status === 'created') return Math.max(builderState?.progress ?? 0, 90);
  if (status === 'added') return Math.max(builderState?.progress ?? 0, 55);
  if (status === 'in_progress') return Math.max(builderState?.progress ?? 0, 25);
  return 0;
}

export function getDocumentBuilderSummary(
  slotType: string,
  documents: DocumentBuilderDocumentLike[] = [],
  builderStates: DocumentBuilderStateLike[] = []
) {
  return {
    status: resolveDocumentBuilderStatus(slotType, documents, builderStates),
    progress: resolveDocumentBuilderProgress(slotType, documents, builderStates),
    builderState: getDocumentBuilderStateForSlot(slotType, builderStates),
    documentCount: getDocumentsForBuilderSlot(slotType, documents).length,
  };
}
