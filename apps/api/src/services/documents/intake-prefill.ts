import { getDocumentBuilderConfig } from '@aipas/shared';
import { AIGateway } from '../ai/gateway';
import { extractDocumentTextDetailed, type ExtractableDocumentRef } from './text-extraction';

export interface DocumentRef {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  caseId: string;
}

export interface PrefillSuggestion {
  questionId: string;
  value: unknown;
  source: string;
  confidence?: 'high' | 'medium' | 'low';
}

function hasUsableAiConfig(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return Boolean(key && key !== 'your-openai-api-key');
}

export async function suggestIntakePrefill(
  documents: DocumentRef[],
  existingAnswers: Record<string, unknown>
): Promise<PrefillSuggestion[]> {
  const config = getDocumentBuilderConfig('intake_questionnaire');
  if (!config || !config.questions.length) return [];

  const questionIds = config.questions.map((q) => q.id).filter((id) => id !== 'voice_notes');
  const parts: string[] = [];

  for (const doc of documents) {
    const extraction = await extractDocumentTextDetailed(doc as ExtractableDocumentRef);
    if (extraction.extractionSucceeded && extraction.extractedText.trim().length > 0) {
      parts.push(`--- Document: ${doc.originalName} ---\n${extraction.extractedText.trim().slice(0, 15000)}`);
    } else {
      parts.push(`--- Document: ${doc.originalName} ---\n(Unreadable or binary; ${extraction.failureReason || 'use filename as hint for relevant sections.'})`);
    }
  }

  const combined = parts.join('\n\n');
  if (!combined.trim()) return [];

  if (!hasUsableAiConfig()) {
    return buildFallbackSuggestions(documents, questionIds);
  }

  const aiGateway = new AIGateway();
  try {
    const result = await aiGateway.chatWithJSON<{ suggestions: PrefillSuggestion[] }>({
      systemPrompt: [
        'You are an EB1A intake assistant. Given document content (or document names when content is not available), suggest values for the Intake Questionnaire.',
        'Return JSON: { "suggestions": [ { "questionId": string, "value": any (string, array, or object per question type), "source": "Document name or excerpt", "confidence": "high"|"medium"|"low" } ] }.',
        'Only suggest for questionIds that match the intake schema (e.g. legal_name, date_of_birth, field_definition, career_timeline_entries, signature_contributions, awards_entries, memberships_entries, published_material_entries, judging_entries, original_contributions_entries, scholarly_entries, leading_role_entries, us_endeavor, evidence_inventory_entries, etc.).',
        'For repeatable questions use array of objects with the expected field ids. For short_text/long_text use string. For date use YYYY-MM-DD string.',
        'Do not suggest for questionId voice_notes. Skip sections where you have no evidence. Be concise; prefer high-confidence suggestions.',
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: `Existing answers (do not duplicate; only add or refine):\n${JSON.stringify(existingAnswers, null, 2)}\n\nDocument content or metadata:\n${combined}\n\nReturn suggested prefill values as JSON.`,
        },
      ],
      temperature: 0.2,
      maxTokens: 4000,
    });

    if (!result?.suggestions || !Array.isArray(result.suggestions)) return [];
    return result.suggestions.filter(
      (s: PrefillSuggestion) => s && typeof s.questionId === 'string' && s.value != null && typeof s.source === 'string'
    );
  } catch (error) {
    console.error('Intake suggest-prefill AI failed:', error);
    return buildFallbackSuggestions(documents, questionIds);
  }
}

function buildFallbackSuggestions(documents: DocumentRef[], questionIds: string[]): PrefillSuggestion[] {
  const suggestions: PrefillSuggestion[] = [];
  const names = documents.map((d) => d.originalName.toLowerCase());
  const hasResume = names.some((n) => n.includes('resume') || n.includes('cv'));
  const hasBio = names.some((n) => n.includes('bio'));
  const hasAwards = names.some((n) => n.includes('award'));
  const hasPublications = names.some((n) => n.includes('publication') || n.includes('paper'));
  const source = documents.map((d) => d.originalName).join(', ');

  if (hasResume && questionIds.includes('career_timeline_entries')) {
    suggestions.push({
      questionId: 'career_timeline_entries',
      value: [],
      source: `Extract from: ${source}. Uploaded document may contain employment history; add entries manually or re-upload as .txt for auto-suggest.`,
      confidence: 'low',
    });
  }
  if (hasAwards && questionIds.includes('awards_entries')) {
    suggestions.push({
      questionId: 'awards_entries',
      value: [],
      source: `Extract from: ${source}. Add award names, issuers, and dates from your document.`,
      confidence: 'low',
    });
  }
  if (hasPublications && questionIds.includes('scholarly_entries')) {
    suggestions.push({
      questionId: 'scholarly_entries',
      value: [],
      source: `Extract from: ${source}. Add publication titles and venues.`,
      confidence: 'low',
    });
  }
  if (hasBio && questionIds.includes('field_definition')) {
    suggestions.push({
      questionId: 'field_definition',
      value: '',
      source: `Review your bio (${source}) and paste or type your field definition here.`,
      confidence: 'low',
    });
  }
  return suggestions;
}
