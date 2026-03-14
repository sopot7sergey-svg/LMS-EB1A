import { CRITERIA, type CriterionId } from '@aipas/shared';
import type { PacketItem, PacketSectionCode } from '../compile/types';
import type {
  CriterionCoverageEntry,
  CriterionSupportLevel,
  DeterministicCheckResult,
  EvidenceQualityIssue,
  FilingCompletenessItem,
  FilingComponentStatus,
  MissingItem,
  PacketArchitectureIssue,
  RequiredAddition,
  SourceBasisEntry,
  ThresholdDeficiency,
} from './types';

const EXPECTED_SECTIONS: PacketSectionCode[] = ['A', 'B', 'C', 'D', 'E', 'F'];

const INTERNAL_ONLY_MARKERS = [
  'internal',
  'draft guidance',
  'intake strategy summary',
  'internal case assembly',
];

function isInternalDocument(item: PacketItem): boolean {
  const title = item.title.toLowerCase();
  return INTERNAL_ONLY_MARKERS.some((m) => title.includes(m));
}

// --------------- Architecture checks ---------------

function checkSectionPresence(items: PacketItem[]): PacketArchitectureIssue[] {
  const issues: PacketArchitectureIssue[] = [];
  const presentSections = new Set(items.map((i) => i.sectionCode));

  for (const code of EXPECTED_SECTIONS) {
    if (!presentSections.has(code)) {
      issues.push({
        sectionCode: code,
        severity: code === 'D' || code === 'E' ? 'error' : 'warning',
        description: `Section ${code} is completely empty — no exhibits found.`,
      });
    }
  }
  return issues;
}

function checkExhibitCodeUniqueness(items: PacketItem[]): PacketArchitectureIssue[] {
  const seen = new Map<string, PacketItem[]>();
  items.forEach((item) => {
    const list = seen.get(item.exhibitCode) ?? [];
    list.push(item);
    seen.set(item.exhibitCode, list);
  });

  const issues: PacketArchitectureIssue[] = [];
  for (const [code, list] of seen) {
    if (list.length > 1) {
      issues.push({
        sectionCode: list[0].sectionCode,
        exhibitCode: code,
        severity: 'error',
        description: `Exhibit code ${code} is used by ${list.length} different items: ${list.map((i) => i.title).join(', ')}`,
      });
    }
  }
  return issues;
}

function checkSectionSequencing(items: PacketItem[]): PacketArchitectureIssue[] {
  const issues: PacketArchitectureIssue[] = [];
  const ORDER: Record<PacketSectionCode, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 };
  let lastOrder = 0;

  for (const item of items) {
    const o = ORDER[item.sectionCode] ?? 99;
    if (o < lastOrder) {
      issues.push({
        sectionCode: item.sectionCode,
        exhibitCode: item.exhibitCode,
        severity: 'warning',
        description: `Exhibit ${item.exhibitCode} (Section ${item.sectionCode}) appears after a later section — sequencing may be broken.`,
      });
      break;
    }
    lastOrder = o;
  }
  return issues;
}

function checkInternalDocumentLeakage(items: PacketItem[]): PacketArchitectureIssue[] {
  const issues: PacketArchitectureIssue[] = [];
  for (const item of items) {
    if (item.sectionCode !== 'F' && isInternalDocument(item)) {
      issues.push({
        sectionCode: item.sectionCode,
        exhibitCode: item.exhibitCode,
        severity: 'warning',
        description: `"${item.title}" looks like an internal-only document but is placed in officer-facing Section ${item.sectionCode}.`,
      });
    }
  }
  return issues;
}

