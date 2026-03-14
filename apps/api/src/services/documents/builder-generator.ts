import {
  DOCUMENT_ASSISTANT_BUILDER_MAP,
  DOCUMENT_BUILDER_VOICE_TRANSCRIPT_KEY,
  type DocumentBuilderAnswers,
  type DocumentDraftPayload,
  type DocumentDraftSection,
  type DocumentBuilderSlotConfig,
  type IntakeReusableDataset,
  type IntakeStrategySummary,
} from '@aipas/shared';
import { AIGateway } from '../ai/gateway';
import type { CoverLetterCaseContext } from './cover-letter-service';
import { generateCoverLetterDraft } from './cover-letter-service';

interface SourceDocumentSummary {
  id: string;
  originalName: string;
  category: string;
  metadata?: unknown;
}

interface GenerateDocumentDraftInput {
  slotType: string;
  answers?: DocumentBuilderAnswers;
  sourceDocuments?: SourceDocumentSummary[];
  priorDocuments?: Array<{
    slotType: string;
    status?: string;
    answers?: DocumentBuilderAnswers;
    draftJson?: DocumentDraftPayload | null;
    draftText?: string | null;
    completedAt?: string | Date | null;
  }>;
  /** Required for cover_letter_draft: case record, documents, prior documents */
  caseContext?: CoverLetterCaseContext;
}

export interface GeneratedDraft extends DocumentDraftPayload {
  title: string;
  summary: string;
  sections: DocumentDraftSection[];
  suggestedNextSteps: string[];
}

/** Intake Questionnaire only: draft plus strategy summary and reusable dataset */
export interface GeneratedIntakeDraft extends GeneratedDraft {
  strategySummary: IntakeStrategySummary;
  reusableDataset: IntakeReusableDataset;
}

function normalizeSuggestedNextStep(step: unknown): string | null {
  if (typeof step === 'string') {
    const trimmed = step.trim();
    return trimmed || null;
  }
  if (!step || typeof step !== 'object') return null;

  const label = typeof (step as { label?: unknown }).label === 'string'
    ? (step as { label: string }).label.trim()
    : '';
  const content = typeof (step as { content?: unknown }).content === 'string'
    ? (step as { content: string }).content.trim()
    : '';

  if (label && content) return `${label}: ${content}`;
  if (label) return label;
  if (content) return content;
  return null;
}

function normalizeGeneratedDraft(draft: GeneratedDraft): GeneratedDraft {
  return {
    ...draft,
    suggestedNextSteps: Array.isArray(draft.suggestedNextSteps)
      ? draft.suggestedNextSteps.map(normalizeSuggestedNextStep).filter((step): step is string => Boolean(step))
      : [],
  };
}

function stringifyValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function asObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function joinLines(lines: Array<string | null | undefined>): string {
  return lines
    .map((line) => (typeof line === 'string' ? line.trim() : ''))
    .filter(Boolean)
    .join('\n');
}

function flattenReusableDataset(dataset: unknown): Record<string, unknown> {
  if (!isRecord(dataset)) return {};
  const flattened: Record<string, unknown> = {};
  for (const value of Object.values(dataset)) {
    if (!isRecord(value)) continue;
    Object.assign(flattened, value);
  }
  return flattened;
}

function buildPriorContext(
  priorDocuments: Array<{
    slotType: string;
    status?: string;
    answers?: DocumentBuilderAnswers;
    draftJson?: DocumentDraftPayload | null;
    draftText?: string | null;
    completedAt?: string | Date | null;
  }>
) {
  return priorDocuments.map((item) => ({
    slotType: item.slotType,
    status: item.status ?? 'unknown',
    completedAt: item.completedAt ?? null,
    answers: item.answers ?? {},
    strategySummary: item.draftJson?.strategySummary ?? null,
    reusableDataset: item.draftJson?.reusableDataset ?? null,
    suggestedNextSteps: item.draftJson?.suggestedNextSteps ?? [],
    draftSummary: item.draftJson?.summary ?? null,
    draftTextPreview: item.draftText ? item.draftText.slice(0, 3000) : null,
  }));
}

function buildSharedAnswerSeed(
  priorDocuments: Array<{
    slotType: string;
    status?: string;
    answers?: DocumentBuilderAnswers;
    draftJson?: DocumentDraftPayload | null;
    draftText?: string | null;
    completedAt?: string | Date | null;
  }>
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const item of priorDocuments) {
    if (item.answers && isRecord(item.answers)) {
      Object.assign(merged, item.answers);
    }
    Object.assign(merged, flattenReusableDataset(item.draftJson?.reusableDataset));
  }
  return merged;
}

