export type UserRole = 'student' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Case {
  id: string;
  userId: string;
  caseAxisStatement?: string;
  proposedEndeavor?: string;
  keywords?: string[];
  criteriaSelected: string[];
  status: 'draft' | 'in_progress' | 'submitted' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseWorkspace {
  id: string;
  caseId: string;
  folderStructure: Record<string, string[]>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description?: string;
  videoUrl?: string;
  videoEmbed?: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Video {
  id: string;
  lessonId: string;
  url: string;
  embedCode?: string;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModuleProgress {
  id: string;
  userId: string;
  moduleId: string;
  lessonsCompleted: string[];
  artifactGenerated: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LessonProgress {
  id: string;
  userId: string;
  lessonId: string;
  completed: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CriterionStatus = 'strong' | 'possible' | 'gap' | 'not_applicable';

export interface CriteriaMatrix {
  id: string;
  caseId: string;
  version: number;
  criteria: Record<string, CriterionStatus>;
  notes: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvidencePack {
  id: string;
  caseId: string;
  criterionId: string;
  documents: string[];
  narrative?: string;
  status: 'draft' | 'uploaded' | 'packaged' | 'reviewed';
  createdAt: Date;
  updatedAt: Date;
}

export interface RecommendationLetter {
  id: string;
  caseId: string;
  signerName: string;
  signerTitle: string;
  signerOrganization: string;
  signerEmail?: string;
  letterType: 'manager' | 'expert' | 'partner' | 'client';
  criteriaAddressed: string[];
  draftContent?: string;
  finalContent?: string;
  status: 'draft' | 'requested' | 'signed';
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PetitionPackage {
  id: string;
  caseId: string;
  version: number;
  briefContent?: string;
  exhibitList: ExhibitItem[];
  tocGenerated: boolean;
  status: 'draft' | 'assembled' | 'reviewed' | 'final';
  createdAt: Date;
  updatedAt: Date;
}

export interface ExhibitItem {
  id: string;
  label: string;
  description: string;
  documentId: string;
  criterionId?: string;
}

export type EERPriority = 'critical' | 'recommended' | 'optional';
export type CriterionEERStatus = 'met' | 'partially_met' | 'not_met' | 'not_claimed';

export interface AuthorityCitation {
  source: string;
  excerptId: string;
  section?: string;
}

export interface EERItem {
  id: string;
  priority: EERPriority;
  category: string;
  ask: string;
  citations: AuthorityCitation[];
  suggestedEvidence?: string[];
  relatedExhibitIds?: string[];
}

export interface CriterionEERItem extends EERItem {
  criterionId: string;
  criterionStatus: CriterionEERStatus;
}

export interface EER {
  id: string;
  caseId: string;
  version: number;
  executiveSummary: string;
  items: EERItem[];
  criterionItems: CriterionEERItem[];
  finalMeritsItems: EERItem[];
  optionalPackagingItems: EERItem[];
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EERResolution {
  id: string;
  eerId: string;
  previousVersion: number;
  changes: string[];
  createdAt: Date;
}

export interface ChatThread {
  id: string;
  studentId: string;
  adminId?: string;
  subject?: string;
  status: 'open' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderRole: UserRole;
  content: string;
  createdAt: Date;
}

import type { DocumentCategory } from './documentCategories';
import type {
  DocumentBuilderAnswers,
  DocumentBuilderInputMode,
  DocumentBuilderStatus,
  DocumentDraftPayload,
  DocumentMetadataSource,
} from './documentBuilder';

export interface Document {
  id: string;
  caseId: string;
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: DocumentCategory;
  metadata?: DocumentMetadata;
  s3Key: string;
  createdAt: Date;
  updatedAt: Date;
}

export type { DocumentCategory };

export interface DocumentMetadata {
  dates?: string[];
  names?: string[];
  organizations?: string[];
  titles?: string[];
  links?: string[];
  metrics?: Record<string, string | number>;
  slotType?: string;
  source?: DocumentMetadataSource;
  builderStatus?: DocumentBuilderStatus;
  builderStateId?: string;
  isDraft?: boolean;
  confidenceScore?: number;
  reviewForDocumentId?: string;
  reviewKind?: 'document_review';
  documentReview?: DocumentReviewResult;
}

export type DocumentReviewFinalStatus = 'usable' | 'weak' | 'irrelevant' | 'needs_context';

export interface DocumentReviewResult {
  reviewedAt: string;
  reviewedBy: 'document_review_agent';
  reviewDocumentId?: string;
  documentType: string;
  relatedCriterion?: string | null;
  relatedSection?: string | null;
  strengths: string[];
  weaknesses: string[];
  missingContext: string[];
  finalStatus: DocumentReviewFinalStatus;
}

export interface DocumentBuilderState {
  id: string;
  caseId: string;
  userId: string;
  sectionId: string;
  slotType: string;
  status: DocumentBuilderStatus;
  inputModes: DocumentBuilderInputMode[];
  answers?: DocumentBuilderAnswers;
  sourceDocumentIds: string[];
  draftJson?: DocumentDraftPayload;
  draftText?: string;
  progress: number;
  lastGeneratedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CriterionEvaluation {
  criterionId: string;
  name: string;
  status: CriterionEERStatus;
  findings: string[];
  gaps: string[];
  authority: AuthorityCitation[];
  eer: {
    critical: string[];
    recommended: string[];
    optional: string[];
  };
}

export const CRITERIA = {
  C1: 'Lesser nationally/internationally recognized prizes or awards',
  C2: 'Membership in associations requiring outstanding achievements',
  C3: 'Published material about you in professional/major media',
  C4: 'Judging the work of others',
  C5: 'Original contributions of major significance',
  C6: 'Authorship of scholarly articles',
  C7: 'Display of work in artistic exhibitions/showcases',
  C8: 'Leading or critical role for distinguished organizations',
  C9: 'High salary or other significantly high remuneration',
  C10: 'Commercial successes in the performing arts',
} as const;

export type CriterionId = keyof typeof CRITERIA;
