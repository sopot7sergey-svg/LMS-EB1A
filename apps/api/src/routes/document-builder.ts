import { Router } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  DOCUMENT_ASSISTANT_BUILDERS,
  DOCUMENT_BUILDER_VOICE_TRANSCRIPT_KEY,
  getDocumentBuilderConfig,
  type DocumentBuilderAnswers,
  type DocumentBuilderInputMode,
  type DocumentBuilderSlotConfig,
  type DocumentBuilderStatus,
  type DocumentDraftPayload,
} from '@aipas/shared';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { canAccessApp, getAccess } from '../services/access';
import { generateDocumentDraft, renderDraftText } from '../services/documents/builder-generator';
import { suggestIntakePrefill } from '../services/documents/intake-prefill';
import { ensureCaseDocumentDir, getCanonicalDocumentPath } from '../services/documents/storage';

const prisma = new PrismaClient();
const router = Router({ mergeParams: true });
function clampProgress(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeStatus(value: unknown): DocumentBuilderStatus {
  return typeof value === 'string' &&
    ['not_started', 'in_progress', 'added', 'created', 'completed'].includes(value)
    ? (value as DocumentBuilderStatus)
    : 'in_progress';
}

function normalizeInputModes(value: unknown, fallback: DocumentBuilderInputMode[] = []): DocumentBuilderInputMode[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((mode): mode is DocumentBuilderInputMode =>
    typeof mode === 'string' && ['manual', 'source_upload', 'voice_transcript'].includes(mode)
  );
}

function sanitizeDraftPayload(draftJson: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (!draftJson || typeof draftJson !== 'object') return undefined;
  return draftJson as Prisma.InputJsonValue;
}

function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function normalizeAnswers(value: unknown): DocumentBuilderAnswers {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as DocumentBuilderAnswers)
    : {};
}

function getMissingRequiredQuestionLabels(
  config: DocumentBuilderSlotConfig,
  answers: DocumentBuilderAnswers
): string[] {
  return config.questions
    .filter((question) => question.required && !isFilled(answers[question.id]))
    .map((question) => question.label);
}

function hasGeneratedDraft(draftJson: unknown, draftText: unknown): boolean {
  if (typeof draftText === 'string' && draftText.trim().length > 0) {
    return true;
  }

  if (!draftJson || typeof draftJson !== 'object') {
    return false;
  }

  const draft = draftJson as {
    title?: unknown;
    summary?: unknown;
    sections?: unknown;
    coverLetterBlocked?: unknown;
  };

  if (draft.coverLetterBlocked && typeof draft.coverLetterBlocked === 'object') {
    return true;
  }

  return (
    (typeof draft.title === 'string' && draft.title.trim().length > 0) ||
    (typeof draft.summary === 'string' && draft.summary.trim().length > 0) ||
    (Array.isArray(draft.sections) && draft.sections.length > 0)
  );
}

function deriveBuilderStatus(
  config: DocumentBuilderSlotConfig,
  payload: {
    answers: DocumentBuilderAnswers;
    inputModes: DocumentBuilderInputMode[];
    sourceDocumentIds: string[];
    draftJson?: unknown;
    draftText?: unknown;
    requestedStatus?: DocumentBuilderStatus;
  }
): DocumentBuilderStatus {
  if (payload.requestedStatus === 'completed' || payload.requestedStatus === 'created') {
    return payload.requestedStatus;
  }

  const hasDraft = hasGeneratedDraft(payload.draftJson, payload.draftText);
  if (hasDraft) {
    return 'in_progress';
  }

  const hasSourceDocuments = payload.sourceDocumentIds.length > 0;
  const hasManualAnswers = config.questions.some((question) => isFilled(payload.answers[question.id]));
  const hasVoiceTranscript = isFilled(payload.answers[DOCUMENT_BUILDER_VOICE_TRANSCRIPT_KEY]);
  const hasSelectedInputModes = payload.inputModes.length > 0;

  if (config.assistantMode === 'fill') {
    return hasManualAnswers ? 'in_progress' : 'not_started';
  }

  if (hasSourceDocuments && !hasManualAnswers && !hasVoiceTranscript) {
    return 'added';
  }

  if (hasManualAnswers || hasVoiceTranscript || hasSelectedInputModes) {
    return 'in_progress';
  }

  return hasSourceDocuments ? 'added' : 'not_started';
}

