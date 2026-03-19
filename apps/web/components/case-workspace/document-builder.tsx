'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DOCUMENT_BUILDER_VOICE_TRANSCRIPT_KEY,
  type CoverLetterBlockedResult,
  type DocumentBuilderInputMode,
  type DocumentBuilderSlotConfig,
  type DocumentBuilderStatus,
} from '@aipas/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DocumentBuilderStepper } from './document-builder-stepper';
import { DocumentBuilderQuestionRenderer } from './document-builder-question-renderer';
import { DocumentDraftEditor, type EditableDraftSection } from './document-draft-editor';
import { DocumentUploadBlock } from './document-upload-block';

interface CaseDocument {
  id: string;
  originalName: string;
  metadata?: { slotType?: string; source?: string };
}

interface DocumentBuilderModalProps {
  open: boolean;
  caseId: string;
  config: DocumentBuilderSlotConfig | null;
  documents: CaseDocument[];
  onClose: () => void;
  onSaved: () => void;
}

const CREATE_STEPS = [
  'Введение',
  'Режим ввода',
  'Вопросы',
  'Создать черновик',
  'Проверка и правка',
  'Сохранить',
];

const STATUS_LABELS: Record<DocumentBuilderStatus, string> = {
  not_started: 'Не начат',
  in_progress: 'В процессе',
  added: 'Добавлено',
  created: 'Создано',
  completed: 'Завершено',
};

function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function computeProgress(config: DocumentBuilderSlotConfig, answers: Record<string, unknown>): number {
  if (!config.questions.length) return 0;
  const criticalSectionIds = config.criticalSectionIds;
  if (criticalSectionIds?.length) {
    const questionsBySection = new Map<string, typeof config.questions>();
    for (const q of config.questions) {
      const sid = (q as { sectionId?: string }).sectionId ?? 'other';
      if (!questionsBySection.has(sid)) questionsBySection.set(sid, []);
      questionsBySection.get(sid)!.push(q);
    }
    let criticalFilled = 0;
    let criticalTotal = 0;
    let otherFilled = 0;
    let otherTotal = 0;
    for (const sectionId of criticalSectionIds) {
      const qs = questionsBySection.get(sectionId) ?? [];
      const required = qs.filter((q) => q.required);
      const target = required.length || qs.length;
      const answered = (required.length ? required : qs).filter((q) => isFilled(answers[q.id])).length;
      criticalTotal += target;
      criticalFilled += answered;
    }
    const otherQs = config.questions.filter(
      (q) => !criticalSectionIds.includes((q as { sectionId?: string }).sectionId ?? '')
    );
    if (otherQs.length) {
      const requiredOther = otherQs.filter((q) => q.required);
      otherTotal = requiredOther.length || otherQs.length;
      otherFilled = (requiredOther.length ? requiredOther : otherQs).filter((q) => isFilled(answers[q.id])).length;
    }
    const criticalPct = criticalTotal ? criticalFilled / criticalTotal : 1;
    const otherPct = otherTotal ? otherFilled / otherTotal : 1;
    return Math.round(criticalPct * 70 + otherPct * 30);
  }
  const requiredQuestions = config.questions.filter((question) => question.required);
  const target = requiredQuestions.length || config.questions.length;
  const answered = (requiredQuestions.length ? requiredQuestions : config.questions).filter((question) =>
    isFilled(answers[question.id])
  ).length;
  return Math.round((answered / target) * 100);
}

function deriveDraftText(
  title: string,
  summary: string,
  sections: EditableDraftSection[],
  coverLetterBlocked?: CoverLetterBlockedResult | null
) {
  if (coverLetterBlocked) {
    const b = coverLetterBlocked;
    return [
      '# Cover Letter Generation Blocked',
      '',
      `**Overall status:** ${b.status}`,
      '',
      `**Why generation is blocked:** ${b.whyBlocked}`,
      '',
      '## Missing required inputs',
      ...(b.missingRequiredInputs.length ? b.missingRequiredInputs.map((i) => `- ${i}`) : ['- None']),
      '',
      '## Missing required evidence',
      ...(b.missingRequiredEvidence.length ? b.missingRequiredEvidence.map((e) => `- ${e}`) : ['- None']),
      '',
      '## Critical deficiencies',
      ...(b.criticalDeficiencies.length ? b.criticalDeficiencies.map((c) => `- ${c}`) : ['- None']),
      '',
      '## Required next actions before generation can proceed',
      ...b.requiredNextActions.map((a) => `- ${a}`),
      '',
      ...(b.recommendedNextDocuments?.length
        ? ['## Recommended next documents/actions', ...b.recommendedNextDocuments.map((d) => `- ${d}`)]
        : []),
    ]
      .filter(Boolean)
      .join('\n');
  }
  return [
    title ? `# ${title}` : '',
    summary,
    ...sections.flatMap((section) => [`## ${section.label}`, section.content, '']),
  ]
    .filter(Boolean)
    .join('\n\n');
}