function checkReviewedCoverage(items: PacketItem[]): { issues: PacketArchitectureIssue[]; signals: SourceBasisEntry[] } {
  const sourceItems = items.filter((i) => i.sourceType === 'document');
  const reviewed = sourceItems.filter((i) => i.review);
  const signals: SourceBasisEntry[] = [];
  const issues: PacketArchitectureIssue[] = [];

  const pct = sourceItems.length ? Math.round((reviewed.length / sourceItems.length) * 100) : 0;
  signals.push({
    kind: 'packet_signal',
    source: 'Review coverage',
    excerpt: `${reviewed.length} of ${sourceItems.length} source documents reviewed (${pct}%)`,
  });

  if (sourceItems.length > 0 && pct < 50) {
    issues.push({
      sectionCode: 'D',
      severity: 'warning',
      description: `Only ${pct}% of source documents have been reviewed by the Document Review agent. Consider reviewing remaining documents before relying on this packet.`,
    });
  }

  return { issues, signals };
}

function checkPrimarySupportingBalance(items: PacketItem[]): { issues: PacketArchitectureIssue[]; signals: SourceBasisEntry[] } {
  const sectionD = items.filter((i) => i.sectionCode === 'D');
  const primary = sectionD.filter((i) => i.evidenceRole === 'primary');
  const supporting = sectionD.filter((i) => i.evidenceRole === 'supporting');
  const signals: SourceBasisEntry[] = [];
  const issues: PacketArchitectureIssue[] = [];

  signals.push({
    kind: 'packet_signal',
    source: 'Section D evidence balance',
    excerpt: `${primary.length} primary, ${supporting.length} supporting exhibits in criterion evidence`,
  });

  if (sectionD.length > 0 && primary.length === 0) {
    issues.push({
      sectionCode: 'D',
      severity: 'error',
      description: 'Section D has no primary evidence — all documents are supporting only.',
    });
  }

  return { issues, signals };
}

// --------------- Threshold deficiencies ---------------

function buildThresholdDeficiencies(items: PacketItem[], criteriaSelected: string[]): ThresholdDeficiency[] {
  const deficiencies: ThresholdDeficiency[] = [];
  const hasCoverLetter = items.some((i) => i.bucketCode === 'B-1');
  const hasIdentity = items.some((i) => i.sectionCode === 'C');
  const hasPassport = items.some((i) =>
    i.title.toLowerCase().includes('passport') || i.bucketCode === 'C-1'
  );
  const hasTranslations = items.some((i) =>
    i.title.toLowerCase().includes('translation') ||
    i.title.toLowerCase().includes('certified translation')
  );
  const hasCriterionEvidence = items.some((i) => i.sectionCode === 'D' && i.criterionId);
  const hasExpertLetters = items.some((i) => i.sectionCode === 'E');
  const hasProposedEndeavor = items.some((i) =>
    i.title.toLowerCase().includes('proposed endeavor') ||
    i.title.toLowerCase().includes('future work') ||
    i.title.toLowerCase().includes('national interest')
  );

  if (!hasCoverLetter) {
    deficiencies.push({
      issue: 'Cover letter / legal brief is missing',
      whyItMatters: 'The cover letter is the primary organizing document that frames the entire petition. Without it, the officer has no roadmap to evaluate the evidence structure.',
      expectedPacketItem: 'A comprehensive cover letter or legal brief in Section B',
      impact: 'critical',
    });
  }

  if (!hasIdentity || !hasPassport) {
    deficiencies.push({
      issue: 'Identity / passport biographic page is missing',
      whyItMatters: 'Passport biographic pages and identity documents are mandatory filing components. Their absence makes the packet incomplete at a basic administrative level.',
      expectedPacketItem: 'Passport biographic page copy and supporting identity/status documents in Section C',
      impact: 'critical',
    });
  }

  if (!hasCriterionEvidence) {
    deficiencies.push({
      issue: 'No criterion-mapped evidence found in the packet',
      whyItMatters: 'The EB-1A petition requires evidence satisfying at least 3 of 10 criteria under 8 CFR 204.5(h)(3). Without mapped criterion evidence, the core evidentiary burden is unmet and criterion analysis cannot be meaningfully performed.',
      expectedPacketItem: 'Evidence exhibits mapped to claimed criteria in Section D',
      impact: 'critical',
    });
  }

  if (!hasExpertLetters) {
    deficiencies.push({
      issue: 'No expert / recommendation letters included',
      whyItMatters: 'Expert letters provide third-party corroboration of the beneficiary\'s achievements and are a standard expected component in EB-1A petitions. Their absence weakens both criterion claims and the final merits argument.',
      expectedPacketItem: 'Expert or recommendation letters in Section E',
      impact: 'material',
    });
  }

  if (criteriaSelected.length > 0 && !hasCriterionEvidence) {
    const claimedButEmpty = criteriaSelected.filter(
      (cId) => !items.some((i) => i.criterionId === cId)
    );
    if (claimedButEmpty.length === criteriaSelected.length) {
      deficiencies.push({
        issue: 'All claimed criteria lack any evidence exhibits',
        whyItMatters: `${criteriaSelected.length} criteria were selected (${criteriaSelected.join(', ')}) but none have mapped evidence in the packet. Criterion coverage cannot be meaningfully assessed.`,
        expectedPacketItem: 'Evidence exhibits for each claimed criterion in Section D',
        impact: 'critical',
      });
    }
  }

  if (!hasTranslations) {
    const foreignLanguageHints = items.some((i) =>
      i.title.toLowerCase().includes('foreign') ||
      i.title.toLowerCase().includes('translated')
    );
    if (foreignLanguageHints) {
      deficiencies.push({
        issue: 'Translation certifications appear to be missing',
        whyItMatters: 'Any foreign-language document requires a certified translation per USCIS filing requirements. Without translation certifications, those exhibits may not be considered.',
        expectedPacketItem: 'Certified translations for all foreign-language documents',
        impact: 'material',
      });
    }
  }

  if (!hasProposedEndeavor && !hasCoverLetter) {
    deficiencies.push({
      issue: 'No proposed endeavor or future-work support identified',
      whyItMatters: 'For EB-1A petitions, the beneficiary must demonstrate that they will continue working in their area of extraordinary ability. Without this, the final merits argument is structurally incomplete.',
      expectedPacketItem: 'Proposed endeavor description or future-work documentation',
      impact: 'material',
    });
  }

  return deficiencies;
}

