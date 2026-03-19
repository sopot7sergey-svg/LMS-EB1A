'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { FileDown, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';

const PACKET_SECTIONS = [
  {
    code: 'A',
    title: 'Ядро подачи',
    description: 'Административные материалы: формы и подтверждение оплаты.',
    toggleKey: 'includeForms' as const,
  },
  {
    code: 'B',
    title: 'Legal Brief / TOC',
    description: 'Cover letter, оглавление и позиционирование.',
  },
  {
    code: 'C',
    title: 'Идентичность / статус',
    description: 'CV, bio и фоновые документы.',
  },
  {
    code: 'D',
    title: 'Доказательства по критериям',
    description: 'Блок доказательств, отфильтрованный по выбранным критериям.',
  },
  {
    code: 'E',
    title: 'Экспертные письма',
    description: 'Материалы экспертных и рекомендательных писем.',
  },
  {
    code: 'F',
    title: 'Проверка / QA',
    description: 'Индекс exhibits, officer-style review и отчёты проверки документов.',
  },
] as const;

const CRITERION_FILTER_OPTIONS = [
  { id: 'C1', label: 'Критерий 1 — Награды' },
  { id: 'C2', label: 'Критерий 2 — Членства' },
  { id: 'C3', label: 'Критерий 3 — Публикации о вас' },
  { id: 'C4', label: 'Критерий 4 — Судейство' },
  { id: 'C5', label: 'Критерий 5 — Оригинальный вклад' },
  { id: 'C6', label: 'Критерий 6 — Научные статьи' },
  { id: 'C7', label: 'Критерий 7 — Художественные выставки' },
  { id: 'C8', label: 'Критерий 8 — Ведущая / Ключевая роль' },
  { id: 'C9', label: 'Критерий 9 — Высокая зарплата' },
  { id: 'C10', label: 'Критерий 10 — Коммерческий успех' },
  { id: 'C-C', label: 'Сопоставимые доказательства' },
] as const;

interface CompileModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  criteriaSelected: string[];
  onComplete?: () => void;
}

