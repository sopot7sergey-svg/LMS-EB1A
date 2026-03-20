import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getAccess } from '../services/access';
import { checkQuota, recordUsage } from '../services/ai/quota';
import { AIGateway } from '../services/ai/gateway';
import type { AIChatResult } from '../services/ai/gateway';
import {
  extractDocumentTextDetailed,
  type DocumentExtractionResult,
  type ExtractableDocumentRef,
} from '../services/documents/text-extraction';
import { retrieveForPacketReview } from '../services/packet-review/legal-reference';
import { MULTILINGUAL_RESPONSE_INSTRUCTION } from '../services/ai/prompts';

const router = Router();
const prisma = new PrismaClient();
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'documents');

const AI_INSIGHTS_CATEGORY = 'AI Insights';

// ---------------------------------------------------------------------------
// Model and RAG
// ---------------------------------------------------------------------------

const ADVISOR_MODEL = process.env.OPENAI_ADVISOR_MODEL || process.env.OPENAI_MODEL || 'gpt-5.4';

// ---------------------------------------------------------------------------
// System prompts — procedural, educational, non-adjudicative
// ---------------------------------------------------------------------------

const ADVISOR_SYSTEM_PROMPT = `You are an EB-1A procedural advisor and educational assistant embedded in a case-building application.

YOUR ROLE (stay within these bounds):
- Procedural explanations: how EB-1A petitions work, what USCIS generally looks for, filing steps.
- Educational explanations: what each criterion means, what evidence typically supports it.
- Product guidance: how to use the app, what each section does, why the system may have flagged something.
- General document-purpose guidance: what a cover letter is for, what expert letters typically address.
- General criterion explanations: what C1–C10 require, what usually strengthens a section or document type.

YOU MUST NOT:
- Predict approval odds or say the user qualifies definitively.
- Provide legal advice or act as an attorney.
- Replace packet review or final audit.
- Issue case-specific filing recommendations as if from counsel.
- Say "your EB-1A will be approved," "you definitely satisfy criterion X," or "you should file now."

ACCEPTABLE PHRASING:
- "This section is commonly supported by…"
- "The system blocked generation because…"
- "USCIS generally looks for…"
- "This document type is usually used to…"
- "EB-1A petitions typically require…"

UNACCEPTABLE PHRASING:
- "Your EB-1A will be approved."
- "You definitely satisfy criterion 5."
- "You should file now."

GROUNDING:
- When answering legal or procedural questions, use the provided LEGAL REFERENCE MATERIALS.
- Prefer citing 8 CFR, USCIS Policy Manual, I-140 instructions, or other provided sources.
- Do not respond from memory alone when authoritative sources are provided.

FORMATTING:
- Use markdown headers (##) for major sections.
- Use bullet points for lists.
- Be clear and practical.
${MULTILINGUAL_RESPONSE_INSTRUCTION}`;

const INTAKE_FACT_EXTRACTION_PROMPT = `You are extracting facts from an EB-1A intake questionnaire and related case materials.

Your job is NOT to give strategy yet.
Your job is to identify only the concrete facts that are actually present in the source material.

Rules:
- Extract only facts supported by the provided materials.
- Do not infer achievements that are not stated.
- Do not give generic EB-1A explanations.
- Do not say "without direct access" or similar vague phrases.
- If the material is too thin, unreadable, or incomplete, say so explicitly.

Return JSON with this exact shape:
{
  "facts": ["..."],
  "missingInformation": ["..."],
  "primaryProfileSignals": ["..."],
  "sufficiency": "sufficient" | "partial" | "insufficient",
  "reason": "short explanation"
}

Interpret sufficiency as:
- "sufficient": enough concrete facts to support a reliable preliminary strategy opinion
- "partial": some meaningful facts exist, but major gaps remain
- "insufficient": too little concrete factual detail for a reliable strategy opinion`;

