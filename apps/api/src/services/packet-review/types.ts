import type { PacketSectionCode, PacketItem } from '../compile/types';

export type PacketRiskLevel = 'low_risk' | 'medium_risk' | 'high_risk' | 'critical_gaps';

export type CriterionSupportLevel =
  | 'strong'
  | 'moderate'
  | 'weak'
  | 'not_assessable'
  | 'not_claimed'
  | 'missing';

export type ThresholdImpact = 'critical' | 'material' | 'notable';

export interface ThresholdDeficiency {
  issue: string;
  whyItMatters: string;
  expectedPacketItem: string;
  impact: ThresholdImpact;
}

export type FilingComponentStatus = 'present' | 'missing' | 'incomplete' | 'needs_correction';

export interface FilingCompletenessItem {
  component: string;
  status: FilingComponentStatus;
  detail?: string;
}

export interface CriterionCoverageEntry {
  criterionId: string;
  criterionLabel: string;
  supportLevel: CriterionSupportLevel;
  exhibitCount: number;
  primaryCount: number;
  supportingCount: number;
  reviewedCount: number;
  findings: string[];
  whyThisRating: string;
  supportPresent: string[];
  supportMissing: string[];
}

export interface FinalMeritsAssessment {
  sustainedAcclaim: string;
  topOfFieldSignaling: string;
  futureWorkContinuity: string;
  evidentiaryCoherence: string;
}

export interface EvidenceQualityIssue {
  documentTitle: string;
  exhibitCode?: string;
  severity: 'info' | 'warning' | 'error';
  description: string;
}

export interface PacketArchitectureIssue {
  sectionCode: PacketSectionCode | string;
  exhibitCode?: string;
  severity: 'info' | 'warning' | 'error';
  description: string;
}

export type RequiredAdditionGroup = 'required' | 'strengthening';

export interface RequiredAddition {
  group: RequiredAdditionGroup;
  description: string;
  expectedSection: PacketSectionCode | string;
  priority: 'high' | 'medium' | 'low';
}

export interface MissingItem {
  description: string;
  expectedSection: PacketSectionCode | string;
  priority: 'high' | 'medium' | 'low';
  action: 'add' | 'replace' | 'strengthen';
}

export interface PriorityFix {
  rank: number;
  action: string;
  whyItMatters: string;
  expectedEffect: string;
}

export interface SourceBasisEntry {
  kind: 'packet_signal' | 'document_review' | 'legal_reference' | 'deterministic_rule';
  source: string;
  excerpt?: string;
}

export interface FinalAuditReport {
  id: string;
  caseId: string;
  compileJobId: string;
  generatedAt: string;
  usedAI: boolean;
  modelUsed?: string;
  packetVersion?: number;
  packetSource: string;

  executiveConclusion: {
    riskLevel: PacketRiskLevel;
    summary: string;
    structuralVerdict: string;
  };

  thresholdDeficiencies: ThresholdDeficiency[];

  filingCompleteness: FilingCompletenessItem[];

  criterionCoverage: CriterionCoverageEntry[];

  finalMeritsAssessment: FinalMeritsAssessment;

  evidenceQualityIssues: EvidenceQualityIssue[];

  packetArchitectureIssues: PacketArchitectureIssue[];

  requiredAdditions: RequiredAddition[];

  priorityFixes: PriorityFix[];

  sourceBasis: SourceBasisEntry[];
}

export interface DeterministicCheckResult {
  architectureIssues: PacketArchitectureIssue[];
  evidenceIssues: EvidenceQualityIssue[];
  missingItems: MissingItem[];
  criterionCoverage: CriterionCoverageEntry[];
  signals: SourceBasisEntry[];
  thresholdDeficiencies: ThresholdDeficiency[];
  filingCompleteness: FilingCompletenessItem[];
  requiredAdditions: RequiredAddition[];
}

export interface LegalReferenceSnippet {
  id: string;
  source: string;
  section?: string | null;
  content: string;
  topicTags: string[];
}

export interface PacketReviewContext {
  caseId: string;
  compileJobId: string;
  criteriaSelected: string[];
  caseAxisStatement?: string | null;
  proposedEndeavor?: string | null;
  packetItems: PacketItem[];
  deterministicResults: DeterministicCheckResult;
  legalSnippets: LegalReferenceSnippet[];
}
