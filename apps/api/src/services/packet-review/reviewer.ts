import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { AIGateway } from '../ai/gateway';
import { MULTILINGUAL_RESPONSE_INSTRUCTION } from '../ai/prompts';
import type { PacketItem } from '../compile/types';
import { runDeterministicChecks } from './deterministic-checks';
import { retrieveForPacketReview } from './legal-reference';
import type {
  FinalAuditReport,
  FinalMeritsAssessment,
  PacketReviewContext,
  PacketRiskLevel,
  PriorityFix,
  SourceBasisEntry,
  EvidenceQualityIssue,
  PacketArchitectureIssue,
  ThresholdDeficiency,
  RequiredAddition,
} from './types';

const prisma = new PrismaClient();

function buildAIPrompt(ctx: PacketReviewContext): string {
  const sectionSummary = (['A', 'B', 'C', 'D', 'E', 'F'] as const).map((code) => {
    const sectionItems = ctx.packetItems.filter((i) => i.sectionCode === code);
    return `Section ${code}: ${sectionItems.length} exhibits`;
  }).join('\n');

  const criterionSummary = ctx.deterministicResults.criterionCoverage.map((c) =>
    `- ${c.criterionId} (${c.criterionLabel}): ${c.supportLevel} — ${c.exhibitCount} exhibits (${c.primaryCount} primary, ${c.supportingCount} supporting)`
  ).join('\n');

  const thresholdSummary = ctx.deterministicResults.thresholdDeficiencies.map((t) =>
    `[${t.impact}] ${t.issue}: ${t.whyItMatters}`
  ).join('\n') || 'No threshold deficiencies detected.';

  const filingStatus = ctx.deterministicResults.filingCompleteness.map((f) =>
    `${f.component}: ${f.status}${f.detail ? ` (${f.detail})` : ''}`
  ).join('\n');

  const archIssues = ctx.deterministicResults.architectureIssues
    .map((i) => `[${i.severity}] ${i.description}`)
    .join('\n') || 'None detected.';

  const evidIssues = ctx.deterministicResults.evidenceIssues
    .map((i) => `[${i.severity}] ${i.documentTitle}: ${i.description}`)
    .join('\n') || 'None detected.';

  const legalRefs = ctx.legalSnippets
    .map((s) => `[${s.source}${s.section ? ` — ${s.section}` : ''}]: ${s.content}`)
    .join('\n\n');

  return `You are the Packet Review Engine for an EB-1A extraordinary ability immigration petition.

Your role is to produce a structured Final Audit Report evaluating the compiled officer packet.
${MULTILINGUAL_RESPONSE_INSTRUCTION}

CRITICAL RULES:
- Do NOT use "submission-ready" or language implying a legal determination.
- Do NOT imitate USCIS correspondence or use government-style letterhead tone.
- Use these risk levels only: low_risk, medium_risk, high_risk, critical_gaps.
- Write as a clear, practical audit memo — direct, specific, and actionable.
- If key materials are missing, say so explicitly. Never leave it vague.
- Ground reasoning in the packet data and legal references provided.

CASE CONTEXT:
Case axis: ${ctx.caseAxisStatement || 'Not set'}
Proposed endeavor: ${ctx.proposedEndeavor || 'Not set'}
Claimed criteria: ${ctx.criteriaSelected.join(', ') || 'None selected'}

PACKET STRUCTURE:
${sectionSummary}
Total exhibits: ${ctx.packetItems.length}

THRESHOLD DEFICIENCIES DETECTED:
${thresholdSummary}

FILING COMPLETENESS:
${filingStatus}

CRITERION COVERAGE (deterministic):
${criterionSummary}

ARCHITECTURE ISSUES:
${archIssues}

EVIDENCE QUALITY ISSUES:
${evidIssues}

LEGAL REFERENCE MATERIALS:
${legalRefs}

Respond with valid JSON matching this structure:
{
  "riskLevel": "low_risk" | "medium_risk" | "high_risk" | "critical_gaps",
  "summary": "2-4 sentence executive conclusion about the packet's current state and readiness risk",
  "structuralVerdict": "one sentence: structurally incomplete | materially weak | reviewable but vulnerable | structurally sound",
  "finalMeritsAssessment": {
    "sustainedAcclaim": "assessment text",
    "topOfFieldSignaling": "assessment text",
    "futureWorkContinuity": "assessment text",
    "evidentiaryCoherence": "assessment text"
  },
  "additionalThresholdDeficiencies": [
    { "issue": "...", "whyItMatters": "...", "expectedPacketItem": "...", "impact": "critical|material|notable" }
  ],
  "additionalArchitectureIssues": [
    { "sectionCode": "X", "severity": "info|warning|error", "description": "..." }
  ],
  "additionalEvidenceIssues": [
    { "documentTitle": "...", "severity": "info|warning|error", "description": "..." }
  ],
  "additionalRequiredAdditions": [
    { "group": "required|strengthening", "description": "...", "expectedSection": "X", "priority": "high|medium|low" }
  ],
  "priorityFixes": [
    { "rank": 1, "action": "...", "whyItMatters": "...", "expectedEffect": "..." }
  ]
}`;
}

