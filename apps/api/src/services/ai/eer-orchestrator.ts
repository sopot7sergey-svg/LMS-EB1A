import { AIGateway } from './gateway';
import { MULTILINGUAL_RESPONSE_INSTRUCTION } from './prompts';
import { RAGService } from '../rag/retrieve';
import { CRITERIA } from '@aipas/shared';

interface EERInput {
  caseData: any;
  claimedCriteria: string[];
  documents: any[];
  letters: any[];
  evidencePacks: any[];
  petitionPackage?: any;
}

interface EEROutput {
  executiveSummary: string;
  items: any[];
  criterionItems: any[];
  finalMeritsItems: any[];
  optionalPackagingItems: any[];
}

const OFFICER_MODE_SYSTEM_PROMPT = `ROLE: Officer-Mode Evidence Reviewer for EB-1A I-140 package.

CONSTRAINTS:
- ONLY rely on retrieved authoritative sources from RAG library.
- Every evaluative statement must include a citation to a retrieved chunk.
- If no supporting authority: abstain and request missing evidence.
- Do NOT provide legal advice, outcome predictions, or approval likelihood.
- Output must always be EER: Critical, Recommended, Optional.

PROCESS:
1) Step 1 criteria threshold for each claimed criterion (8 CFR 204.5(h)(3)).
2) Step 2 final merits (USCIS PM Vol 6 Part F Ch 2).
3) Evidence/RFE procedural logic (USCIS PM Vol 1 Part E Ch 6/9; 8 CFR 103.2).

OUTPUT FORMAT:
Return a JSON object with:
- executiveSummary: neutral summary of the review
- criterionItems: array of items per criterion with priority, category, ask, citations, criterionId, criterionStatus
- finalMeritsItems: array of holistic review items
- optionalPackagingItems: array of packaging/readability improvements

Each item must have:
- id: unique identifier
- priority: "critical" | "recommended" | "optional"
- category: category of the issue
- ask: specific enhancement request
- citations: array of {source, excerptId, section}
${MULTILINGUAL_RESPONSE_INSTRUCTION}`;

export class EEROrchestrator {
  private aiGateway: AIGateway;
  private ragService: RAGService;

  constructor() {
    this.aiGateway = new AIGateway();
    this.ragService = new RAGService();
  }

  async generateEER(input: EERInput): Promise<EEROutput> {
    const completenessResult = await this.checkCompleteness(input);
    if (completenessResult.hasCriticalGaps) {
      return this.generateIncompleteSubmissionEER(completenessResult);
    }

    const path = this.identifyPath(input);

    const criterionEvaluations = await this.evaluateCriteria(input);

    const finalMeritsEvaluation = await this.evaluateFinalMerits(input, criterionEvaluations);

    const eerOutput = await this.generateEERReport(
      input,
      criterionEvaluations,
      finalMeritsEvaluation,
      path
    );

    return eerOutput;
  }

  private async checkCompleteness(input: EERInput): Promise<{
    hasCriticalGaps: boolean;
    missingItems: string[];
  }> {
    const missingItems: string[] = [];

    if (!input.petitionPackage?.briefContent) {
      missingItems.push('Petition brief / cover letter');
    }

    if (!input.petitionPackage?.exhibitList || 
        (Array.isArray(input.petitionPackage.exhibitList) && input.petitionPackage.exhibitList.length === 0)) {
      missingItems.push('Exhibit list');
    }

    if (input.documents.length === 0) {
      missingItems.push('Evidence documents');
    }

    return {
      hasCriticalGaps: missingItems.length > 0,
      missingItems,
    };
  }

  private generateIncompleteSubmissionEER(completenessResult: {
    hasCriticalGaps: boolean;
    missingItems: string[];
  }): EEROutput {
    return {
      executiveSummary: 'The submission is incomplete and cannot be fully evaluated. Critical baseline documents are missing.',
      items: completenessResult.missingItems.map((item, index) => ({
        id: `incomplete-${index}`,
        priority: 'critical',
        category: 'Submission Completeness',
        ask: `Provide: ${item}`,
        citations: [{
          source: 'USCIS PM Vol 1 Part E Ch 6',
          excerptId: 'evidence-procedures',
          section: 'Evidence Submission Requirements',
        }],
      })),
      criterionItems: [],
      finalMeritsItems: [],
      optionalPackagingItems: [],
    };
  }

  private identifyPath(input: EERInput): 'major_award' | 'criteria' | 'comparable' {
    if (input.caseData.criteriaSelected?.includes('major_award')) {
      return 'major_award';
    }
    return 'criteria';
  }

  private async evaluateCriteria(input: EERInput): Promise<any[]> {
    const evaluations: any[] = [];

    for (const criterionId of input.claimedCriteria) {
      const criterionName = CRITERIA[criterionId as keyof typeof CRITERIA] || criterionId;

      const relevantDocs = input.documents.filter((doc) =>
        this.isDocumentRelevantToCriterion(doc, criterionId)
      );
      const relevantPacks = input.evidencePacks.filter(
        (pack) => pack.criterionId === criterionId
      );

      const ragChunks = await this.ragService.retrieveForCriterion(criterionId);

      const evaluation = await this.aiGateway.chatWithJSON({
        messages: [
          {
            role: 'user',
            content: `Evaluate criterion ${criterionId}: ${criterionName}

Evidence submitted:
- Documents: ${JSON.stringify(relevantDocs.map((d) => ({ name: d.originalName, category: d.category })))}
- Evidence packs: ${JSON.stringify(relevantPacks.map((p) => ({ narrative: p.narrative, status: p.status })))}

Authoritative guidance:
${ragChunks.map((c) => `[${c.source}] ${c.content}`).join('\n\n')}

Evaluate whether the evidence meets the criterion requirements. Return JSON with:
- criterionId
- criterionStatus: "met" | "partially_met" | "not_met"
- findings: array of findings
- gaps: array of evidence gaps
- eerItems: array of EER items (critical/recommended/optional)`,
          },
        ],
        systemPrompt: OFFICER_MODE_SYSTEM_PROMPT,
      });

      evaluations.push(evaluation);
    }

    return evaluations;
  }

