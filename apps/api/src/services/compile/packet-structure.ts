import {
  CRITERIA,
  normalizeCategory,
  type CriterionId,
  type DocumentMetadata,
  type DocumentReviewFinalStatus,
} from '@aipas/shared';
import type {
  CompileCaseContext,
  CompileOptions,
  CompileSourceDocument,
  PacketEvidenceRole,
  PacketItem,
  PacketPlan,
  PacketSectionCode,
  PacketSectionDefinition,
} from './types';

const PACKET_SECTIONS: PacketSectionDefinition[] = [
  {
    code: 'A',
    title: 'Section A — Filing Core',
    description: 'Administrative filing materials.',
    order: 1,
  },
  {
    code: 'B',
    title: 'Section B — Legal Brief / TOC / Positioning',
    description: 'Case framing, legal briefing, and packet navigation.',
    order: 2,
  },
  {
    code: 'C',
    title: 'Section C — Identity / Status / Core Personal Documents',
    description: 'Core personal, status, and background documents.',
    order: 3,
  },
  {
    code: 'D',
    title: 'Section D — Criterion Evidence',
    description: 'Primary substantive evidence by criterion.',
    order: 4,
  },
  {
    code: 'E',
    title: 'Section E — Expert / Recommendation Letters',
    description: 'Expert and recommendation letter materials.',
    order: 5,
  },
  {
    code: 'F',
    title: 'Section F — Review / QA / Internal Support',
    description: 'Review, QA, and internal support materials.',
    order: 6,
  },
];

const SECTION_CATEGORY_MAP = {
  'Forms & Fees': 'A',
  'Cover Letter / Legal Brief': 'B',
  'Identity & Status': 'C',
  'Case Intake & Profile': 'C',
  'Translations': 'C',
  'Evidence (Criteria)': 'D',
  'Comparable Evidence': 'D',
  'Expert Letters': 'E',
  'AI Insights': 'F',
  'Responses to USCIS (RFE/NOID)': 'F',
  'Filing & Tracking': 'F',
} as const;

const PRIMARY_EVIDENCE_SLOTS = new Set([
  'evidence_awards_certificates',
  'evidence_awards_announcement',
  'evidence_memberships_confirmation',
  'evidence_published_articles',
  'evidence_judging_invitations',
  'evidence_judging_assignments',
  'evidence_judging_confirmation',
  'evidence_judging_proof',
  'evidence_contributions_impact',
  'evidence_contributions_metrics',
  'evidence_contributions_patents',
  'evidence_contributions_technical',
  'evidence_scholarly_articles',
  'evidence_scholarly_citations',
  'evidence_leading_verification',
  'evidence_leading_role_proof',
  'evidence_salary_contracts',
  'evidence_salary_pay_records',
  'evidence_commercial_reports',
  'evidence_commercial_rankings',
  'evidence_commercial_press',
  'industry_standards_benchmarks',
  'market_impact_proof',
  'revenue_sales_metrics_proof',
  'user_customer_adoption',
  'independent_third_party_validation',
  'competition_selectivity_proof',
  'media_industry_recognition',
  'comparable_role_title_evidence',
  'peer_comparisons_top_percent',
  'contracts_elite_demand',
  'portfolio_work_product_samples',
]);

const SUPPORTING_EVIDENCE_SLOTS = new Set([
  'evidence_awards_criteria',
  'evidence_awards_reputation',
  'evidence_memberships_requirements',
  'evidence_memberships_reputation',
  'evidence_published_metadata',
  'evidence_published_circulation',
  'evidence_scholarly_confirmations',
  'evidence_scholarly_venue',
  'evidence_leading_reputation',
  'evidence_leading_org_charts',
  'evidence_salary_benchmarks',
  'comparable_explanation',
  'expert_letter_signed',
  'expert_letter_editable',
  'expert_cv_resume',
  'expert_bio_profile_proof',
  'expert_credentials_evidence',
  'relationship_independence_statement',
  'letter_request_packet',
  'supporting_materials_to_expert',
  'expert_communication_record',
  'expert_notarization',
]);