interface AIAuditResponse {
  riskLevel: PacketRiskLevel;
  summary: string;
  structuralVerdict?: string;
  finalMeritsAssessment: FinalMeritsAssessment;
  additionalThresholdDeficiencies?: ThresholdDeficiency[];
  additionalArchitectureIssues?: PacketArchitectureIssue[];
  additionalEvidenceIssues?: EvidenceQualityIssue[];
  additionalRequiredAdditions?: RequiredAddition[];
  priorityFixes?: PriorityFix[];
}

function computeFallbackRiskLevel(ctx: PacketReviewContext): PacketRiskLevel {
  const { deterministicResults } = ctx;
  const criticalThresholds = deterministicResults.thresholdDeficiencies.filter((t) => t.impact === 'critical').length;
  const errorCount = deterministicResults.architectureIssues.filter((i) => i.severity === 'error').length
    + deterministicResults.evidenceIssues.filter((i) => i.severity === 'error').length;
  const missingFilingComponents = deterministicResults.filingCompleteness.filter((f) => f.status === 'missing').length;
  const missingCriteria = deterministicResults.criterionCoverage.filter((c) => c.supportLevel === 'missing').length;

  if (criticalThresholds >= 2 || errorCount >= 3 || missingFilingComponents >= 4) return 'critical_gaps';
  if (criticalThresholds >= 1 || errorCount >= 1 || missingCriteria >= 2) return 'high_risk';
  if (deterministicResults.architectureIssues.length + deterministicResults.evidenceIssues.length >= 3 || missingFilingComponents >= 2) return 'medium_risk';
  return 'low_risk';
}

function computeStructuralVerdict(ctx: PacketReviewContext, riskLevel: PacketRiskLevel): string {
  const criticalThresholds = ctx.deterministicResults.thresholdDeficiencies.filter((t) => t.impact === 'critical').length;
  const missingFiling = ctx.deterministicResults.filingCompleteness.filter((f) => f.status === 'missing').length;

  if (criticalThresholds >= 2 || missingFiling >= 5) return 'The packet is structurally incomplete — core filing materials and evidence are missing.';
  if (riskLevel === 'critical_gaps') return 'The packet has critical structural gaps that prevent meaningful reliance.';
  if (riskLevel === 'high_risk') return 'The packet is materially weak — significant deficiencies reduce evidentiary reliability.';
  if (riskLevel === 'medium_risk') return 'The packet is reviewable but vulnerable — moderate gaps should be addressed.';
  return 'The packet is structurally sound at a basic level.';
}