function resolveBuilderAnswers(
  config: DocumentBuilderSlotConfig,
  answers: DocumentBuilderAnswers | undefined,
  priorDocuments: Array<{
    slotType: string;
    status?: string;
    answers?: DocumentBuilderAnswers;
    draftJson?: DocumentDraftPayload | null;
    draftText?: string | null;
    completedAt?: string | Date | null;
  }>
): DocumentBuilderAnswers {
  const nextAnswers: DocumentBuilderAnswers = { ...(answers ?? {}) };
  const sharedSeed = buildSharedAnswerSeed(priorDocuments);

  for (const key of config.sharedAnswerKeys ?? []) {
    const existingValue = nextAnswers[key];
    const isEmpty =
      existingValue == null ||
      existingValue === '' ||
      (Array.isArray(existingValue) && existingValue.length === 0);
    if (isEmpty && sharedSeed[key] != null) {
      nextAnswers[key] = sharedSeed[key];
    }
  }

  return nextAnswers;
}

function buildAnswerDigest(answers: DocumentBuilderAnswers | undefined, config: DocumentBuilderSlotConfig) {
  const safeAnswers = answers ?? {};
  const digest = config.questions
    .map((question) => {
      const value = safeAnswers[question.id];
      if (value == null || value === '') return null;
      return `- ${question.label}: ${stringifyValue(value)}`;
    })
    .filter(Boolean)
    .join('\n');
  const voiceTranscript = asString(safeAnswers[DOCUMENT_BUILDER_VOICE_TRANSCRIPT_KEY]);
  if (!voiceTranscript) {
    return digest;
  }
  return [digest, `- Voice transcript notes: ${voiceTranscript}`].filter(Boolean).join('\n');
}

function buildFallbackDraft(
  config: DocumentBuilderSlotConfig,
  answers: DocumentBuilderAnswers | undefined,
  sourceDocuments: SourceDocumentSummary[],
  priorDocuments: Array<{
    slotType: string;
    status?: string;
    answers?: DocumentBuilderAnswers;
    draftJson?: DocumentDraftPayload | null;
    draftText?: string | null;
    completedAt?: string | Date | null;
  }> = []
): GeneratedDraft {
  const resolvedAnswers = resolveBuilderAnswers(config, answers, priorDocuments);
  const priorityFallback = buildPriorityFallbackDraft(config, resolvedAnswers, sourceDocuments);
  if (priorityFallback) {
    return priorityFallback;
  }

  const digest = buildAnswerDigest(resolvedAnswers, config);
  const sourceList = sourceDocuments.length
    ? sourceDocuments.map((doc) => `- ${doc.originalName}`).join('\n')
    : '- No source materials linked yet.';

  const sections = config.outputSections.map((section) => ({
    id: section.id,
    label: section.label,
    content: [
      `Draft guidance for ${section.label}.`,
      section.description || '',
      digest ? `Relevant intake data:\n${digest}` : 'No intake data has been entered yet.',
    ]
      .filter(Boolean)
      .join('\n\n'),
  }));

  return {
    title: config.shortLabel,
    summary: `${config.shortLabel} draft generated from the current builder answers and linked source materials.`,
    sections,
    suggestedNextSteps: [
      'Review each section and replace placeholders with precise facts and metrics.',
      'Use the template panel to compare structure and coverage.',
      `Linked source materials:\n${sourceList}`,
    ],
  };
}

function formatTimelineEntry(entry: Record<string, unknown>): string {
  const organization = asString(entry.organization);
  const title = asString(entry.title) || asString(entry.role);
  const startDate = asString(entry.start_date) || asString(entry.startDate);
  const endDate = asString(entry.end_date) || asString(entry.endDate) || 'Present';
  const impact = asString(entry.impact) || asString(entry.summary) || asString(entry.highlights);
  return joinLines([
    [title, organization].filter(Boolean).join(', '),
    [startDate, endDate].filter(Boolean).join(' - '),
    impact,
  ]);
}

function formatAchievement(entry: Record<string, unknown>): string {
  return joinLines([
    asString(entry.title) || asString(entry.contribution) || asString(entry.name),
    asString(entry.context),
    asString(entry.impact) || asString(entry.adoption_impact),
    asString(entry.evidence),
  ]);
}

function formatAward(entry: Record<string, unknown>): string {
  return joinLines([
    [asString(entry.name), asString(entry.issuer)].filter(Boolean).join(' - '),
    asString(entry.date),
    asString(entry.selectivity),
    asString(entry.impact),
    asString(entry.evidence),
  ]);
}