type BucketDefinition = {
  code: string;
  title: string;
  slotTypes?: string[];
  nameIncludes?: string[];
};

function normalizeNameStem(value: string): string {
  return value
    .trim()
    .replace(/\.[A-Za-z0-9]+$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const SECTION_A_BUCKETS: BucketDefinition[] = [
  { code: 'A-1', title: 'Form G-1145', slotTypes: ['form_g1145'] },
  {
    code: 'A-2',
    title: 'Filing Fee Proof',
    slotTypes: [
      'payment_method_proof',
      'filing_fee_worksheet',
      'filing_fee_proof',
      'fee_receipt_bank_confirmation',
    ],
  },
  {
    code: 'A-3',
    title: 'Form I-140',
    slotTypes: ['form_i140_final', 'form_i140_draft', 'final_forms_set'],
  },
  {
    code: 'A-4',
    title: 'Form I-907',
    slotTypes: ['form_i907', 'i907_filed_copy', 'premium_receipt_pp_clock', 'premium_email_notifications'],
  },
  {
    code: 'A-5',
    title: 'Other Filing Core Materials',
    slotTypes: [
      'uscis_filing_address_confirmation',
      'delivery_label_courier_sheet',
      'signed_client_declaration',
      'g28_filed_copy',
      'g28_receipt_acceptance',
    ],
  },
];

const SECTION_B_BUCKETS: BucketDefinition[] = [
  {
    code: 'B-1',
    title: 'Cover Letter / Legal Brief',
    slotTypes: ['cover_letter_legal_brief_final', 'cover_letter_legal_brief_editable', 'final_cover_letter'],
  },
  {
    code: 'B-2',
    title: 'Table of Contents',
    slotTypes: ['table_of_contents_final'],
  },
  {
    code: 'B-3',
    title: 'Case Axis / Positioning Summary',
    nameIncludes: ['case axis', 'positioning summary'],
  },
  {
    code: 'B-4',
    title: 'Proposed Endeavor Summary',
    nameIncludes: ['proposed endeavor'],
  },
  {
    code: 'B-5',
    title: 'Overall Merits Summary',
    nameIncludes: ['overall merits'],
  },
];

const SECTION_C_BUCKETS: BucketDefinition[] = [
  {
    code: 'C-1',
    title: 'Passport',
    slotTypes: ['passport_biographic_page'],
  },
  {
    code: 'C-2',
    title: 'Visa / I-94 / Status Documents',
    slotTypes: [
      'us_visa_stamps',
      'form_i94',
      'i797_notices',
      'current_status_document_set',
      'ead_card',
      'advance_parole',
      'prior_uscis_filings',
      'entry_exit_travel_history',
      'birth_certificate',
      'marriage_cert_name_change',
      'court_police_dispositions',
    ],
  },
  {
    code: 'C-3',
    title: 'CV / Resume',
    slotTypes: ['master_cv_resume'],
  },
  {
    code: 'C-4',
    title: 'Beneficiary Bio',
    slotTypes: ['beneficiary_master_bio'],
  },
  {
    code: 'C-5',
    title: 'Education / Employment History Sheets',
    slotTypes: ['employment_history_sheet', 'education_history_sheet'],
  },
  {
    code: 'C-6',
    title: 'Translation Certifications',
    slotTypes: ['certified_translation', 'translator_certificate', 'source_document_original', 'translation_qa_notes'],
  },
  {
    code: 'C-7',
    title: 'Core Personal Support Materials',
    slotTypes: [
      'intake_questionnaire',
      'awards_honors_list',
      'publications_list',
      'media_press_mentions_list',
      'speaking_conferences_list',
      'memberships_list',
      'judging_peer_review_list',
      'patents_products_projects_list',
      'reference_contacts_list',
      'case_notes_gaps_log',
      'document_inventory_evidence_tracker',
    ],
  },
];

const SECTION_F_BUCKETS: BucketDefinition[] = [
  {
    code: 'F-1',
    title: 'Exhibit Index',
    slotTypes: ['exhibit_list_index_final', 'final_toc_exhibit_list', 'exhibit_map_cross_reference'],
  },
  {
    code: 'F-2',
    title: 'Officer-Style Review Report',
    nameIncludes: ['officer review', 'eer', 'review report'],
  },
  {
    code: 'F-3',
    title: 'Document Review Reports',
  },
  {
    code: 'F-4',
    title: 'Final QA Checklist',
    nameIncludes: ['qa checklist', 'final qa', 'checklist'],
  },
  {
    code: 'F-5',
    title: 'Other Internal Support',
  },
];

function getSectionDefinition(code: PacketSectionCode): PacketSectionDefinition {
  const found = PACKET_SECTIONS.find((section) => section.code === code);
  if (!found) {
    throw new Error(`Unknown packet section ${code}`);
  }
  return found;
}

function getSlotType(document: CompileSourceDocument): string {
  return (document.metadata as DocumentMetadata | null | undefined)?.slotType?.trim() ?? '';
}

function isReviewArtifact(document: CompileSourceDocument): boolean {
  const metadata = document.metadata as DocumentMetadata | null | undefined;
  return Boolean(metadata?.reviewKind === 'document_review' || metadata?.reviewForDocumentId);
}

function parseCriterionId(value?: string | null): CriterionId | 'C-C' | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  if (trimmed === 'C-C' || trimmed === 'CC' || trimmed === 'COMPARABLE') return 'C-C';
  const direct = trimmed.match(/^C(10|[1-9])$/);
  if (direct) return direct[0] as CriterionId;
  const embedded = trimmed.match(/C(?:RITERION)?\s*(10|[1-9])/);
  return embedded ? (`C${embedded[1]}` as CriterionId) : null;
}

function inferCriterionId(document: CompileSourceDocument): CriterionId | 'C-C' | null {
  const reviewCriterion = parseCriterionId(document.metadata?.documentReview?.relatedCriterion);
  if (reviewCriterion) return reviewCriterion;

  if (document.category === 'Comparable Evidence') return 'C-C';
  const category = normalizeCategory(document.category);
  if (category === 'Comparable Evidence') return 'C-C';

  const slotType = getSlotType(document);
  const slotCriterionMap: Array<[string, CriterionId]> = [
    ['evidence_awards_', 'C1'],
    ['evidence_memberships_', 'C2'],
    ['evidence_published_', 'C3'],
    ['evidence_judging_', 'C4'],
    ['evidence_contributions_', 'C5'],
    ['evidence_scholarly_', 'C6'],
    ['evidence_display_', 'C7'],
    ['evidence_exhibition_', 'C7'],
    ['evidence_leading_', 'C8'],
    ['evidence_salary_', 'C9'],
    ['evidence_commercial_', 'C10'],
  ];
  for (const [prefix, criterionId] of slotCriterionMap) {
    if (slotType.startsWith(prefix)) return criterionId;
  }

  const nameCriterion = parseCriterionId(document.originalName);
  return nameCriterion;
}

function getCriterionBucketCode(criterionId: CriterionId | 'C-C'): string {
  if (criterionId === 'C-C') return 'D-C';
  return `D-${criterionId.slice(1)}`;
}

function getCriterionBucketTitle(criterionId: CriterionId | 'C-C'): string {
  if (criterionId === 'C-C') return 'Comparable Evidence';
  return CRITERIA[criterionId];
}

function getEvidenceRole(document: CompileSourceDocument, sectionCode: PacketSectionCode): PacketEvidenceRole {
  if (isReviewArtifact(document)) return 'supporting';
  const slotType = getSlotType(document);

  if (sectionCode === 'D') {
    if (PRIMARY_EVIDENCE_SLOTS.has(slotType)) return 'primary';
    if (SUPPORTING_EVIDENCE_SLOTS.has(slotType)) return 'supporting';
    const finalStatus = document.metadata?.documentReview?.finalStatus;
    return finalStatus === 'usable' || finalStatus === 'weak' ? 'primary' : 'supporting';
  }

  if (sectionCode === 'E' || sectionCode === 'F' || sectionCode === 'B') return 'supporting';
  return 'primary';
}

function getReviewRank(status?: DocumentReviewFinalStatus | null): number {
  switch (status) {
    case 'usable':
      return 0;
    case 'weak':
      return 1;
    case 'needs_context':
      return 2;
    case 'irrelevant':
      return 3;
    default:
      return 4;
  }
}

function sortDocumentsForPacket(
  sectionCode: PacketSectionCode,
  documents: CompileSourceDocument[]
): CompileSourceDocument[] {
  return [...documents].sort((left, right) => {
    const roleDelta =
      (getEvidenceRole(left, sectionCode) === 'primary' ? 0 : 1) -
      (getEvidenceRole(right, sectionCode) === 'primary' ? 0 : 1);
    if (roleDelta !== 0) return roleDelta;

    const reviewDelta =
      getReviewRank(left.metadata?.documentReview?.finalStatus) -
      getReviewRank(right.metadata?.documentReview?.finalStatus);
    if (reviewDelta !== 0) return reviewDelta;

    const slotDelta = getSlotType(left).localeCompare(getSlotType(right));
    if (slotDelta !== 0) return slotDelta;

    const createdDelta = left.createdAt.getTime() - right.createdAt.getTime();
    if (createdDelta !== 0) return createdDelta;

    return left.originalName.localeCompare(right.originalName);
  });
}

function matchesBucket(document: CompileSourceDocument, bucket: BucketDefinition): boolean {
  if (bucket.code === 'F-3' && isReviewArtifact(document)) return true;
  const slotType = getSlotType(document);
  if (bucket.slotTypes?.includes(slotType)) return true;

  const lowerName = document.originalName.toLowerCase();
  if (bucket.nameIncludes?.some((token) => lowerName.includes(token))) return true;

  return false;
}

function hasBucketMatch(documents: CompileSourceDocument[], bucket: BucketDefinition): boolean {
  return documents.some((document) => matchesBucket(document, bucket));
}

function getSectionCodeForDocument(document: CompileSourceDocument): PacketSectionCode {
  if (isReviewArtifact(document)) return 'F';

  const slotType = getSlotType(document);
  if (slotType === 'table_of_contents_final') return 'B';
  if (['exhibit_list_index_final', 'final_toc_exhibit_list', 'exhibit_map_cross_reference'].includes(slotType)) return 'F';
  if (['final_cover_letter'].includes(slotType)) return 'B';
  if (
    [
      'final_forms_set',
      'filing_fee_proof',
      'fee_receipt_bank_confirmation',
      'form_i907',
      'i907_filed_copy',
      'g28_filed_copy',
      'g28_receipt_acceptance',
    ].includes(slotType)
  ) {
    return 'A';
  }

  if (document.category === 'AI Insights') return 'F';
  const category = normalizeCategory(document.category);
  return SECTION_CATEGORY_MAP[category] ?? 'F';
}

function buildBucketedItems(
  documents: CompileSourceDocument[],
  sectionCode: PacketSectionCode,
  buckets: BucketDefinition[],
  sectionTitle: string
): PacketItem[] {
  const remaining = new Set(documents.map((document) => document.id));
  const items: PacketItem[] = [];

  for (const bucket of buckets) {
    const bucketDocuments = sortDocumentsForPacket(
      sectionCode,
      documents.filter((document) => remaining.has(document.id) && matchesBucket(document, bucket))
    );

    bucketDocuments.forEach((document, index) => {
      remaining.delete(document.id);
      const exhibitCode =
        bucketDocuments.length === 1 ? bucket.code : `${bucket.code}.${index + 1}`;
      items.push({
        id: `${document.id}:${exhibitCode}`,
        sourceType: 'document',
        sectionCode,
        sectionTitle,
        bucketCode: bucket.code,
        bucketTitle: bucket.title,
        exhibitCode,
        title: document.originalName,
        evidenceRole: getEvidenceRole(document, sectionCode),
        sourceDocumentId: document.id,
        sourceOriginalName: document.originalName,
        mimeType: document.mimeType,
        review: document.metadata?.documentReview ?? null,
        pageCount: 0,
      });
    });
  }

  const fallbackBucket = buckets[buckets.length - 1];
  sortDocumentsForPacket(
    sectionCode,
    documents.filter((document) => remaining.has(document.id))
  ).forEach((document, index, list) => {
    const exhibitCode = list.length === 1 ? fallbackBucket.code : `${fallbackBucket.code}.${index + 1}`;
    items.push({
      id: `${document.id}:${exhibitCode}`,
      sourceType: 'document',
      sectionCode,
      sectionTitle,
      bucketCode: fallbackBucket.code,
      bucketTitle: fallbackBucket.title,
      exhibitCode,
      title: document.originalName,
      evidenceRole: getEvidenceRole(document, sectionCode),
      sourceDocumentId: document.id,
      sourceOriginalName: document.originalName,
      mimeType: document.mimeType,
      review: document.metadata?.documentReview ?? null,
      pageCount: 0,
    });
  });

  return items;
}

function buildExpertLetterItems(documents: CompileSourceDocument[], sectionTitle: string): PacketItem[] {
  return sortDocumentsForPacket('E', documents).map((document, index) => ({
    id: `${document.id}:E-${index + 1}`,
    sourceType: 'document',
    sectionCode: 'E',
    sectionTitle,
    bucketCode: `E-${index + 1}`,
    bucketTitle: 'Expert / Recommendation Letters',
    exhibitCode: `E-${index + 1}`,
    title: document.originalName,
    evidenceRole: 'supporting',
    sourceDocumentId: document.id,
    sourceOriginalName: document.originalName,
    mimeType: document.mimeType,
    review: document.metadata?.documentReview ?? null,
    pageCount: 0,
  }));
}

function buildCriterionItems(
  documents: CompileSourceDocument[],
  allowedCriteria: string[],
  sectionTitle: string
): PacketItem[] {
  const criterionOrder = [...allowedCriteria].sort((left, right) => {
    const leftParsed = left === 'C-C' ? 999 : Number.parseInt(left.slice(1), 10);
    const rightParsed = right === 'C-C' ? 999 : Number.parseInt(right.slice(1), 10);
    return leftParsed - rightParsed;
  });

  const items: PacketItem[] = [];
  for (const criterionId of criterionOrder) {
    const typedCriterion = criterionId as CriterionId | 'C-C';
    const criterionDocuments = sortDocumentsForPacket(
      'D',
      documents.filter((document) => inferCriterionId(document) === typedCriterion)
    );
    const bucketCode = getCriterionBucketCode(typedCriterion);
    const bucketTitle = getCriterionBucketTitle(typedCriterion);

    criterionDocuments.forEach((document, index) => {
      items.push({
        id: `${document.id}:${bucketCode}.${index + 1}`,
        sourceType: 'document',
        sectionCode: 'D',
        sectionTitle,
        bucketCode,
        bucketTitle,
        exhibitCode: `${bucketCode}.${index + 1}`,
        title: document.originalName,
        evidenceRole: getEvidenceRole(document, 'D'),
        sourceDocumentId: document.id,
        sourceOriginalName: document.originalName,
        mimeType: document.mimeType,
        review: document.metadata?.documentReview ?? null,
        criterionId: typedCriterion,
        packetSubsectionCode: bucketCode as PacketItem['packetSubsectionCode'],
        packetSubsectionTitle: bucketTitle,
        pageCount: 0,
      });
    });
  }

  return items;
}

function buildOverallMeritsSummary(caseRecord: CompileCaseContext, documents: CompileSourceDocument[]): string {
  const reviewed = documents.filter((document) => document.metadata?.documentReview);
  const usable = reviewed.filter((document) => document.metadata?.documentReview?.finalStatus === 'usable').length;
  const weak = reviewed.filter((document) => document.metadata?.documentReview?.finalStatus === 'weak').length;
  const needsContext = reviewed.filter(
    (document) => document.metadata?.documentReview?.finalStatus === 'needs_context'
  ).length;

  return [
    'Overall Merits Summary',
    '',
    `Selected criteria: ${caseRecord.criteriaSelected.length ? caseRecord.criteriaSelected.join(', ') : 'None selected'}`,
    `Reviewed documents: ${reviewed.length}`,
    `Usable reviewed documents: ${usable}`,
    `Weak reviewed documents: ${weak}`,
    `Needs-context reviewed documents: ${needsContext}`,
    '',
    'This generated summary is a compile-time structural aid for officer packet review. It does not replace legal analysis.',
  ].join('\n');
}

function buildOfficerReviewSummary(caseRecord: CompileCaseContext): string | null {
  if (!caseRecord.latestEer?.executiveSummary) return null;

  return [
    'Officer-Style Review Report',
    '',
    caseRecord.latestEer.executiveSummary,
    '',
    `Generated at: ${caseRecord.latestEer.createdAt?.toISOString() ?? 'Unknown'}`,
  ].join('\n');
}

function buildGeneratedItems(
  caseRecord: CompileCaseContext,
  documents: CompileSourceDocument[],
  options: CompileOptions
): PacketItem[] {
  const items: PacketItem[] = [];

  if (options.includeTOC && !hasBucketMatch(documents.filter((document) => getSectionCodeForDocument(document) === 'B'), SECTION_B_BUCKETS[1])) {
    items.push({
      id: 'generated:B-2',
      sourceType: 'generated',
      sectionCode: 'B',
      sectionTitle: getSectionDefinition('B').title,
      bucketCode: 'B-2',
      bucketTitle: 'Table of Contents',
      exhibitCode: 'B-2',
      title: 'Table of Contents',
      evidenceRole: 'supporting',
      generatedText: '',
      pageCount: 0,
    });
  }

  if (
    caseRecord.caseAxisStatement?.trim() &&
    !hasBucketMatch(documents.filter((document) => getSectionCodeForDocument(document) === 'B'), SECTION_B_BUCKETS[2])
  ) {
    items.push({
      id: 'generated:B-3',
      sourceType: 'generated',
      sectionCode: 'B',
      sectionTitle: getSectionDefinition('B').title,
      bucketCode: 'B-3',
      bucketTitle: 'Case Axis / Positioning Summary',
      exhibitCode: 'B-3',
      title: 'Case Axis / Positioning Summary',
      evidenceRole: 'supporting',
      generatedText: `Case Axis / Positioning Summary\n\n${caseRecord.caseAxisStatement.trim()}`,
      pageCount: 0,
    });
  }

  if (
    caseRecord.proposedEndeavor?.trim() &&
    !hasBucketMatch(documents.filter((document) => getSectionCodeForDocument(document) === 'B'), SECTION_B_BUCKETS[3])
  ) {
    items.push({
      id: 'generated:B-4',
      sourceType: 'generated',
      sectionCode: 'B',
      sectionTitle: getSectionDefinition('B').title,
      bucketCode: 'B-4',
      bucketTitle: 'Proposed Endeavor Summary',
      exhibitCode: 'B-4',
      title: 'Proposed Endeavor Summary',
      evidenceRole: 'supporting',
      generatedText: `Proposed Endeavor Summary\n\n${caseRecord.proposedEndeavor.trim()}`,
      pageCount: 0,
    });
  }

  if (!hasBucketMatch(documents.filter((document) => getSectionCodeForDocument(document) === 'B'), SECTION_B_BUCKETS[4])) {
    items.push({
      id: 'generated:B-5',
      sourceType: 'generated',
      sectionCode: 'B',
      sectionTitle: getSectionDefinition('B').title,
      bucketCode: 'B-5',
      bucketTitle: 'Overall Merits Summary',
      exhibitCode: 'B-5',
      title: 'Overall Merits Summary',
      evidenceRole: 'supporting',
      generatedText: buildOverallMeritsSummary(caseRecord, documents),
      pageCount: 0,
    });
  }

  if (options.includeExhibitIndex) {
    items.push({
      id: 'generated:F-1',
      sourceType: 'generated',
      sectionCode: 'F',
      sectionTitle: getSectionDefinition('F').title,
      bucketCode: 'F-1',
      bucketTitle: 'Exhibit Index',
      exhibitCode: 'F-1',
      title: 'Exhibit Index',
      evidenceRole: 'supporting',
      generatedText: '',
      pageCount: 0,
    });
  }

  const officerReviewText = buildOfficerReviewSummary(caseRecord);
  if (
    officerReviewText &&
    !hasBucketMatch(documents.filter((document) => getSectionCodeForDocument(document) === 'F'), SECTION_F_BUCKETS[1])
  ) {
    items.push({
      id: 'generated:F-2',
      sourceType: 'generated',
      sectionCode: 'F',
      sectionTitle: getSectionDefinition('F').title,
      bucketCode: 'F-2',
      bucketTitle: 'Officer-Style Review Report',
      exhibitCode: 'F-2',
      title: 'Officer-Style Review Report',
      evidenceRole: 'supporting',
      generatedText: officerReviewText,
      pageCount: 0,
    });
  }

  return items;
}

function shouldSkipDocument(document: CompileSourceDocument, options: CompileOptions): boolean {
  const slotType = getSlotType(document);
  if (!options.includeForms && getSectionCodeForDocument(document) === 'A') return true;
  if (document.category === 'AI Insights') return true;
  if (
    document.metadata?.source === 'generated' &&
    document.metadata?.builderStateId &&
    !isReviewArtifact(document)
  ) {
    return true;
  }
  if (['table_of_contents_final', 'exhibit_list_index_final', 'final_toc_exhibit_list', 'exhibit_map_cross_reference', 'final_filed_i140_packet'].includes(slotType)) {
    return true;
  }
  return false;
}

function getPacketDocumentPriority(document: CompileSourceDocument): number {
  let score = 0;
  if (document.metadata?.documentReview?.reviewedAt) score += 100;
  if (document.metadata?.source === 'upload') score += 20;
  if (document.metadata?.source === 'generated') score -= 10;
  if (document.mimeType === 'application/pdf') score += 5;
  if (isReviewArtifact(document)) score += 10;
  return score;
}

function getPacketDeduplicationKey(document: CompileSourceDocument): string | null {
  if (isReviewArtifact(document)) {
    return document.metadata?.reviewForDocumentId
      ? `review:${document.metadata.reviewForDocumentId}`
      : `review-name:${normalizeNameStem(document.originalName)}`;
  }

  const category = document.category;
  if (
    ![
      'Case Intake & Profile',
      'Identity & Status',
      'Cover Letter / Legal Brief',
      'Forms & Fees',
    ].includes(category)
  ) {
    return null;
  }

  return `doc:${category}:${normalizeNameStem(document.originalName)}:${document.mimeType}`;
}

function pruneRedundantPacketDocuments(documents: CompileSourceDocument[]): CompileSourceDocument[] {
  const deduped = new Map<string, CompileSourceDocument>();
  const passthrough: CompileSourceDocument[] = [];

  for (const document of documents) {
    const key = getPacketDeduplicationKey(document);
    if (!key) {
      passthrough.push(document);
      continue;
    }

    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, document);
      continue;
    }

    const currentScore = getPacketDocumentPriority(document);
    const existingScore = getPacketDocumentPriority(existing);
    if (
      currentScore > existingScore ||
      (currentScore === existingScore && document.createdAt.getTime() > existing.createdAt.getTime())
    ) {
      deduped.set(key, document);
    }
  }

  return [...passthrough, ...Array.from(deduped.values())];
}

