'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, MessageCircle, ClipboardCheck, FileText, Brain, ChevronDown, ChevronRight, ExternalLink, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface Document {
  id: string;
  originalName: string;
  category?: string;
  metadata?: { slotType?: string; insightType?: string };
}

interface NextActionItem {
  label: string;
  onClick?: () => void;
}

const STAGE_OPTIONS = [
  { value: 'M0', label: 'M0: "Ось дела" и стратегия' },
  { value: 'M1', label: 'M1: Диагностика по 10 критериям' },
  { value: 'M2', label: 'M2: Построение доказательств под 10 критериев' },
  { value: 'M3', label: 'M3: Рекомендательные письма' },
  { value: 'M4', label: 'M4: Упаковка петиции и финальная сборка' },
  { value: 'M5', label: 'M5: Подача I-140 и процесс после (premium / AOS / consular)' },
  { value: 'M6', label: 'M6: Officer-Style Review' },
] as const;

interface RightPanelProps {
  stage: string;
  onStageChange: (stage: string) => void;
  nextActions: NextActionItem[];
  openTasks: string[];
  documents: Document[];
  onGenerateNarrative: () => void;
  onAskAdvisor: () => void;
  onSubmitForReview: () => void;
  onDocumentDeleted?: () => void;
  onOpenDocument?: (docId: string, docName?: string) => void;
}

export function RightPanel({
  stage,
  onStageChange,
  nextActions,
  openTasks,
  documents,
  onGenerateNarrative,
  onAskAdvisor,
  onSubmitForReview,
  onDocumentDeleted,
  onOpenDocument,
}: RightPanelProps) {
  const { token } = useAuthStore();
  const [docsExpanded, setDocsExpanded] = useState(true);
  const [insightsExpanded, setInsightsExpanded] = useState(true);

  const userDocs = documents.filter((d) => d.category !== 'AI Insights');
  const aiInsights = documents.filter((d) => d.category === 'AI Insights');

  const handleOpenDoc = (docId: string, docName: string) => {
    if (onOpenDocument) {
      onOpenDocument(docId, docName);
    } else if (token) {
      api.documents.getFileBlobUrl(docId, token).then(
        (url) => {
          window.open(url, '_blank', 'noopener');
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        },
        (err) => {
          console.error(err);
          alert(err instanceof Error ? err.message : 'Не удалось открыть документ');
        }
      );
    }
  };

  const handleDeleteDoc = async (docId: string, docName: string) => {
    if (!token) return;
    if (!confirm(`Удалить «${docName}»?`)) return;
    try {
      await api.documents.delete(docId, token);
      onDocumentDeleted?.();
    } catch (err) {
      console.error(err);
        alert('Не удалось удалить документ');
    }
  };

  return (
    <div className="space-y-6">
      {aiInsights.length > 0 && (
        <Card>
          <CardHeader
            className="cursor-pointer"
            onClick={() => setInsightsExpanded((prev) => !prev)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {insightsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Brain className="h-4 w-4 text-violet-400" />
                AI-инсайты
                <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-medium text-violet-300">
                  {aiInsights.length}
                </span>
              </CardTitle>
            </div>
          </CardHeader>
          {insightsExpanded && (
            <CardContent>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {aiInsights.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-background-tertiary group">
                    <Brain className="h-4 w-4 shrink-0 text-violet-400" />
                    <button
                      type="button"
                      onClick={() => handleOpenDoc(doc.id, doc.originalName)}
                      className="flex flex-1 items-center gap-2 min-w-0 text-left text-sm"
                    >
                      <span className="truncate text-violet-300 hover:underline">{doc.originalName}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-foreground-muted opacity-70 group-hover:opacity-100" aria-label="Open" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDoc(doc.id, doc.originalName)}
                      className="shrink-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-2 text-foreground-muted hover:bg-destructive/10 hover:text-destructive transition-colors sm:min-h-0 sm:min-w-0 sm:p-1"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setDocsExpanded((prev) => !prev)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {docsExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Загруженные документы
              {userDocs.length > 0 && (
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                  {userDocs.length}
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        {docsExpanded && (
          <CardContent>
            {userDocs.length === 0 ? (
              <p className="text-sm text-foreground-muted">Документы ещё не загружены. Используйте + Добавить в чеклисте.</p>
            ) : (
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {userDocs.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-background-tertiary group">
                    <FileText className="h-4 w-4 shrink-0 text-foreground-muted" />
                    <button
                      type="button"
                      onClick={() => handleOpenDoc(doc.id, doc.originalName)}
                      className="flex flex-1 items-center gap-2 min-w-0 text-left text-sm"
                    >
                      <span className="truncate text-primary hover:underline">{doc.originalName}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-foreground-muted opacity-70 group-hover:opacity-100" aria-label="Open" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDoc(doc.id, doc.originalName)}
                      className="shrink-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-2 text-foreground-muted hover:bg-destructive/10 hover:text-destructive transition-colors sm:min-h-0 sm:min-w-0 sm:p-1"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Рекомендуемые шаги</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground-secondary mb-2">
              Текущий этап
            </label>
            <select
              value={stage}
              onChange={(e) => onStageChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {STAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Следующие 3 действия</h4>
            <ul className="space-y-1 text-sm text-foreground-secondary">
              {nextActions.length > 0 ? (
                nextActions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary">{i + 1}.</span>
                    {a.onClick ? (
                      <button
                        type="button"
                        onClick={a.onClick}
                        className="text-left text-primary hover:underline"
                      >
                        {a.label}
                      </button>
                    ) : (
                      a.label
                    )}
                  </li>
                ))
              ) : (
                <li className="text-foreground-muted">Выполните пункты чеклиста</li>
              )}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Открытые задачи</h4>
            <ul className="space-y-1 text-sm text-foreground-secondary">
              {openTasks.length > 0 ? (
                openTasks.map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-warning">•</span>
                    {t}
                  </li>
                ))
              ) : (
                <li className="text-foreground-muted">Нет открытых задач</li>
              )}
            </ul>
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={onGenerateNarrative}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Сгенерировать нарратив для выбранного критерия
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={onAskAdvisor}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Спросить об этом требовании
            </Button>
            <Button
              className="w-full justify-start"
              onClick={onSubmitForReview}
            >
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Отправить на проверку
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