export function CompileModal({
  open,
  onClose,
  caseId,
  criteriaSelected,
  onComplete,
}: CompileModalProps) {
  const { token } = useAuthStore();
  const [criteriaIds, setCriteriaIds] = useState<string[]>([]);
  const [includeForms, setIncludeForms] = useState(true);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [includeLowConfidence, setIncludeLowConfidence] = useState(true);
  const [pageNumberFormat, setPageNumberFormat] = useState<'simple' | 'bates'>('simple');
  const [includeTOC, setIncludeTOC] = useState(true);
  const [includeExhibitIndex, setIncludeExhibitIndex] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (open && criteriaSelected?.length) {
      setCriteriaIds(criteriaSelected);
    }
  }, [open, criteriaSelected]);

  const selectedCriterionLabels = useMemo(
    () =>
      CRITERION_FILTER_OPTIONS.filter((option) => criteriaIds.includes(option.id)).map(
        (option) => option.label
      ),
    [criteriaIds]
  );

  const pollStatus = useCallback(async () => {
    if (!token || !caseId || !jobId) return;
    try {
      const res = await api.cases.compile.status(caseId, jobId, token);
      setStatus(res.status);
      setProgress(res.progress);
      setError(res.error || null);
      return res;
    } catch {
      setError('Не удалось получить статус');
      return null;
    }
  }, [token, caseId, jobId]);

  useEffect(() => {
    if (!jobId || status === 'completed' || status === 'failed') return;
    const interval = setInterval(pollStatus, 1500);
    return () => clearInterval(interval);
  }, [jobId, status, pollStatus]);

  const handleStart = async () => {
    if (!token) return;
    setError(null);
    setJobId(null);
    setStatus('');
    setProgress(0);
    try {
      const res = await api.cases.compile.start(
        caseId,
        {
          criteriaIds,
          orderingStrategy: 'numeric',
          includeForms,
          includeDrafts,
          includeDuplicates,
          includeLowConfidence,
          pageNumberFormat,
          includeTOC,
          includeExhibitIndex,
        },
        token
      );
      setJobId(res.jobId);
      setStatus(res.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось запустить');
    }
  };

  const handleDownload = async () => {
    if (!token || !jobId) return;
    setIsDownloading(true);
    try {
      const blob = await api.cases.compile.download(caseId, jobId, token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EB1A-Officer-Packet-${caseId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setIsDownloading(false);
    }
  };

  const isRunning = status && status !== 'completed' && status !== 'failed';

  return (
    <Dialog open={open} onClose={onClose} title="Собрать пакет для офицера" className="max-w-2xl">
      <div className="p-6 space-y-6">
        <div className="rounded-lg border border-border bg-background-secondary p-4">
          <p className="text-sm text-foreground-secondary">
            Собирает канонический пакет в порядке A → B → C → D → E → F, используя проверенные документы, коды exhibits, сгенерированное оглавление и индекс exhibits.
          </p>
        </div>

        {!jobId ? (
          <>
            <div>
              <h3 className="mb-3 font-medium">Структура пакета</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {PACKET_SECTIONS.map((section) => (
                  <div
                    key={section.code}
                    className="rounded-lg border border-border bg-background-secondary px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">
                          Секция {section.code} — {section.title}
                        </p>
                        <p className="mt-1 text-xs text-foreground-muted">{section.description}</p>
                      </div>
                      {'toggleKey' in section && section.toggleKey === 'includeForms' ? (
                        <label className="shrink-0 text-xs text-foreground-secondary">
                          <input
                            type="checkbox"
                            checked={includeForms}
                            onChange={(e) => setIncludeForms(e.target.checked)}
                            className="mr-2 rounded border-border"
                          />
                          Включить
                        </label>
                      ) : (
                        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-1 text-[11px] font-medium text-primary">
                          Включается при наличии
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium">Фильтр доказательств по критериям</h3>
                  <p className="text-xs text-foreground-muted">
                    Фильтрует только секцию D. Структура пакета остаётся канонической.
                  </p>
                </div>
                <span className="rounded-full bg-background-secondary px-2 py-1 text-xs text-foreground-secondary">
                  {selectedCriterionLabels.length} выбрано
                </span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {CRITERION_FILTER_OPTIONS.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-start gap-2 rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={criteriaIds.includes(option.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCriteriaIds((prev) => [...prev, option.id]);
                        } else {
                          setCriteriaIds((prev) => prev.filter((id) => id !== option.id));
                        }
                      }}
                      className="mt-0.5 rounded border-border"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              {selectedCriterionLabels.length > 0 && (
                <p className="mt-2 text-xs text-foreground-muted">
                  Выбрано: {selectedCriterionLabels.join(' • ')}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="font-medium">Результаты пакета</h3>
                <p className="text-xs text-foreground-muted">
                  Соответствуют каноническому workflow пакета для офицера.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg border border-border bg-background-secondary px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeTOC}
                    onChange={(e) => setIncludeTOC(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Сгенерировать оглавление</span>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-border bg-background-secondary px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeExhibitIndex}
                    onChange={(e) => setIncludeExhibitIndex(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Сгенерировать индекс exhibits</span>
                </label>
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-medium">Нумерация страниц</h3>
              <select
                value={pageNumberFormat}
                onChange={(e) => setPageNumberFormat(e.target.value as 'simple' | 'bates')}
                className="input"
              >
                <option value="simple">Простая нумерация</option>
                <option value="bates">Bates (EB1A-0001...)</option>
              </select>
            </div>

            <div className="rounded-lg border border-border bg-background-secondary">
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div>
                  <p className="text-sm font-medium text-white">Дополнительно</p>
                  <p className="text-xs text-foreground-muted">
                    Дополнительные опции подготовки пакета.
                  </p>
                </div>
                {showAdvanced ? (
                  <ChevronDown className="h-4 w-4 text-foreground-muted" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-foreground-muted" />
                )}
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-1 gap-3 border-t border-border px-4 py-4 md:grid-cols-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDrafts}
                      onChange={(e) => setIncludeDrafts(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-sm">Включить черновики</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDuplicates}
                      onChange={(e) => setIncludeDuplicates(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-sm">Разрешить дубликаты файлов</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer md:col-span-2">
                    <input
                      type="checkbox"
                      checked={includeLowConfidence}
                      onChange={(e) => setIncludeLowConfidence(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-sm">Включить документы с низкой уверенностью</span>
                  </label>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-medium text-white">Стандартный порядок сборки</p>
              <p className="mt-1 text-sm text-foreground-secondary">
                Канонический порядок: A Ядро подачи, B Legal Brief / TOC, C Идентичность / статус, D Доказательства по критериям, E Экспертные письма, F Проверка / QA.
              </p>
            </div>

            <Button onClick={handleStart} className="w-full">
              Собрать канонический пакет
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            {isRunning && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="font-medium">{status}</span>
                  <span className="text-sm text-foreground-muted">({progress}%)</span>
                </div>
                <div className="h-2 rounded-full bg-background-tertiary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {status === 'completed' && (
              <div className="flex items-center gap-3 rounded-lg bg-success/10 p-4 text-success">
                <CheckCircle className="h-8 w-8" />
                <div>
                  <p className="font-medium">Сборка завершена</p>
                  <p className="text-sm opacity-90">Скачайте PDF или сохраните как артефакт.</p>
                </div>
              </div>
            )}

            {status === 'failed' && (
              <div className="flex items-center gap-3 rounded-lg bg-error/10 p-4 text-error">
                <AlertCircle className="h-8 w-8" />
                <div>
                  <p className="font-medium">Сборка не удалась</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}

            {error && status !== 'failed' && (
              <p className="text-sm text-error">{error}</p>
            )}

            {status === 'completed' && (
              <div className="flex gap-2">
                <Button onClick={handleDownload} disabled={isDownloading} className="flex-1">
                  <FileDown className="mr-2 h-4 w-4" />
                  {isDownloading ? 'Загрузка...' : 'Скачать PDF'}
                </Button>
                <Button variant="secondary" onClick={onClose}>
                  Закрыть
                </Button>
              </div>
            )}

            {(status === 'failed' || status === 'completed') && (
              <Button variant="ghost" onClick={() => { setJobId(null); setStatus(''); }}>
                Новая сборка
              </Button>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