// --------------- Filing completeness ---------------

function buildFilingCompleteness(items: PacketItem[]): FilingCompletenessItem[] {
  const components: FilingCompletenessItem[] = [];

  const check = (
    component: string,
    predicate: (items: PacketItem[]) => boolean,
    detail?: string
  ): FilingCompletenessItem => {
    const found = predicate(items);
    return {
      component,
      status: found ? 'present' : 'missing',
      detail: found ? undefined : detail,
    };
  };

  components.push(
    check(
      'Cover Letter / Legal Brief',
      (its) => its.some((i) => i.bucketCode === 'B-1'),
      'Required organizing document not found in packet'
    )
  );

  components.push(
    check(
      'Passport Biographic Page',
      (its) => its.some((i) => i.bucketCode === 'C-1' || i.title.toLowerCase().includes('passport')),
      'Passport copy is a mandatory identity document'
    )
  );

  components.push(
    check(
      'Identity / Status Evidence',
      (its) => its.some((i) => i.sectionCode === 'C'),
      'Section C (Identity/Status) has no documents'
    )
  );

  components.push(
    check(
      'Filing Forms (I-140, G-1145)',
      (its) => its.some((i) => i.sectionCode === 'A'),
      'Filing core forms not found in Section A'
    )
  );

  components.push(
    check(
      'Table of Contents',
      (its) => its.some((i) => i.bucketCode === 'B-2'),
    )
  );

  components.push(
    check(
      'Exhibit Index',
      (its) => its.some((i) => i.bucketCode === 'F-1'),
    )
  );

  const hasTranslation = items.some((i) =>
    i.title.toLowerCase().includes('translation') ||
    i.title.toLowerCase().includes('certified translation')
  );
  const hasForeignHint = items.some((i) =>
    i.title.toLowerCase().includes('foreign') ||
    i.title.toLowerCase().includes('translated')
  );

  if (hasTranslation || hasForeignHint) {
    components.push({
      component: 'Translation Certifications',
      status: hasTranslation ? 'present' : 'missing',
      detail: hasTranslation ? undefined : 'Foreign-language documents detected but no translation certifications found',
    });
  }

  const hasExpertLetters = items.some((i) => i.sectionCode === 'E');
  components.push({
    component: 'Expert / Recommendation Letters',
    status: hasExpertLetters ? 'present' : 'missing',
    detail: hasExpertLetters ? undefined : 'Section E has no letters',
  });

  const hasCriterionEvidence = items.some((i) => i.sectionCode === 'D' && i.criterionId);
  components.push({
    component: 'Criterion-Mapped Evidence',
    status: hasCriterionEvidence ? 'present' : 'missing',
    detail: hasCriterionEvidence ? undefined : 'No evidence exhibits mapped to specific criteria in Section D',
  });

  return components;
}

