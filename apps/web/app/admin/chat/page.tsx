'use client';

import { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Send, MessageSquare, CheckCircle, XCircle } from 'lucide-react';

interface ChatThread {
  id: string;
  subject: string | null;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  student: { id: string; name: string; email: string };
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

export default function AdminChatPage() {
  const { token } = useAuthStore();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
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

  const filteredThreads = threads.filter((t) => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

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
        <h1 className="text-3xl font-bold">Student Chat</h1>
        <p className="mt-2 text-foreground-secondary">
          Respond to student questions and support requests.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 h-[600px]">
        <div className="lg:col-span-1">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle>Conversations</CardTitle>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as 'all' | 'open' | 'closed')}
                  className="rounded border border-border bg-background-secondary px-2 py-1 text-sm"
                >
                  <option value="all">All</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {filteredThreads.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="mx-auto mb-4 h-12 w-12 text-foreground-muted" />
                  <p className="text-foreground-secondary">No conversations found.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredThreads.map((thread) => (
                    <button
                      key={thread.id}
                      onClick={() => setSelectedThread(thread)}
                      className={`w-full rounded-lg p-3 text-left transition-colors ${
                        selectedThread?.id === thread.id
                          ? 'bg-primary/10 border border-primary'
                          : 'bg-background-secondary hover:bg-background-tertiary'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">
                          {thread.student.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-sm truncate">
                          {thread.student.name}
                        </span>
                      </div>
                      <p className="text-sm truncate">
                        {thread.subject || 'No subject'}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-foreground-muted">
                          {thread._count.messages} messages
                        </span>
                        <span
                          className={`flex items-center gap-1 text-xs ${
                            thread.status === 'open'
                              ? 'text-success'
                              : 'text-foreground-muted'
                          }`}
                        >
                          {thread.status === 'open' ? (
                            <CheckCircle className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          {thread.status}
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
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedThread.subject || 'Conversation'}</CardTitle>
                      <p className="text-sm text-foreground-secondary mt-1">
                        {selectedThread.student.name} ({selectedThread.student.email})
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        selectedThread.status === 'open'
                          ? 'bg-success/10 text-success'
                          : 'bg-foreground-muted/10 text-foreground-muted'
                      }`}
                    >
                      {selectedThread.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto py-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.senderRole === 'admin' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            message.senderRole === 'admin'
                              ? 'bg-primary text-white'
                              : 'bg-background-secondary'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p
                            className={`text-xs mt-1 ${
                              message.senderRole === 'admin'
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
                      placeholder="Type a reply..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button onClick={handleSendMessage} isLoading={isSending}>
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
                    Select a conversation to view and respond.
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
