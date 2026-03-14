/**
 * Cover Letter / Legal Brief builder logic.
 * Two outcomes only: Generate Draft OR Block with structured explanation.
 * Does NOT generate weak/partial prose when the record is insufficient.
 */
import type {
  CoverLetterBlockedResult,
  DocumentBuilderAnswers,
  DocumentDraftPayload,
  DocumentDraftSection,
  DocumentMetadata,
  DocumentReviewFinalStatus,
  IntakeReusableDataset,
} from '@aipas/shared';
import { CRITERIA } from '@aipas/shared';
import { buildPacketPlan } from '../compile/packet-structure';
import type { CompileCaseContext, CompileOptions, CompileSourceDocument } from '../compile/types';
import { AIGateway } from '../ai/gateway';

/** Documents with status usable count as viable evidence; weak/needs_context/irrelevant do not. */
const USABLE_STATUS: DocumentReviewFinalStatus[] = ['usable'];

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function flattenReusableDataset(dataset: unknown): Record<string, unknown> {
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) return {};
  const out: Record<string, unknown> = {};
  for (const v of Object.values(dataset)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, v);
  }
  return out;
}

function parseCriterionFromLabel(label: string): string | null {
  const m = label.match(/C(?:1|2|3|4|5|6|7|8|9|10)/i) || label.match(/C(\d+)/i);
  if (m) return `C${m[1]}`;
  return null;
}

function inferCriterionFromDocument(doc: { metadata?: unknown }): string | null {
  const meta = doc.metadata as { documentReview?: { relatedCriterion?: string } } | null;
  const c = meta?.documentReview?.relatedCriterion;
  if (c && typeof c === 'string') {
    const t = c.trim().toUpperCase();
    if (/^C(10|[1-9])$/.test(t)) return t;
  }
  const slotType = (meta as { slotType?: string })?.slotType ?? '';
  const slotCriterionMap: Array<[string, string]> = [
    ['evidence_awards_', 'C1'],
    ['evidence_memberships_', 'C2'],
    ['evidence_published_', 'C3'],
    ['evidence_judging_', 'C4'],
    ['evidence_contributions_', 'C5'],
    ['evidence_scholarly_', 'C6'],
    ['evidence_leading_', 'C8'],
    ['evidence_salary_', 'C9'],
    ['evidence_commercial_', 'C10'],
  ];
  for (const [prefix, cid] of slotCriterionMap) {
    if (slotType.startsWith(prefix)) return cid;
  }
  return null;
}

export interface CoverLetterCaseContext {
  caseId: string;
  caseAxisStatement: string | null;
  proposedEndeavor: string | null;
  criteriaSelected: string[];
  documents: Array<{
    id: string;
    originalName: string;
    category: string;
    metadata?: unknown;
    mimeType?: string;
    createdAt?: Date;
  }>;
  priorDocuments: Array<{
    slotType: string;
    answers?: DocumentBuilderAnswers;
    draftJson?: { reusableDataset?: IntakeReusableDataset; summary?: string; title?: string } | null;
    draftText?: string | null;
  }>;
}

export interface CoverLetterSufficiencyResult {
  allowed: boolean;
  blocked?: CoverLetterBlockedResult;
}

/**
 * Evaluates whether the case record meets minimum sufficiency for cover letter generation.
 * Hard blocks when required inputs or evidence are missing.
 */
