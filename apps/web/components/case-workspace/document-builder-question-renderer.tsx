'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { DocumentBuilderQuestion } from '@aipas/shared';

const intakeQuestion = (q: DocumentBuilderQuestion): q is DocumentBuilderQuestion & { whyWeAskThis?: string; evidenceHint?: string; answerPrompt?: string } =>
  'whyWeAskThis' in q || 'evidenceHint' in q || 'answerPrompt' in q;

function IntakeHints({ question }: { question: DocumentBuilderQuestion }) {
  if (!intakeQuestion(question) || (!question.whyWeAskThis && !question.evidenceHint && !question.answerPrompt))
    return null;
  return (
    <details className="mt-2 text-xs text-foreground-muted">
      <summary className="cursor-pointer hover:text-foreground-secondary">Why we ask / evidence hint / tips</summary>
      <ul className="mt-2 space-y-1 list-disc list-inside text-foreground-secondary">
        {question.whyWeAskThis ? <li><strong>Why:</strong> {question.whyWeAskThis}</li> : null}
        {question.evidenceHint ? <li><strong>Evidence:</strong> {question.evidenceHint}</li> : null}
        {question.answerPrompt ? <li><strong>Tip:</strong> {question.answerPrompt}</li> : null}
      </ul>
    </details>
  );
}

function QuestionPrompt({ question }: { question: DocumentBuilderQuestion }) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{question.label}</p>
          {question.helpText ? (
            <p className="mt-1 text-xs text-foreground-muted">{question.helpText}</p>
          ) : null}
        </div>
        {question.assistantHelp ? (
          <button
            type="button"
            onClick={() => setShowHelp((value) => !value)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-foreground-muted transition-colors hover:border-primary/50 hover:text-primary"
            aria-label={`Help for ${question.label}`}
            title={`Help for ${question.label}`}
          >
            <span className="text-sm font-semibold">?</span>
          </button>
        ) : null}
      </div>
      {question.assistantHelp && showHelp ? (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground-secondary">
          <p><strong>What it means:</strong> {question.assistantHelp.whatItMeans}</p>
          <p className="mt-2"><strong>What to enter:</strong> {question.assistantHelp.whatToEnter}</p>
          {question.assistantHelp.whatNotToEnter ? (
            <p className="mt-2"><strong>What not to enter:</strong> {question.assistantHelp.whatNotToEnter}</p>
          ) : null}
          {question.assistantHelp.example ? (
            <p className="mt-2"><strong>Example:</strong> {question.assistantHelp.example}</p>
          ) : null}
          {question.assistantHelp.sourceDocument ? (
            <p className="mt-2"><strong>Use:</strong> {question.assistantHelp.sourceDocument}</p>
          ) : null}
        </div>
      ) : null}
      <IntakeHints question={question} />
    </div>
  );
}

interface DocumentBuilderQuestionRendererProps {
  question: DocumentBuilderQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
  onRequestFileUpload?: () => void;
}

export function DocumentBuilderQuestionRenderer({
  question,
  value,
  onChange,
  onRequestFileUpload,
}: DocumentBuilderQuestionRendererProps) {
  if (question.type === 'multi_select') {
    const selected = new Set(Array.isArray(value) ? value : []);

    return (
      <div className="space-y-3 rounded-lg border border-border bg-background-secondary p-4">
        <QuestionPrompt question={question} />
        <div className="grid gap-2 md:grid-cols-2">
          {question.options.map((option) => {
            const checked = selected.has(option);
            return (
              <label
                key={option}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  checked ? 'border-primary bg-primary/10 text-white' : 'border-border text-foreground-secondary'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = new Set(selected);
                    if (checked) next.delete(option);
                    else next.add(option);
                    onChange(Array.from(next));
                  }}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  if (question.type === 'select') {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-background-secondary p-4">
        <QuestionPrompt question={question} />
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        >
          <option value="">Select...</option>
          {question.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (question.type === 'repeatable') {
    const items = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];

    return (
      <div className="space-y-3 rounded-lg border border-border bg-background-secondary p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <QuestionPrompt question={question} />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onChange([...(items || []), {}])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Добавить {question.itemLabel}
          </Button>
        </div>
        <div className="space-y-3">
          {items.map((item, itemIndex) => (
            <div key={`${question.id}-${itemIndex}`} className="rounded-lg border border-border bg-background p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-white">
                  {question.itemLabel} {itemIndex + 1}
                </p>
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, index) => index !== itemIndex))}
                  className="rounded p-1 text-foreground-muted hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {question.fields.map((field) => {
                  const fieldValue = item?.[field.id];
                  const isLong = field.type === 'long_text';
                  return (
                    <div key={field.id} className={isLong ? 'md:col-span-2' : ''}>
                      {isLong ? (
                        <div className="space-y-1.5">
                          <label className="label">{field.label}</label>
                          <textarea
                            className="input min-h-[120px]"
                            value={typeof fieldValue === 'string' ? fieldValue : ''}
                            placeholder={field.placeholder}
                            onChange={(event) => {
                              const nextItems = [...items];
                              nextItems[itemIndex] = {
                                ...item,
                                [field.id]: event.target.value,
                              };
                              onChange(nextItems);
                            }}
                          />
                        </div>
                      ) : (
                        <Input
                          label={field.label}
                          type={field.type === 'date' ? 'date' : 'text'}
                          value={typeof fieldValue === 'string' ? fieldValue : ''}
                          placeholder={field.placeholder}
                          onChange={(event) => {
                            const nextItems = [...items];
                            nextItems[itemIndex] = {
                              ...item,
                              [field.id]: event.target.value,
                            };
                            onChange(nextItems);
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!items.length ? (
            <p className="text-sm text-foreground-muted">No entries added yet.</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (question.type === 'file_upload') {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-background-secondary p-4">
        <QuestionPrompt question={question} />
        <Button type="button" size="sm" variant="secondary" onClick={onRequestFileUpload}>
          Upload source materials
        </Button>
      </div>
    );
  }

  const isLong = question.type === 'long_text';
  const stringValue = typeof value === 'string' ? value : '';

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background-secondary p-4">
      {isLong ? (
        <>
          <QuestionPrompt question={question} />
          <textarea
            className="input min-h-[140px]"
            value={stringValue}
            placeholder={question.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        </>
      ) : (
        <div className="space-y-3">
          <QuestionPrompt question={question} />
          <input
            className="input w-full"
            type={question.type === 'date' ? 'date' : 'text'}
            value={stringValue}
            placeholder={question.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      )}
    </div>
  );
}