function formatEvidenceInventoryEntry(entry: Record<string, unknown>): string {
  return joinLines([
    [asString(entry.item) || asString(entry.name), asString(entry.status)].filter(Boolean).join(' - '),
    asString(entry.supports),
    asString(entry.location),
    asString(entry.nextStep),
  ]);
}

function formatSourceMaterials(sourceDocuments: SourceDocumentSummary[]): string {
  if (!sourceDocuments.length) {
    return 'No linked source materials yet.';
  }
  return sourceDocuments
    .map((doc) => `- ${doc.originalName} (${doc.category})`)
    .join('\n');
}

function buildPriorityFallbackDraft(
  config: DocumentBuilderSlotConfig,
  answers: DocumentBuilderAnswers,
  sourceDocuments: SourceDocumentSummary[]
): GeneratedDraft | null {
  switch (config.slotType) {
    case 'beneficiary_master_bio':
      return buildBeneficiaryMasterBioFallback(config, answers, sourceDocuments);
    case 'master_cv_resume':
      return buildMasterCvFallback(config, answers, sourceDocuments);
    case 'employment_history_sheet':
      return buildEmploymentHistoryFallback(config, answers, sourceDocuments);
    case 'awards_honors_list':
      return buildAwardsHonorsFallback(config, answers, sourceDocuments);
    case 'document_inventory_evidence_tracker':
      return buildEvidenceTrackerFallback(config, answers, sourceDocuments);
    default:
      return null;
  }
}

function buildBeneficiaryMasterBioFallback(
  config: DocumentBuilderSlotConfig,
  answers: DocumentBuilderAnswers,
  sourceDocuments: SourceDocumentSummary[]
): GeneratedDraft {
  const name = asString(answers.legal_name);
  const headline = asString(answers.headline) || asString(answers.field_positioning) || asString(answers.field_definition);
  const careerArc = asString(answers.career_arc);
  const achievements = asObjectArray(answers.key_contributions).length
    ? asObjectArray(answers.key_contributions)
    : asObjectArray(answers.signature_contributions);
  const recognition = asString(answers.recognition) || asString(answers.criteria_self_assessment);
  const futureFocus = asString(answers.future_focus) || asString(answers.us_endeavor);

  return {
    title: name ? `${name} - ${config.shortLabel}` : config.shortLabel,
    summary: 'Structured narrative bio drafted from intake answers and reusable case positioning data.',
    sections: [
      {
        id: 'overview',
        label: 'Professional overview',
        content: joinLines([
          headline || 'Add a concise positioning statement that defines the beneficiary and niche.',
          name ? `${name} is positioned as a distinguished professional in the field described above.` : '',
        ]),
      },
      {
        id: 'trajectory',
        label: 'Career trajectory',
        content:
          careerArc ||
          asObjectArray(answers.career_timeline_entries).map(formatTimelineEntry).filter(Boolean).join('\n\n') ||
          'Summarize the beneficiary’s career progression, emphasizing role growth, scope, and continuity in the field.',
      },
      {
        id: 'impact',
        label: 'Signature impact',
        content:
          achievements.map(formatAchievement).filter(Boolean).join('\n\n') ||
          recognition ||
          'Highlight the beneficiary’s top 3-5 contributions with concrete metrics, adoption, recognition, or third-party validation.',
      },
      {
        id: 'future',
        label: 'Future focus',
        content:
          futureFocus ||
          'Explain the future U.S. endeavor and how it extends the beneficiary’s prior achievements and field leadership.',
      },
    ],
    suggestedNextSteps: [
      'Replace placeholder narrative with polished third-person prose and metrics.',
      'Check that the bio uses the same field definition and case theme as the intake questionnaire.',
      `Source materials reviewed:\n${formatSourceMaterials(sourceDocuments)}`,
    ],
  };
}