function sortPacketItems(items: PacketItem[]): PacketItem[] {
  return [...items].sort((left, right) => {
    const sectionDelta =
      getSectionDefinition(left.sectionCode).order - getSectionDefinition(right.sectionCode).order;
    if (sectionDelta !== 0) return sectionDelta;

    if (left.sectionCode === 'E' && right.sectionCode === 'E') {
      return left.title.localeCompare(right.title);
    }

    const bucketDelta = left.bucketCode.localeCompare(right.bucketCode, undefined, { numeric: true });
    if (bucketDelta !== 0) return bucketDelta;

    const roleDelta = (left.evidenceRole === 'primary' ? 0 : 1) - (right.evidenceRole === 'primary' ? 0 : 1);
    if (roleDelta !== 0) return roleDelta;

    return left.title.localeCompare(right.title);
  });
}

function assignUniqueExhibitCodes(items: PacketItem[]): PacketItem[] {
  const bySection = new Map<PacketSectionCode, PacketItem[]>();
  items.forEach((item) => {
    if (!bySection.has(item.sectionCode)) bySection.set(item.sectionCode, []);
    bySection.get(item.sectionCode)!.push(item);
  });

  for (const [sectionCode, sectionItems] of bySection.entries()) {
    if (sectionCode === 'D') {
      const byBucket = new Map<string, PacketItem[]>();
      sectionItems.forEach((item) => {
        if (!byBucket.has(item.bucketCode)) byBucket.set(item.bucketCode, []);
        byBucket.get(item.bucketCode)!.push(item);
      });
      for (const [bucketCode, bucketItems] of byBucket.entries()) {
        bucketItems.forEach((item, index) => {
          item.exhibitCode = `${bucketCode}.${index + 1}`;
        });
      }
      continue;
    }

    if (sectionCode === 'E') {
      sectionItems.forEach((item, index) => {
        item.bucketCode = `E-${index + 1}`;
        item.exhibitCode = `E-${index + 1}`;
      });
      continue;
    }

    const byBucket = new Map<string, PacketItem[]>();
    sectionItems.forEach((item) => {
      if (!byBucket.has(item.bucketCode)) byBucket.set(item.bucketCode, []);
      byBucket.get(item.bucketCode)!.push(item);
    });

    for (const [bucketCode, bucketItems] of byBucket.entries()) {
      if (bucketItems.length === 1) {
        bucketItems[0].exhibitCode = bucketCode;
        continue;
      }
      bucketItems.forEach((item, index) => {
        item.exhibitCode = `${bucketCode}.${index + 1}`;
      });
    }
  }

  return items;
}

