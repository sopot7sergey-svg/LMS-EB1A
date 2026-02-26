import { PrismaClient } from '@prisma/client';
import { RAG_SOURCES } from '@lms-eb1a/shared';

const prisma = new PrismaClient();

interface RAGChunk {
  id: string;
  source: string;
  section: string | null;
  content: string;
  topicTags: string[];
}

export class RAGService {
  async retrieveForCriterion(criterionId: string): Promise<RAGChunk[]> {
    const criterionTopics: Record<string, string[]> = {
      C1: ['awards', 'prizes', 'recognition'],
      C2: ['membership', 'associations', 'selectivity'],
      C3: ['published material', 'media', 'press'],
      C4: ['judging', 'peer review', 'evaluation'],
      C5: ['original contributions', 'major significance', 'impact'],
      C6: ['authorship', 'scholarly articles', 'publications'],
      C7: ['exhibitions', 'artistic display', 'showcases'],
      C8: ['leading role', 'critical role', 'distinguished organizations'],
      C9: ['high salary', 'remuneration', 'compensation'],
      C10: ['commercial success', 'performing arts', 'box office'],
    };

    const topics = criterionTopics[criterionId] || [];

    try {
      const chunks = await prisma.rAGChunk.findMany({
        where: {
          OR: [
            { topicTags: { hasSome: topics } },
            { source: RAG_SOURCES.CFR_204_5_H },
            { source: RAG_SOURCES.USCIS_PM_VOL6_PART_F_CH2 },
          ],
        },
        take: 10,
      });

      if (chunks.length === 0) {
        return this.getDefaultChunksForCriterion(criterionId);
      }

      return chunks;
    } catch (error) {
      console.error('RAG retrieval error:', error);
      return this.getDefaultChunksForCriterion(criterionId);
    }
  }

  async retrieveForFinalMerits(): Promise<RAGChunk[]> {
    try {
      const chunks = await prisma.rAGChunk.findMany({
        where: {
          OR: [
            { topicTags: { hasSome: ['final merits', 'totality', 'holistic review'] } },
            { source: RAG_SOURCES.USCIS_PM_VOL6_PART_F_CH2 },
            { source: RAG_SOURCES.KAZARIAN },
            { source: RAG_SOURCES.CHAWATHE },
          ],
        },
        take: 10,
      });

      if (chunks.length === 0) {
        return this.getDefaultFinalMeritsChunks();
      }

      return chunks;
    } catch (error) {
      console.error('RAG retrieval error:', error);
      return this.getDefaultFinalMeritsChunks();
    }
  }

  async retrieveForProcedure(): Promise<RAGChunk[]> {
    try {
      const chunks = await prisma.rAGChunk.findMany({
        where: {
          OR: [
            { source: RAG_SOURCES.USCIS_PM_VOL1_PART_E_CH6 },
            { source: RAG_SOURCES.USCIS_PM_VOL1_PART_E_CH9 },
            { source: RAG_SOURCES.CFR_103_2 },
          ],
        },
        take: 10,
      });

      return chunks;
    } catch (error) {
      console.error('RAG retrieval error:', error);
      return [];
    }
  }

  private getDefaultChunksForCriterion(criterionId: string): RAGChunk[] {
    const criterionGuidance: Record<string, string> = {
      C1: 'Documentation of the alien\'s receipt of lesser nationally or internationally recognized prizes or awards for excellence in the field of endeavor.',
      C2: 'Documentation of the alien\'s membership in associations in the field for which classification is sought, which require outstanding achievements of their members, as judged by recognized national or international experts in their disciplines or fields.',
      C3: 'Published material about the alien in professional or major trade publications or other major media, relating to the alien\'s work in the field for which classification is sought.',
      C4: 'Evidence of the alien\'s participation, either individually or on a panel, as a judge of the work of others in the same or an allied field of specification for which classification is sought.',
      C5: 'Evidence of the alien\'s original scientific, scholarly, artistic, athletic, or business-related contributions of major significance in the field.',
      C6: 'Evidence of the alien\'s authorship of scholarly articles in the field, in professional or major trade publications or other major media.',
      C7: 'Evidence of the display of the alien\'s work in the field at artistic exhibitions or showcases.',
      C8: 'Evidence that the alien has performed in a leading or critical role for organizations or establishments that have a distinguished reputation.',
      C9: 'Evidence that the alien has commanded a high salary or other significantly high remuneration for services, in relation to others in the field.',
      C10: 'Evidence of commercial successes in the performing arts, as shown by box office receipts or record, cassette, compact disk, or video sales.',
    };

    return [{
      id: `default-${criterionId}`,
      source: RAG_SOURCES.CFR_204_5_H,
      section: `8 CFR 204.5(h)(3)(${this.getCriterionRomanNumeral(criterionId)})`,
      content: criterionGuidance[criterionId] || 'Criterion guidance not available.',
      topicTags: [criterionId],
    }];
  }

  private getCriterionRomanNumeral(criterionId: string): string {
    const mapping: Record<string, string> = {
      C1: 'i',
      C2: 'ii',
      C3: 'iii',
      C4: 'iv',
      C5: 'v',
      C6: 'vi',
      C7: 'vii',
      C8: 'viii',
      C9: 'ix',
      C10: 'x',
    };
    return mapping[criterionId] || '';
  }

  private getDefaultFinalMeritsChunks(): RAGChunk[] {
    return [
      {
        id: 'default-final-merits-1',
        source: RAG_SOURCES.USCIS_PM_VOL6_PART_F_CH2,
        section: 'Final Merits Determination',
        content: 'After determining that the petitioner has submitted evidence that meets at least three criteria, USCIS officers then evaluate the evidence together when considering the petition in its entirety to make a final merits determination of whether or not the petitioner, by a preponderance of the evidence, has demonstrated the required high level of expertise for the immigrant classification.',
        topicTags: ['final merits', 'totality', 'holistic review'],
      },
      {
        id: 'default-final-merits-2',
        source: RAG_SOURCES.KAZARIAN,
        section: 'Two-Step Analysis',
        content: 'The Kazarian court established a two-step analysis: first, determine whether the evidence meets the regulatory criteria; second, evaluate whether the totality of the evidence demonstrates that the beneficiary has sustained national or international acclaim and is among the small percentage at the very top of the field.',
        topicTags: ['two-step', 'Kazarian', 'analysis'],
      },
    ];
  }
}