function buildMasterCvFallback(
  config: DocumentBuilderSlotConfig,
  answers: DocumentBuilderAnswers,
  sourceDocuments: SourceDocumentSummary[]
): GeneratedDraft {
  const headline = asString(answers.current_headline) || asString(answers.field_definition);
  const experienceEntries = asObjectArray(answers.experience_entries).length
    ? asObjectArray(answers.experience_entries)
    : asObjectArray(answers.career_timeline_entries);
  const educationEntries = asObjectArray(answers.education_entries);
  const achievements = asObjectArray(answers.signature_contributions);
  const awards = asObjectArray(answers.awards_entries).map(formatAward).filter(Boolean);
  const publications = asObjectArray(answers.scholarly_entries)
    .map((entry) =>
      joinLines([
        [asString(entry.title), asString(entry.venue)].filter(Boolean).join(' - '),
        asString(entry.date),
        asString(entry.role),
        asString(entry.citations),
      ])
    )
    .filter(Boolean);
  const speaking = asObjectArray(answers.speaking_entries)
    .map((entry) =>
      joinLines([
        [asString(entry.event), asString(entry.role)].filter(Boolean).join(' - '),
        asString(entry.date),
        asString(entry.audience),
      ])
    )
    .filter(Boolean);

  return {
    title: config.shortLabel,
    summary: 'Editable master CV/resume draft with reusable chronology and achievements.',
    sections: [
      {
        id: 'summary',
        label: 'Summary',
        content:
          joinLines([headline, asString(answers.field_positioning), asString(answers.us_endeavor)]) ||
          'Add a concise professional summary with niche, scope, and current focus.',
      },
      {
        id: 'experience',
        label: 'Experience',
        content:
          experienceEntries.map(formatTimelineEntry).filter(Boolean).join('\n\n') ||
          'List roles in reverse chronological order with dates, titles, organizations, and high-impact bullets.',
      },
      {
        id: 'education',
        label: 'Education',
        content:
          educationEntries
            .map((entry) =>
              joinLines([
                [asString(entry.institution), asString(entry.degree) || asString(entry.program)].filter(Boolean).join(' - '),
                [asString(entry.startDate), asString(entry.endDate) || asString(entry.date)].filter(Boolean).join(' - '),
                asString(entry.notes),
              ])
            )
            .filter(Boolean)
            .join('\n\n') || 'Add education, degrees, and notable distinctions.',
      },
      {
        id: 'selectedAchievements',
        label: 'Selected achievements',
        content:
          [
            achievements.map(formatAchievement).filter(Boolean).join('\n\n'),
            awards.length ? `Awards\n${awards.join('\n\n')}` : '',
            publications.length ? `Publications\n${publications.join('\n\n')}` : '',
            speaking.length ? `Speaking\n${speaking.join('\n\n')}` : '',
          ]
            .filter(Boolean)
            .join('\n\n') || 'Add signature achievements, awards, publications, and speaking items relevant to the case.',
      },
    ],
    suggestedNextSteps: [
      'Normalize dates and organization names against supporting documents.',
      'Convert dense narrative into resume-style impact bullets where appropriate.',
      `Linked source materials:\n${formatSourceMaterials(sourceDocuments)}`,
    ],
  };
}

function buildEmploymentHistoryFallback(
  config: DocumentBuilderSlotConfig,
  answers: DocumentBuilderAnswers,
  sourceDocuments: SourceDocumentSummary[]
): GeneratedDraft {
  const employmentEntries = asObjectArray(answers.employment_entries).length
    ? asObjectArray(answers.employment_entries)
    : asObjectArray(answers.career_timeline_entries);
  const notes = asString(answers.timeline_notes) || asString(answers.career_timeline_notes);

  return {
    title: config.shortLabel,
    summary: 'Structured employment chronology aligned with the intake timeline and CV data.',
    sections: [
      {
        id: 'chronology',
        label: 'Employment chronology',
        content:
          employmentEntries.map(formatTimelineEntry).filter(Boolean).join('\n\n') ||
          'Add each employer, title, dates, and location in chronological order.',
      },
      {
        id: 'highlights',
        label: 'Role highlights',
        content:
          employmentEntries
            .map((entry) =>
              joinLines([
                [asString(entry.title), asString(entry.organization)].filter(Boolean).join(' - '),
                asString(entry.summary) || asString(entry.impact),
              ])
            )
            .filter(Boolean)
            .join('\n\n') || 'Capture the responsibilities and high-impact outputs for each major role.',
      },
      {
        id: 'notes',
        label: 'Gap / overlap notes',
        content: notes || 'Explain any date gaps, overlaps, contract roles, or title changes here.',
      },
    ],
    suggestedNextSteps: [
      'Verify month/year consistency against the master CV, LinkedIn, and employment letters.',
      'Call out title changes or overlapping consulting engagements explicitly.',
      `Supporting source materials:\n${formatSourceMaterials(sourceDocuments)}`,
    ],
  };
}