function buildFallbackReport(ctx: PacketReviewContext): Omit<FinalAuditReport, 'id' | 'caseId' | 'compileJobId' | 'generatedAt' | 'packetVersion' | 'packetSource'> {
  const riskLevel = computeFallbackRiskLevel(ctx);
  const { deterministicResults } = ctx;

  const summary = riskLevel === 'critical_gaps'
    ? 'The packet has critical structural or evidentiary gaps. Multiple core filing components are missing, and the packet cannot be meaningfully relied upon in its current state.'
    : riskLevel === 'high_risk'
      ? 'The packet has significant deficiencies in section coverage, evidence quality, or mandatory components. These must be addressed before the packet can support a strong petition.'
      : riskLevel === 'medium_risk'
        ? 'The packet is partially assembled with moderate issues in filing completeness or evidence organization. Review and address the flagged items to strengthen reliability.'
        : 'The packet structure and evidence coverage appear reasonable at a structural level. Minor improvements may still be beneficial.';

  const priorityFixes: PriorityFix[] = [];
  let rank = 1;

  for (const td of deterministicResults.thresholdDeficiencies.filter((t) => t.impact === 'critical').slice(0, 3)) {
    priorityFixes.push({
      rank: rank++,
      action: td.issue,
      whyItMatters: td.whyItMatters,
      expectedEffect: 'Resolves a critical structural deficiency.',
    });
  }
  for (const issue of deterministicResults.architectureIssues.filter((i) => i.severity === 'error').slice(0, 2)) {
    if (rank > 5) break;
    priorityFixes.push({
      rank: rank++,
      action: `Fix: ${issue.description}`,
      whyItMatters: 'Addresses a structural error in packet organization.',
      expectedEffect: 'Improves packet integrity and readability.',
    });
  }
  while (priorityFixes.length < 5 && rank <= 5) {
    const remaining = [
      ...deterministicResults.thresholdDeficiencies.filter((t) => t.impact === 'material'),
      ...deterministicResults.evidenceIssues.filter((i) => i.severity === 'warning'),
    ];
    const next = remaining[rank - priorityFixes.length - 1];
    if (!next) break;
    priorityFixes.push({
      rank: rank++,
      action: 'issue' in next ? (next as ThresholdDeficiency).issue : (next as EvidenceQualityIssue).description,
      whyItMatters: 'issue' in next ? (next as ThresholdDeficiency).whyItMatters : 'Improves evidence quality.',
      expectedEffect: 'Strengthens overall packet.',
    });
  }

  return {
    usedAI: false,
    executiveConclusion: {
      riskLevel,
      summary,
      structuralVerdict: computeStructuralVerdict(ctx, riskLevel),
    },
    thresholdDeficiencies: deterministicResults.thresholdDeficiencies,
    filingCompleteness: deterministicResults.filingCompleteness,
    criterionCoverage: deterministicResults.criterionCoverage,
    finalMeritsAssessment: {
      sustainedAcclaim: 'Cannot assess without AI reasoning — deterministic review only.',
      topOfFieldSignaling: 'Cannot assess without AI reasoning — deterministic review only.',
      futureWorkContinuity: 'Cannot assess without AI reasoning — deterministic review only.',
      evidentiaryCoherence: 'Cannot assess without AI reasoning — deterministic review only.',
    },
    packetArchitectureIssues: deterministicResults.architectureIssues,
    evidenceQualityIssues: deterministicResults.evidenceIssues,
    requiredAdditions: deterministicResults.requiredAdditions,
    priorityFixes,
    sourceBasis: deterministicResults.signals,
  };
}

function asValidRiskLevel(value: string): PacketRiskLevel {
  const VALID: PacketRiskLevel[] = ['low_risk', 'medium_risk', 'high_risk', 'critical_gaps'];
  return VALID.includes(value as PacketRiskLevel) ? (value as PacketRiskLevel) : 'medium_risk';
}

