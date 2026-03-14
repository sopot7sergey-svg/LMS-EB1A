/**
 * Legal Library Ingestion Script
 *
 * Reads PDFs from legal-library/primary and legal-library/aao,
 * extracts text, chunks by section, tags topics, and populates RAGChunk records.
 *
 * Usage:  npx tsx apps/api/scripts/ingest-legal-library.ts
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PDFParse } from 'pdf-parse';

const prisma = new PrismaClient();

const LIBRARY_ROOT = path.resolve(__dirname, '../../../legal-library');

// ---------------------------------------------------------------------------
// Source registry — maps each file to structured metadata
// ---------------------------------------------------------------------------

interface SourceEntry {
  file: string;
  source: string;
  authorityLevel: 'primary' | 'interpretive';
  jurisdiction: string;
  defaultTopicTags: string[];
  effectiveDate?: string;
}

const SOURCE_REGISTRY: SourceEntry[] = [
  // ---- primary ----
  {
    file: 'primary/01-8CFR-204.5.pdf',
    source: '8 CFR 204.5(h)',
    authorityLevel: 'primary',
    jurisdiction: 'federal',
    defaultTopicTags: ['extraordinary ability', 'filing requirements', 'evidence criteria', 'I-140', 'regulatory'],
  },
  {
    file: 'primary/02-uscis-pm-v6-part-f-ch2-extraordinary-ability.pdf',
    source: 'USCIS Policy Manual Vol 6 Part F Ch 2',
    authorityLevel: 'primary',
    jurisdiction: 'federal',
    defaultTopicTags: ['extraordinary ability', 'final merits', 'evidence criteria', 'sustained acclaim', 'top of field', 'evidentiary weight'],
  },
  {
    file: 'primary/03-form-i-140-instructions.pdf',
    source: 'Form I-140 Instructions',
    authorityLevel: 'primary',
    jurisdiction: 'federal',
    defaultTopicTags: ['I-140', 'filing requirements', 'petition format', 'packet structure'],
  },
  {
    file: 'primary/04-i-140-required-initial-evidence-checklist.pdf',
    source: 'I-140 Required Initial Evidence Checklist',
    authorityLevel: 'primary',
    jurisdiction: 'federal',
    defaultTopicTags: ['I-140', 'filing requirements', 'evidence criteria', 'packet structure'],
  },
  {
    file: 'primary/05-uscis-eb1-overview.pdf',
    source: 'USCIS EB-1 Overview',
    authorityLevel: 'primary',
    jurisdiction: 'federal',
    defaultTopicTags: ['extraordinary ability', 'EB-1', 'filing requirements'],
  },
  {
    file: 'primary/06-uscis-policy-alert-2024-10-02-extraordinary-ability.pdf',
    source: 'USCIS Policy Alert PA-2024-31',
    authorityLevel: 'primary',
    jurisdiction: 'federal',
    effectiveDate: '2024-10-02',
    defaultTopicTags: ['extraordinary ability', 'evidence criteria', 'STEM', 'original contributions'],
  },
  {
    file: 'primary/07-matter-of-chawathe.pdf',
    source: 'Matter of Chawathe (AAO 2010)',
    authorityLevel: 'primary',
    jurisdiction: 'federal',
    defaultTopicTags: ['standard of proof', 'preponderance of evidence', 'evidentiary weight'],
  },
  // SKIPPED: primary/08-kazarian-two-step-aao-reference.pdf
  // This PDF actually contains a Form I-131 (Travel Documents), not the Kazarian decision.
  // Kazarian two-step analysis is already well-covered by USCIS Policy Manual and AAO decision chunks.
  // Re-enable when a correct Kazarian source PDF is available.
  // ---- aao (interpretive) ----
  {
    file: 'aao/09jul-aao-eb1a-final-merits-example.pdf',
    source: 'AAO Non-Precedent Decision (Jul 2024) — Final Merits',
    authorityLevel: 'interpretive',
    jurisdiction: 'federal',
    defaultTopicTags: ['final merits', 'totality', 'sustained acclaim', 'top of field', 'AAO decision'],
  },
  {
    file: 'aao/09oct-aao-eb1a-final-merits-example.pdf',
    source: 'AAO Non-Precedent Decision (Oct 2024) — Final Merits',
    authorityLevel: 'interpretive',
    jurisdiction: 'federal',
    defaultTopicTags: ['final merits', 'totality', 'sustained acclaim', 'top of field', 'AAO decision'],
  },
  {
    file: 'aao/10-aao-eb1a-weak-letters-example.pdf',
    source: 'AAO Non-Precedent Decision — Weak Letters',
    authorityLevel: 'interpretive',
    jurisdiction: 'federal',
    defaultTopicTags: ['recommendation letters', 'expert letters', 'evidentiary weight', 'independent expert', 'AAO decision'],
  },
  {
    file: 'aao/11-aao-eb1a-original-contributions-example.pdf',
    source: 'AAO Non-Precedent Decision — Original Contributions',
    authorityLevel: 'interpretive',
    jurisdiction: 'federal',
    defaultTopicTags: ['original contributions', 'major significance', 'evidence criteria', 'AAO decision'],
  },
  {
    file: 'aao/12-aao-eb1a-critical-role-example.pdf',
    source: 'AAO Non-Precedent Decision — Critical Role',
    authorityLevel: 'interpretive',
    jurisdiction: 'federal',
    defaultTopicTags: ['critical role', 'leading role', 'distinguished organizations', 'evidence criteria', 'AAO decision'],
  },
];

// ---------------------------------------------------------------------------
// PDF text extraction
// ---------------------------------------------------------------------------

async function extractPdfText(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return (parsed.text || '')
      .replace(/\0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Section-aware chunking
// ---------------------------------------------------------------------------

const SECTION_HEADING_RE = /^(?:(?:§|Section|Part|Chapter|Article|PART|CHAPTER)\s*[\d.]+|[A-Z][A-Z .]{4,80}$|\d+\.\s+[A-Z]|\([a-z]\)\s|\(\d+\)\s|[IVXLC]+\.\s)/m;

interface RawChunk {
  section: string | null;
  text: string;
}

function chunkDocument(text: string, maxChunkSize: number = 1800, minChunkSize: number = 200): RawChunk[] {
  const lines = text.split('\n');
  const rawSections: RawChunk[] = [];
  let currentSection: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      currentLines.push('');
      continue;
    }

    const isHeading = SECTION_HEADING_RE.test(trimmed) && trimmed.length < 200;
    if (isHeading && currentLines.join('\n').trim().length > minChunkSize) {
      rawSections.push({ section: currentSection, text: currentLines.join('\n').trim() });
      currentSection = trimmed;
      currentLines = [trimmed];
    } else {
      if (isHeading && !currentSection) {
        currentSection = trimmed;
      }
      currentLines.push(trimmed);
    }
  }
  if (currentLines.join('\n').trim().length > 0) {
    rawSections.push({ section: currentSection, text: currentLines.join('\n').trim() });
  }

  const finalChunks: RawChunk[] = [];
  for (const sec of rawSections) {
    if (sec.text.length <= maxChunkSize) {
      if (sec.text.length >= minChunkSize) {
        finalChunks.push(sec);
      } else if (finalChunks.length > 0) {
        const last = finalChunks[finalChunks.length - 1];
        last.text += '\n\n' + sec.text;
      } else {
        finalChunks.push(sec);
      }
    } else {
      const paragraphs = sec.text.split(/\n\n+/);
      let buffer = '';
      for (const para of paragraphs) {
        if (buffer.length + para.length + 2 > maxChunkSize && buffer.length >= minChunkSize) {
          finalChunks.push({ section: sec.section, text: buffer.trim() });
          buffer = para;
        } else {
          buffer += (buffer ? '\n\n' : '') + para;
        }
      }
      if (buffer.trim().length >= minChunkSize) {
        finalChunks.push({ section: sec.section, text: buffer.trim() });
      } else if (buffer.trim().length > 0 && finalChunks.length > 0) {
        finalChunks[finalChunks.length - 1].text += '\n\n' + buffer.trim();
      } else if (buffer.trim().length > 0) {
        finalChunks.push({ section: sec.section, text: buffer.trim() });
      }
    }
  }

  return finalChunks;
}

// ---------------------------------------------------------------------------
// Content-aware topic tagging
// ---------------------------------------------------------------------------

interface TopicRule {
  tag: string;
  patterns: RegExp[];
}

const TOPIC_RULES: TopicRule[] = [
  { tag: 'extraordinary ability', patterns: [/extraordinary\s+ability/i, /EB[- ]?1A/i, /204\.5\(h\)/i] },
  { tag: 'final merits', patterns: [/final\s+merits/i, /totality\s+of\s+(the\s+)?evidence/i, /holistic\s+review/i] },
  { tag: 'sustained acclaim', patterns: [/sustained\s+.*acclaim/i, /national\s+or\s+international\s+acclaim/i] },
  { tag: 'top of field', patterns: [/top\s+of\s+(the\s+)?field/i, /very\s+top\s+of\s+the\s+field/i, /small\s+percentage/i] },
  { tag: 'two-step analysis', patterns: [/two[- ]?step/i, /two[- ]?part\s+(approach|analysis)/i, /Kazarian/i] },
  { tag: 'standard of proof', patterns: [/preponderance\s+of\s+(the\s+)?evidence/i, /standard\s+of\s+proof/i, /burden\s+of\s+proof/i] },
  { tag: 'evidentiary weight', patterns: [/evidentiary\s+weight/i, /probative\s+value/i, /weight\s+of\s+(the\s+)?evidence/i] },
  { tag: 'awards', patterns: [/\bprizes?\b.*\baward/i, /\baward.*\bprize/i, /nationally\s+.*\brecognized\s+.*\bprize/i, /awards?\s+for\s+excellence/i] },
  { tag: 'prizes', patterns: [/\bprizes?\b/i, /\baward/i] },
  { tag: 'membership', patterns: [/\bmembership\b/i, /\bassociation\b/i, /outstanding\s+achievements?\s+of\s+(their|its)\s+members/i] },
  { tag: 'associations', patterns: [/\bassociation/i] },
  { tag: 'published material', patterns: [/published\s+material/i, /major\s+trade\s+publication/i, /major\s+media/i] },
  { tag: 'media', patterns: [/\bmedia\b/i, /press\s+coverage/i] },
  { tag: 'judging', patterns: [/\bjudging\b/i, /judge\s+of\s+the\s+work/i, /\bpeer\s+review/i, /review\s+panel/i] },
  { tag: 'peer review', patterns: [/peer\s+review/i] },
  { tag: 'original contributions', patterns: [/original\s+(scientific|scholarly|artistic|business|contributions?)/i, /major\s+significance/i, /contributions?\s+of\s+major\s+significance/i] },
  { tag: 'major significance', patterns: [/major\s+significance/i] },
  { tag: 'authorship', patterns: [/\bauthorship\b/i, /scholarly\s+articles?/i] },
  { tag: 'scholarly articles', patterns: [/scholarly\s+articles?/i] },
  { tag: 'exhibitions', patterns: [/\bexhibitions?\b/i, /artistic\s+(exhibitions?|showcases?)/i, /\bshowcases?\b/i] },
  { tag: 'showcases', patterns: [/\bshowcases?\b/i] },
  { tag: 'leading role', patterns: [/leading\s+(or\s+critical\s+)?role/i, /\bcritical\s+role/i] },
  { tag: 'critical role', patterns: [/critical\s+role/i, /leading\s+.*role/i] },
  { tag: 'distinguished organizations', patterns: [/distinguished\s+(reputation|organization)/i] },
  { tag: 'high salary', patterns: [/high\s+salary/i, /high\s+remuneration/i, /significantly\s+high\s+remuneration/i] },
  { tag: 'remuneration', patterns: [/\bremuneration/i, /compensation/i] },
  { tag: 'commercial success', patterns: [/commercial\s+success/i, /box\s+office/i, /performing\s+arts/i] },
  { tag: 'recommendation letters', patterns: [/recommendation\s+letter/i, /expert\s+letter/i, /advisory\s+opinion/i, /support\s+letter/i] },
  { tag: 'expert letters', patterns: [/expert\s+letter/i, /independent\s+expert/i] },
  { tag: 'independent expert', patterns: [/independent\s+expert/i] },
  { tag: 'filing requirements', patterns: [/filing\s+(requirement|fee|instruction)/i, /initial\s+evidence/i, /required\s+.*evidence/i] },
  { tag: 'I-140', patterns: [/I[- ]?140\b/i, /form\s+I-140/i] },
  { tag: 'petition format', patterns: [/petition\s+format/i, /petition\s+package/i] },
  { tag: 'packet structure', patterns: [/exhibit\s+(list|index)/i, /packet\s+structure/i, /table\s+of\s+contents/i] },
  { tag: 'STEM', patterns: [/\bSTEM\b/, /science\s*,?\s*technology/i] },
  { tag: 'RFE', patterns: [/\bRFE\b/, /request\s+for\s+(additional\s+)?evidence/i] },
  { tag: 'NOID', patterns: [/\bNOID\b/, /notice\s+of\s+intent\s+to\s+deny/i] },
  { tag: 'AAO decision', patterns: [/administrative\s+appeals?\s+office/i, /\bAAO\b/] },
  { tag: 'evidence criteria', patterns: [/evidence\s+criteria/i, /regulatory\s+criteria/i, /\(h\)\(3\)/i, /ten\s+criteria/i] },
];

function tagChunk(text: string, defaultTags: string[]): string[] {
  const tags = new Set(defaultTags);
  const lowerText = text.toLowerCase();

  for (const rule of TOPIC_RULES) {
    if (tags.has(rule.tag)) continue;
    for (const pattern of rule.patterns) {
      if (pattern.test(text) || pattern.test(lowerText)) {
        tags.add(rule.tag);
        break;
      }
    }
  }

  return [...tags];
}

// ---------------------------------------------------------------------------
// Main ingestion
// ---------------------------------------------------------------------------

function requireProductionConfirmation(): void {
  if (process.env.NODE_ENV === 'production' && process.env.CONFIRM_LEGAL_INGEST !== '1') {
    console.error(
      '[INGEST] BLOCKED: NODE_ENV=production. This script deletes and replaces RAGChunk records. ' +
        'Backup the database first. To proceed, set CONFIRM_LEGAL_INGEST=1.'
    );
    process.exit(1);
  }
}

async function main() {
  console.log('=== Legal Library Ingestion ===\n');
  requireProductionConfirmation();

  const stats = {
    filesProcessed: 0,
    filesFailed: 0,
    chunksCreated: 0,
    existingDeleted: 0,
    failures: [] as string[],
  };

  const allSources = SOURCE_REGISTRY.map((s) => s.source);
  const existing = await prisma.rAGChunk.count({
    where: { source: { in: allSources } },
  });
  if (existing > 0) {
    console.log(`Deleting ${existing} existing RAGChunk records for these sources...`);
    await prisma.rAGChunk.deleteMany({
      where: { source: { in: allSources } },
    });
    stats.existingDeleted = existing;
  }

  for (const entry of SOURCE_REGISTRY) {
    const filePath = path.join(LIBRARY_ROOT, entry.file);
    console.log(`\nProcessing: ${entry.file}`);

    if (!fs.existsSync(filePath)) {
      console.error(`  ERROR: File not found: ${filePath}`);
      stats.filesFailed++;
      stats.failures.push(`${entry.file}: File not found`);
      continue;
    }

    let fullText: string;
    try {
      fullText = await extractPdfText(filePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR: Extraction failed: ${msg}`);
      stats.filesFailed++;
      stats.failures.push(`${entry.file}: ${msg}`);
      continue;
    }

    if (fullText.length < 100) {
      console.error(`  WARNING: Very short text (${fullText.length} chars) — may be scanned/image PDF`);
      stats.failures.push(`${entry.file}: Extraction yielded only ${fullText.length} chars (possible scan)`);
    }

    console.log(`  Extracted: ${fullText.length} chars`);

    const chunks = chunkDocument(fullText);
    console.log(`  Chunked: ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const topicTags = tagChunk(chunk.text, entry.defaultTopicTags);

      await prisma.rAGChunk.create({
        data: {
          source: entry.source,
          section: chunk.section || `Chunk ${i + 1}`,
          content: chunk.text,
          embedding: [],
          effectiveDate: entry.effectiveDate ? new Date(entry.effectiveDate) : null,
          jurisdiction: entry.jurisdiction,
          topicTags,
        },
      });
      stats.chunksCreated++;
    }

    stats.filesProcessed++;
    console.log(`  Created ${chunks.length} RAGChunk records (source: ${entry.source})`);
  }

  // Summary
  console.log('\n=== Ingestion Summary ===');
  console.log(`Files processed: ${stats.filesProcessed}/${SOURCE_REGISTRY.length}`);
  console.log(`Files failed: ${stats.filesFailed}`);
  console.log(`Chunks created: ${stats.chunksCreated}`);
  console.log(`Existing records replaced: ${stats.existingDeleted}`);

  if (stats.failures.length > 0) {
    console.log('\nFailures:');
    for (const f of stats.failures) {
      console.log(`  - ${f}`);
    }
  }

  // Quick retrieval validation
  console.log('\n=== Retrieval Validation ===');
  const testQueries = [
    { label: 'Extraordinary ability / filing', tags: ['extraordinary ability', 'filing requirements'] },
    { label: 'Final merits / sustained acclaim', tags: ['final merits', 'sustained acclaim'] },
    { label: 'Original contributions', tags: ['original contributions', 'major significance'] },
    { label: 'Recommendation letters', tags: ['recommendation letters', 'expert letters'] },
    { label: 'Critical role', tags: ['critical role', 'leading role'] },
    { label: 'Standard of proof', tags: ['standard of proof', 'evidentiary weight'] },
    { label: 'Two-step analysis / Kazarian', tags: ['two-step analysis', 'Kazarian'] },
  ];

  for (const q of testQueries) {
    const results = await prisma.rAGChunk.findMany({
      where: { topicTags: { hasSome: q.tags } },
      take: 3,
      select: { source: true, section: true, topicTags: true, content: true },
    });
    console.log(`\n"${q.label}" => ${results.length} chunks found`);
    if (results.length > 0) {
      const r = results[0];
      console.log(`  Top result: [${r.source}] ${r.section}`);
      console.log(`  Tags: ${r.topicTags.join(', ')}`);
      console.log(`  Preview: ${r.content.slice(0, 150).replace(/\n/g, ' ')}...`);
    }
  }

  const totalChunks = await prisma.rAGChunk.count();
  console.log(`\nTotal RAGChunk records in database: ${totalChunks}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