const INTAKE_STRATEGY_PROMPT = `${ADVISOR_SYSTEM_PROMPT}

SPECIAL CONTEXT: The user has attached their Intake Questionnaire and is asking for strategic case analysis.

You will receive:
1. The user's question
2. A list of extracted case facts
3. A list of missing facts / evidence gaps
4. A sufficiency level
5. Legal reference materials (use these when explaining criteria or procedure)

You MUST produce a preliminary strategic opinion, grounded only in the extracted facts and legal references.

SCOPE RULES (strict):
- Do NOT predict approval or say the user qualifies.
- Do NOT say "you should file" or "you are ready."
- Use phrasing like "this area appears potentially supportable" or "this may present a challenge."
- Ground criterion explanations in the provided legal reference materials where possible.

Mandatory structure:

## A. Preliminary Positioning
- One paragraph only
- State whether the profile appears potentially viable, borderline, weak, or promising for EB-1A
- Do not guarantee approval

## B. Key Facts Considered
- Bullet list of the concrete facts actually extracted
- No invented facts

## C. Strongest Case Axis
- Identify one primary axis
- Optionally one secondary axis
- Explain why they fit the facts

## D. Likely Strongest EB-1A Criteria
- Identify only the criteria that appear genuinely supportable
- For each: why it appears viable, what facts support it, what still needs strengthening
- Reference legal materials when explaining what each criterion requires

## E. Weak / Risky Criteria
- Identify criteria that appear weak, unsupported, or risky
- Explain whether they should be avoided, deprioritized, or developed later

## F. Main Evidence Gaps
- Focus on documentary gaps, independent corroboration, national/international recognition, quantification of impact, distinguished organizations, and similar high-value gaps

## G. Recommended Strategy
- Give a concrete filing posture recommendation
- Example: lead with 3-4 criteria only, emphasize original contributions + judging, avoid weak awards, strengthen critical role before filing

## H. Next 5 Actions
- Concrete, prioritized, practical next steps

## I. Risk Note
- One short professional caution only
- Do not repeat disclaimers elsewhere

Critical behavior rules:
- Facts first, then analysis.
- Never say "without direct access" if materials are attached.
- If the provided facts are only partial, clearly separate supported conclusions from open questions.
- If the extracted facts are insufficient, do not improvise a strategy opinion. Say so clearly and specify what exact information is missing.
- Do not turn this into a generic EB-1A explainer.
- Do not list every possible case axis unless explicitly asked.
- Prefer decisive analysis over brainstorming.
- Use the provided LEGAL REFERENCE MATERIALS when explaining criteria or procedure.
${MULTILINGUAL_RESPONSE_INSTRUCTION}`;

interface IntakeFactExtraction {
  facts: string[];
  missingInformation: string[];
  primaryProfileSignals: string[];
  sufficiency: 'sufficient' | 'partial' | 'insufficient';
  reason: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStrategyQuestion(message: string): boolean {
  const patterns = [
    /case\s*axis/i, /strong/i, /weak/i, /strateg/i, /missing/i,
    /gap/i, /criteria/i, /likely/i, /recommend/i,
    /position/i, /develop/i, /focus/i, /priorit/i, /next\s*step/i,
    /underdevelop/i, /organiz/i, /improv/i, /conclusion/i,
    /summary/i, /analys/i, /build\s*next/i, /choose/i, /obtain/i,
    /sufficient/i, /ready/i, /assess/i, /evaluat/i,
  ];
  return patterns.some((p) => p.test(message));
}

function isIntakeDocument(docName: string): boolean {
  const lower = docName.toLowerCase();
  return lower.includes('intake') || lower.includes('questionnaire');
}

function deduplicateIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

// ---------------------------------------------------------------------------
// Main route
// ---------------------------------------------------------------------------

router.post('/ask', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseId, message, documentIds, conversationHistory } = req.body;