function buildAwardsHonorsFallback(
  config: DocumentBuilderSlotConfig,
  answers: DocumentBuilderAnswers,
  sourceDocuments: SourceDocumentSummary[]
): GeneratedDraft {
  const awardEntries = asObjectArray(answers.award_entries).length
    ? asObjectArray(answers.award_entries)
    : asObjectArray(answers.awards_entries);
  const criteriaSignals = asStringArray(answers.criteria_signals);

  return {
    title: config.shortLabel,
    summary: 'Curated awards tracker emphasizing selectivity, proof, and strategic relevance.',
    sections: [
      {
        id: 'catalog',
        label: 'Awards catalog',
        content:
          awardEntries.map(formatAward).filter(Boolean).join('\n\n') ||
          'List each award with issuer, date, competitiveness, and supporting proof.',
      },
      {
        id: 'strengthNotes',
        label: 'Strength notes',
        content:
          criteriaSignals.length > 0
            ? `Existing criteria signals mention:\n- ${criteriaSignals.join('\n- ')}`
            : 'Note which awards are nationally or internationally recognized, selective, and independently verifiable.',
      },
      {
        id: 'evidenceNeeds',
        label: 'Evidence needs',
        content:
          awardEntries
            .map((entry) =>
              joinLines([
                asString(entry.name),
                asString(entry.evidence) ? `Current proof: ${asString(entry.evidence)}` : 'Add certificates, criteria, or winner announcements.',
              ])
            )
            .filter(Boolean)
            .join('\n\n') || 'Track what proof is still needed for each award: certificate, criteria, recipient count, or reputation evidence.',
      },
    ],
    suggestedNextSteps: [
      'Prioritize independent, selective awards over internal recognition.',
      'Add issuer reputation and recipient-count proof for the strongest awards.',
      `Linked materials:\n${formatSourceMaterials(sourceDocuments)}`,
    ],
  };
}

function buildEvidenceTrackerFallback(
  config: DocumentBuilderSlotConfig,
  answers: DocumentBuilderAnswers,
  sourceDocuments: SourceDocumentSummary[]
): GeneratedDraft {
  const inventoryEntries = asObjectArray(answers.inventory_entries).length
    ? asObjectArray(answers.inventory_entries)
    : asObjectArray(answers.evidence_inventory_entries);
  const knownGaps = asString(answers.known_gaps);
  const weaknesses = asString(answers.weaknesses_risks);
  const missingItems = inventoryEntries.filter((entry) =>
    ['need', 'missing', 'draft'].some((token) => asString(entry.status).toLowerCase().includes(token))
  );

  return {
    title: config.shortLabel,
    summary: 'Operational evidence inventory linking current documents, status, and follow-up actions.',
    sections: [
      {
        id: 'inventory',
        label: 'Inventory',
        content:
          inventoryEntries.map(formatEvidenceInventoryEntry).filter(Boolean).join('\n\n') ||
          'List each known document or evidence item, what it supports, where it lives, and its current status.',
      },
      {
        id: 'gaps',
        label: 'Missing evidence',
        content:
          joinLines([
            missingItems.length
              ? missingItems.map(formatEvidenceInventoryEntry).join('\n\n')
              : '',
            knownGaps,
            weaknesses,
          ]) || 'Capture missing, weak, or draft-only evidence here.',
      },
      {
        id: 'nextActions',
        label: 'Next actions',
        content:
          missingItems
            .map((entry) =>
              joinLines([
                asString(entry.item) || asString(entry.name),
                asString(entry.nextStep) || `Collect or clean up evidence supporting ${asString(entry.supports) || 'the relevant criterion'}.`,
              ])
            )
            .filter(Boolean)
            .join('\n\n') || 'Add concrete follow-up steps for any missing or incomplete evidence.',
      },
    ],
    suggestedNextSteps: [
      'Keep this tracker aligned with actual uploaded files and generated drafts.',
      'Mark draft-only or weak evidence clearly so the team can triage what needs corroboration.',
      `Current linked materials:\n${formatSourceMaterials(sourceDocuments)}`,
    ],
  };
}

function getSlotSpecificPrompt(slotType: string): string {
  switch (slotType) {
    case 'beneficiary_master_bio':
      return 'Write a polished 1-2 page third-person professional bio emphasizing trajectory, expertise, acclaim signals, and future U.S. work. Keep it narrative, not bullet-heavy.';
    case 'master_cv_resume':
      return 'Produce an editable master CV/resume draft with chronology, experience, education, and selected achievements. Favor structured, reusable content over visual formatting.';
    case 'employment_history_sheet':
      return 'Produce a clean employment chronology with consistent dates, organizations, titles, and concise impact notes. Flag any gap or overlap notes separately.';
    case 'awards_honors_list':
      return 'Produce a selective awards tracker that records issuer, date, competitiveness, evidence strength, and why each award matters strategically.';
    case 'document_inventory_evidence_tracker':
      return 'Produce an operational evidence tracker that links each evidence item to what it supports, current location/status, and follow-up actions.';
    default:
      return 'Tailor the draft to the specific document template and preserve reusable structure.';
  }
}

function hasUsableAiConfig(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return Boolean(key && key !== 'your-openai-api-key');
}