export async function runPacketReview(
  caseId: string,
  compileJobId: string
): Promise<FinalAuditReport> {
  const artifact = await prisma.compileArtifact.findUnique({
    where: { jobId: compileJobId },
  });
  if (!artifact) throw new Error('Compile artifact not found for this job.');

  const packetPlanRaw = artifact.optionsHash
    ? JSON.parse(artifact.optionsHash as string)
    : null;

  const packetItems: PacketItem[] = packetPlanRaw?.packetPlan?.items ?? [];

  if (packetItems.length === 0) {
    throw new Error('Compiled packet has no items — cannot run packet review.');
  }

  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      documents: true,
    },
  });
  if (!caseRecord) throw new Error('Case not found.');

  const docMap = new Map(caseRecord.documents.map((d) => [d.id, d]));
  for (const item of packetItems) {
    if (item.sourceDocumentId && !item.review) {
      const doc = docMap.get(item.sourceDocumentId);
      if (doc) {
        const meta = (doc.metadata ?? {}) as any;
        if (meta.documentReview) {
          item.review = meta.documentReview;
        }
      }
    }
  }

  const criteriaSelected = caseRecord.criteriaSelected;
  const deterministicResults = runDeterministicChecks(packetItems, criteriaSelected);
  const legalSnippets = await retrieveForPacketReview(criteriaSelected);

  const ctx: PacketReviewContext = {
    caseId,
    compileJobId,
    criteriaSelected,
    caseAxisStatement: caseRecord.caseAxisStatement,
    proposedEndeavor: caseRecord.proposedEndeavor,
    packetItems,
    deterministicResults,
    legalSnippets,
  };

  const diag = AIGateway.diagnose();
  let report: Omit<FinalAuditReport, 'id' | 'caseId' | 'compileJobId' | 'generatedAt' | 'packetVersion' | 'packetSource'>;

  if (diag.available) {
    try {
      const gateway = new AIGateway();
      const prompt = buildAIPrompt(ctx);
      const aiResult = await gateway.chatWithJSON<AIAuditResponse>({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 4096,
      });

      const allThresholds = [
        ...deterministicResults.thresholdDeficiencies,
        ...(aiResult.additionalThresholdDeficiencies ?? []),
      ];
      const allArchIssues = [
        ...deterministicResults.architectureIssues,
        ...(aiResult.additionalArchitectureIssues ?? []),
      ];
      const allEvidIssues = [
        ...deterministicResults.evidenceIssues,
        ...(aiResult.additionalEvidenceIssues ?? []),
      ];
      const allAdditions = [
        ...deterministicResults.requiredAdditions,
        ...(aiResult.additionalRequiredAdditions ?? []),
      ];

      const legalSignals: SourceBasisEntry[] = legalSnippets.map((s) => ({
        kind: 'legal_reference' as const,
        source: `${s.source}${s.section ? ` — ${s.section}` : ''}`,
        excerpt: s.content.slice(0, 200),
      }));

      const riskLevel = asValidRiskLevel(aiResult.riskLevel);

      report = {
        usedAI: true,
        modelUsed: diag.model,
        executiveConclusion: {
          riskLevel,
          summary: aiResult.summary || 'AI review completed.',
          structuralVerdict: aiResult.structuralVerdict || computeStructuralVerdict(ctx, riskLevel),
        },
        thresholdDeficiencies: allThresholds,
        filingCompleteness: deterministicResults.filingCompleteness,
        criterionCoverage: deterministicResults.criterionCoverage,
        finalMeritsAssessment: aiResult.finalMeritsAssessment ?? {
          sustainedAcclaim: 'Not assessed.',
          topOfFieldSignaling: 'Not assessed.',
          futureWorkContinuity: 'Not assessed.',
          evidentiaryCoherence: 'Not assessed.',
        },
        packetArchitectureIssues: allArchIssues,
        evidenceQualityIssues: allEvidIssues,
        requiredAdditions: allAdditions,
        priorityFixes: (aiResult.priorityFixes ?? []).slice(0, 5),
        sourceBasis: [...deterministicResults.signals, ...legalSignals],
      };
    } catch (error) {
      console.error('[PacketReview] AI reasoning failed, using fallback:', error);
      report = buildFallbackReport(ctx);
    }
  } else {
    report = buildFallbackReport(ctx);
  }

  const existingMeta = packetPlanRaw ?? {};
  const packetVersion = existingMeta.version ?? existingMeta.artifactSchemaVersion ?? 1;

  const finalReport: FinalAuditReport = {
    id: randomUUID(),
    caseId,
    compileJobId,
    generatedAt: new Date().toISOString(),
    packetVersion,
    packetSource: 'Compiled officer packet',
    ...report,
  };

  return finalReport;
}