export function evaluateCoverLetterSufficiency(ctx: CoverLetterCaseContext): CoverLetterSufficiencyResult {
  const missingRequiredInputs: string[] = [];
  const missingRequiredEvidence: string[] = [];
  const criticalDeficiencies: string[] = [];
  const requiredNextActions: string[] = [];
  const missingInputWarnings: string[] = [];
  const weakEvidenceWarnings: string[] = [];
  const recommendedNextDocuments: string[] = [];

  const intakeData = flattenReusableDataset(
    ctx.priorDocuments.find((p) => p.slotType === 'intake_questionnaire')?.draftJson?.reusableDataset
  );
  const bioData =
    ctx.priorDocuments.find((p) => p.slotType === 'beneficiary_master_bio') ??
    ctx.priorDocuments.find((p) => p.slotType === 'master_cv_resume');
  const bioSummary = bioData?.draftJson?.summary ?? bioData?.draftText ?? '';

  const beneficiaryName =
    asString((intakeData as Record<string, unknown>).legal_name) ||
    asString((intakeData.basicIdentity as Record<string, unknown>)?.legal_name);
  const fieldDefinition =
    asString((intakeData as Record<string, unknown>).field_definition) ||
    asString((intakeData.fieldDefinition as Record<string, unknown>)?.field_definition);
  const caseAxis = asString(ctx.caseAxisStatement);
  const proposedEndeavor = asString(ctx.proposedEndeavor);
  const bioOrCvSummary = bioSummary.trim() || asString((intakeData as Record<string, unknown>).case_overview_summary);

  if (!fieldDefinition) {
    missingRequiredInputs.push('Field / specialization definition');
    criticalDeficiencies.push('No field definition');
  }
  if (!caseAxis) {
    missingRequiredInputs.push('Case axis statement');
    criticalDeficiencies.push('No case axis');
  }
  if (!proposedEndeavor) {
    missingRequiredInputs.push('Proposed endeavor / future work');
    criticalDeficiencies.push('No proposed endeavor');
  }
  if (!beneficiaryName) {
    missingRequiredInputs.push('Beneficiary full name');
  }
  if (!bioOrCvSummary) {
    missingRequiredInputs.push('Bio or CV summary');
    criticalDeficiencies.push('No beneficiary background summary');
  }

  const claimedCriteria = ctx.criteriaSelected.length
    ? ctx.criteriaSelected
    : Array.from(
        new Set(
          ctx.priorDocuments
            .flatMap((p) => {
              const a = p.answers ?? {};
              const arr = Array.isArray(a.criteria_to_address) ? a.criteria_to_address : [];
              const signals = Array.isArray(a.criteria_signals) ? a.criteria_signals : [];
              return [...arr, ...signals];
            })
            .map(parseCriterionFromLabel)
            .filter((c): c is string => Boolean(c))
        )
      );

  if (claimedCriteria.length < 3) {
    missingRequiredEvidence.push('At least 3 claimed criteria required');
    criticalDeficiencies.push('Fewer than 3 viable criteria');
  }

  const docsByCriterion = new Map<string, typeof ctx.documents>();
  for (const doc of ctx.documents) {
    const cid = inferCriterionFromDocument(doc);
    if (cid) {
      if (!docsByCriterion.has(cid)) docsByCriterion.set(cid, []);
      docsByCriterion.get(cid)!.push(doc);
    }
  }

  const viableCriteria = claimedCriteria.filter((c) => {
    const docs = docsByCriterion.get(c) ?? [];
    const hasUsableOrStrong = docs.some((d) => {
      const status = (d.metadata as { documentReview?: { finalStatus?: string } })?.documentReview?.finalStatus;
      return status && USABLE_STATUS.includes(status as DocumentReviewFinalStatus);
    });
    return docs.length > 0 && hasUsableOrStrong;
  });

  if (viableCriteria.length < 3) {
    missingRequiredEvidence.push('At least 3 criteria with mapped evidence');

    const criteriaWithNoEvidence = claimedCriteria.filter((c) => !docsByCriterion.has(c) || docsByCriterion.get(c)!.length === 0);
    if (criteriaWithNoEvidence.length) {
      criticalDeficiencies.push('No criterion-mapped evidence for: ' + criteriaWithNoEvidence.join(', '));
    }

    const criteriaWithOnlyWeak = claimedCriteria.filter((c) => {
      const docs = docsByCriterion.get(c) ?? [];
      if (docs.length === 0) return false;
      const allWeak = docs.every((d) => {
        const status = (d.metadata as { documentReview?: { finalStatus?: string } })?.documentReview?.finalStatus;
        return status === 'needs_context' || status === 'irrelevant';
      });
      return allWeak;
    });
    if (criteriaWithOnlyWeak.length) {
      criticalDeficiencies.push('Only weak/needs_context evidence for: ' + criteriaWithOnlyWeak.join(', '));
    }
  }

  const hasAcclaim = fieldDefinition.length > 0 || caseAxis.length > 0;
  const hasTopOfField = fieldDefinition.length > 0;
  const hasContinuity = proposedEndeavor.length > 0;
  const hasCorroboration = viableCriteria.length >= 3;

  if (!hasAcclaim || !hasTopOfField || !hasContinuity || !hasCorroboration) {
    const missing: string[] = [];
    if (!hasAcclaim) missing.push('acclaim');
    if (!hasTopOfField) missing.push('top-of-field');
    if (!hasContinuity) missing.push('continuity');
    if (!hasCorroboration) missing.push('corroboration');
    criticalDeficiencies.push('Insufficient record for final-merits synthesis: missing ' + missing.join(', '));
  }

  if (missingRequiredInputs.length) {
    requiredNextActions.push('Complete required narrative inputs in Case Intake and Profile documents.');
  }
  if (missingRequiredEvidence.length) {
    requiredNextActions.push('Add and review evidence for at least 3 criteria.');
  }
  if (criticalDeficiencies.some((c) => c.includes('weak/needs_context'))) {
    requiredNextActions.push('Strengthen evidence for criteria with only weak or needs-context documents.');
  }
  if (missingRequiredInputs.length === 0 && missingRequiredEvidence.length === 0 && criticalDeficiencies.length === 0) {
    requiredNextActions.push('Complete Intake Questionnaire and Beneficiary Master Bio.');
  }

  recommendedNextDocuments.push('Intake Questionnaire');
  recommendedNextDocuments.push('Beneficiary Master Bio');
  recommendedNextDocuments.push('Master CV / Resume');
  if (viableCriteria.length < 3) {
    recommendedNextDocuments.push('Evidence documents for each claimed criterion (with document review)');
  }

  const hasHardBlock =
    !fieldDefinition ||
    !caseAxis ||
    !proposedEndeavor ||
    !bioOrCvSummary ||
    claimedCriteria.length < 3 ||
    viableCriteria.length < 3 ||
    criticalDeficiencies.some(
      (c) =>
        c.includes('Only weak') ||
        c.includes('No criterion-mapped') ||
        c.includes('Insufficient record')
    );

  if (hasHardBlock) {
    const whyBlocked = criticalDeficiencies.length
      ? criticalDeficiencies[0]
      : missingRequiredInputs.length
        ? `Missing required inputs: ${missingRequiredInputs.slice(0, 3).join(', ')}`
        : `Missing required evidence: ${missingRequiredEvidence.join(', ')}`;

    return {
      allowed: false,
      blocked: {
        status: 'blocked',
        whyBlocked,
        missingRequiredInputs,
        missingRequiredEvidence,
        criticalDeficiencies,
        requiredNextActions,
        missingInputWarnings: missingInputWarnings.length ? missingInputWarnings : undefined,
        weakEvidenceWarnings: weakEvidenceWarnings.length ? weakEvidenceWarnings : undefined,
        recommendedNextDocuments,
      },
    };
  }

  return { allowed: true };
}

