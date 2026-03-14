'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileCheck, Send } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { DocumentAttachmentPicker, type AttachableDocument } from './document-attachment-picker';
import { DOCUMENT_ASSISTANT_BUILDERS, FORMS_FEES_DOCUMENT_BUILDERS } from '@aipas/shared';
import type { ToolId } from './tool-cards';

interface ToolModalProps {
  toolId: ToolId | null;
  onClose: () => void;
  caseId: string;
}

interface DocumentAssistantModalProps extends ToolModalProps {
  onOpenSlot: (slotType: string) => void;
}

interface AdvisorChatModalProps extends ToolModalProps {
  caseDocuments?: AttachableDocument[];
  onDocumentsRefresh?: () => void;
}

export function DocumentAssistantModal({
  toolId,
  onClose,
  caseId,
  onOpenSlot,
}: DocumentAssistantModalProps) {
  if (toolId !== 'document-assistant') return null;

  const createFlows = DOCUMENT_ASSISTANT_BUILDERS
    .filter((config) => config.assistantMode === 'create')
    .sort((a, b) => {
      if (a.priority === b.priority) return a.shortLabel.localeCompare(b.shortLabel);
      return a.priority === 'priority' ? -1 : 1;
    });
  const fillFlows = FORMS_FEES_DOCUMENT_BUILDERS;
  const openFlow = (slotType: string) => {
    onClose();
    window.setTimeout(() => onOpenSlot(slotType), 0);
  };

  return (
    <Dialog open={true} onClose={onClose} title="Document Assistant" className="max-w-3xl">
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-border bg-background-secondary p-4">
          <p className="text-sm text-foreground-secondary">
            One guided assistant for both drafting documents and preparing forms. Every flow uses the same step-based builder with progress, autosave, and continue-later support.
          </p>
        </div>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Create mode</h3>
            <p className="mt-1 text-xs text-foreground-muted">
              Guided drafting flows for supported case documents.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {createFlows.map((config) => (
              <button
                key={config.slotType}
                type="button"
                onClick={() => openFlow(config.slotType)}
                aria-label={`Open create flow for ${config.shortLabel}`}
                className="rounded-lg border border-border bg-background-secondary px-4 py-3 text-left transition-colors hover:border-primary/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{config.shortLabel}</p>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-primary">
                    Create
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground-muted">{config.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Fill mode</h3>
            <p className="mt-1 text-xs text-foreground-muted">
              Guided form prep with short per-gap help based on USCIS instructions.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {fillFlows.map((config) => (
              <button
                key={config.slotType}
                type="button"
                onClick={() => openFlow(config.slotType)}
                aria-label={`Open fill flow for ${config.shortLabel}`}
                className="rounded-lg border border-border bg-background-secondary px-4 py-3 text-left transition-colors hover:border-primary/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{config.shortLabel}</p>
                  <span className="rounded-full bg-sky-500/10 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-sky-300">
                    Fill
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground-muted">{config.description}</p>
              </button>
            ))}
          </div>
        </section>

        <p className="text-xs text-foreground-muted">
          You can also launch these same flows directly from the checklist using Create, Fill, Template, or + Add.
        </p>
      </div>
    </Dialog>
  );
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  disclaimer?: boolean;
  attachedDocuments?: string[];
  usedAI?: boolean;
  model?: string;
}

export function AdvisorChatModal({ toolId, onClose, caseId, caseDocuments = [], onDocumentsRefresh }: AdvisorChatModalProps) {
  const { token } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachedDocIds, setAttachedDocIds] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const resetSession = useCallback(() => {
    setMessages([]);
    setInput('');
    setAttachedDocIds([]);
    setIsSending(false);
    setSaveNotice(null);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (toolId === 'advisor-chat') {
      resetSession();
    }
  }, [toolId, caseId, resetSession]);

  useEffect(() => {
    if (!saveNotice) return;
    const timeout = window.setTimeout(() => setSaveNotice(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [saveNotice]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !token || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      attachedDocuments: attachedDocIds.length > 0
        ? caseDocuments.filter((d) => attachedDocIds.includes(d.id)).map((d) => d.originalName)
        : undefined,
    };

    setMessages([userMsg]);
    setInput('');
    setIsSending(true);
    setSaveNotice(null);

    try {
      const conversationHistory = messages.slice(-2).map((m) => ({ role: m.role, content: m.content }));
      const response = await api.advisorChat.ask(caseId, text, token, attachedDocIds, conversationHistory);

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: response.answer || 'No response received.',
        disclaimer: response.disclaimer,
        attachedDocuments: response.attachedDocuments,
        usedAI: response.usedAI,
        model: response.aiMeta?.model ?? response.model,
      };

      setMessages([userMsg, assistantMsg]);
      if (response.savedDocumentName) {
        onDocumentsRefresh?.();
        setSaveNotice('Saved to AI Insights');
      }
    } catch (error) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}. Please try again.`,
      };
      setMessages([userMsg, errMsg]);
    } finally {
      setIsSending(false);
    }
  }, [input, token, isSending, attachedDocIds, caseDocuments, caseId, messages]);

  if (toolId !== 'advisor-chat') return null;

  return (
    <Dialog open={true} onClose={onClose} title="Advisor Chat" className="max-w-2xl">
      <div className="flex flex-col" style={{ height: 'min(70vh, 600px)' }}>
        <div className="border-b border-border px-6 py-3">
          <p className="text-xs text-foreground-muted">
            EB1A procedural Q&A, document analysis, and general case guidance. No approval predictions or legal advice.
          </p>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 space-y-3 text-foreground-muted">
              <p className="text-sm">Ask a question about your EB1A case.</p>
              <p className="text-xs">You can attach documents for context-aware answers.</p>
              <div className="text-xs text-left max-w-sm mx-auto space-y-1">
                <p className="font-medium text-foreground-secondary">Try asking:</p>
                <p>&bull; &quot;What does USCIS generally look for in EB-1A petitions?&quot;</p>
                <p>&bull; &quot;What are the 10 EB1A criteria?&quot;</p>
                <p>&bull; &quot;What evidence typically supports original contributions (C5)?&quot;</p>
                <p>&bull; &quot;What should I prepare before starting my case?&quot;</p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-white'
                    : 'border border-border bg-background-secondary text-foreground-secondary'
                }`}
              >
                {msg.attachedDocuments?.length && msg.role === 'user' ? (
                  <p className="mb-2 text-xs opacity-80">
                    Attached: {msg.attachedDocuments.join(', ')}
                  </p>
                ) : null}
                {msg.disclaimer && msg.role === 'assistant' ? (
                  <div className="mb-3 flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>This is not legal advice. It does not predict outcomes. Final decisions may require professional legal review.</span>
                  </div>
                ) : null}
                {msg.role === 'assistant' && msg.usedAI === false ? (
                  <div className="mb-3 flex items-start gap-2 rounded border border-orange-500/30 bg-orange-500/10 p-2 text-xs text-orange-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>AI unavailable — fallback response used.</span>
                  </div>
                ) : null}
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.role === 'assistant' && msg.usedAI && msg.model ? (
                  <p className="mt-2 text-[10px] text-foreground-muted">Model: {msg.model}</p>
                ) : null}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className="rounded-lg border border-border bg-background-secondary px-4 py-3 text-sm text-foreground-muted">
                Thinking...
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border px-6 py-3 space-y-3">
          {saveNotice ? (
            <div className="flex items-start gap-2 rounded border border-violet-500/30 bg-violet-500/10 p-2 text-xs text-violet-200">
              <FileCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{saveNotice}</span>
            </div>
          ) : null}

          <DocumentAttachmentPicker
            caseId={caseId}
            documents={caseDocuments}
            selectedIds={attachedDocIds}
            onSelectionChange={setAttachedDocIds}
            onUploadSuccess={onDocumentsRefresh}
            label="Attach"
            compact
          />

          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask about your EB1A case..."
              className="flex-1 resize-none rounded-lg border border-border bg-background-tertiary px-3 py-2 text-sm placeholder:text-foreground-muted focus:border-primary focus:outline-none"
              rows={2}
              disabled={isSending}
            />
            <Button
              type="button"
              onClick={sendMessage}
              disabled={!input.trim() || isSending}
              isLoading={isSending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