function validateGenerateRequest(
  config: DocumentBuilderSlotConfig,
  answers: DocumentBuilderAnswers,
  inputModes: DocumentBuilderInputMode[],
  sourceDocumentIds: string[]
): string | null {
  if (config.assistantMode === 'fill') {
    const missingRequired = getMissingRequiredQuestionLabels(config, answers);
    if (missingRequired.length > 0) {
      return `Complete the required fields before finishing this form: ${missingRequired.slice(0, 5).join(', ')}`;
    }
    return null;
  }

  if (inputModes.length === 0) {
    return 'Select at least one input mode before generating a draft.';
  }

  const hasManualAnswers =
    inputModes.includes('manual') &&
    config.questions.some((question) => isFilled(answers[question.id]));
  const hasVoiceTranscript =
    inputModes.includes('voice_transcript') &&
    isFilled(answers[DOCUMENT_BUILDER_VOICE_TRANSCRIPT_KEY]);
  const hasSourceDocuments =
    inputModes.includes('source_upload') &&
    sourceDocumentIds.length > 0;

  if (!hasManualAnswers && !hasVoiceTranscript && !hasSourceDocuments) {
    return 'Add some builder input before generating: answer a question, link a source document, or paste a voice transcript.';
  }

  return null;
}

async function buildSyntheticBuilderState(
  caseId: string,
  userId: string,
  slotType: string,
  config: DocumentBuilderSlotConfig
) {
  const documents = await prisma.document.findMany({
    where: { caseId },
    select: {
      id: true,
      metadata: true,
    },
  });

  const slotDocuments = documents.filter((document) => {
    const metadata = document.metadata as { slotType?: string; source?: string } | null;
    return metadata?.slotType === slotType;
  });
  const sourceDocumentIds = slotDocuments
    .filter((document) => {
      const metadata = document.metadata as { source?: string } | null;
      return metadata?.source !== 'generated';
    })
    .map((document) => document.id);
  const hasGeneratedArtifact = slotDocuments.some((document) => {
    const metadata = document.metadata as { source?: string } | null;
    return metadata?.source === 'generated';
  });
  const status: DocumentBuilderStatus = hasGeneratedArtifact
    ? 'created'
    : sourceDocumentIds.length > 0
    ? 'added'
    : 'not_started';

  return {
    id: null,
    caseId,
    userId,
    sectionId: config.sectionId,
    slotType,
    status,
    inputModes: config.assistantMode === 'fill' ? (['manual'] as DocumentBuilderInputMode[]) : [],
    answers: {},
    sourceDocumentIds,
    draftJson: null,
    draftText: '',
    progress: status === 'created' ? 90 : status === 'added' ? 55 : 0,
    lastGeneratedAt: null,
    completedAt: null,
    createdAt: null,
    updatedAt: null,
    config,
  };
}

async function getAuthorizedCase(caseId: string, req: AuthRequest) {
  const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
  if (!caseRecord) {
    return { error: { status: 404, body: { error: 'Case not found' } } };
  }

  if (req.user!.role !== 'admin' && caseRecord.userId !== req.user!.id) {
    return { error: { status: 403, body: { error: 'Access denied' } } };
  }

  if (req.user!.role !== 'admin') {
    const access = await getAccess(req.user!.id);
    if (!canAccessApp(access)) {
      return { error: { status: 403, body: { error: 'App access expired. Renew your plan.' } } };
    }
  }

  return { caseRecord };
}

function normalizeBuilderState(state: any) {
  return {
    ...state,
    answers: state.answers ?? {},
    draftJson: state.draftJson ?? null,
    inputModes: state.inputModes ?? [],
    sourceDocumentIds: state.sourceDocumentIds ?? [],
    config: getDocumentBuilderConfig(state.slotType),
  };
}

router.get('/configs', authenticate, async (_req, res) => {
  res.json(DOCUMENT_ASSISTANT_BUILDERS);
});

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseId } = req.params;
    const authorization = await getAuthorizedCase(caseId, req);
    if (authorization.error) {
      return res.status(authorization.error.status).json(authorization.error.body);
    }

    const states = await prisma.documentBuilderState.findMany({
      where: { caseId },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(states.map(normalizeBuilderState));
  } catch (error) {
    console.error('List document builder states error:', error);
    res.status(500).json({ error: 'Failed to load document builder states' });
  }
});