const DEFAULT_COMPILE_OPTIONS: CompileOptions = {
  criteriaIds: [],
  orderingStrategy: 'strength-first',
  includeForms: true,
  includeDrafts: false,
  includeDuplicates: false,
  includeLowConfidence: false,
  pageNumberFormat: 'simple',
  includeTOC: false,
  includeExhibitIndex: false,
};

function buildExhibitMap(
  ctx: CoverLetterCaseContext
): Map<string, string> {
  const compileDocs: CompileSourceDocument[] = ctx.documents.map((d) => ({
    id: d.id,
    caseId: ctx.caseId,
    filename: '',
    originalName: d.originalName,
    mimeType: d.mimeType ?? 'application/pdf',
    size: 0,
    category: d.category,
    metadata: d.metadata as DocumentMetadata | null,
    s3Key: '',
    createdAt: d.createdAt ?? new Date(),
  }));

  const compileCtx: CompileCaseContext = {
    id: ctx.caseId,
    caseAxisStatement: ctx.caseAxisStatement,
    proposedEndeavor: ctx.proposedEndeavor,
    criteriaSelected: ctx.criteriaSelected,
    documents: compileDocs,
    latestEer: null,
  };

  const plan = buildPacketPlan(compileCtx, DEFAULT_COMPILE_OPTIONS);
  const map = new Map<string, string>();
  for (const item of plan.items) {
    if (item.sourceDocumentId) {
      map.set(item.sourceDocumentId, item.exhibitCode);
    }
  }
  return map;
}

function getExhibitRef(docId: string, docName: string, exhibitMap: Map<string, string>): string {
  const code = exhibitMap.get(docId);
  return code ? `Exhibit ${code}` : `[${docName}]`;
}

export interface GenerateCoverLetterInput {
  caseContext: CoverLetterCaseContext;
  answers: DocumentBuilderAnswers;
}

export type CoverLetterGenerateResult =
  | { blocked: CoverLetterBlockedResult }
  | { draft: DocumentDraftPayload };

/**
 * Generates Cover Letter draft OR returns blocked result.
 * Never generates weak/partial prose when the record is insufficient.
 */