    if (!caseId || !message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'caseId and message are required' });
    }

    const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) return res.status(404).json({ error: 'Case not found' });
    if (req.user!.role !== 'admin' && caseRecord.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userId = req.user!.role === 'admin' ? caseRecord.userId : req.user!.id;
    const access = await getAccess(userId);
    const quotaCheck = await checkQuota(userId, 'advisor_chat', access.plan as any, access.appAccessActive);
    if (!quotaCheck.allowed) {
      return res.status(403).json({ error: quotaCheck.message ?? 'AI usage limit reached' });
    }

    const uniqueDocIds = deduplicateIds(Array.isArray(documentIds) ? documentIds : []);

    let documentContext = '';
    const attachedDocNames: string[] = [];
    let hasIntakeAttached = false;
    const extractionResults: DocumentExtractionResult[] = [];

    if (uniqueDocIds.length > 0) {
      const documents = await prisma.document.findMany({
        where: { id: { in: uniqueDocIds }, caseId },
      });

      for (const doc of documents) {
        attachedDocNames.push(doc.originalName);
        if (isIntakeDocument(doc.originalName)) hasIntakeAttached = true;
        const extraction = await extractDocumentTextDetailed({
          id: doc.id,
          originalName: doc.originalName,
          filename: doc.filename,
          mimeType: doc.mimeType,
          caseId: doc.caseId,
        } as ExtractableDocumentRef);
        extractionResults.push(extraction);

        console.log(
          `[Advisor Chat] Document extraction: id=${extraction.documentId}, file="${extraction.fileName}", mime=${extraction.mimeType}, len=${extraction.extractedTextLength}, success=${extraction.extractionSucceeded}, scanned=${extraction.appearsScanned}, preview="${extraction.preview.replace(/\n/g, ' ')}"`
        );

        if (extraction.extractionSucceeded && extraction.extractedText) {
          documentContext += `\n--- Document: ${doc.originalName} ---\n${extraction.extractedText.slice(0, 20000)}\n`;
        } else {
          documentContext += `\n--- Document: ${doc.originalName} (${doc.mimeType}, ${doc.category}) ---\n[Unreadable attached file. ${extraction.failureReason || 'No meaningful text could be extracted.'}]\n`;
        }
      }
    }

    const isStrategy = isStrategyQuestion(message);
    const isIntakeStrategy = hasIntakeAttached && isStrategy;
    const showDisclaimer = isStrategy || attachedDocNames.length > 0;
    const intakeBuilderMaterial = hasIntakeAttached ? await loadIntakeBuilderMaterial(caseId) : '';
    const attachedDocumentsHaveMeaningfulText = extractionResults.some((r) => r.extractionSucceeded && r.extractedTextLength > 500);

    const aiDiag = AIGateway.diagnose({ model: ADVISOR_MODEL });
    console.log(`[Advisor Chat] AI: available=${aiDiag.available}, model=${aiDiag.model}, reason=${aiDiag.reason}`);
    console.log(`[Advisor Chat] Request: intake=${hasIntakeAttached}, strategy=${isStrategy}, docs=${attachedDocNames.length}`);

    const criteriaIds = caseRecord.criteriaSelected ?? [];
    const legalSnippets = await retrieveForPacketReview(criteriaIds.length ? criteriaIds : ['C1', 'C2', 'C3', 'C4', 'C5']);
    const legalRefBlock = legalSnippets.length
      ? legalSnippets
          .slice(0, 12)
          .map((s) => `[${s.source}${s.section ? ` — ${s.section}` : ''}]: ${s.content}`)
          .join('\n\n')
      : '';

    let answer: string;
    let usedAI = false;
    let aiMeta: Pick<AIChatResult, 'model' | 'totalTokens' | 'promptTokens' | 'completionTokens' | 'durationMs'> | null = null;

    if (aiDiag.available) {
      console.log(`[Advisor Chat] PATH: AI (model=${aiDiag.model})`);

      const aiGateway = new AIGateway({ model: ADVISOR_MODEL });
      const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      if (Array.isArray(conversationHistory)) {
        for (const msg of conversationHistory.slice(-6)) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            history.push({ role: msg.role, content: String(msg.content).slice(0, 2000) });
          }
        }
      }

      try {
        if (isIntakeStrategy) {
          const primarySourceMaterial = documentContext || '[no attached document text extracted]';
          let extraction = await extractIntakeFacts(aiGateway, message, primarySourceMaterial);
          console.log(
            `[Advisor Chat] Intake extraction: sufficiency=${extraction.sufficiency}, facts=${extraction.facts?.length ?? 0}, missing=${extraction.missingInformation?.length ?? 0}`
          );

          let extractionSourceUsed: 'attached_documents_only' | 'attached_documents_plus_builder_data' = 'attached_documents_only';
          if (
            (extraction.sufficiency === 'insufficient' || (extraction.facts?.length ?? 0) < 4) &&
            intakeBuilderMaterial
          ) {
            console.log('[Advisor Chat] Attached file extraction was too thin; augmenting with stored intake builder material');
            extraction = await extractIntakeFacts(
              aiGateway,
              message,
              [documentContext || '[no attached text extracted]', intakeBuilderMaterial].filter(Boolean).join('\n\n')
            );
            extractionSourceUsed = 'attached_documents_plus_builder_data';
            console.log(
              `[Advisor Chat] Intake extraction (augmented): sufficiency=${extraction.sufficiency}, facts=${extraction.facts?.length ?? 0}, missing=${extraction.missingInformation?.length ?? 0}`
            );
          }

          if (extraction.sufficiency === 'insufficient' || !extraction.facts?.length) {
            answer = renderInsufficientFactsResponse(
              extraction,
              extractionResults.length > 0 ? extractionResults : undefined
            );
            usedAI = true;
            aiMeta = { model: aiDiag.model, totalTokens: 0, promptTokens: 0, completionTokens: 0, durationMs: 0 };
          } else {
            const intakeUserParts = [
              legalRefBlock ? `LEGAL REFERENCE MATERIALS:\n${legalRefBlock}` : '',
              caseRecord.caseAxisStatement || criteriaIds.length
                ? `LIGHT CASE CONTEXT:\n${caseRecord.caseAxisStatement ? `Case axis: ${caseRecord.caseAxisStatement}\n` : ''}${criteriaIds.length ? `Selected criteria: ${criteriaIds.join(', ')}` : ''}`
                : '',
              `User question: ${message}`,
              `Extracted facts:\n${extraction.facts.map((fact) => `- ${fact}`).join('\n')}`,
              extraction.primaryProfileSignals?.length
                ? `Profile signals:\n${extraction.primaryProfileSignals.map((signal) => `- ${signal}`).join('\n')}`
                : '',
              extraction.missingInformation?.length
                ? `Missing facts / open issues:\n${extraction.missingInformation.map((item) => `- ${item}`).join('\n')}`
                : '',
              `Fact sufficiency: ${extraction.sufficiency}`,
              `Source priority used: ${extractionSourceUsed}`,
              showDisclaimer
                ? 'Begin with one short risk note that this is preliminary and not legal advice, then proceed with the structured opinion.'
                : '',
            ].filter(Boolean);

            const result = await aiGateway.chatDetailed({
              systemPrompt: INTAKE_STRATEGY_PROMPT,
              messages: [...history, { role: 'user', content: intakeUserParts.join('\n\n') }],
              temperature: 0.35,
              maxTokens: 3500,
            });

            answer = result.content || '';
            usedAI = true;
            aiMeta = { model: result.model, totalTokens: result.totalTokens, promptTokens: result.promptTokens, completionTokens: result.completionTokens, durationMs: result.durationMs };
            console.log(
              `[Advisor Chat] AI response: model=${result.model}, tokens=${result.totalTokens} (prompt=${result.promptTokens}, completion=${result.completionTokens}), duration=${result.durationMs}ms`
            );
          }
        } else {
          const userParts: string[] = [];
          if (legalRefBlock) {
            userParts.push(`LEGAL REFERENCE MATERIALS (use these when answering legal/procedural questions):\n${legalRefBlock}`);
          }
          if (caseRecord.caseAxisStatement || (criteriaIds.length > 0)) {
            userParts.push(
              `LIGHT CASE CONTEXT (for explanation only — do not adjudicate):\n` +
                (caseRecord.caseAxisStatement ? `Case axis: ${caseRecord.caseAxisStatement}\n` : '') +
                (criteriaIds.length ? `Selected criteria: ${criteriaIds.join(', ')}` : '')
            );
          }
          if (documentContext) {
            userParts.push(`ATTACHED DOCUMENTS:\n${documentContext}`);
          }
          userParts.push(`USER QUESTION: ${message}`);
          if (showDisclaimer) {
            userParts.push('Note: Begin your response with a single brief disclaimer that this is not legal advice and does not predict outcomes. Then proceed directly to substance.');
          }

          const result = await aiGateway.chatDetailed({
            systemPrompt: ADVISOR_SYSTEM_PROMPT,
            messages: [...history, { role: 'user', content: userParts.join('\n\n') }],
            temperature: 0.5,
            maxTokens: 3500,
          });

          answer = result.content || '';
          usedAI = true;
          aiMeta = { model: result.model, totalTokens: result.totalTokens, promptTokens: result.promptTokens, completionTokens: result.completionTokens, durationMs: result.durationMs };
          console.log(
            `[Advisor Chat] AI response: model=${result.model}, tokens=${result.totalTokens} (prompt=${result.promptTokens}, completion=${result.completionTokens}), duration=${result.durationMs}ms`
          );
        }

        if (!answer) {
          answer = 'The AI returned an empty response. Please try rephrasing your question.';
          usedAI = false;
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Advisor Chat] AI FAILED: ${errMsg}`);
        console.log('[Advisor Chat] PATH: FALLBACK (AI error)');
        answer = await buildIntakeAwareFallback(caseId, message, attachedDocNames, hasIntakeAttached, isStrategy, showDisclaimer);
      }
    } else {
      console.log(`[Advisor Chat] PATH: FALLBACK (${aiDiag.reason})`);
      answer = await buildIntakeAwareFallback(caseId, message, attachedDocNames, hasIntakeAttached, isStrategy, showDisclaimer);
    }

    let savedDocumentName: string | undefined;
    if ((isIntakeStrategy || (attachedDocNames.length > 0 && isStrategy)) && answer.length > 200) {
      try {
        savedDocumentName = await saveAIInsightDocument(
          caseId,
          req.user!.id,
          message,
          answer,
          attachedDocNames,
          hasIntakeAttached ? 'Intake Questionnaire' : attachedDocNames[0] ?? 'Documents',
          usedAI ? 'advisor_ai' : 'advisor_fallback',
          extractionResults,
          attachedDocumentsHaveMeaningfulText,
        );
        console.log(`[Advisor Chat] Saved to AI Insights: "${savedDocumentName}"`);
      } catch (err) {
        console.error('[Advisor Chat] Failed to save AI Insight:', err);
      }
    }

    if (usedAI && aiMeta && aiMeta.totalTokens > 0) {
      try {
        await recordUsage(
          userId,
          'advisor_chat',
          aiMeta.model,
          aiMeta.promptTokens ?? Math.floor(aiMeta.totalTokens * 0.7),
          aiMeta.completionTokens ?? Math.ceil(aiMeta.totalTokens * 0.3)
        );
      } catch (err) {
        console.error('[Advisor Chat] Failed to record usage:', err);
      }
    }

    res.json({
      answer,
      disclaimer: showDisclaimer,
      attachedDocuments: attachedDocNames,
      savedDocumentName,
      usedAI,
      aiMeta: usedAI ? aiMeta : undefined,
      model: usedAI && aiMeta ? aiMeta.model : ADVISOR_MODEL,
    });
  } catch (error) {
    console.error('[Advisor Chat] Route error:', error);
    res.status(500).json({ error: 'Failed to process advisor chat request' });
  }
});

// ---------------------------------------------------------------------------
// Fallback builders (used when AI is unavailable)
// ---------------------------------------------------------------------------

async function buildIntakeAwareFallback(
  caseId: string,
  message: string,
  attachedDocNames: string[],
  hasIntakeAttached: boolean,
  isStrategy: boolean,
  showDisclaimer: boolean,
): Promise<string> {
  const parts: string[] = [];
  if (showDisclaimer) {
    parts.push('> *This is not legal advice and does not predict immigration outcomes. It is an informational summary that may require professional legal review.*');
  }
  parts.push('**Note:** AI analysis is currently unavailable. The response below is generated from available case data.\n');

  if (hasIntakeAttached && isStrategy) {
    const intakeContext = await loadIntakeContext(caseId);
    if (intakeContext) {
      parts.push(intakeContext);
    } else {
      parts.push(buildGenericIntakeStrategyFallback(attachedDocNames));
    }
    return parts.join('\n\n');
  }

  if (attachedDocNames.length > 0 && isStrategy) {
    parts.push(`Attached: ${attachedDocNames.join(', ')}`);
    parts.push(buildGenericStrategyFallback(message));
    return parts.join('\n\n');
  }

  if (attachedDocNames.length > 0) {
    parts.push(`Attached: ${attachedDocNames.join(', ')}`);
    parts.push('For strategic analysis, configure a real OpenAI API key. For compliance-style document checks, use Officer Review.');
  }

  parts.push(buildTopicSpecificFallback(message));
  return parts.join('\n\n');
}

async function loadIntakeContext(caseId: string): Promise<string | null> {
  try {
    const builderState = await prisma.documentBuilderState.findFirst({
      where: { caseId, slotType: 'intake_questionnaire' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!builderState) return null;

    const draftJson = builderState.draftJson as Record<string, unknown> | null;
    const answers = builderState.answers as Record<string, unknown> | null;

    if (draftJson?.strategySummary) {
      return formatStrategySummary(draftJson.strategySummary as Record<string, unknown>);
    }
    if (answers && Object.keys(answers).length > 5) {
      return buildStrategyFromAnswers(answers);
    }
    if (builderState.draftText && builderState.draftText.length > 200) {
      return `Based on the generated Intake draft:\n\n${builderState.draftText.slice(0, 2000)}\n\n**Next Steps:** Review and expand the draft, then build documents for your strongest criteria.`;
    }
    return null;
  } catch (err) {
    console.error('[Advisor Chat] Error loading intake context:', err);
    return null;
  }
}

async function loadIntakeBuilderMaterial(caseId: string): Promise<string> {
  try {
    const builderState = await prisma.documentBuilderState.findFirst({
      where: { caseId, slotType: 'intake_questionnaire' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!builderState) return '';

    const parts: string[] = [];
    const draftJson = builderState.draftJson as Record<string, unknown> | null;
    const answers = builderState.answers as Record<string, unknown> | null;

    if (draftJson?.strategySummary) {
      parts.push(`Stored strategy summary:\n${JSON.stringify(draftJson.strategySummary, null, 2)}`);
    }
    if (draftJson?.reusableDataset) {
      parts.push(`Reusable intake dataset:\n${JSON.stringify(draftJson.reusableDataset, null, 2)}`);
    }
    if (answers && Object.keys(answers).length > 0) {
      parts.push(`Builder answers:\n${JSON.stringify(answers, null, 2).slice(0, 12000)}`);
    }
    if (builderState.draftText) {
      parts.push(`Draft text:\n${builderState.draftText.slice(0, 6000)}`);
    }

    return parts.join('\n\n');
  } catch (error) {
    console.error('[Advisor Chat] Failed to load intake builder material:', error);
    return '';
  }
}

async function extractIntakeFacts(
  aiGateway: AIGateway,
  userQuestion: string,
  sourceMaterial: string,
): Promise<IntakeFactExtraction> {
  return aiGateway.chatWithJSON<IntakeFactExtraction>({
    systemPrompt: INTAKE_FACT_EXTRACTION_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          `User question: ${userQuestion}`,
          `Source material:\n${sourceMaterial || '[no source material available]'}`,
        ].join('\n\n'),
      },
    ],
    temperature: 0.1,
    maxTokens: 1800,
  });
}

function renderInsufficientFactsResponse(
  extraction: IntakeFactExtraction,
  extractionResults?: DocumentExtractionResult[],
): string {
  const facts = extraction.facts?.length ? extraction.facts : ['No reliable concrete facts were extracted.'];
  const missing = extraction.missingInformation?.length
    ? extraction.missingInformation
    : [
        'A readable factual summary of the beneficiary’s achievements',
        'Clear evidence of nationally or internationally recognized accomplishments',
        'Specific facts tied to likely EB-1A criteria',
      ];

  const extractionNotes =
    extractionResults && extractionResults.length > 0
      ? [
          '',
          '## C. Attached File Readability',
          ...extractionResults.map((result) =>
            `- ${result.fileName}: ${
              result.extractionSucceeded
                ? `meaningful text extracted (${result.extractedTextLength} chars)`
                : `not reliably readable (${result.failureReason || 'no extractable text'})`
            }`
          ),
        ]
      : [];

  return [
    '## A. Preliminary Positioning',
    'I do not have enough extracted factual detail from the attached intake to give a reliable strategy opinion.',
    '',
    '## B. Facts Successfully Identified',
    ...facts.map((fact) => `- ${fact}`),
    ...extractionNotes,
    '',
    '## D. Why That Is Not Enough',
    extraction.reason || 'The available material does not provide enough concrete, case-specific facts to support a responsible preliminary strategy recommendation.',
    '',
    '## E. Additional Information Needed',
    ...missing.map((item) => `- ${item}`),
    '',
    '## I. Risk Note',
    'This is a preliminary limitation notice, not legal advice. A reliable strategy opinion depends on readable, fact-specific intake content.',
  ].join('\n');
}

function formatStrategySummary(ss: Record<string, unknown>): string {
  const s: string[] = ['## Strategic Summary (from Intake Builder)\n'];
  if (ss.probableCaseAxis) s.push(`**Probable Case Axis:** ${ss.probableCaseAxis}`);
  if (Array.isArray(ss.likelyStrongCriteria) && ss.likelyStrongCriteria.length) s.push(`**Likely Strong Criteria:** ${ss.likelyStrongCriteria.join(', ')}`);
  if (Array.isArray(ss.likelyWeakCriteria) && ss.likelyWeakCriteria.length) s.push(`**Areas Needing Development:** ${ss.likelyWeakCriteria.join(', ')}`);
  if (Array.isArray(ss.missingEvidence) && ss.missingEvidence.length) s.push(`**Missing Evidence:** ${ss.missingEvidence.join('; ')}`);
  if (Array.isArray(ss.riskFactors) && ss.riskFactors.length) s.push(`**Risk Factors:** ${ss.riskFactors.join('; ')}`);
  if (ss.strategyNotes) s.push(`**Strategy Notes:** ${ss.strategyNotes}`);
  s.push('\n**Recommended Next Steps:**\n- Build documents for your strongest criteria\n- Gather third-party corroboration\n- Identify recommenders\n- Complete Master Bio with concrete metrics');
  return s.join('\n\n');
}

function buildStrategyFromAnswers(answers: Record<string, unknown>): string {
  const s: string[] = ['## Preliminary Strategic Overview (from Intake answers)\n'];
  const text = Object.entries(answers).filter(([, v]) => v && String(v).trim()).map(([k, v]) => `${k}: ${String(v).slice(0, 300)}`).join('\n');

  const detect = (pattern: RegExp) => pattern.test(text);
  const strong: string[] = [];
  const weak: string[] = [];

  if (detect(/award|prize|honor|medal/i)) strong.push('Awards (C1)'); else weak.push('Awards (C1)');
  if (detect(/member|fellow|society/i)) strong.push('Memberships (C2)');
  if (detect(/publish|paper|journal|article/i)) strong.push('Published Material (C3)'); else weak.push('Published Material (C3)');
  if (detect(/judg|review|referee|panel/i)) strong.push('Judging (C4)');
  if (detect(/contribut|original|innovat|patent/i)) strong.push('Original Contributions (C5)'); else weak.push('Original Contributions (C5)');
  if (detect(/media|press|interview|feature/i)) strong.push('Media Coverage (C6)');
  if (detect(/lead|direct|found|ceo|cto|vp/i)) strong.push('Leading Role (C8)');
  if (detect(/salary|compensation|earning/i)) strong.push('High Salary (C9)');

  if (strong.length) s.push(`**Strongest Apparent Areas:** ${strong.join(', ')}`);
  if (weak.length) s.push(`**Underdeveloped Areas:** ${weak.join(', ')}`);

  if (detect(/lead|direct|found|ceo|cto/i)) s.push('**Probable Axis:** Leadership / Executive');
  else if (detect(/contribut|original/i) && detect(/publish|paper/i)) s.push('**Probable Axis:** Researcher / Innovator');
  else if (detect(/award/i) && detect(/media|press/i)) s.push('**Probable Axis:** Accomplished Professional / Industry Expert');
  else s.push('**Probable Axis:** More detail needed to determine strongest positioning.');

  s.push('\n**Next Steps:**\n- Complete remaining intake sections\n- Build evidence for your strongest 3-4 criteria\n- Gather independent third-party corroboration\n- Draft Master Bio with specific metrics');
  return s.join('\n\n');
}

function buildGenericIntakeStrategyFallback(docNames: string[]): string {
  return [
    `Attached: ${docNames.join(', ')}`,
    '## General Intake Strategy Guidance',
    '**Case Axis:** EB-1A cases require clear positioning — researcher, entrepreneur, executive, artist, or educator. Your intake answers should reveal which axis fits best.',
    '**Criteria:** You need at least 3 of 10 criteria. Focus where you have concrete, third-party verifiable evidence.',
    '**Common patterns by axis:**\n- Researcher: Original Contributions (C5), Scholarly Articles (C6), Judging (C4)\n- Entrepreneur: Leading Role (C8), Original Contributions (C5), High Salary (C9)\n- Artist: Awards (C1), Published Material (C3), Media (C6)',
    '**Next Steps:**\n1. Complete the Intake Questionnaire in the Document Builder\n2. Generate an Intake Strategy Summary\n3. Configure an OpenAI API key for AI-powered analysis',
  ].join('\n\n');
}

function buildGenericStrategyFallback(message: string): string {
  const lower = message.toLowerCase();
  const parts: string[] = ['## General EB-1A Strategy Guidance\n'];
  if (lower.includes('axis') || lower.includes('position') || lower.includes('choose') || lower.includes('strategy'))
    parts.push('Case axis is your positioning narrative — how you frame your field, achievements, and evidence. Common axes: researcher/scientist, founder/entrepreneur, executive/leader, artist/creative, educator/expert.');
  if (lower.includes('strong') || lower.includes('weak'))
    parts.push('Strength comes from third-party verifiable evidence: independent press, peer-reviewed publications, recognized awards, documented judging, measurable impact.');
  parts.push('Focus on 3-4 strongest criteria. Quality and specificity matter more than breadth.');
  return parts.join('\n\n');
}

function buildTopicSpecificFallback(message: string): string {
  const lower = message.toLowerCase();
  const parts: string[] = [];
  if (lower.includes('criteria') || lower.includes('criterion'))
    parts.push('EB-1A requires at least 3 of 10 criteria: awards (C1), memberships (C2), published material (C3), judging (C4), original contributions (C5), scholarly articles (C6), exhibitions (C7), leading role (C8), high salary (C9), commercial success (C10).');
  if (lower.includes('intake') || lower.includes('questionnaire'))
    parts.push('The Intake Questionnaire drives case axis, criteria selection, and evidence mapping. Complete it with specific facts, metrics, and organization names.');
  if (lower.includes('next step') || lower.includes('missing') || lower.includes('build'))
    parts.push('Common next steps: complete intake, build evidence for strongest criteria, identify recommenders, create evidence inventory.');
  if (!parts.length)
    parts.push('Attach relevant documents and ask a focused question for the best guidance.');
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Save AI output as a document in the AI Insights category
// ---------------------------------------------------------------------------

async function saveAIInsightDocument(
  caseId: string,
  userId: string,
  question: string,
  answer: string,
  attachedDocNames: string[],
  sourceLabel: string,
  sourceType: 'advisor_ai' | 'advisor_fallback',
  extractionResults: DocumentExtractionResult[],
  attachedDocumentsHaveMeaningfulText: boolean,
): Promise<string> {
  const docTitle = sourceLabel.includes('Intake')
    ? 'Intake Strategy Summary'
    : `Advisor Summary — ${sourceLabel}`;

  const existing = await prisma.document.findFirst({
    where: {
      caseId,
      category: AI_INSIGHTS_CATEGORY,
      metadata: { path: ['insightType'], equals: 'advisor_strategy' },
      originalName: { startsWith: docTitle },
    },
    orderBy: { createdAt: 'desc' },
  });

  const version = existing ? ` v${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}` : '';
  const finalName = `${docTitle}${version}`;
  const filename = `${uuidv4()}-${docTitle.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;

  const content = [
    `# ${finalName}`,
    `Generated: ${new Date().toISOString()}`,
    `Source: ${sourceType === 'advisor_ai' ? 'AI-powered analysis' : 'Fallback analysis (AI unavailable)'}`,
    `Source documents: ${attachedDocNames.join(', ')}`,
    `Source priority: ${attachedDocumentsHaveMeaningfulText ? 'Attached document text first' : 'Stored builder data used to augment or replace thin attached extraction'}`,
    `User question: ${question}`,
    '',
    '---',
    '',
    '## Source Diagnostics',
    ...extractionResults.map((result) =>
      `- ${result.fileName} | mime=${result.mimeType} | textLength=${result.extractedTextLength} | success=${result.extractionSucceeded} | scanned=${result.appearsScanned} | sourceUsed=${result.sourceUsed}${result.failureReason ? ` | reason=${result.failureReason}` : ''}`
    ),
    '',
    '---',
    '',
    answer,
  ].join('\n');

  const caseDir = path.join(UPLOADS_DIR, caseId);
  if (!fs.existsSync(caseDir)) fs.mkdirSync(caseDir, { recursive: true });
  fs.writeFileSync(path.join(caseDir, filename), content, 'utf-8');

  await prisma.document.create({
    data: {
      caseId,
      userId,
      filename,
      originalName: finalName,
      mimeType: 'text/plain',
      size: Buffer.byteLength(content, 'utf-8'),
      category: AI_INSIGHTS_CATEGORY,
      s3Key: `documents/${caseId}/${filename}`,
      metadata: {
        insightType: 'advisor_strategy',
        sourceType,
        sourceDocuments: attachedDocNames,
        extraction: extractionResults.map((result) => ({
          documentId: result.documentId,
          fileName: result.fileName,
          mimeType: result.mimeType,
          extractedTextLength: result.extractedTextLength,
          extractionSucceeded: result.extractionSucceeded,
          appearsScanned: result.appearsScanned,
          preview: result.preview,
          sourceUsed: result.sourceUsed,
          failureReason: result.failureReason,
        })),
        attachedDocumentsHaveMeaningfulText,
        question,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  return finalName;
}

export default router;
