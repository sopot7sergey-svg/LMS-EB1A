import path from 'path';
import fs from 'fs';
import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib';
import { PrismaClient } from '@prisma/client';
import { resolveStoredDocumentPath } from '../documents/storage';
import { extractDocumentTextDetailed } from '../documents/text-extraction';
import { buildPacketPlan } from './packet-structure';
import type { CompileOptions, CompileProgress, PacketItem, PacketPlan } from './types';

const prisma = new PrismaClient();
const COMPILE_OUTPUT_DIR = path.join(process.cwd(), 'uploads', 'compile');
const PAGE_SIZE: [number, number] = [612, 792];
const LEFT_MARGIN = 72;
const TOP_MARGIN = 720;
const LINE_HEIGHT = 14;
const CONTENT_FONT_SIZE = 10;
const BODY_MAX_CHARS = 95;

const DEFAULT_OPTIONS: CompileOptions = {
  criteriaIds: [],
  orderingStrategy: 'strength-first',
  includeForms: true,
  includeDrafts: false,
  includeDuplicates: false,
  includeLowConfidence: true,
  pageNumberFormat: 'simple',
  includeTOC: true,
  includeExhibitIndex: true,
};

type ResolvedDocumentInfo = {
  resolvedPath: string | null;
  textContent?: string | null;
  pdfPageCount?: number;
  textExtractionFailed?: boolean;
  textFailureReason?: string;
};

type RenderBlock =
  | { type: 'section'; key: string; title: string; subtitle: string; pageCount: 1 }
  | { type: 'criterion'; key: string; title: string; subtitle: string; pageCount: 1 }
  | { type: 'item'; item: PacketItem; pageCount: number };

function wrapParagraph(paragraph: string, maxChars = BODY_MAX_CHARS): string[] {
  const trimmed = paragraph.trim();
  if (!trimmed) return [''];

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function composeTextLines(item: PacketItem, text: string): string[] {
  const lines: string[] = [
    `${item.exhibitCode} — ${item.title}`,
    item.sectionTitle,
  ];

  if (item.packetSubsectionTitle) {
    lines.push(item.packetSubsectionTitle);
  }

  lines.push('');

  for (const paragraph of text.replace(/\r\n/g, '\n').split('\n')) {
    lines.push(...wrapParagraph(paragraph));
  }

  return lines;
}

function paginateLines(lines: string[], linesPerPage = 42): string[][] {
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }
  return pages.length ? pages : [['']];
}