const EB1A_CRITERIA_LABELS: Record<string, string> = {
  C1: 'Awards (nationally/internationally recognized)',
  C2: 'Membership (associations requiring outstanding achievement)',
  C3: 'Published material about the beneficiary',
  C4: 'Judging the work of others',
  C5: 'Original contributions of major significance',
  C6: 'Scholarly articles / authorship',
  C7: 'Leading or critical role',
  C8: 'High salary or remuneration',
  C9: 'Commercial success (performing arts)',
  C10: 'Other comparable evidence',
};

function buildIntakeStrategySummaryFallback(
  answers: DocumentBuilderAnswers | undefined
): IntakeStrategySummary {
  const a = answers ?? {};
  const criteriaSignals = Array.isArray(a.criteria_signals) ? a.criteria_signals as string[] : [];
  const knownGaps = typeof a.known_gaps === 'string' ? (a.known_gaps as string).trim() : '';
  const weaknesses = typeof a.weaknesses_risks === 'string' ? (a.weaknesses_risks as string).trim() : '';
  const finalTheme = typeof a.final_strategy_theme === 'string' ? (a.final_strategy_theme as string).trim() : '';
  const fieldDef = typeof a.field_definition === 'string' ? (a.field_definition as string).trim() : '';

  const criteriaMap: Record<string, string> = {
    'Awards (C1)': 'C1',
    'Memberships (C2)': 'C2',
    'Published material about you (C3)': 'C3',
    'Judging (C4)': 'C4',
    'Original contributions (C5)': 'C5',
    'Scholarly articles (C6)': 'C6',
    'Leading/critical role (C7)': 'C7',
    'High salary (C8)': 'C8',
    'Commercial success (C9)': 'C9',
  };
  const strongCriteria: string[] = [];
  const weakCriteria: string[] = [];
  const allCriteria = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'];
  criteriaSignals.forEach((label) => {
    const c = criteriaMap[label] || (label.startsWith('C') ? label : null);
    if (c && allCriteria.includes(c)) {
      strongCriteria.push(EB1A_CRITERIA_LABELS[c] ?? c);
    }
  });
  allCriteria.forEach((c) => {
    const label = EB1A_CRITERIA_LABELS[c];
    if (label && !strongCriteria.includes(label)) weakCriteria.push(label);
  });

  const axisHint = fieldDef
    ? fieldDef.slice(0, 80) + (fieldDef.length > 80 ? '...' : '')
    : 'Unclear from responses—complete Field Definition section.';
  const missingEvidence: string[] = [];
  if (knownGaps) missingEvidence.push(knownGaps);
  if (weaknesses) missingEvidence.push(weaknesses);
  if (missingEvidence.length === 0) missingEvidence.push('Review evidence inventory and self-assessment for gaps.');

  const riskFactors: string[] = [];
  if (weakCriteria.length > 5) riskFactors.push('Many criteria have limited evidence; consider focusing on 3–4 strongest.');
  if (!finalTheme) riskFactors.push('Case theme not yet defined; complete Final Strategy Questions.');

  const strategyNotes: string[] = [];
  if (finalTheme) strategyNotes.push(`Proposed theme: ${finalTheme}`);
  if (strongCriteria.length > 0) strategyNotes.push(`Likely strong criteria: ${strongCriteria.slice(0, 4).join(', ')}.`);
  strategyNotes.push('Complete critical sections (identity, field, career, achievements, evidence inventory, gaps) for a fuller strategy analysis.');

  return {
    probableCaseAxis: axisHint,
    likelyStrongCriteria: strongCriteria.length > 0 ? strongCriteria : ['Complete questionnaire to infer.'],
    likelyWeakCriteria: weakCriteria.length > 0 ? weakCriteria : ['Complete self-assessment to infer.'],
    missingEvidence: missingEvidence.length > 0 ? missingEvidence : ['Not yet summarized.'],
    riskFactors: riskFactors.length > 0 ? riskFactors : ['None identified from current answers.'],
    strategyNotes,
  };
}

function buildIntakeReusableDataset(answers: DocumentBuilderAnswers | undefined): IntakeReusableDataset {
  const a = answers ?? {};
  return {
    basicIdentity: {
      legal_name: a.legal_name,
      date_of_birth: a.date_of_birth,
      citizenship: a.citizenship,
      current_status: a.current_status,
      case_overview_summary: a.case_overview_summary,
    },
    fieldDefinition: {
      field_definition: a.field_definition,
      field_positioning: a.field_positioning,
    },
    careerTimeline: {
      career_timeline_entries: a.career_timeline_entries,
      career_timeline_notes: a.career_timeline_notes,
    },
    coreAchievements: {
      signature_contributions: a.signature_contributions,
    },
    criteriaSignals: {
      criteria_signals: a.criteria_signals,
      criteria_self_assessment: a.criteria_self_assessment,
    },
    usIntent: {
      us_endeavor: a.us_endeavor,
    },
    evidenceInventory: {
      evidence_inventory_entries: a.evidence_inventory_entries,
    },
    weaknessesGaps: {
      known_gaps: a.known_gaps,
      weaknesses_risks: a.weaknesses_risks,
    },
  };
}

