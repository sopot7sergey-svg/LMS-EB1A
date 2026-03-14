import type {
  CriterionId,
  DocumentMetadata,
  DocumentReviewResult,
} from '@aipas/shared';

export interface CompileOptions {
  criteriaIds: string[];
  orderingStrategy: 'strength-first' | 'numeric' | 'custom';
  includeForms: boolean;
  includeDrafts: boolean;
  includeDuplicates: boolean;
  includeLowConfidence: boolean;
  pageNumberFormat: 'simple' | 'bates';
  includeTOC: boolean;
  includeExhibitIndex: boolean;
}

export interface CompileProgress {
  status: string;
  progress: number;
  error?: string;
}

export type PacketSectionCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type PacketCriterionSubsectionCode =
  | 'D-1'
  | 'D-2'
  | 'D-3'
  | 'D-4'
  | 'D-5'
  | 'D-6'
  | 'D-7'
  | 'D-8'
  | 'D-9'
  | 'D-10'
  | 'D-C';
export type PacketEvidenceRole = 'primary' | 'supporting';
export type PacketSourceType = 'document' | 'generated';

export interface CompileSourceDocument {
  id: string;
  caseId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: string;
  metadata?: DocumentMetadata | null;
  s3Key: string;
  createdAt: Date;
}

export interface CompileCaseContext {
  id: string;
  caseAxisStatement?: string | null;
  proposedEndeavor?: string | null;
  criteriaSelected: string[];
  documents: CompileSourceDocument[];
  latestEer?: {
    executiveSummary?: string | null;
    criterionItems?: unknown;
    finalMeritsItems?: unknown;
    optionalPackagingItems?: unknown;
    createdAt?: Date;
  } | null;
}

export interface PacketSectionDefinition {
  code: PacketSectionCode;
  title: string;
  description: string;
  order: number;
}

export interface PacketItem {
  id: string;
  sourceType: PacketSourceType;
  sectionCode: PacketSectionCode;
  sectionTitle: string;
  bucketCode: string;
  bucketTitle: string;
  exhibitCode: string;
  title: string;
  evidenceRole: PacketEvidenceRole;
  sourceDocumentId?: string;
  sourceOriginalName?: string;
  mimeType?: string;
  filePath?: string;
  review?: DocumentReviewResult | null;
  criterionId?: CriterionId | 'C-C';
  packetSubsectionCode?: PacketCriterionSubsectionCode;
  packetSubsectionTitle?: string;
  generatedText?: string;
  pageCount: number;
  startPage?: number;
  endPage?: number;
}

export interface PacketTocEntry {
  code: string;
  title: string;
  startPage: number;
}

export interface PacketExhibitIndexEntry {
  exhibitCode: string;
  title: string;
  sectionCode: PacketSectionCode;
  evidenceRole: PacketEvidenceRole;
  startPage: number;
  endPage: number;
  sourceOriginalName?: string;
}

export interface PacketPlan {
  caseId: string;
  sectionOrder: PacketSectionDefinition[];
  items: PacketItem[];
  tocEntries: PacketTocEntry[];
  exhibitIndex: PacketExhibitIndexEntry[];
}