router.get('/:slotType', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseId, slotType } = req.params;
    const config = getDocumentBuilderConfig(slotType);
    if (!config) {
      return res.status(404).json({ error: 'Unsupported document builder slot' });
    }

    const authorization = await getAuthorizedCase(caseId, req);
    if (authorization.error) {
      return res.status(authorization.error.status).json(authorization.error.body);
    }
    const { caseRecord } = authorization;

    const state = await prisma.documentBuilderState.findUnique({
      where: { caseId_slotType: { caseId, slotType } },
    });

    if (!state) {
      return res.json(await buildSyntheticBuilderState(caseId, caseRecord.userId, slotType, config));
    }

    res.json(normalizeBuilderState(state));
  } catch (error) {
    console.error('Get document builder state error:', error);
    res.status(500).json({ error: 'Failed to load document builder state' });
  }
});

router.put('/:slotType', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseId, slotType } = req.params;
    const config = getDocumentBuilderConfig(slotType);
    if (!config) {
      return res.status(404).json({ error: 'Unsupported document builder slot' });
    }

    const authorization = await getAuthorizedCase(caseId, req);
    if (authorization.error) {
      return res.status(authorization.error.status).json(authorization.error.body);
    }
    const { caseRecord } = authorization;

    const {
      answers,
      inputModes,
      sourceDocumentIds,
      draftJson,
      draftText,
      progress,
      status,
    } = req.body ?? {};

    const normalizedAnswers = normalizeAnswers(answers);
    const normalizedInputModes =
      config.assistantMode === 'fill'
        ? (['manual'] as DocumentBuilderInputMode[])
        : normalizeInputModes(inputModes);
    const normalizedSourceDocumentIds =
      config.assistantMode === 'fill' ? [] : (Array.isArray(sourceDocumentIds) ? sourceDocumentIds : undefined);
    const normalizedDraftJson = sanitizeDraftPayload(draftJson);
    const requestedStatus =
      typeof status === 'string' &&
      ['not_started', 'in_progress', 'added', 'created', 'completed'].includes(status)
        ? (status as DocumentBuilderStatus)
        : undefined;
    const derivedStatus = deriveBuilderStatus(config, {
      answers: normalizedAnswers,
      inputModes: normalizedInputModes,
      sourceDocumentIds: normalizedSourceDocumentIds ?? [],
      draftJson,
      draftText,
      requestedStatus,
    });

    if (requestedStatus === 'completed' && config.assistantMode === 'fill') {
      const missingRequired = getMissingRequiredQuestionLabels(config, normalizedAnswers);
      if (missingRequired.length > 0) {
        return res.status(400).json({
          error: `Complete the required fields before marking this builder complete: ${missingRequired
            .slice(0, 5)
            .join(', ')}`,
        });
      }
    }

    if (requestedStatus === 'created' && !hasGeneratedDraft(draftJson, draftText)) {
      return res.status(400).json({ error: 'Generate a draft before marking this builder as created.' });
    }

    const state = await prisma.documentBuilderState.upsert({
      where: { caseId_slotType: { caseId, slotType } },
      update: {
        answers: normalizedAnswers as Prisma.InputJsonValue,
        inputModes: normalizedInputModes,
        sourceDocumentIds: normalizedSourceDocumentIds,
        draftJson: normalizedDraftJson,
        draftText: typeof draftText === 'string' ? draftText : undefined,
        progress: clampProgress(progress),
        status: derivedStatus,
        completedAt: derivedStatus === 'completed' ? new Date() : null,
      },
      create: {
        caseId,
        userId: caseRecord.userId,
        sectionId: config.sectionId,
        slotType,
        answers: normalizedAnswers as Prisma.InputJsonValue,
        inputModes: normalizedInputModes,
        sourceDocumentIds: normalizedSourceDocumentIds ?? [],
        draftJson: normalizedDraftJson,
        draftText: typeof draftText === 'string' ? draftText : undefined,
        progress: clampProgress(progress),
        status: derivedStatus,
        completedAt: derivedStatus === 'completed' ? new Date() : null,
      },
    });

    res.json(normalizeBuilderState(state));
  } catch (error) {
    console.error('Save document builder state error:', error);
    res.status(500).json({ error: 'Failed to save document builder state' });
  }
});