function formatAnswerPreview(value: unknown): string {
  if (value == null) return 'Не заполнено';
  if (typeof value === 'string') return value.trim() || 'Не заполнено';
  if (Array.isArray(value)) {
    if (!value.length) return 'Не заполнено';
    return value
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getMissingRequiredQuestions(
  config: DocumentBuilderSlotConfig,
  answers: Record<string, unknown>
): string[] {
  return config.questions
    .filter((question) => question.required && !isFilled(answers[question.id]))
    .map((question) => question.label);
}

export function DocumentBuilderModal({
  open,
  caseId,
  config,
  documents,
  onClose,
  onSaved,
}: DocumentBuilderModalProps) {
  const { token } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [builderStateId, setBuilderStateId] = useState<string | null>(null);
  const [status, setStatus] = useState<DocumentBuilderStatus>('not_started');
  const [inputModes, setInputModes] = useState<DocumentBuilderInputMode[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [sourceDocumentIds, setSourceDocumentIds] = useState<string[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftSections, setDraftSections] = useState<EditableDraftSection[]>([]);
  const [draftSuggestedNextSteps, setDraftSuggestedNextSteps] = useState<string[]>([]);
  const [strategySummary, setStrategySummary] = useState<{
    probableCaseAxis?: string;
    likelyStrongCriteria?: string[];
    likelyWeakCriteria?: string[];
    missingEvidence?: string[];
    riskFactors?: string[];
    strategyNotes?: string[];
  } | null>(null);
  const [reusableDataset, setReusableDataset] = useState<Record<string, unknown> | null>(null);
  const [coverLetterBlocked, setCoverLetterBlocked] = useState<CoverLetterBlockedResult | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
  const [prefillSuggestions, setPrefillSuggestions] = useState<Array<{ questionId: string; value: unknown; source: string; confidence?: string }>>([]);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const lastSavedPayload = useRef<string>('');
  const hydrated = useRef(false);
  const isFillMode = config?.assistantMode === 'fill';

  const fillQuestionGroups = useMemo(() => {
    if (!config || !isFillMode) return [];
    const questionsById = new Map(config.questions.map((question) => [question.id, question]));
    const groups = config.questionGroups?.length
        ? config.questionGroups
      : [{
          id: 'all-fields',
          title: 'Заполните форму',
          questionIds: config.questions.map((question) => question.id),
        }];

    return groups.map((group) => ({
      ...group,
      questions: group.questionIds
        .map((questionId) => questionsById.get(questionId))
        .filter((question): question is NonNullable<typeof question> => Boolean(question)),
    }));
  }, [config, isFillMode]);

  const steps = useMemo(() => {
    if (!isFillMode) return CREATE_STEPS;
    return ['Введение', ...fillQuestionGroups.map((group) => group.title), 'Проверка и сохранение'];
  }, [fillQuestionGroups, isFillMode]);

  const availableCreateInputModes = useMemo(() => {
    if (!config || isFillMode) return [];
    const labels: Record<DocumentBuilderInputMode, { label: string; description: string }> = {
      manual: {
        label: 'Заполнить вручную',
        description: 'Ответьте на вопросы прямо в приложении.',
      },
      source_upload: {
        label: 'Загрузить исходные материалы',
        description: 'Прикрепите резюме, заметки или документы для составления черновика.',
      },
      voice_transcript: {
        label: 'Вставить расшифровку',
        description: 'Вставьте продиктованные заметки или текст. Аудио в v1 не сохраняется.',
      },
    };

    return config.inputModes.map((mode) => ({
      id: mode,
      ...labels[mode],
    }));
  }, [config, isFillMode]);

  const progress = useMemo(() => {
    if (!config) return 0;
    return Math.max(computeProgress(config, answers), status === 'created' ? 90 : 0, status === 'completed' ? 100 : 0);
  }, [answers, config, status]);

  const missingRequiredQuestions = useMemo(() => {
    if (!config) return [];
    return getMissingRequiredQuestions(config, answers);
  }, [answers, config]);

  const createGenerateError = useMemo(() => {
    if (!config || isFillMode) return null;
    if (inputModes.length === 0) {
      return 'Выберите хотя бы один режим ввода перед созданием черновика.';
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
      return 'Добавьте данные перед генерацией: ответьте на вопрос, прикрепите документ или вставьте расшифровку.';
    }

    return null;
  }, [answers, config, inputModes, isFillMode, sourceDocumentIds]);

  // Isolate wizard step per document: reset when opening or when switching to a different builder (slotType).
  useEffect(() => {
    if (!open || !config) return;
    setCurrentStep(0);
    setUploadOpen(false);
    setPrefillSuggestions([]);
  }, [open, config?.slotType]);

  useEffect(() => {
    if (!open || !config || !token) return;

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const state = await api.documentBuilders.get(caseId, config.slotType, token);
        if (cancelled) return;

        setBuilderStateId(state.id ?? null);
        setStatus((state.status || 'not_started') as DocumentBuilderStatus);
        setInputModes(isFillMode ? ['manual'] : ((state.inputModes || []) as DocumentBuilderInputMode[]));
        setAnswers(state.answers || {});
        setSourceDocumentIds(isFillMode ? [] : (state.sourceDocumentIds || []));
        setLastGeneratedAt(state.lastGeneratedAt || null);
        if (state.draftJson?.title) setDraftTitle(state.draftJson.title);
        else setDraftTitle(config.shortLabel);
        if (state.draftJson?.summary) setDraftSummary(state.draftJson.summary);
        else setDraftSummary(config.description);
        setDraftSuggestedNextSteps(
          Array.isArray(state.draftJson?.suggestedNextSteps) ? state.draftJson.suggestedNextSteps : []
        );
        setDraftSections(
          Array.isArray(state.draftJson?.sections)
            ? state.draftJson.sections
            : []
        );
        if (state.draftJson?.strategySummary && typeof state.draftJson.strategySummary === 'object') {
          setStrategySummary(state.draftJson.strategySummary as {
            probableCaseAxis?: string;
            likelyStrongCriteria?: string[];
            likelyWeakCriteria?: string[];
            missingEvidence?: string[];
            riskFactors?: string[];
            strategyNotes?: string[];
          });
        } else {
          setStrategySummary(null);
        }
        if (state.draftJson?.reusableDataset && typeof state.draftJson.reusableDataset === 'object') {
          setReusableDataset(state.draftJson.reusableDataset as Record<string, unknown>);
        } else {
          setReusableDataset(null);
        }
        if (state.draftJson?.coverLetterBlocked && typeof state.draftJson.coverLetterBlocked === 'object') {
          setCoverLetterBlocked(state.draftJson.coverLetterBlocked as CoverLetterBlockedResult);
        } else {
          setCoverLetterBlocked(null);
        }
        hydrated.current = true;
        lastSavedPayload.current = '';
      } catch (error) {
        console.error('Failed to load document builder state:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, config, token, caseId]);

  useEffect(() => {
    if (!open || !config || !token || !hydrated.current) return;

    const hasFillAnswers = Object.values(answers).some((value) => isFilled(value));
    const hasDraft = draftSections.length > 0;
    const hasCreateInputs = inputModes.length > 0 || sourceDocumentIds.length > 0 || hasFillAnswers;
    const hasOnlyAddedSources =
      !hasDraft &&
      sourceDocumentIds.length > 0 &&
      !config.questions.some((question) => isFilled(answers[question.id])) &&
      !isFilled(answers[DOCUMENT_BUILDER_VOICE_TRANSCRIPT_KEY]);

    const derivedStatus =
      status === 'completed'
        ? 'completed'
        : status === 'created'
        ? 'created'
        : isFillMode
        ? hasFillAnswers
          ? 'in_progress'
          : 'not_started'
        : hasOnlyAddedSources
        ? 'added'
        : hasDraft || hasCreateInputs
        ? 'in_progress'
        : 'not_started';

    const payload = {
      answers,
      inputModes: isFillMode ? (['manual'] as DocumentBuilderInputMode[]) : inputModes,
      sourceDocumentIds: isFillMode ? [] : sourceDocumentIds,
      ...(isFillMode
        ? {}
        : {
            draftJson: {
              title: draftTitle || config.shortLabel,
              summary: draftSummary || config.description,
              sections: draftSections,
              suggestedNextSteps: draftSuggestedNextSteps,
              ...(strategySummary && { strategySummary }),
              ...(reusableDataset && { reusableDataset }),
              ...(coverLetterBlocked && { coverLetterBlocked }),
            },
            draftText: deriveDraftText(
              draftTitle || config.shortLabel,
              draftSummary || config.description,
              draftSections,
              coverLetterBlocked
            ),
          }),
      progress,
      status: derivedStatus,
    };

    const payloadKey = JSON.stringify(payload);
    if (payloadKey === lastSavedPayload.current) return;

    const timeout = window.setTimeout(async () => {
      try {
        setIsSaving(true);
        const state = await api.documentBuilders.save(caseId, config.slotType, payload, token);
        setBuilderStateId(state.id);
        setStatus((state.status || payload.status) as DocumentBuilderStatus);
        lastSavedPayload.current = payloadKey;
      } catch (error) {
        console.error('Autosave failed:', error);
      } finally {
        setIsSaving(false);
      }
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [
    open,
    config,
    token,
    caseId,
    answers,
    inputModes,
    sourceDocumentIds,
    draftTitle,
    draftSummary,
    draftSections,
    draftSuggestedNextSteps,
    strategySummary,
    reusableDataset,
    progress,
    status,
    isFillMode,
  ]);

  if (!open || !config) return null;

  const availableSourceDocs = documents.filter(
    (doc) => doc.metadata?.source !== 'generated'
  );
  const voiceTranscript = typeof answers[DOCUMENT_BUILDER_VOICE_TRANSCRIPT_KEY] === 'string'
    ? (answers[DOCUMENT_BUILDER_VOICE_TRANSCRIPT_KEY] as string)
    : '';

  const toggleInputMode = (mode: DocumentBuilderInputMode) => {
    setInputModes((prev) => (prev.includes(mode) ? prev.filter((value) => value !== mode) : [...prev, mode]));
  };

  const handleGenerate = async () => {
    if (!token) return;
    if (createGenerateError) {
      alert(createGenerateError);
      return;
    }
    setIsGenerating(true);
    try {
      const response = await api.documentBuilders.generate(
        caseId,
        config.slotType,
        {
          answers,
          inputModes,
          sourceDocumentIds,
        },
        token
      );

      setBuilderStateId(response.id);
      setStatus('in_progress');
      setDraftTitle(response.draft?.title || config.shortLabel);
      setDraftSummary(response.draft?.summary || config.description);
      setDraftSections(response.draft?.sections || []);
      setDraftSuggestedNextSteps(response.draft?.suggestedNextSteps || []);
      if (response.draft?.coverLetterBlocked && typeof response.draft.coverLetterBlocked === 'object') {
        setCoverLetterBlocked(response.draft.coverLetterBlocked as CoverLetterBlockedResult);
      } else {
        setCoverLetterBlocked(null);
      }
      if (response.draft?.strategySummary && typeof response.draft.strategySummary === 'object') {
        setStrategySummary(response.draft.strategySummary as {
          probableCaseAxis?: string;
          likelyStrongCriteria?: string[];
          likelyWeakCriteria?: string[];
          missingEvidence?: string[];
          riskFactors?: string[];
          strategyNotes?: string[];
        });
      } else {
        setStrategySummary(null);
      }
      if (response.draft?.reusableDataset && typeof response.draft.reusableDataset === 'object') {
        setReusableDataset(response.draft.reusableDataset as Record<string, unknown>);
      } else {
        setReusableDataset(null);
      }
      setLastGeneratedAt(response.lastGeneratedAt || new Date().toISOString());
      setCurrentStep(4);
      onSaved();
    } catch (error) {
      console.error('Draft generation failed:', error);
      alert(error instanceof Error ? error.message : 'Не удалось создать черновик');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!token) return;
    setIsPublishing(true);
    try {
      const response = await api.documentBuilders.publish(caseId, config.slotType, token);
      setStatus(response.state.status);
      setBuilderStateId(response.state.id);
      onSaved();
      setCurrentStep(5);
    } catch (error) {
      console.error('Publish failed:', error);
      alert(error instanceof Error ? error.message : 'Не удалось сохранить результат');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!token) return;
    if (isFillMode && missingRequiredQuestions.length > 0) {
      alert(`Заполните обязательные поля перед завершением: ${missingRequiredQuestions.slice(0, 5).join(', ')}`);
      return;
    }
    try {
      const response = await api.documentBuilders.save(
        caseId,
        config.slotType,
        isFillMode
          ? {
              answers,
              inputModes: ['manual'],
              sourceDocumentIds: [],
              progress: 100,
              status: 'completed',
            }
          : {
              answers,
              inputModes,
              sourceDocumentIds,
              draftJson: {
                title: draftTitle || config.shortLabel,
                summary: draftSummary || config.description,
                sections: draftSections,
                suggestedNextSteps: draftSuggestedNextSteps,
                ...(strategySummary && { strategySummary }),
                ...(reusableDataset && { reusableDataset }),
              },
              draftText: deriveDraftText(
                draftTitle || config.shortLabel,
                draftSummary || config.description,
                draftSections
              ),
              progress: 100,
              status: 'completed',
            },
        token
      );
      setStatus(response.status);
      onSaved();
      onClose();
    } catch (error) {
      console.error('Failed to mark completed:', error);
      alert(error instanceof Error ? error.message : 'Не удалось отметить документ завершённым');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Помощник по документам: ${config.shortLabel}`}
      className="max-w-6xl"
    >
      <div className="space-y-6 p-6">
        <DocumentBuilderStepper
          steps={steps}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background-secondary px-4 py-3 text-sm">
          <div>
            <p className="font-medium text-white">{config.shortLabel}</p>
            <p className="text-foreground-secondary">{config.description}</p>
          </div>
          <div className="text-right text-xs text-foreground-secondary">
            <p>Прогресс: {progress}%</p>
            <p>Статус: {STATUS_LABELS[status] ?? status.replace('_', ' ')}</p>
            {!isFillMode && lastGeneratedAt ? <p>Последняя генерация: {new Date(lastGeneratedAt).toLocaleString()}</p> : null}
            {isSaving ? <p>Сохранение...</p> : <p>Автосохранение включено</p>}
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-foreground-secondary">Загрузка...</div>
        ) : isFillMode ? (
          <>
            {currentStep === 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-background-secondary p-5">
                  <h3 className="mb-2 text-sm font-semibold text-white">Назначение</h3>
                  <p className="text-sm text-foreground-secondary">{config.purpose}</p>
                </div>
                <div className="rounded-lg border border-border bg-background-secondary p-5">
                  <h3 className="mb-2 text-sm font-semibold text-white">Как использовать</h3>
                  <p className="text-sm text-foreground-secondary">{config.usageInCase}</p>
                </div>
                <div className="rounded-lg border border-border bg-background-secondary p-5 md:col-span-2">
                  <h3 className="mb-2 text-sm font-semibold text-white">Результат</h3>
                  <p className="text-sm text-foreground-secondary">{config.completionOutcome}</p>
                  {config.templateUrl ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-4"
                      onClick={() => window.open(config.templateUrl, '_blank', 'noopener,noreferrer')}
                    >
                      Открыть шаблон USCIS
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {fillQuestionGroups.map((group, index) =>
              currentStep === index + 1 ? (
                <div key={group.id} className="space-y-4">
                  <div className="rounded-lg border border-border bg-background-secondary p-4">
                    <h3 className="text-sm font-semibold text-white">{group.title}</h3>
                    {group.description ? (
                      <p className="mt-1 text-sm text-foreground-secondary">{group.description}</p>
                    ) : null}
                  </div>
                  <div className="space-y-4">
                    {group.questions.map((question) => (
                      <DocumentBuilderQuestionRenderer
                        key={question.id}
                        question={question}
                        value={answers[question.id]}
                        onChange={(value) =>
                          setAnswers((prev) => ({ ...prev, [question.id]: value }))
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null
            )}

            {currentStep === steps.length - 1 ? (
              <div className="space-y-4 rounded-lg border border-border bg-background-secondary p-5">
                <div>
                  <h3 className="text-sm font-semibold text-white">Проверка и сохранение</h3>
                  <p className="mt-1 text-sm text-foreground-secondary">
                    Проверьте ответы ниже. Ответы сохраняются для последующего переноса в официальную форму USCIS.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {config.questions.map((question) => (
                    <div key={question.id} className="rounded-lg border border-border bg-background px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                        {question.label}
                      </p>
                      <p className="mt-2 text-sm text-foreground-secondary">
                        {formatAnswerPreview(answers[question.id])}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  {config.templateUrl ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => window.open(config.templateUrl, '_blank', 'noopener,noreferrer')}
                    >
                      Открыть шаблон USCIS
                    </Button>
                  ) : null}
                  {missingRequiredQuestions.length > 0 ? (
                    <p className="w-full text-sm text-amber-200">
                      Заполните обязательные поля: {missingRequiredQuestions.slice(0, 5).join(', ')}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    onClick={handleMarkCompleted}
                    disabled={missingRequiredQuestions.length > 0}
                  >
                    Отметить форму заполненной
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            {currentStep === 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-background-secondary p-5">
                  <h3 className="mb-2 text-sm font-semibold text-white">Назначение</h3>
                  <p className="text-sm text-foreground-secondary">{config.purpose}</p>
                </div>
                <div className="rounded-lg border border-border bg-background-secondary p-5">
                  <h3 className="mb-2 text-sm font-semibold text-white">Как будет использоваться</h3>
                  <p className="text-sm text-foreground-secondary">{config.usageInCase}</p>
                </div>
                <div className="rounded-lg border border-border bg-background-secondary p-5 md:col-span-2">
                  <h3 className="mb-2 text-sm font-semibold text-white">Результат</h3>
                  <p className="text-sm text-foreground-secondary">{config.completionOutcome}</p>
                </div>
              </div>
            ) : null}

            {currentStep === 1 ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  {availableCreateInputModes.map((mode) => {
                    const selected = inputModes.includes(mode.id);
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => toggleInputMode(mode.id)}
                        className={`rounded-lg border p-4 text-left ${
                          selected
                            ? 'border-primary bg-primary/10 text-white'
                            : 'border-border bg-background-secondary text-foreground-secondary'
                        }`}
                      >
                        <div className="mb-2 text-sm font-semibold">{mode.label}</div>
                        <div className="text-xs leading-5">{mode.description}</div>
                      </button>
                    );
                  })}
                </div>

                {inputModes.includes('source_upload') ? (
                  <div className="space-y-4 rounded-lg border border-border bg-background-secondary p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Исходные материалы</h3>
                        <p className="text-xs text-foreground-secondary">
                          Выберите файлы или загрузите новые материалы для черновика.
                        </p>
                      </div>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setUploadOpen((prev) => !prev)}>
                        {uploadOpen ? 'Скрыть загрузку' : 'Загрузить файл'}
                      </Button>
                    </div>

                    {availableSourceDocs.length ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        {availableSourceDocs.map((doc) => {
                          const checked = sourceDocumentIds.includes(doc.id);
                          return (
                            <label
                              key={doc.id}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                                checked
                                  ? 'border-primary bg-primary/10 text-white'
                                  : 'border-border text-foreground-secondary'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setSourceDocumentIds((prev) =>
                                    checked ? prev.filter((id) => id !== doc.id) : [...prev, doc.id]
                                  );
                                }}
                              />
                              <span className="truncate">{doc.originalName}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-foreground-muted">Исходные файлы пока отсутствуют.</p>
                    )}

                    {uploadOpen ? (
                      <DocumentUploadBlock
                        caseId={caseId}
                        category={config.slotType}
                        builderStateId={builderStateId ?? undefined}
                        source="source_upload"
                        acceptedMode="documents_only"
                        acceptedLabel="PDF, DOC, DOCX, TXT"
                        onUploadSuccess={(uploadedDocuments) => {
                          if (uploadedDocuments?.length) {
                            setSourceDocumentIds((prev) =>
                              Array.from(new Set([...prev, ...uploadedDocuments.map((doc) => doc.id)]))
                            );
                          }
                          setUploadOpen(false);
                          onSaved();
                        }}
                        onClose={() => setUploadOpen(false)}
                      />
                    ) : null}
                  </div>
                ) : null}

                {inputModes.includes('voice_transcript') ? (
                  <div className="space-y-3 rounded-lg border border-border bg-background-secondary p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Расшифровка / заметки</h3>
                      <p className="text-xs text-foreground-secondary">
                        Вставьте текст расшифровки, продиктованные пункты или заметки. Аудио не сохраняется.
                      </p>
                    </div>
                    <textarea
                      className="input min-h-[160px]"
                      value={voiceTranscript}
                      placeholder="Вставьте расшифровку или заметки..."
                      onChange={(event) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [DOCUMENT_BUILDER_VOICE_TRANSCRIPT_KEY]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ) : null}
                {!inputModes.length ? (
                  <p className="text-sm text-amber-200">
                    Выберите один или несколько режимов ввода для продолжения.
                  </p>
                ) : null}
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div className="space-y-6">
                {config.slotType === 'intake_questionnaire' && config.intakeSections?.length ? (
                  config.intakeSections.map((section) => {
                    const sectionQuestions = config.questions.filter(
                      (q) => (q as { sectionId?: string }).sectionId === section.id
                    );
                    if (!sectionQuestions.length) return null;
                    return (
                      <div key={section.id} className="rounded-lg border border-border bg-background-secondary p-4 space-y-4">
                        <div>
                          <h3 className="text-sm font-semibold text-white">{section.label}</h3>
                          <p className="mt-1 text-xs text-foreground-muted">{section.purpose}</p>
                          <details className="mt-2 text-xs text-foreground-secondary">
                            <summary className="cursor-pointer text-foreground-muted">Что оценивается / доказательства / сильный ответ</summary>
                            <ul className="mt-2 space-y-1 list-disc list-inside">
                              <li><strong>Оценивается:</strong> {section.whatThisEvaluates}</li>
                              <li><strong>Доказательства для загрузки:</strong> {section.evidenceToUpload}</li>
                              <li><strong>Сильный ответ:</strong> {section.strongAnswerLooksLike}</li>
                            </ul>
                          </details>
                        </div>
                        {sectionQuestions.map((question) => (
                          <DocumentBuilderQuestionRenderer
                            key={question.id}
                            question={question}
                            value={answers[question.id]}
                            onChange={(value) =>
                              setAnswers((prev) => ({ ...prev, [question.id]: value }))
                            }
                            onRequestFileUpload={() => { setCurrentStep(1); setUploadOpen(true); }}
                          />
                        ))}
                      </div>
                    );
                  })
                ) : (
                  config.questions.map((question) => (
                    <DocumentBuilderQuestionRenderer
                      key={question.id}
                      question={question}
                      value={answers[question.id]}
                      onChange={(value) =>
                        setAnswers((prev) => ({ ...prev, [question.id]: value }))
                      }
                      onRequestFileUpload={() => { setCurrentStep(1); setUploadOpen(true); }}
                    />
                  ))
                )}
                {config.slotType === 'intake_questionnaire' && sourceDocumentIds.length > 0 ? (
                  <div className="rounded-lg border border-border bg-background-secondary p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <h3 className="text-sm font-semibold text-white">Предложения из документов</h3>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          if (!token) return;
                          setPrefillLoading(true);
                          try {
                            const res = await api.documentBuilders.suggestPrefill(caseId, token, sourceDocumentIds);
                            setPrefillSuggestions(res.suggestions ?? []);
                          } catch (e) {
                            console.error(e);
                            setPrefillSuggestions([]);
                          } finally {
                            setPrefillLoading(false);
                          }
                        }}
                        disabled={prefillLoading}
                      >
                        {prefillLoading ? 'Загрузка…' : 'Получить предложения'}
                      </Button>
                    </div>
                    {prefillSuggestions.length > 0 ? (
                      <ul className="space-y-2 text-sm">
                        {prefillSuggestions.map((s, i) => (
                          <li key={i} className="flex flex-wrap items-start gap-2 rounded border border-border p-2">
                            <span className="text-foreground-muted">{s.questionId}:</span>
                            <span className="text-foreground-secondary flex-1 min-w-0">
                              {typeof s.value === 'string' ? s.value : JSON.stringify(s.value)}
                            </span>
                            <span className="text-xs text-foreground-muted">из {s.source}</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setAnswers((prev) => ({ ...prev, [s.questionId]: s.value }));
                                setPrefillSuggestions((prev) => prev.filter((_, j) => j !== i));
                              }}
                            >
                              Применить
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {currentStep === 3 ? (
              <div className="space-y-4 rounded-lg border border-border bg-background-secondary p-5">
                <div>
                  <h3 className="text-sm font-semibold text-white">Генерация черновика с ИИ</h3>
                  <p className="mt-1 text-sm text-foreground-secondary">
                    Создание структурированного черновика из ответов, прикреплённых материалов и сохранённых данных.
                  </p>
                </div>
                <ul className="space-y-2 text-sm text-foreground-secondary">
                  <li>• Ответов в конструкторе: {Object.keys(answers).filter((key) => isFilled(answers[key])).length}</li>
                  <li>• Прикреплённых материалов: {sourceDocumentIds.length}</li>
                  <li>• Расшифровка прикреплена: {voiceTranscript ? 'Да' : 'Нет'}</li>
                  <li>• Зависимости предзаполнения: {config.prefillFromSlots?.length ? config.prefillFromSlots.join(', ') : 'Нет'}</li>
                </ul>
                {createGenerateError ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                    {createGenerateError}
                  </div>
                ) : null}
                <Button
                  type="button"
                  onClick={handleGenerate}
                  isLoading={isGenerating}
                  disabled={Boolean(createGenerateError)}
                >
                  Создать черновик
                </Button>
              </div>
            ) : null}

            {currentStep === 4 ? (
              <div className="space-y-4">
                {config.slotType === 'cover_letter_draft' && coverLetterBlocked ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-amber-200">Генерация сопроводительного письма заблокирована</h3>
                    <p className="text-sm text-foreground-secondary">
                      <strong>Причина блокировки:</strong> {coverLetterBlocked.whyBlocked}
                    </p>
                    {coverLetterBlocked.missingRequiredInputs.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium text-foreground-muted mb-1">Отсутствующие обязательные данные</p>
                        <ul className="list-disc list-inside text-sm text-foreground-secondary">
                          {coverLetterBlocked.missingRequiredInputs.map((i, idx) => (
                            <li key={idx}>{i}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {coverLetterBlocked.missingRequiredEvidence.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium text-foreground-muted mb-1">Missing required evidence</p>
                        <ul className="list-disc list-inside text-sm text-foreground-secondary">
                          {coverLetterBlocked.missingRequiredEvidence.map((e, idx) => (
                            <li key={idx}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {coverLetterBlocked.criticalDeficiencies.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium text-amber-200 mb-1">Critical deficiencies</p>
                        <ul className="list-disc list-inside text-sm text-amber-200/90">
                          {coverLetterBlocked.criticalDeficiencies.map((c, idx) => (
                            <li key={idx}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div>
                      <p className="text-xs font-medium text-foreground-muted mb-1">Required next actions before generation can proceed</p>
                      <ul className="list-disc list-inside text-sm text-foreground-secondary">
                        {coverLetterBlocked.requiredNextActions.map((a, idx) => (
                          <li key={idx}>{a}</li>
                        ))}
                      </ul>
                    </div>
                    {coverLetterBlocked.recommendedNextDocuments?.length ? (
                      <div>
                        <p className="text-xs font-medium text-foreground-muted mb-1">Recommended next documents/actions</p>
                        <ul className="list-disc list-inside text-sm text-foreground-secondary">
                          {coverLetterBlocked.recommendedNextDocuments.map((d, idx) => (
                            <li key={idx}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <Button type="button" onClick={handleGenerate} isLoading={isGenerating}>
                      Try again after completing requirements
                    </Button>
                  </div>
                ) : config.slotType === 'intake_questionnaire' && strategySummary ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-white">Strategy summary</h3>
                    {strategySummary.probableCaseAxis ? (
                      <p className="text-sm"><span className="text-foreground-muted">Probable case axis:</span> {strategySummary.probableCaseAxis}</p>
                    ) : null}
                    {strategySummary.likelyStrongCriteria?.length ? (
                      <div>
                        <p className="text-xs font-medium text-foreground-muted mb-1">Likely strongest criteria</p>
                        <ul className="list-disc list-inside text-sm text-foreground-secondary">{strategySummary.likelyStrongCriteria.map((c, i) => <li key={i}>{c}</li>)}</ul>
                      </div>
                    ) : null}
                    {strategySummary.likelyWeakCriteria?.length ? (
                      <div>
                        <p className="text-xs font-medium text-foreground-muted mb-1">Likely weak criteria</p>
                        <ul className="list-disc list-inside text-sm text-foreground-secondary">{strategySummary.likelyWeakCriteria.map((c, i) => <li key={i}>{c}</li>)}</ul>
                      </div>
                    ) : null}
                    {strategySummary.missingEvidence?.length ? (
                      <div>
                        <p className="text-xs font-medium text-foreground-muted mb-1">Missing evidence</p>
                        <ul className="list-disc list-inside text-sm text-foreground-secondary">{strategySummary.missingEvidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
                      </div>
                    ) : null}
                    {strategySummary.riskFactors?.length ? (
                      <div>
                        <p className="text-xs font-medium text-foreground-muted mb-1">Risk factors</p>
                        <ul className="list-disc list-inside text-sm text-amber-200/90">{strategySummary.riskFactors.map((r, i) => <li key={i}>{r}</li>)}</ul>
                      </div>
                    ) : null}
                    {strategySummary.strategyNotes?.length ? (
                      <div>
                        <p className="text-xs font-medium text-foreground-muted mb-1">Strategy notes</p>
                        <ul className="list-disc list-inside text-sm text-foreground-secondary">{strategySummary.strategyNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {!(config.slotType === 'cover_letter_draft' && coverLetterBlocked) ? (
                  <>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="input"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    placeholder="Название черновика"
                  />
                  <input
                    className="input"
                    value={draftSummary}
                    onChange={(event) => setDraftSummary(event.target.value)}
                    placeholder="Краткое описание"
                  />
                </div>
                <DocumentDraftEditor
                  sections={draftSections}
                  isRegenerating={isGenerating}
                  onSectionChange={(sectionId, content) =>
                    setDraftSections((prev) =>
                      prev.map((section) => (section.id === sectionId ? { ...section, content } : section))
                    )
                  }
                  onRegenerateSection={async (sectionId) => {
                    if (!token) return;
                    setIsGenerating(true);
                    try {
                      const response = await api.documentBuilders.generate(
                        caseId,
                        config.slotType,
                        { answers, inputModes, sourceDocumentIds },
                        token
                      );
                      const freshSections = response.draft?.sections || [];
                      if (response.draft?.suggestedNextSteps) {
                        setDraftSuggestedNextSteps(response.draft.suggestedNextSteps);
                      }
                      if (response.draft?.strategySummary && typeof response.draft.strategySummary === 'object') {
                        setStrategySummary(response.draft.strategySummary as {
                          probableCaseAxis?: string;
                          likelyStrongCriteria?: string[];
                          likelyWeakCriteria?: string[];
                          missingEvidence?: string[];
                          riskFactors?: string[];
                          strategyNotes?: string[];
                        });
                      }
                      if (response.draft?.reusableDataset && typeof response.draft.reusableDataset === 'object') {
                        setReusableDataset(response.draft.reusableDataset as Record<string, unknown>);
                      }
                      const replacement = freshSections.find((section: EditableDraftSection) => section.id === sectionId);
                      if (replacement) {
                        setDraftSections((prev) =>
                          prev.map((section) => (section.id === sectionId ? replacement : section))
                        );
                      }
                    } catch (error) {
                      console.error('Section regeneration failed:', error);
                    } finally {
                      setIsGenerating(false);
                    }
                  }}
                />
                  </>
                ) : null}
              </div>
            ) : null}

            {currentStep === 5 ? (
              <div className="space-y-4 rounded-lg border border-border bg-background-secondary p-5">
                <div>
                  <h3 className="text-sm font-semibold text-white">Сохранить результат</h3>
                  <p className="mt-1 text-sm text-foreground-secondary">
                    Сохраните черновик в приложении и опубликуйте документ для скачивания.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground-secondary">
                  <p>Текущий статус: {STATUS_LABELS[status] ?? status.replace('_', ' ')}</p>
                  <p>Разделов черновика: {draftSections.length}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={handlePublish} isLoading={isPublishing}>
                    Сохранить как созданный документ
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleMarkCompleted}
                    disabled={status !== 'created' && status !== 'completed'}
                  >
                    Отметить завершённым
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}

        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
            disabled={currentStep === 0}
          >
            Назад
          </Button>
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Продолжить позже
            </Button>
            <Button
              type="button"
              onClick={() => setCurrentStep((step) => Math.min(steps.length - 1, step + 1))}
              disabled={currentStep === steps.length - 1}
            >
              Далее
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