// --------------- Required additions ---------------

function buildRequiredAdditions(
  missingItems: MissingItem[],
  thresholds: ThresholdDeficiency[],
  filingItems: FilingCompletenessItem[]
): RequiredAddition[] {
  const additions: RequiredAddition[] = [];

  for (const td of thresholds) {
    additions.push({
      group: 'required',
      description: td.issue,
      expectedSection: 'B',
      priority: td.impact === 'critical' ? 'high' : 'medium',
    });
  }

  for (const fi of filingItems) {
    if (fi.status === 'missing' || fi.status === 'needs_correction') {
      const alreadyCovered = additions.some((a) =>
        a.description.toLowerCase().includes(fi.component.toLowerCase())
      );
      if (!alreadyCovered) {
        additions.push({
          group: 'required',
          description: `${fi.component}: ${fi.detail || 'missing from packet'}`,
          expectedSection: 'A',
          priority: 'medium',
        });
      }
    }
  }

  for (const mi of missingItems) {
    const alreadyCovered = additions.some((a) =>
      a.description.toLowerCase().includes(mi.description.toLowerCase().slice(0, 30))
    );
    if (!alreadyCovered) {
      additions.push({
        group: mi.priority === 'high' ? 'required' : 'strengthening',
        description: mi.description,
        expectedSection: mi.expectedSection,
        priority: mi.priority,
      });
    }
  }

  return additions;
}

// --------------- Criterion coverage ---------------