router.post('/intake_questionnaire/suggest-prefill', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseId } = req.params;
    const authorization = await getAuthorizedCase(caseId, req);
    if (authorization.error) {
      return res.status(authorization.error.status).json(authorization.error.body);
    }

    const { sourceDocumentIds } = req.body ?? {};
    const docIds = Array.isArray(sourceDocumentIds) ? sourceDocumentIds : [];

    let documentIds = docIds as string[];
    if (documentIds.length === 0) {
      const state = await prisma.documentBuilderState.findUnique({
        where: { caseId_slotType: { caseId, slotType: 'intake_questionnaire' } },
      });
      documentIds = state?.sourceDocumentIds ?? [];
    }

    if (documentIds.length === 0) {
      return res.json({ suggestions: [], message: 'No source documents linked. Upload documents in the builder, then try again.' });
    }

    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds }, caseId },
      select: { id: true, originalName: true, filename: true, mimeType: true, caseId: true },
    });

    if (documents.length === 0) {
      return res.json({ suggestions: [], message: 'No documents found for the given IDs.' });
    }

    const state = await prisma.documentBuilderState.findUnique({
      where: { caseId_slotType: { caseId, slotType: 'intake_questionnaire' } },
    });
    const existingAnswers = (state?.answers as Record<string, unknown>) ?? {};

    const suggestions = await suggestIntakePrefill(documents, existingAnswers);
    res.json({ suggestions });
  } catch (error) {
    console.error('Suggest prefill error:', error);
    res.status(500).json({ error: 'Failed to suggest prefill from documents' });
  }
});

router.post('/:slotType/generate', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseId, slotType } = req.params;
    const config = getDocumentBuilderConfig(slotType);
    if (!config) {
      return res.status(404).json({ error: 'Unsupported document builder slot' });
    }

    const authorization = await getAuthorizedCase(caseId, req);
    if (authorization.error) {
      return res.status(authorization.error.status).json(authorization.error.body);
    }
    const { caseRecord } = authorization;

    const existing = await prisma.documentBuilderState.findUnique({
      where: { caseId_slotType: { caseId, slotType } },
    });

    const answers = normalizeAnswers(
      typeof req.body?.answers === 'object' && req.body.answers
        ? req.body.answers
        : existing?.answers || {}
    );

    const inputModes =
      config.assistantMode === 'fill'
        ? (['manual'] as DocumentBuilderInputMode[])
        : normalizeInputModes(req.body?.inputModes, normalizeInputModes(existing?.inputModes));

    const sourceDocumentIds =
      config.assistantMode === 'fill'
        ? []
        : (Array.isArray(req.body?.sourceDocumentIds)
            ? req.body.sourceDocumentIds
            : existing?.sourceDocumentIds || []);

    const sourceDocuments = sourceDocumentIds.length
      ? await prisma.document.findMany({
          where: {
            id: { in: sourceDocumentIds },
            caseId,
          },
          select: {
            id: true,
            originalName: true,
            category: true,
            metadata: true,
          },
        })
      : [];

    if (sourceDocumentIds.length > 0 && sourceDocuments.length !== sourceDocumentIds.length) {
      return res.status(400).json({ error: 'One or more selected source documents are unavailable for this case.' });
    }

    const generateValidationError = validateGenerateRequest(config, answers, inputModes, sourceDocumentIds);
    if (generateValidationError) {
      return res.status(400).json({ error: generateValidationError });
    }

    const priorDocuments = config.prefillFromSlots?.length
      ? await prisma.documentBuilderState.findMany({
          where: {
            caseId,
            slotType: { in: config.prefillFromSlots },
          },
          select: {
            slotType: true,
            answers: true,
            draftJson: true,
            draftText: true,
            status: true,
            completedAt: true,
          },
        })
      : [];

    const normalizedPriorDocuments = priorDocuments.map((item) => ({
      slotType: item.slotType,
      answers: item.answers && typeof item.answers === 'object' ? (item.answers as Record<string, unknown>) : {},
      draftJson:
        item.draftJson && typeof item.draftJson === 'object'
          ? (item.draftJson as unknown as DocumentDraftPayload)
          : null,
      draftText: typeof item.draftText === 'string' ? item.draftText : null,
      status: typeof item.status === 'string' ? item.status : 'not_started',
      completedAt: item.completedAt,
    }));

    let caseContext: import('../services/documents/cover-letter-service').CoverLetterCaseContext | undefined;
    if (slotType === 'cover_letter_draft') {
      const caseDocuments = await prisma.document.findMany({
        where: { caseId },
        select: { id: true, originalName: true, category: true, metadata: true, mimeType: true, createdAt: true },
      });
      caseContext = {
        caseId,
        caseAxisStatement: caseRecord.caseAxisStatement,
        proposedEndeavor: caseRecord.proposedEndeavor,
        criteriaSelected: caseRecord.criteriaSelected ?? [],
        documents: caseDocuments,
        priorDocuments: normalizedPriorDocuments.map((p) => ({
          slotType: p.slotType,
          answers: p.answers,
          draftJson: p.draftJson,
          draftText: p.draftText,
        })),
      };
    }

    const draft = await generateDocumentDraft({
      slotType,
      answers,
      sourceDocuments,
      priorDocuments: normalizedPriorDocuments,
      caseContext,
    });

    const draftText = renderDraftText(draft);
    const state = await prisma.documentBuilderState.upsert({
      where: { caseId_slotType: { caseId, slotType } },
      update: {
        answers: answers as object,
        inputModes,
        sourceDocumentIds,
        draftJson: draft as unknown as object,
        draftText,
        progress: Math.max(existing?.progress ?? 0, 70),
        status: 'in_progress',
        lastGeneratedAt: new Date(),
      },
      create: {
        caseId,
        userId: caseRecord.userId,
        sectionId: config.sectionId,
        slotType,
        answers: answers as object,
        inputModes,
        sourceDocumentIds,
        draftJson: draft as unknown as object,
        draftText,
        progress: 70,
        status: 'in_progress',
        lastGeneratedAt: new Date(),
      },
    });

    res.json({
      ...normalizeBuilderState(state),
      draft,
      draftText,
    });
  } catch (error) {
    console.error('Generate document builder draft error:', error);
    res.status(500).json({ error: 'Failed to generate document draft' });
  }
});