async function loadPdfPageCount(filePath: string): Promise<number> {
  const bytes = fs.readFileSync(filePath);
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

async function getResolvedDocumentInfo(document: any, cache: Map<string, ResolvedDocumentInfo>): Promise<ResolvedDocumentInfo> {
  const existing = cache.get(document.id);
  if (existing) return existing;

  const { resolvedPath } = resolveStoredDocumentPath(document);
  const info: ResolvedDocumentInfo = { resolvedPath };
  cache.set(document.id, info);
  return info;
}

async function ensureTextContent(
  document: any,
  info: ResolvedDocumentInfo
): Promise<string> {
  if (typeof info.textContent === 'string') {
    return info.textContent;
  }

  const extraction = await extractDocumentTextDetailed({
    id: document.id,
    originalName: document.originalName,
    filename: document.filename,
    mimeType: document.mimeType,
    caseId: document.caseId,
  });

  info.textContent = extraction.extractedText || '';
  info.textExtractionFailed = !extraction.extractionSucceeded;
  info.textFailureReason = extraction.failureReason;
  return info.textContent;
}

async function estimateItemPageCount(
  item: PacketItem,
  documentLookup: Map<string, any>,
  resolvedCache: Map<string, ResolvedDocumentInfo>
): Promise<number> {
  if (item.sourceType === 'generated') {
    return paginateLines(composeTextLines(item, item.generatedText || '')).length;
  }

  const document = item.sourceDocumentId ? documentLookup.get(item.sourceDocumentId) : null;
  if (!document) {
    return 1;
  }

  const info = await getResolvedDocumentInfo(document, resolvedCache);
  if (!info.resolvedPath) {
    return 1;
  }

  if (document.mimeType === 'application/pdf') {
    info.pdfPageCount ??= await loadPdfPageCount(info.resolvedPath);
    return 1 + info.pdfPageCount;
  }

  if (document.mimeType.startsWith('image/')) {
    return 2;
  }

  if (
    document.mimeType === 'text/plain' ||
    document.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    document.mimeType === 'application/msword'
  ) {
    const text =
      document.mimeType === 'text/plain'
        ? (info.textContent ??= fs.readFileSync(info.resolvedPath, 'utf8'))
        : await ensureTextContent(document, info);
    const fallbackText =
      text.trim() ||
      info.textFailureReason ||
      `No extractable text was available for ${document.originalName}.`;
    return paginateLines(composeTextLines(item, fallbackText)).length;
  }

  return 1;
}

function buildRenderBlocks(plan: PacketPlan): RenderBlock[] {
  const blocks: RenderBlock[] = [];

  for (const section of plan.sectionOrder) {
    const sectionItems = plan.items
      .filter((item) => item.sectionCode === section.code)
      .sort((left, right) =>
        left.exhibitCode.localeCompare(right.exhibitCode, undefined, { numeric: true })
      );

    if (!sectionItems.length) continue;

    blocks.push({
      type: 'section',
      key: `section:${section.code}`,
      title: section.title,
      subtitle: section.description,
      pageCount: 1,
    });

    if (section.code === 'D') {
      const criterionGroups = Array.from(
        sectionItems.reduce((map, item) => {
          const key = item.bucketCode;
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(item);
          return map;
        }, new Map<string, PacketItem[]>())
      ).sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }));

      for (const [bucketCode, items] of criterionGroups) {
        blocks.push({
          type: 'criterion',
          key: `criterion:${bucketCode}`,
          title: `${bucketCode} — ${items[0]?.bucketTitle || bucketCode}`,
          subtitle: 'Criterion evidence ordered with primary proof first and supporting proof after.',
          pageCount: 1,
        });
        items.forEach((item) => blocks.push({ type: 'item', item, pageCount: item.pageCount }));
      }
      continue;
    }

    sectionItems.forEach((item) => blocks.push({ type: 'item', item, pageCount: item.pageCount }));
  }

  return blocks;
}

function applyPageLayout(plan: PacketPlan): RenderBlock[] {
  const blocks = buildRenderBlocks(plan);
  const sectionStartPages = new Map<string, number>();
  const criterionStartPages = new Map<string, number>();
  let currentPage = 1;

  for (const block of blocks) {
    if (block.type === 'section') {
      sectionStartPages.set(block.key, currentPage);
      currentPage += block.pageCount;
      continue;
    }

    if (block.type === 'criterion') {
      criterionStartPages.set(block.key, currentPage);
      currentPage += block.pageCount;
      continue;
    }

    block.item.startPage = currentPage;
    block.item.endPage = currentPage + block.pageCount - 1;
    currentPage += block.pageCount;
  }

  const tocEntries = [];
  for (const section of plan.sectionOrder) {
    const key = `section:${section.code}`;
    const startPage = sectionStartPages.get(key);
    if (!startPage) continue;
    tocEntries.push({ code: section.code, title: section.title, startPage });

    if (section.code === 'D') {
      const criterionItems = plan.items
        .filter((item) => item.sectionCode === 'D')
        .sort((left, right) =>
          left.bucketCode.localeCompare(right.bucketCode, undefined, { numeric: true })
        );
      const seen = new Set<string>();
      for (const item of criterionItems) {
        if (seen.has(item.bucketCode)) continue;
        seen.add(item.bucketCode);
        const criterionPage = criterionStartPages.get(`criterion:${item.bucketCode}`);
        if (!criterionPage) continue;
        tocEntries.push({
          code: item.bucketCode,
          title: item.bucketTitle,
          startPage: criterionPage,
        });
      }
    }

    plan.items
      .filter((item) => item.sectionCode === section.code)
      .sort((left, right) =>
        left.exhibitCode.localeCompare(right.exhibitCode, undefined, { numeric: true })
      )
      .forEach((item) => {
        tocEntries.push({
          code: item.exhibitCode,
          title: item.title,
          startPage: item.startPage || 1,
        });
      });
  }

  plan.tocEntries = tocEntries;
  plan.exhibitIndex = plan.items
    .slice()
    .sort((left, right) =>
      left.exhibitCode.localeCompare(right.exhibitCode, undefined, { numeric: true })
    )
    .map((item) => ({
      exhibitCode: item.exhibitCode,
      title: item.title,
      sectionCode: item.sectionCode,
      evidenceRole: item.evidenceRole,
      startPage: item.startPage || 1,
      endPage: item.endPage || item.startPage || 1,
      sourceOriginalName: item.sourceOriginalName,
    }));

  return blocks;
}