function buildCriterionCoverage(items: PacketItem[], criteriaSelected: string[]): CriterionCoverageEntry[] {
  const allCriteria = new Set<string>([
    ...criteriaSelected,
    ...items
      .filter((i) => i.criterionId)
      .map((i) => i.criterionId as string),
  ]);

  const hasCriterionEvidence = items.some((i) => i.sectionCode === 'D' && i.criterionId);

  const entries: CriterionCoverageEntry[] = [];

  for (const cId of allCriteria) {
    const label = (CRITERIA as Record<string, string>)[cId] ?? cId;
    const criterionItems = items.filter((i) => i.criterionId === cId);
    const primary = criterionItems.filter((i) => i.evidenceRole === 'primary');
    const supporting = criterionItems.filter((i) => i.evidenceRole === 'supporting');
    const reviewed = criterionItems.filter((i) => i.review);
    const findings: string[] = [];
    const supportPresent: string[] = [];
    const supportMissing: string[] = [];

    const isClaimed = criteriaSelected.includes(cId);

    let supportLevel: CriterionSupportLevel;
    let whyThisRating: string;

    if (!isClaimed && criterionItems.length === 0) {
      supportLevel = 'not_claimed';
      whyThisRating = 'This criterion was not claimed and has no evidence in the packet.';
    } else if (criterionItems.length === 0) {
      if (!hasCriterionEvidence) {
        supportLevel = 'not_assessable';
        whyThisRating = 'Criterion coverage could not be meaningfully assessed because the packet lacks mapped criterion evidence entirely.';
        findings.push('The packet contains no criterion-mapped evidence. All criterion assessments are blocked until evidence is added to Section D.');
      } else {
        supportLevel = 'missing';
        whyThisRating = 'This criterion was claimed but has no exhibits in the packet.';
        findings.push('No exhibits found for this criterion.');
        supportMissing.push('Any primary or supporting evidence for this criterion');
      }
    } else if (primary.length === 0) {
      supportLevel = 'weak';
      whyThisRating = 'Only supporting materials are present — no primary evidence to anchor the criterion claim.';
      findings.push('No primary evidence — only supporting materials present.');
      supportPresent.push(`${supporting.length} supporting exhibit(s)`);
      supportMissing.push('Primary evidence documents');
    } else if (primary.length >= 2 && reviewed.length >= 1) {
      supportLevel = 'strong';
      whyThisRating = 'Multiple primary evidence items and at least one reviewed document support this criterion.';
      supportPresent.push(`${primary.length} primary, ${supporting.length} supporting exhibit(s)`);
      if (reviewed.length > 0) supportPresent.push(`${reviewed.length} reviewed`);
    } else {
      supportLevel = 'moderate';
      whyThisRating = 'Some primary evidence exists but coverage could be stronger.';
      supportPresent.push(`${primary.length} primary, ${supporting.length} supporting exhibit(s)`);
      if (reviewed.length === 0) {
        findings.push('No documents have been reviewed for this criterion.');
        supportMissing.push('Reviewed evidence for quality assurance');
      }
    }

    const weakReviews = criterionItems.filter(
      (i) => i.review?.finalStatus === 'weak' || i.review?.finalStatus === 'needs_context'
    );
    if (weakReviews.length > 0) {
      findings.push(`${weakReviews.length} exhibit(s) flagged as weak or needing context.`);
      if (supportLevel === 'strong') {
        supportLevel = 'moderate';
        whyThisRating = 'Evidence exists but some documents were flagged as weak or lacking context during review.';
      }
    }

    entries.push({
      criterionId: cId,
      criterionLabel: label,
      supportLevel,
      exhibitCount: criterionItems.length,
      primaryCount: primary.length,
      supportingCount: supporting.length,
      reviewedCount: reviewed.length,
      findings,
      whyThisRating,
      supportPresent,
      supportMissing,
    });
  }

  return entries;
}

// --------------- Evidence quality ---------------

function checkEvidenceQuality(items: PacketItem[]): EvidenceQualityIssue[] {
  const issues: EvidenceQualityIssue[] = [];

  for (const item of items) {
    if (!item.review) continue;

    if (item.review.finalStatus === 'weak') {
      issues.push({
        documentTitle: item.title,
        exhibitCode: item.exhibitCode,
        severity: 'warning',
        description: `Document Review rated this as "weak". ${item.review.weaknesses.slice(0, 2).join(' ')}`,
      });
    }

    if (item.review.finalStatus === 'needs_context') {
      issues.push({
        documentTitle: item.title,
        exhibitCode: item.exhibitCode,
        severity: 'info',
        description: `Document Review rated this as "needs context". Missing: ${item.review.missingContext.slice(0, 2).join('; ')}`,
      });
    }

    if (item.review.finalStatus === 'irrelevant') {
      issues.push({
        documentTitle: item.title,
        exhibitCode: item.exhibitCode,
        severity: 'error',
        description: 'Document Review rated this as "irrelevant" — consider removing from packet.',
      });
    }
  }

  const expertLetters = items.filter((i) => i.sectionCode === 'E' && i.sourceType === 'document');
  for (const letter of expertLetters) {
    if (letter.review && letter.review.weaknesses.some(
      (w) => /generic|vague|lacks detail|no specific/i.test(w)
    )) {
      issues.push({
        documentTitle: letter.title,
        exhibitCode: letter.exhibitCode,
        severity: 'warning',
        description: 'Recommendation/expert letter appears generic or lacking specifics.',
      });
    }
  }

  return issues;
}