export function buildPacketPlan(
  caseRecord: CompileCaseContext,
  options: CompileOptions
): PacketPlan {
  const sourceDocuments = pruneRedundantPacketDocuments(
    caseRecord.documents.filter((document) => !shouldSkipDocument(document, options))
  );
  const generatedItems = buildGeneratedItems(caseRecord, sourceDocuments, options);

  const bySection: Record<PacketSectionCode, CompileSourceDocument[]> = {
    A: [],
    B: [],
    C: [],
    D: [],
    E: [],
    F: [],
  };

  sourceDocuments.forEach((document) => {
    const sectionCode = getSectionCodeForDocument(document);
    bySection[sectionCode].push(document);
  });

  const allowedCriteria = Array.from(
    new Set([
      ...(options.criteriaIds.length ? options.criteriaIds : caseRecord.criteriaSelected),
      ...bySection.D
        .map((document) => inferCriterionId(document))
        .filter((criterionId): criterionId is CriterionId | 'C-C' => Boolean(criterionId)),
    ])
  );

  const items = assignUniqueExhibitCodes(sortPacketItems([
    ...buildBucketedItems(bySection.A, 'A', SECTION_A_BUCKETS, getSectionDefinition('A').title),
    ...buildBucketedItems(
      bySection.B,
      'B',
      SECTION_B_BUCKETS,
      getSectionDefinition('B').title
    ).filter((item) => item.bucketCode !== 'B-2'),
    ...buildBucketedItems(bySection.C, 'C', SECTION_C_BUCKETS, getSectionDefinition('C').title),
    ...buildCriterionItems(bySection.D, allowedCriteria, getSectionDefinition('D').title),
    ...buildExpertLetterItems(bySection.E, getSectionDefinition('E').title),
    ...buildBucketedItems(bySection.F, 'F', SECTION_F_BUCKETS, getSectionDefinition('F').title).filter(
      (item) => item.bucketCode !== 'F-1'
    ),
    ...generatedItems,
  ]));

  return {
    caseId: caseRecord.id,
    sectionOrder: PACKET_SECTIONS,
    items,
    tocEntries: [],
    exhibitIndex: [],
  };
}