function buildTocText(plan: PacketPlan): string {
  return [
    'Table of Contents',
    '',
    ...plan.tocEntries.map((entry) => `${entry.code} | ${entry.title} | ${entry.startPage}`),
  ].join('\n');
}

function buildExhibitIndexText(plan: PacketPlan): string {
  return [
    'Exhibit Index',
    '',
    ...plan.exhibitIndex.map(
      (entry) =>
        `${entry.exhibitCode} | ${entry.title} | ${entry.evidenceRole} | pages ${entry.startPage}-${entry.endPage}`
    ),
  ].join('\n');
}

function setGeneratedText(plan: PacketPlan, itemId: string, text: string) {
  const item = plan.items.find((entry) => entry.id === itemId);
  if (item) item.generatedText = text;
}

async function addPageNumbers(
  pdfDoc: PDFDocument,
  format: 'simple' | 'bates',
  startNum = 1
): Promise<void> {
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (let index = 0; index < pages.length; index++) {
    const page = pages[index];
    const number =
      format === 'bates'
        ? `EB1A-${String(startNum + index).padStart(4, '0')}`
        : String(startNum + index);
    page.drawText(number, {
      x: PAGE_SIZE[0] / 2 - 20,
      y: 20,
      size: 10,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
  }
}

async function addHeadingPage(
  pdfDoc: PDFDocument,
  title: string,
  subtitle: string,
  font: PDFFont,
  boldFont: PDFFont
) {
  const page = pdfDoc.addPage(PAGE_SIZE);
  page.drawText(title, {
    x: LEFT_MARGIN,
    y: 700,
    size: 20,
    font: boldFont,
    color: rgb(0.08, 0.08, 0.08),
  });
  page.drawText(subtitle, {
    x: LEFT_MARGIN,
    y: 666,
    size: 12,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
}

async function addTextItemPages(pdfDoc: PDFDocument, item: PacketItem, text: string, font: PDFFont, boldFont: PDFFont) {
  const pages = paginateLines(composeTextLines(item, text));
  for (const lines of pages) {
    const page = pdfDoc.addPage(PAGE_SIZE);
    page.drawText(`${item.exhibitCode} — ${item.title}`, {
      x: LEFT_MARGIN,
      y: 740,
      size: 16,
      font: boldFont,
      color: rgb(0.08, 0.08, 0.08),
    });

    let y = 708;
    for (const line of lines.slice(1)) {
      page.drawText(line || ' ', {
        x: LEFT_MARGIN,
        y,
        size: CONTENT_FONT_SIZE,
        font,
        color: rgb(0.18, 0.18, 0.18),
      });
      y -= LINE_HEIGHT;
    }
  }
}

async function addExhibitCoverPage(pdfDoc: PDFDocument, item: PacketItem, font: PDFFont, boldFont: PDFFont) {
  const page = pdfDoc.addPage(PAGE_SIZE);
  page.drawText(item.exhibitCode, {
    x: LEFT_MARGIN,
    y: 720,
    size: 24,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText(item.title, {
    x: LEFT_MARGIN,
    y: 680,
    size: 16,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText(item.sectionTitle, {
    x: LEFT_MARGIN,
    y: 650,
    size: 12,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  page.drawText(`Evidence role: ${item.evidenceRole}`, {
    x: LEFT_MARGIN,
    y: 626,
    size: 11,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  if (item.review?.finalStatus) {
    page.drawText(`Document review status: ${item.review.finalStatus}`, {
      x: LEFT_MARGIN,
      y: 606,
      size: 11,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
  }
}

async function addImagePage(pdfDoc: PDFDocument, imagePath: string, mimeType: string) {
  const bytes = fs.readFileSync(imagePath);
  const page = pdfDoc.addPage(PAGE_SIZE);

  if (mimeType === 'image/png') {
    const image = await pdfDoc.embedPng(bytes);
    const { width, height } = image.scale(1);
    const scale = Math.min(PAGE_SIZE[0] / width, PAGE_SIZE[1] / height) * 0.9;
    page.drawImage(image, {
      x: (PAGE_SIZE[0] - width * scale) / 2,
      y: (PAGE_SIZE[1] - height * scale) / 2,
      width: width * scale,
      height: height * scale,
    });
    return;
  }

  const image = await pdfDoc.embedJpg(bytes);
  const { width, height } = image.scale(1);
  const scale = Math.min(PAGE_SIZE[0] / width, PAGE_SIZE[1] / height) * 0.9;
  page.drawImage(image, {
    x: (PAGE_SIZE[0] - width * scale) / 2,
    y: (PAGE_SIZE[1] - height * scale) / 2,
    width: width * scale,
    height: height * scale,
  });
}

async function renderPacketItem(
  pdfDoc: PDFDocument,
  item: PacketItem,
  documentLookup: Map<string, any>,
  resolvedCache: Map<string, ResolvedDocumentInfo>,
  exceptions: string[],
  font: PDFFont,
  boldFont: PDFFont
) {
  if (item.sourceType === 'generated') {
    await addTextItemPages(pdfDoc, item, item.generatedText || '', font, boldFont);
    return;
  }

  const document = item.sourceDocumentId ? documentLookup.get(item.sourceDocumentId) : null;
  if (!document) {
    await addTextItemPages(pdfDoc, item, 'Source document not found for this packet entry.', font, boldFont);
    exceptions.push(`${item.title}: source document record missing during compile.`);
    return;
  }

  const info = await getResolvedDocumentInfo(document, resolvedCache);
  if (!info.resolvedPath) {
    await addTextItemPages(pdfDoc, item, 'Source file could not be resolved from storage.', font, boldFont);
    exceptions.push(`${item.title}: source file not found in storage.`);
    return;
  }

  if (
    document.mimeType === 'text/plain' ||
    document.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    document.mimeType === 'application/msword'
  ) {
    const text =
      document.mimeType === 'text/plain'
        ? (info.textContent ??= fs.readFileSync(info.resolvedPath, 'utf8'))
        : await ensureTextContent(document, info);
    const fallbackText =
      text.trim() ||
      info.textFailureReason ||
      `No extractable text was available for ${document.originalName}.`;
    await addTextItemPages(pdfDoc, item, fallbackText, font, boldFont);
    return;
  }

  await addExhibitCoverPage(pdfDoc, item, font, boldFont);

  try {
    if (document.mimeType === 'application/pdf') {
      const sourcePdf = await PDFDocument.load(fs.readFileSync(info.resolvedPath));
      const pages = await pdfDoc.copyPages(sourcePdf, sourcePdf.getPageIndices());
      pages.forEach((page) => pdfDoc.addPage(page));
      return;
    }

    if (document.mimeType.startsWith('image/')) {
      await addImagePage(pdfDoc, info.resolvedPath, document.mimeType);
      return;
    }

    await addTextItemPages(
      pdfDoc,
      item,
      `Unsupported source format: ${document.mimeType}. This exhibit remained in its canonical packet location, but its file body could not be rendered directly.`,
      font,
      boldFont
    );
  } catch (error) {
    await addTextItemPages(
      pdfDoc,
      item,
      `Failed to render source file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      font,
      boldFont
    );
    exceptions.push(`${item.title}: ${error instanceof Error ? error.message : 'Failed to render source file'}`);
  }
}

function dedupeDocuments(documents: any[]): any[] {
  const seen = new Set<string>();
  return documents.filter((document) => {
    const key = [
      document.originalName.trim().toLowerCase(),
      document.size,
      document.metadata?.slotType || '',
      document.metadata?.reviewForDocumentId || '',
      document.metadata?.reviewKind || '',
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function runCompile(
  jobId: string,
  caseId: string,
  options: Partial<CompileOptions>,
  onProgress: (p: CompileProgress) => Promise<void>
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const updateProgress = async (status: string, progress: number, error?: string) => {
    await prisma.compileJob.update({
      where: { id: jobId },
      data: { status, progress, error: error || null },
    });
    await onProgress({ status, progress, error });
  };

  try {
    await updateProgress('collecting', 5);

    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        documents: true,
        eers: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!caseRecord) throw new Error('Case not found');

    let documents = caseRecord.documents.filter((document) => {
      const metadata = (document.metadata || {}) as any;
      if (!opts.includeDrafts && metadata?.isDraft) return false;
      if (!opts.includeLowConfidence && metadata?.confidenceScore !== undefined && metadata.confidenceScore < 0.5) {
        return false;
      }
      return true;
    });

    if (!opts.includeDuplicates) {
      documents = dedupeDocuments(documents);
    }

    const compileDocuments = documents.map((document) => ({
      ...document,
      category: document.category,
      metadata: (document.metadata ?? null) as any,
    }));

    const documentLookup = new Map(compileDocuments.map((document) => [document.id, document]));
    const resolvedCache = new Map<string, ResolvedDocumentInfo>();

    await updateProgress('normalizing', 20);

    const plan = buildPacketPlan(
      {
        id: caseRecord.id,
        caseAxisStatement: caseRecord.caseAxisStatement,
        proposedEndeavor: caseRecord.proposedEndeavor,
        criteriaSelected: caseRecord.criteriaSelected,
        documents: compileDocuments,
        latestEer: caseRecord.eers[0]
          ? {
              executiveSummary: caseRecord.eers[0].executiveSummary,
              criterionItems: caseRecord.eers[0].criterionItems,
              finalMeritsItems: caseRecord.eers[0].finalMeritsItems,
              optionalPackagingItems: caseRecord.eers[0].optionalPackagingItems,
              createdAt: caseRecord.eers[0].createdAt,
            }
          : null,
      },
      opts
    );

    for (let iteration = 0; iteration < 3; iteration++) {
      for (const item of plan.items) {
        item.pageCount = await estimateItemPageCount(item, documentLookup, resolvedCache);
      }
      applyPageLayout(plan);
      setGeneratedText(plan, 'generated:B-2', buildTocText(plan));
      setGeneratedText(plan, 'generated:F-1', buildExhibitIndexText(plan));
    }

    for (const item of plan.items) {
      item.pageCount = await estimateItemPageCount(item, documentLookup, resolvedCache);
    }
    const blocks = applyPageLayout(plan);

    await updateProgress('merging', 55);

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const exceptions: string[] = [];

    for (const block of blocks) {
      if (block.type === 'section') {
        await addHeadingPage(pdfDoc, block.title, block.subtitle, font, boldFont);
        continue;
      }
      if (block.type === 'criterion') {
        await addHeadingPage(pdfDoc, block.title, block.subtitle, font, boldFont);
        continue;
      }
      await renderPacketItem(pdfDoc, block.item, documentLookup, resolvedCache, exceptions, font, boldFont);
    }

    if (exceptions.length) {
      await addTextItemPages(
        pdfDoc,
        {
          id: 'generated:F-5.exceptions',
          sourceType: 'generated',
          sectionCode: 'F',
          sectionTitle: 'Section F — Review / QA / Internal Support',
          bucketCode: 'F-5',
          bucketTitle: 'Other Internal Support',
          exhibitCode: 'F-5',
          title: 'Compilation Exceptions',
          evidenceRole: 'supporting',
          generatedText: exceptions.join('\n'),
          pageCount: 0,
        },
        exceptions.join('\n'),
        font,
        boldFont
      );
    }

    await updateProgress('bookmarking', 85);
    await addPageNumbers(pdfDoc, opts.pageNumberFormat, 1);

    await updateProgress('finalizing', 95);

    fs.mkdirSync(COMPILE_OUTPUT_DIR, { recursive: true });
    const outputPath = path.join(COMPILE_OUTPUT_DIR, `${caseId}-${jobId}.pdf`);
    fs.writeFileSync(outputPath, await pdfDoc.save());

    const { ARTIFACT_SCHEMA_VERSION } = await import('../../constants/artifact-versions');
    const latestVersion = await prisma.compileArtifact.count({ where: { caseId } });
    await prisma.compileArtifact.create({
      data: {
        caseId,
        jobId,
        version: latestVersion + 1,
        filePath: outputPath,
        optionsHash: JSON.stringify({
          artifactSchemaVersion: ARTIFACT_SCHEMA_VERSION,
          options: opts,
          packetPlan: {
            items: plan.items.map((item) => ({
              exhibitCode: item.exhibitCode,
              title: item.title,
              sectionCode: item.sectionCode,
              bucketCode: item.bucketCode,
              evidenceRole: item.evidenceRole,
              startPage: item.startPage,
              endPage: item.endPage,
              sourceDocumentId: item.sourceDocumentId,
            })),
            tocEntries: plan.tocEntries,
            exhibitIndex: plan.exhibitIndex,
          },
        }),
      },
    });

    await updateProgress('completed', 100);
    return outputPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Compilation failed';
    await updateProgress('failed', 0, message);
    throw error;
  }
}