// --------------- Missing items (for backward compat and additions) ---------------

function checkMissingItems(items: PacketItem[], criteriaSelected: string[]): MissingItem[] {
  const missing: MissingItem[] = [];
  const presentSections = new Set(items.map((i) => i.sectionCode));
  const hasToc = items.some((i) => i.bucketCode === 'B-2');
  const hasExhibitIndex = items.some((i) => i.bucketCode === 'F-1');
  const hasCoverLetter = items.some((i) => i.bucketCode === 'B-1');

  if (!hasCoverLetter) {
    missing.push({
      description: 'Cover Letter / Legal Brief is not included in the packet.',
      expectedSection: 'B',
      priority: 'high',
      action: 'add',
    });
  }
  if (!hasToc) {
    missing.push({
      description: 'Table of Contents is not included.',
      expectedSection: 'B',
      priority: 'medium',
      action: 'add',
    });
  }
  if (!hasExhibitIndex) {
    missing.push({
      description: 'Exhibit Index is not included.',
      expectedSection: 'F',
      priority: 'medium',
      action: 'add',
    });
  }
  if (!presentSections.has('A')) {
    missing.push({
      description: 'Filing forms (I-140, G-1145, filing fees) are absent.',
      expectedSection: 'A',
      priority: 'high',
      action: 'add',
    });
  }

  for (const cId of criteriaSelected) {
    const hasEvidence = items.some((i) => i.criterionId === cId);
    if (!hasEvidence) {
      const label = (CRITERIA as Record<string, string>)[cId] ?? cId;
      missing.push({
        description: `No evidence exhibits for claimed ${label}.`,
        expectedSection: 'D',
        priority: 'high',
        action: 'add',
      });
    }
  }

  return missing;
}

// --------------- Main entry ---------------

export function runDeterministicChecks(
  items: PacketItem[],
  criteriaSelected: string[]
): DeterministicCheckResult {
  const architectureIssues: PacketArchitectureIssue[] = [
    ...checkSectionPresence(items),
    ...checkExhibitCodeUniqueness(items),
    ...checkSectionSequencing(items),
    ...checkInternalDocumentLeakage(items),
  ];

  const reviewCoverage = checkReviewedCoverage(items);
  const balance = checkPrimarySupportingBalance(items);
  architectureIssues.push(...reviewCoverage.issues, ...balance.issues);

  const evidenceIssues = checkEvidenceQuality(items);
  const missingItems = checkMissingItems(items, criteriaSelected);
  const criterionCoverage = buildCriterionCoverage(items, criteriaSelected);
  const thresholdDeficiencies = buildThresholdDeficiencies(items, criteriaSelected);
  const filingCompleteness = buildFilingCompleteness(items);
  const requiredAdditions = buildRequiredAdditions(missingItems, thresholdDeficiencies, filingCompleteness);

  const signals: SourceBasisEntry[] = [
    ...reviewCoverage.signals,
    ...balance.signals,
    {
      kind: 'deterministic_rule',
      source: 'Packet structure check',
      excerpt: `${items.length} exhibits across ${new Set(items.map((i) => i.sectionCode)).size} sections`,
    },
    {
      kind: 'deterministic_rule',
      source: 'Criterion coverage',
      excerpt: `${criterionCoverage.filter((c) => c.supportLevel !== 'missing' && c.supportLevel !== 'not_claimed' && c.supportLevel !== 'not_assessable').length} criteria have exhibits; ${criterionCoverage.filter((c) => c.supportLevel === 'missing').length} are missing`,
    },
  ];

  return {
    architectureIssues,
    evidenceIssues,
    missingItems,
    criterionCoverage,
    signals,
    thresholdDeficiencies,
    filingCompleteness,
    requiredAdditions,
  };
}