async function generateIntakeDraftAndStrategy(
  config: DocumentBuilderSlotConfig,
  answers: DocumentBuilderAnswers | undefined,
  sourceDocuments: SourceDocumentSummary[],
  priorDocuments: Array<{
    slotType: string;
    status?: string;
    answers?: DocumentBuilderAnswers;
    draftJson?: DocumentDraftPayload | null;
    draftText?: string | null;
    completedAt?: string | Date | null;
  }>
): Promise<GeneratedIntakeDraft> {
  const draft = hasUsableAiConfig()
    ? await (async () => {
        const base = await generateDocumentDraftInternal(config, answers, sourceDocuments, priorDocuments);
        return base;
      })()
    : buildFallbackDraft(config, answers, sourceDocuments, priorDocuments);

  let strategySummary: IntakeStrategySummary;
  if (hasUsableAiConfig()) {
    const aiGateway = new AIGateway();
    const answerDigest = buildAnswerDigest(answers, config);
    try {
      const result = await aiGateway.chatWithJSON<IntakeStrategySummary>({
        systemPrompt: [
          'You are an EB1A case strategy analyst. Based on intake questionnaire answers, return a JSON object with:',
          'probableCaseAxis (string: e.g. founder/entrepreneur, researcher/scientist, executive, artist, educator, hybrid/unclear)',
          'likelyStrongCriteria (array of strings: criteria that appear well-supported)',
          'likelyWeakCriteria (array of strings: criteria with little or no evidence)',
          'missingEvidence (array of strings: what the applicant likely still needs)',
          'riskFactors (array of strings: case weaknesses, gaps, red flags)',
          'strategyNotes (array of strings: high-level positioning and next steps).',
          'Do not provide legal advice or outcome predictions. Be concise.',
        ].join(' '),
        messages: [
          {
            role: 'user',
            content: `Intake questionnaire answer digest:\n${answerDigest}\n\nDerive strategy summary from the above.`,
          },
        ],
        temperature: 0.3,
        maxTokens: 1200,
      });
      if (
        result &&
        typeof result.probableCaseAxis === 'string' &&
        Array.isArray(result.likelyStrongCriteria) &&
        Array.isArray(result.likelyWeakCriteria) &&
        Array.isArray(result.missingEvidence) &&
        Array.isArray(result.riskFactors) &&
        Array.isArray(result.strategyNotes)
      ) {
        strategySummary = result;
      } else {
        strategySummary = buildIntakeStrategySummaryFallback(answers);
      }
    } catch {
      strategySummary = buildIntakeStrategySummaryFallback(answers);
    }
  } else {
    strategySummary = buildIntakeStrategySummaryFallback(answers);
  }

  const reusableDataset = buildIntakeReusableDataset(answers);
  return {
    ...draft,
    strategySummary,
    reusableDataset,
  };
}

async function generateDocumentDraftInternal(
  config: DocumentBuilderSlotConfig,
  answers: DocumentBuilderAnswers | undefined,
  sourceDocuments: SourceDocumentSummary[],
  priorDocuments: Array<{
    slotType: string;
    status?: string;
    answers?: DocumentBuilderAnswers;
    draftJson?: DocumentDraftPayload | null;
    draftText?: string | null;
    completedAt?: string | Date | null;
  }>
): Promise<GeneratedDraft> {
  if (!hasUsableAiConfig()) {
    return buildFallbackDraft(config, answers, sourceDocuments, priorDocuments);
  }
  try {
    const aiGateway = new AIGateway();
    const resolvedAnswers = resolveBuilderAnswers(config, answers, priorDocuments);
    const answerDigest = buildAnswerDigest(resolvedAnswers, config);
    const priorContext = buildPriorContext(priorDocuments);
    const result = await aiGateway.chatWithJSON<GeneratedDraft>({
      systemPrompt: [
        'You generate structured drafts for EB1A document builders.',
        'Use a professional, factual tone.',
        'Return JSON with title, summary, sections[], and suggestedNextSteps[].',
        'Each section must have id, label, and content.',
        'Use prior builder context, especially any reusableDataset or strategySummary, when it helps keep facts consistent.',
        'Do not provide legal advice or outcome predictions.',
        getSlotSpecificPrompt(config.slotType),
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: JSON.stringify(
            {
              config: {
                shortLabel: config.shortLabel,
                purpose: config.purpose,
                outputSections: config.outputSections,
              },
              answers: resolvedAnswers,
              answerDigest,
              sourceDocuments,
              priorDocuments: priorContext,
            },
            null,
            2
          ),
        },
      ],
      temperature: 0.3,
      maxTokens: 2500,
    });
    if (!result?.sections?.length) return buildFallbackDraft(config, resolvedAnswers, sourceDocuments, priorDocuments);
    return normalizeGeneratedDraft(result);
  } catch (error) {
    console.error('Document builder AI generation failed, using fallback draft:', error);
    return buildFallbackDraft(config, answers, sourceDocuments, priorDocuments);
  }
}