  /** Check if document is relevant to criterion based on metadata.slotType */
  private isDocumentRelevantToCriterion(doc: { metadata?: any; category?: string }, criterionId: string): boolean {
    const slotType = ((doc.metadata as any)?.slotType || '').toLowerCase();
    const slotPrefixes: Record<string, string> = {
      C1: 'evidence_awards_',
      C2: 'evidence_memberships_',
      C3: 'evidence_published_',
      C4: 'evidence_judging_',
      C5: 'evidence_contributions_',
      C6: 'evidence_scholarly_',
      C7: 'evidence_', // exhibition - use generic evidence
      C8: 'evidence_leading_',
      C9: 'evidence_salary_',
      C10: 'evidence_commercial_',
    };
    const prefix = slotPrefixes[criterionId];
    if (prefix && slotType.startsWith(prefix)) return true;
    if (criterionId === 'C7' && slotType.startsWith('evidence_')) return true;
    return false;
  }

  private async evaluateFinalMerits(
    input: EERInput,
    criterionEvaluations: any[]
  ): Promise<any> {
    const ragChunks = await this.ragService.retrieveForFinalMerits();

    const evaluation = await this.aiGateway.chatWithJSON({
      messages: [
        {
          role: 'user',
          content: `Perform Step 2 Final Merits evaluation.

Case axis: ${input.caseData.caseAxisStatement || 'Not provided'}
Proposed endeavor: ${input.caseData.proposedEndeavor || 'Not provided'}

Criterion evaluations summary:
${JSON.stringify(criterionEvaluations)}

Letters summary:
${JSON.stringify(input.letters.map((l) => ({ signer: l.signerName, type: l.letterType, criteria: l.criteriaAddressed })))}

Authoritative guidance:
${ragChunks.map((c) => `[${c.source}] ${c.content}`).join('\n\n')}

Evaluate the totality of evidence. Check for:
- Narrative consistency across brief, letters, exhibits
- Independence: self-asserted vs corroborated evidence
- Sustained acclaim indicators
- Impact beyond immediate team/employer
- Credibility and probative value

Return JSON with:
- overallAssessment: summary
- consistencyIssues: array
- independenceIssues: array
- sustainedAcclaimIssues: array
- eerItems: array of final merits EER items`,
        },
      ],
      systemPrompt: OFFICER_MODE_SYSTEM_PROMPT,
    });

    return evaluation;
  }

  private async generateEERReport(
    input: EERInput,
    criterionEvaluations: any[],
    finalMeritsEvaluation: any,
    path: string
  ): Promise<EEROutput> {
    const criterionItems: any[] = [];
    criterionEvaluations.forEach((eval_) => {
      if (eval_.eerItems) {
        eval_.eerItems.forEach((item: any, index: number) => {
          criterionItems.push({
            ...item,
            id: `${eval_.criterionId}-${index}`,
            criterionId: eval_.criterionId,
            criterionStatus: eval_.criterionStatus,
            citations: item.citations || [{
              source: '8 CFR 204.5(h)(3)',
              excerptId: `criterion-${eval_.criterionId}`,
              section: 'Criteria Requirements',
            }],
          });
        });
      }
    });

    const finalMeritsItems = (finalMeritsEvaluation.eerItems || []).map(
      (item: any, index: number) => ({
        ...item,
        id: `final-merits-${index}`,
        citations: item.citations || [{
          source: 'USCIS PM Vol 6 Part F Ch 2',
          excerptId: 'final-merits',
          section: 'Final Merits Determination',
        }],
      })
    );

    const optionalPackagingItems = await this.generatePackagingItems(input);

    const metCount = criterionEvaluations.filter((e) => e.criterionStatus === 'met').length;
    const partialCount = criterionEvaluations.filter((e) => e.criterionStatus === 'partially_met').length;

    const executiveSummary = `Evidence Enhancement Request (EER) for EB-1A petition.

Path: ${path === 'major_award' ? 'One-time major award' : '3 of 10 criteria'}
Criteria claimed: ${input.claimedCriteria.length}
Criteria status: ${metCount} met, ${partialCount} partially met, ${input.claimedCriteria.length - metCount - partialCount} not met

This EER identifies areas requiring enhancement. Critical items must be addressed for completeness. Recommended items strengthen the record. Optional items improve presentation.

This review does not predict outcomes or provide legal advice.`;

    return {
      executiveSummary,
      items: [...criterionItems, ...finalMeritsItems, ...optionalPackagingItems],
      criterionItems,
      finalMeritsItems,
      optionalPackagingItems,
    };
  }

  private async generatePackagingItems(input: EERInput): Promise<any[]> {
    const items: any[] = [];

    if (!input.petitionPackage?.tocGenerated) {
      items.push({
        id: 'packaging-toc',
        priority: 'optional',
        category: 'Packaging',
        ask: 'Generate and include a table of contents for easier navigation.',
        citations: [],
      });
    }

    return items;
  }
}
