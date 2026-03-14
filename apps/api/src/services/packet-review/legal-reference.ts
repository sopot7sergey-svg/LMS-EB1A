import { PrismaClient } from '@prisma/client';
import { RAG_SOURCES } from '@aipas/shared';
import type { LegalReferenceSnippet } from './types';

const prisma = new PrismaClient();

const PACKET_REVIEW_TOPICS: Record<string, string[]> = {
  packet_structure: ['filing requirements', 'I-140', 'petition format', 'exhibit list', 'packet structure'],
  criterion_evidence: ['extraordinary ability', 'evidence criteria', 'major significance'],
  final_merits: ['final merits', 'totality', 'holistic review', 'sustained acclaim', 'top of field'],
  recommendation_letters: ['recommendation letters', 'expert letters', 'independent expert'],
  filing_procedure: ['filing requirements', 'premium processing', 'RFE', 'NOID'],
  standard_of_proof: ['standard of proof', 'evidentiary weight', 'preponderance of evidence'],
  two_step: ['two-step analysis', 'Kazarian'],
};

const PACKET_REVIEW_SOURCES = [
  RAG_SOURCES.CFR_204_5_H,
  RAG_SOURCES.USCIS_PM_VOL6_PART_F_CH2,
  RAG_SOURCES.CHAWATHE,
  RAG_SOURCES.USCIS_PM_VOL1_PART_E_CH6,
  'Form I-140 Instructions',
  'I-140 Required Initial Evidence Checklist',
  'USCIS EB-1 Overview',
  'USCIS Policy Alert PA-2024-31',
  'AAO Non-Precedent Decision (Jul 2024) — Final Merits',
  'AAO Non-Precedent Decision (Oct 2024) — Final Merits',
  'AAO Non-Precedent Decision — Weak Letters',
  'AAO Non-Precedent Decision — Original Contributions',
  'AAO Non-Precedent Decision — Critical Role',
];

const CRITERION_TOPICS: Record<string, string[]> = {
  C1: ['awards', 'prizes'],
  C2: ['membership', 'associations'],
  C3: ['published material', 'media'],
  C4: ['judging', 'peer review'],
  C5: ['original contributions', 'major significance'],
  C6: ['authorship', 'scholarly articles'],
  C7: ['exhibitions', 'showcases'],
  C8: ['leading role', 'critical role', 'distinguished organizations'],
  C9: ['high salary', 'remuneration'],
  C10: ['commercial success'],
};

function scoreChunk(chunk: { topicTags: string[]; source: string; content: string }, queryTags: string[]): number {
  let score = 0;
  for (const tag of queryTags) {
    if (chunk.topicTags.includes(tag)) score += 3;
  }
  const PRIMARY_SOURCES = new Set([
    RAG_SOURCES.CFR_204_5_H,
    RAG_SOURCES.USCIS_PM_VOL6_PART_F_CH2,
    RAG_SOURCES.CHAWATHE,
    'Form I-140 Instructions',
    'I-140 Required Initial Evidence Checklist',
    'USCIS EB-1 Overview',
    'USCIS Policy Alert PA-2024-31',
  ]);
  if (PRIMARY_SOURCES.has(chunk.source)) score += 2;

  const contentLen = chunk.content.length;
  if (contentLen >= 400 && contentLen <= 2000) score += 1;

  return score;
}

