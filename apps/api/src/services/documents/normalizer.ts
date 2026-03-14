import { DocumentCategory, DocumentMetadata } from '@aipas/shared';

interface NormalizedDocument {
  category: DocumentCategory;
  metadata: DocumentMetadata;
  consistencyFlags: string[];
}

export class DocumentNormalizer {
  classifyDocument(filename: string, content?: string): DocumentCategory {
    const lowerFilename = filename.toLowerCase();

    if (lowerFilename.includes('letter') || lowerFilename.includes('recommendation')) {
      return 'Expert Letters';
    }
    if (lowerFilename.includes('pay') || lowerFilename.includes('salary') ||
        lowerFilename.includes('w2') || lowerFilename.includes('w-2') ||
        lowerFilename.includes('offer')) {
      return 'Forms & Fees';
    }
    if (lowerFilename.includes('article') || lowerFilename.includes('interview') ||
        lowerFilename.includes('press') || lowerFilename.includes('media')) {
      return 'Evidence (Criteria)';
    }
    if (lowerFilename.includes('publication') || lowerFilename.includes('paper') ||
        lowerFilename.includes('journal')) {
      return 'Evidence (Criteria)';
    }
    if (lowerFilename.includes('award') || lowerFilename.includes('certificate') ||
        lowerFilename.includes('prize')) {
      return 'Evidence (Criteria)';
    }
    if (lowerFilename.includes('judg') || lowerFilename.includes('review') ||
        lowerFilename.includes('panel')) {
      return 'Evidence (Criteria)';
    }
    if (lowerFilename.includes('member') || lowerFilename.includes('association')) {
      return 'Evidence (Criteria)';
    }
    if (lowerFilename.includes('role') || lowerFilename.includes('org') ||
        lowerFilename.includes('chart')) {
      return 'Evidence (Criteria)';
    }
    if (lowerFilename.includes('contribution') || lowerFilename.includes('patent') ||
        lowerFilename.includes('innovation')) {
      return 'Evidence (Criteria)';
    }

    return 'Case Intake & Profile';
  }

  extractMetadata(content: string): DocumentMetadata {
    const metadata: DocumentMetadata = {};

    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
      /\b\d{4}-\d{2}-\d{2}\b/g,
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    ];

    const dates: string[] = [];
    datePatterns.forEach((pattern) => {
      const matches = content.match(pattern);
      if (matches) {
        dates.push(...matches);
      }
    });
    if (dates.length > 0) {
      metadata.dates = [...new Set(dates)];
    }

    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = content.match(emailPattern);

    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = content.match(urlPattern);
    if (urls) {
      metadata.links = [...new Set(urls)];
    }

    const dollarPattern = /\$[\d,]+(?:\.\d{2})?/g;
    const amounts = content.match(dollarPattern);
    if (amounts) {
      metadata.metrics = metadata.metrics || {};
      amounts.forEach((amount, index) => {
        metadata.metrics![`amount_${index}`] = amount;
      });
    }

    return metadata;
  }

  checkConsistency(documents: Array<{ metadata?: DocumentMetadata }>): string[] {
    const flags: string[] = [];

    const allDates = new Set<string>();
    const allOrgs = new Set<string>();
    const allTitles = new Set<string>();

    documents.forEach((doc) => {
      if (doc.metadata?.dates) {
        doc.metadata.dates.forEach((d) => allDates.add(d));
      }
      if (doc.metadata?.organizations) {
        doc.metadata.organizations.forEach((o) => allOrgs.add(o.toLowerCase()));
      }
      if (doc.metadata?.titles) {
        doc.metadata.titles.forEach((t) => allTitles.add(t.toLowerCase()));
      }
    });

    if (allOrgs.size > 5) {
      flags.push('Multiple organization name variations detected - verify consistency');
    }

    if (allTitles.size > 5) {
      flags.push('Multiple job title variations detected - verify consistency');
    }

    return flags;
  }

  normalizeDocument(filename: string, content?: string): NormalizedDocument {
    const category = this.classifyDocument(filename, content);
    const metadata = content ? this.extractMetadata(content) : {};

    return {
      category,
      metadata,
      consistencyFlags: [],
    };
  }
}
