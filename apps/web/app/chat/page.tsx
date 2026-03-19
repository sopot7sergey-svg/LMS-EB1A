'use client';

import { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Send, Plus, MessageSquare } from 'lucide-react';

interface ChatThread {
  id: string;
  subject: string | null;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  messages: { content: string; createdAt: string }[];
  _count: { messages: number };
}

interface ChatMessage {
  id: string;
  content: string;
  senderRole: 'student' | 'admin';
  createdAt: string;
  sender: { name: string };
}

export default function ChatPage() {
  const { token, user } = useAuthStore();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const fetchThreads = async () => {
      try {
        const data = await api.chat.threads(token);
        setThreads(data);
        if (data.length > 0 && !selectedThread) {
          setSelectedThread(data[0]);
        }
      } catch (error) {
        console.error('Failed to fetch threads:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchThreads();
  }, [token]);

  useEffect(() => {
    if (!token || !selectedThread) return;

    const fetchMessages = async () => {
      try {
        const data = await api.chat.getThread(selectedThread.id, token);
        setMessages(data.messages);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };

    fetchMessages();
  }, [token, selectedThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateThread = async () => {
    if (!token || !newSubject.trim()) return;

    try {
      const thread = await api.chat.createThread(newSubject.trim(), token);
      setThreads((prev) => [{ ...thread, messages: [], _count: { messages: 0 } }, ...prev]);
      setSelectedThread(thread);
      setIsCreating(false);
      setNewSubject('');
    } catch (error) {
      console.error('Failed to create thread:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!token || !selectedThread || !newMessage.trim()) return;

    setIsSending(true);
    try {
      const message = await api.chat.sendMessage(selectedThread.id, newMessage.trim(), token);
      setMessages((prev) => [...prev, message]);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Чат с поддержкой</h1>
        <p className="mt-2 text-foreground-secondary">
          Получите помощь и поддержку от нашей команды.
        </p>
      </div>

      <div className="grid min-h-[400px] gap-6 lg:grid-cols-3 lg:h-[600px]">
        <div className="lg:col-span-1">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle>Диалоги</CardTitle>
                <Button size="sm" onClick={() => setIsCreating(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {isCreating && (
                <div className="mb-4 p-3 rounded-lg border border-primary bg-primary/5">
                  <Input
                    placeholder="Тема..."
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="mb-2"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCreateThread}>
                      Создать
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setIsCreating(false)}>
                      Отмена
                    </Button>
                  </div>
                </div>
              )}

              {threads.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="mx-auto mb-4 h-12 w-12 text-foreground-muted" />
                  <p className="text-foreground-secondary">Диалогов пока нет.</p>
                  <Button className="mt-4" onClick={() => setIsCreating(true)}>
                    Начать диалог
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {threads.map((thread) => (
                    <button
                      key={thread.id}
                      onClick={() => setSelectedThread(thread)}
                      className={`w-full rounded-lg p-3 text-left transition-colors ${
                        selectedThread?.id === thread.id
                          ? 'bg-primary/10 border border-primary'
                          : 'bg-background-secondary hover:bg-background-tertiary'
                      }`}
                    >
                      <p className="font-medium truncate">
                        {thread.subject || 'Без темы'}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-foreground-muted">
                          {thread._count.messages} сообщ.
                        </span>
                        <span
                          className={`text-xs ${
                            thread.status === 'open'
                              ? 'text-success'
                              : 'text-foreground-muted'
                          }`}
                        >
                          {thread.status === 'open' ? 'Открыт' : 'Закрыт'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            {selectedThread ? (
              <>
                <CardHeader className="flex-shrink-0 border-b border-border">
                  <CardTitle>{selectedThread.subject || 'Диалог'}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto py-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.senderRole === 'student' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-lg p-3 ${
                            message.senderRole === 'student'
                              ? 'bg-primary text-white'
                              : 'bg-background-secondary'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p
                            className={`text-xs mt-1 ${
                              message.senderRole === 'student'
                                ? 'text-white/70'
                                : 'text-foreground-muted'
                            }`}
                          >
                            {message.sender.name} •{' '}
                            {new Date(message.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </CardContent>
                <div className="flex-shrink-0 border-t border-border p-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Введите сообщение..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="min-h-[44px] min-w-0 flex-1"
                    />
                    <Button onClick={handleSendMessage} isLoading={isSending} className="min-h-[44px] min-w-[44px] shrink-0">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <CardContent className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="mx-auto mb-4 h-12 w-12 text-foreground-muted" />
                  <p className="text-foreground-secondary">
                    Выберите диалог или начните новый.
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