export async function retrieveForPacketReview(
  criteriaIds: string[]
): Promise<LegalReferenceSnippet[]> {
  const queryTags = [
    ...PACKET_REVIEW_TOPICS.packet_structure,
    ...PACKET_REVIEW_TOPICS.criterion_evidence,
    ...PACKET_REVIEW_TOPICS.final_merits,
    ...PACKET_REVIEW_TOPICS.standard_of_proof,
    ...PACKET_REVIEW_TOPICS.two_step,
  ];

  for (const cId of criteriaIds) {
    if (CRITERION_TOPICS[cId]) {
      queryTags.push(...CRITERION_TOPICS[cId]);
    }
  }

  try {
    const chunks = await prisma.rAGChunk.findMany({
      where: {
        OR: [
          { topicTags: { hasSome: queryTags } },
          { source: { in: PACKET_REVIEW_SOURCES } },
        ],
      },
      take: 80,
    });

    if (chunks.length > 0) {
      const scored = chunks.map((c) => ({
        chunk: c,
        score: scoreChunk(
          { topicTags: c.topicTags, source: c.source, content: c.content },
          queryTags
        ),
      }));
      scored.sort((a, b) => b.score - a.score);

      const seenSources = new Map<string, number>();
      const selected: typeof scored = [];
      const MAX_PER_SOURCE = 5;
      const MAX_RESULTS = 25;

      for (const item of scored) {
        if (selected.length >= MAX_RESULTS) break;
        const srcCount = seenSources.get(item.chunk.source) ?? 0;
        if (srcCount >= MAX_PER_SOURCE) continue;
        seenSources.set(item.chunk.source, srcCount + 1);
        selected.push(item);
      }

      return selected.map((s) => ({
        id: s.chunk.id,
        source: s.chunk.source,
        section: s.chunk.section,
        content: s.chunk.content,
        topicTags: s.chunk.topicTags,
      }));
    }
  } catch (error) {
    console.error('[PacketReview] Legal reference retrieval error:', error);
  }

  return getDefaultPacketReviewSnippets(criteriaIds);
}

function getDefaultPacketReviewSnippets(criteriaIds: string[]): LegalReferenceSnippet[] {
  const snippets: LegalReferenceSnippet[] = [
    {
      id: 'default-pr-structure',
      source: RAG_SOURCES.CFR_204_5_H,
      section: '8 CFR 204.5(h)(3)',
      content:
        'A petition for an alien of extraordinary ability must be accompanied by evidence that the alien has sustained national or international acclaim and that his or her achievements have been recognized in the field of expertise. Such evidence shall include evidence of a one-time achievement (that is, a major, internationally recognized award), or at least three of the following forms of documentation.',
      topicTags: ['extraordinary ability', 'filing requirements'],
    },
    {
      id: 'default-pr-final-merits',
      source: RAG_SOURCES.USCIS_PM_VOL6_PART_F_CH2,
      section: 'Final Merits Determination',
      content:
        'After determining that the petitioner has submitted evidence that meets at least three criteria, USCIS officers then evaluate the evidence together when considering the petition in its entirety to make a final merits determination of whether or not the petitioner, by a preponderance of the evidence, has demonstrated the required high level of expertise for the immigrant classification.',
      topicTags: ['final merits', 'totality'],
    },
    {
      id: 'default-pr-kazarian',
      source: RAG_SOURCES.KAZARIAN,
      section: 'Two-Step Analysis',
      content:
        'The Kazarian court established a two-step analysis: first, determine whether the evidence meets the regulatory criteria; second, evaluate whether the totality of the evidence demonstrates that the beneficiary has sustained national or international acclaim and is among the small percentage at the very top of the field.',
      topicTags: ['Kazarian', 'two-step analysis'],
    },
  ];

  const criterionGuidance: Record<string, string> = {
    C1: 'Documentation of the alien\'s receipt of lesser nationally or internationally recognized prizes or awards for excellence in the field of endeavor.',
    C2: 'Documentation of the alien\'s membership in associations in the field for which classification is sought, which require outstanding achievements of their members.',
    C3: 'Published material about the alien in professional or major trade publications or other major media.',
    C4: 'Evidence of the alien\'s participation, either individually or on a panel, as a judge of the work of others in the same or an allied field.',
    C5: 'Evidence of the alien\'s original scientific, scholarly, artistic, athletic, or business-related contributions of major significance in the field.',
    C6: 'Evidence of the alien\'s authorship of scholarly articles in the field, in professional or major trade publications or other major media.',
    C7: 'Evidence of the display of the alien\'s work in the field at artistic exhibitions or showcases.',
    C8: 'Evidence that the alien has performed in a leading or critical role for organizations or establishments that have a distinguished reputation.',
    C9: 'Evidence that the alien has commanded a high salary or other significantly high remuneration for services.',
    C10: 'Evidence of commercial successes in the performing arts.',
  };

  for (const cId of criteriaIds) {
    if (criterionGuidance[cId]) {
      snippets.push({
        id: `default-pr-${cId}`,
        source: RAG_SOURCES.CFR_204_5_H,
        section: `8 CFR 204.5(h)(3) — ${cId}`,
        content: criterionGuidance[cId],
        topicTags: [cId],
      });
    }
  }

  return snippets;
}