export async function generateCoverLetterDraft(
  input: GenerateCoverLetterInput
): Promise<CoverLetterGenerateResult> {
  const sufficiency = evaluateCoverLetterSufficiency(input.caseContext);
  if (!sufficiency.allowed && sufficiency.blocked) {
    return { blocked: sufficiency.blocked };
  }

  const ctx = input.caseContext;
  const answers = input.answers;
  const exhibitMap = buildExhibitMap(ctx);

  const intakeData = flattenReusableDataset(
    ctx.priorDocuments.find((p) => p.slotType === 'intake_questionnaire')?.draftJson?.reusableDataset
  );
  const bioData =
    ctx.priorDocuments.find((p) => p.slotType === 'beneficiary_master_bio') ??
    ctx.priorDocuments.find((p) => p.slotType === 'master_cv_resume');
  const bioSummary = bioData?.draftJson?.summary ?? bioData?.draftText ?? '';

  const beneficiaryName =
    asString((intakeData as Record<string, unknown>).legal_name) ||
    asString((intakeData.basicIdentity as Record<string, unknown>)?.legal_name) ||
    asString(answers.beneficiary_name);
  const fieldDefinition =
    asString((intakeData as Record<string, unknown>).field_definition) ||
    asString((intakeData.fieldDefinition as Record<string, unknown>)?.field_definition) ||
    asString(ctx.caseAxisStatement);
  const caseAxis = asString(ctx.caseAxisStatement);
  const proposedEndeavor = asString(ctx.proposedEndeavor);
  const bioOrCv = bioSummary.trim() || asString((intakeData as Record<string, unknown>).case_overview_summary);

  const criteriaSelected =
    ctx.criteriaSelected.length >= 3
      ? ctx.criteriaSelected
      : (['C1', 'C2', 'C3', 'C4', 'C5'] as const).slice(0, Math.max(3, ctx.criteriaSelected.length));

  const docsByCriterion = new Map<string, typeof ctx.documents>();
  for (const doc of ctx.documents) {
    const cid = inferCriterionFromDocument(doc);
    if (cid) {
      if (!docsByCriterion.has(cid)) docsByCriterion.set(cid, []);
      docsByCriterion.get(cid)!.push(doc);
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const headerBlock = [
    today,
    '',
    '[USCIS Service Center Address]',
    '[City, State ZIP]',
    '',
    `Re: Form I-140, Immigrant Petition for Alien Worker`,
    `Beneficiary: ${beneficiaryName || '[Beneficiary Name]'}`,
    `Classification Sought: EB-1A (Extraordinary Ability)`,
  ].join('\n');

  const introFiling = [
    'This petition seeks classification of the beneficiary under the Employment-Based First Preference (EB-1) immigrant category as an alien of extraordinary ability.',
    '',
    `The beneficiary demonstrates sustained acclaim and recognition in the field of ${fieldDefinition || '[field]'}, and is positioned at the top of that field.`,
  ].join('\n');

  const execPositioning = [
    `Case Axis: ${caseAxis || '[Case axis statement]'}`,
    '',
    `Field Definition: ${fieldDefinition || '[Field]'}`,
    '',
    `Proposed U.S. Endeavor: ${proposedEndeavor || '[Proposed endeavor]'}`,
  ].join('\n');

  const statutoryFramework = [
    'Under 8 CFR § 204.5(h)(2), the petitioner must demonstrate that the beneficiary meets at least three of the ten regulatory criteria, and that the beneficiary\'s achievements have been recognized in the field and that the beneficiary is positioned to continue work in the United States.',
    '',
    'The beneficiary meets the following criteria: ' + criteriaSelected.join(', ') + '.',
  ].join('\n');

  const beneficiaryBackground = [
    `Beneficiary: ${beneficiaryName || '[Name]'}`,
    '',
    bioOrCv || '[Add beneficiary background and field definition from Master Bio or CV.]',
  ].join('\n');

  const proposedEndeavorSection = proposedEndeavor || '[Add proposed endeavor and future work in the United States.]';

  const criterionSections: DocumentDraftSection[] = criteriaSelected.map((criterionId) => {
    const docs = docsByCriterion.get(criterionId) ?? [];
    const criterionLabel = CRITERIA[criterionId as keyof typeof CRITERIA] ?? criterionId;
    const legalStandard = `The beneficiary must demonstrate ${criterionLabel.toLowerCase()}.`;
    const evidenceRefs = docs
      .map((d) => `- ${getExhibitRef(d.id, d.originalName, exhibitMap)}: ${d.originalName}`)
      .join('\n');
    const content = [
      `## ${criterionId}`,
      legalStandard,
      '',
      '[Factual theory and strongest supporting facts.]',
      '',
      'Evidence references:',
      evidenceRefs || '- [Add evidence references]',
      '',
      '[Mini-conclusion for this criterion.]',
    ].join('\n');
    return { id: criterionId.toLowerCase(), label: criterionId, content };
  });

  const finalMerits = [
    'Sustained acclaim: The beneficiary has demonstrated sustained acclaim in the field.',
    '',
    'Top-of-field positioning: The evidence establishes that the beneficiary is among the small percentage at the top of the field.',
    '',
    'Evidentiary coherence: The evidence across criteria supports a coherent final-merits argument.',
    '',
    'Future continuity: The beneficiary intends to continue work in the United States in the same field.',
  ].join('\n');

  const conclusion = [
    'For the foregoing reasons, the petitioner respectfully requests that the beneficiary be classified as an alien of extraordinary ability under 8 U.S.C. § 1153(b)(1)(A).',
  ].join('\n');

  const exhibitNote = [
    'Exhibit references in this brief correspond to the compiled packet exhibit index. If the packet has not yet been compiled, the references shown are provisional placeholders tied to document titles.',
  ].join('\n');

  const sections: DocumentDraftSection[] = [
    { id: 'header', label: 'Header', content: headerBlock },
    { id: 'intro', label: 'Introductory Filing Statement', content: introFiling },
    { id: 'exec', label: 'Executive Positioning Summary', content: execPositioning },
    { id: 'statutory', label: 'Statutory / Regulatory Framework', content: statutoryFramework },
    { id: 'background', label: 'Beneficiary Background and Field Definition', content: beneficiaryBackground },
    { id: 'endeavor', label: 'Proposed Endeavor / Future Work', content: proposedEndeavorSection },
    ...criterionSections,
    { id: 'final_merits', label: 'Final Merits', content: finalMerits },
    { id: 'conclusion', label: 'Conclusion', content: conclusion },
    { id: 'exhibit_note', label: 'Exhibit Reference Note', content: exhibitNote },
  ];

  const hasAi = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key');
  if (hasAi) {
    try {
      const aiGateway = new AIGateway();
      const result = await aiGateway.chatWithJSON<{ sections: DocumentDraftSection[] }>({
        systemPrompt: [
          'You are an EB-1A petition drafter. Generate a Cover Letter / Legal Brief draft.',
          'Use ONLY the facts provided. Do NOT invent facts. Do NOT write generic praise.',
          'Keep the legal-standard section concise. Make the brief an organizing petition document.',
          'Return JSON with sections array. Each section must have id, label, and content.',
          'Section ids: header, intro, exec, statutory, background, endeavor, final_merits, conclusion, exhibit_note.',
          'Include one section per claimed criterion with id like c1, c2, etc. and label like C1, C2.',
        ].join(' '),
        messages: [
          {
            role: 'user',
            content: JSON.stringify(
              {
                beneficiaryName,
                fieldDefinition,
                caseAxis,
                proposedEndeavor,
                bioOrCv: bioOrCv.slice(0, 2000),
                criteriaSelected,
                exhibitRefs: Array.from(exhibitMap.entries()).map(([id, code]) => ({ id, code })),
                documentsByCriterion: Object.fromEntries(
                  Array.from(docsByCriterion.entries()).map(([c, docs]) => [
                    c,
                    docs.map((d) => ({
                      id: d.id,
                      name: d.originalName,
                      exhibitCode: exhibitMap.get(d.id),
                    })),
                  ])
                ),
              },
              null,
              2
            ),
          },
        ],
        temperature: 0.3,
        maxTokens: 4000,
      });
      if (result?.sections?.length) {
        const byId = new Map(result.sections.map((s) => [s.id, s]));
        const merged = sections.map((s) => byId.get(s.id) ?? s);
        return {
          draft: {
            title: 'Cover Letter / Legal Brief Draft',
            summary: `Cover letter draft for ${beneficiaryName || 'beneficiary'}, framing the case under ${criteriaSelected.join(', ')}.`,
            sections: merged,
            suggestedNextSteps: [
              'Review each section for accuracy and completeness.',
              'Replace placeholder text with case-specific facts.',
              'Verify exhibit references match the compiled packet.',
            ],
          },
        };
      }
    } catch (err) {
      console.error('Cover letter AI generation failed, using fallback:', err);
    }
  }

  return {
    draft: {
      title: 'Cover Letter / Legal Brief Draft',
      summary: `Cover letter draft for ${beneficiaryName || 'beneficiary'}, framing the case under ${criteriaSelected.join(', ')}.`,
      sections,
      suggestedNextSteps: [
        'Review and refine each section with case-specific facts.',
        'Verify exhibit references match the compiled packet.',
        'Ensure legal-standard sentences are concise.',
      ],
    },
  };
}