export type GeneratedDraftResult = GeneratedDraft & {
  strategySummary?: IntakeStrategySummary;
  reusableDataset?: IntakeReusableDataset;
};

export async function generateDocumentDraft({
  slotType,
  answers,
  sourceDocuments = [],
  priorDocuments = [],
  caseContext,
}: GenerateDocumentDraftInput): Promise<GeneratedDraftResult> {
  const config = DOCUMENT_ASSISTANT_BUILDER_MAP[slotType];
  if (!config) {
    throw new Error(`Unsupported builder slot: ${slotType}`);
  }

  if (slotType === 'intake_questionnaire') {
    return generateIntakeDraftAndStrategy(config, answers, sourceDocuments, priorDocuments);
  }

  if (slotType === 'cover_letter_draft') {
    if (!caseContext) {
      throw new Error('Cover letter generation requires case context (case record, documents, prior documents)');
    }
    const result = await generateCoverLetterDraft({
      caseContext,
      answers: answers ?? {},
    });
    if ('blocked' in result) {
      return {
        title: 'Cover Letter / Legal Brief Draft',
        summary: 'Generation blocked. See blocked result for required actions.',
        sections: [],
        suggestedNextSteps: result.blocked.requiredNextActions ?? [],
        coverLetterBlocked: result.blocked,
      };
    }
    return normalizeGeneratedDraft({
      ...result.draft,
      suggestedNextSteps: result.draft.suggestedNextSteps ?? [],
    });
  }

  return generateDocumentDraftInternal(config, answers, sourceDocuments, priorDocuments);
}

export function renderDraftText(draft: GeneratedDraft): string {
  const payload = draft as DocumentDraftPayload & { coverLetterBlocked?: import('@aipas/shared').CoverLetterBlockedResult };
  if (payload.coverLetterBlocked) {
    const b = payload.coverLetterBlocked;
    return [
      '# Cover Letter Generation Blocked',
      '',
      `**Overall status:** ${b.status}`,
      '',
      `**Why generation is blocked:** ${b.whyBlocked}`,
      '',
      '## Missing required inputs',
      ...(b.missingRequiredInputs.length ? b.missingRequiredInputs.map((i) => `- ${i}`) : ['- None']),
      '',
      '## Missing required evidence',
      ...(b.missingRequiredEvidence.length ? b.missingRequiredEvidence.map((e) => `- ${e}`) : ['- None']),
      '',
      '## Critical deficiencies',
      ...(b.criticalDeficiencies.length ? b.criticalDeficiencies.map((c) => `- ${c}`) : ['- None']),
      '',
      '## Required next actions before generation can proceed',
      ...b.requiredNextActions.map((a) => `- ${a}`),
      '',
      ...(b.missingInputWarnings?.length
        ? ['## Missing input warnings', ...b.missingInputWarnings.map((w) => `- ${w}`), '']
        : []),
      ...(b.weakEvidenceWarnings?.length
        ? ['## Weak evidence warnings', ...b.weakEvidenceWarnings.map((w) => `- ${w}`), '']
        : []),
      ...(b.recommendedNextDocuments?.length
        ? ['## Recommended next documents/actions', ...b.recommendedNextDocuments.map((d) => `- ${d}`)]
        : []),
    ]
      .filter(Boolean)
      .join('\n');
  }
  const normalizedDraft = normalizeGeneratedDraft(draft);
  return [
    `# ${normalizedDraft.title}`,
    '',
    normalizedDraft.summary,
    '',
    ...normalizedDraft.sections.flatMap((section) => [`## ${section.label}`, section.content, '']),
    '## Suggested Next Steps',
    ...normalizedDraft.suggestedNextSteps.map((step) => `- ${step}`),
  ].join('\n');
}