router.post('/:slotType/publish', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseId, slotType } = req.params;
    const config = getDocumentBuilderConfig(slotType);
    if (!config) {
      return res.status(404).json({ error: 'Unsupported document builder slot' });
    }
    if (config.assistantMode === 'fill') {
      return res.status(400).json({ error: 'Fill-mode document assistants do not publish generated artifacts.' });
    }

    const authorization = await getAuthorizedCase(caseId, req);
    if (authorization.error) {
      return res.status(authorization.error.status).json(authorization.error.body);
    }
    const { caseRecord } = authorization;

    const state = await prisma.documentBuilderState.findUnique({
      where: { caseId_slotType: { caseId, slotType } },
    });

    if (!state?.draftText) {
      return res.status(400).json({ error: 'Generate a draft before publishing' });
    }

    const filename = `${uuidv4()}-${slotType}.txt`;
    ensureCaseDocumentDir(caseId);
    fs.writeFileSync(getCanonicalDocumentPath(caseId, filename), state.draftText, 'utf8');

    const document = await prisma.document.create({
      data: {
        caseId,
        userId: caseRecord.userId,
        filename,
        originalName: `${config.shortLabel}.txt`,
        mimeType: 'text/plain',
        size: Buffer.byteLength(state.draftText, 'utf8'),
        category: config.category,
        metadata: {
          slotType,
          source: 'generated',
          builderStatus: 'created',
          builderStateId: state.id,
        },
        s3Key: `documents/${caseId}/${filename}`,
      },
    });

    const updatedState = await prisma.documentBuilderState.update({
      where: { id: state.id },
      data: {
        status: 'created',
        progress: Math.max(state.progress, 90),
      },
    });

    res.json({
      state: normalizeBuilderState(updatedState),
      document,
    });
  } catch (error) {
    console.error('Publish document builder draft error:', error);
    res.status(500).json({ error: 'Failed to publish document draft' });
  }
});

export default router;
