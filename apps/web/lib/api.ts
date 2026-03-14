// Use empty string for same-origin (proxied via Next.js rewrites) when no explicit API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const API_TIMEOUT_MS = 12_000;

interface FetchOptions extends RequestInit {
  token?: string;
}

async function fetchAPI<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        'Request timed out. API may be unavailable. Run: npm run dev:all'
      );
    }
    const msg = err instanceof Error ? err.message : 'Network error';
    if (msg.includes('fetch') || msg.includes('Failed') || msg.includes('NetworkError')) {
      throw new Error(
        'Cannot reach server. From project root run: npm run dev:all (or npm run start:all). ' +
          'Ensure PostgreSQL is running: docker-compose up -d postgres'
      );
    }
    throw err;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `Request failed (${response.status})` }));
    const msg = error.error || `Request failed (${response.status})`;
    if (response.status === 502 || response.status === 503) {
      throw new Error(
        `API server not reachable (${response.status}). From project root run: npm run dev:all. ` +
          'Ensure PostgreSQL is running: docker-compose up -d postgres'
      );
    }
    throw new Error(msg);
  }

  return response.json();
}

export const api = {
  auth: {
    login: (email: string, password: string, deviceId?: string) =>
      fetchAPI<{ user: any; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, deviceId }),
      }),
    register: (email: string, password: string, name: string) =>
      fetchAPI<{ user: any; token: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),
    me: (token: string) =>
      fetchAPI<any>('/api/auth/me', { token }),
  },

  account: {
    access: (token: string) =>
      fetchAPI<any>('/api/account/access', { token }),
    changePassword: (currentPassword: string, newPassword: string, token: string) =>
      fetchAPI<{ message: string }>('/api/account/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
        token,
      }),
    registerDevice: (deviceId: string, label?: string, token?: string) =>
      fetchAPI<{ message: string }>('/api/account/device', {
        method: 'POST',
        body: JSON.stringify({ deviceId, label }),
        token: token!,
      }),
    requestUltra: (token: string) =>
      fetchAPI<{ id: string; status: string }>('/api/account/request-ultra', {
        method: 'POST',
        token,
      }),
  },

  billing: {
    status: (token: string) =>
      fetchAPI<any>('/api/billing/status', { token }),
    checkout: (plan: 'pro' | 'ultra', billingCycle: 'monthly' | 'annual', token: string) =>
      fetchAPI<{ url: string }>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan, billingCycle }),
        token,
      }),
    portal: (token: string) =>
      fetchAPI<{ url: string }>('/api/billing/portal', {
        method: 'POST',
        token,
      }),
    cancel: (options?: { reason?: string; atPeriodEnd?: boolean }, token?: string) =>
      fetchAPI<{ message: string }>('/api/billing/cancel', {
        method: 'POST',
        body: JSON.stringify(options ?? {}),
        token: token!,
      }),
  },

  plans: {
    list: (token: string) =>
      fetchAPI<{ plans: any[] }>('/api/plans', { token }),
  },

  cases: {
    list: (token: string) =>
      fetchAPI<any[]>('/api/cases', { token }),
    get: (id: string, token: string) =>
      fetchAPI<any>(`/api/cases/${id}`, { token }),
    create: (token: string) =>
      fetchAPI<any>('/api/cases', { method: 'POST', token }),
    delete: (id: string, token: string) =>
      fetchAPI<{ message: string }>(`/api/cases/${id}`, {
        method: 'DELETE',
        token,
      }),
    update: (id: string, data: any, token: string) =>
      fetchAPI<any>(`/api/cases/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        token,
      }),
    compile: {
      start: (caseId: string, options: object, token: string) =>
        fetchAPI<{ jobId: string; status: string }>(`/api/cases/${caseId}/compile`, {
          method: 'POST',
          body: JSON.stringify(options),
          token,
        }),
      status: (caseId: string, jobId: string, token: string) =>
        fetchAPI<{ status: string; progress: number; error?: string; artifactId?: string }>(
          `/api/cases/${caseId}/compile/${jobId}/status`,
          { token }
        ),
      download: async (caseId: string, jobId: string, token: string): Promise<Blob> => {
        const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
        const res = await fetch(`${API_URL}/api/cases/${caseId}/compile/${jobId}/download`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      },
    },
  },

  modules: {
    list: (token: string) =>
      fetchAPI<any[]>('/api/modules', { token }),
    get: (id: string, token: string) =>
      fetchAPI<any>(`/api/modules/${id}`, { token }),
    getProgress: (id: string, token: string) =>
      fetchAPI<any>(`/api/modules/${id}/progress`, { token }),
  },

  lessons: {
    get: (id: string, token: string) =>
      fetchAPI<any>(`/api/lessons/${id}`, { token }),
    complete: (id: string, token: string) =>
      fetchAPI<any>(`/api/lessons/${id}/complete`, { method: 'POST', token }),
    uncomplete: (id: string, token: string) =>
      fetchAPI<any>(`/api/lessons/${id}/uncomplete`, { method: 'POST', token }),
  },

  progress: {
    overall: (token: string) =>
      fetchAPI<any>('/api/progress/overall', { token }),
    modules: (token: string) =>
      fetchAPI<any[]>('/api/progress/modules', { token }),
    lessonsForModule: (moduleId: string, token: string) =>
      fetchAPI<any[]>(`/api/progress/lessons?moduleId=${encodeURIComponent(moduleId)}`, { token }),
  },

  documents: {
    list: (caseId: string, token: string) =>
      fetchAPI<any[]>(`/api/documents?caseId=${caseId}`, { token }),
    get: (id: string, token: string) =>
      fetchAPI<any>(`/api/documents/${id}`, { token }),
    upload: async (
      caseId: string,
      file: File,
      category: string,
      token: string,
      options?: { builderStateId?: string; source?: 'upload' | 'generated' | 'source_upload' }
    ) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('caseId', caseId);
      formData.append('category', category);
      if (options?.builderStateId) formData.append('builderStateId', options.builderStateId);
      if (options?.source) formData.append('source', options.source);

      const response = await fetch(`${API_URL}/api/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || `Upload failed (${response.status})`);
      }

      return response.json();
    },
    delete: (id: string, token: string) =>
      fetchAPI<any>(`/api/documents/${id}`, { method: 'DELETE', token }),
    getFileBlobUrl: async (id: string, token: string): Promise<string> => {
      const url = `${API_URL}/api/documents/${id}/file`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        let errMsg: string;
        try {
          const json = JSON.parse(text);
          errMsg = json.error || text || `HTTP ${res.status}`;
        } catch {
          errMsg = text || `HTTP ${res.status}`;
        }
        throw new Error(`Failed to load document: ${errMsg} (status ${res.status})`);
      }
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
  },

  documentBuilders: {
    list: (caseId: string, token: string) =>
      fetchAPI<any[]>(`/api/cases/${caseId}/document-builders`, { token }),
    get: (caseId: string, slotType: string, token: string) =>
      fetchAPI<any>(`/api/cases/${caseId}/document-builders/${slotType}`, { token }),
    save: (caseId: string, slotType: string, data: any, token: string) =>
      fetchAPI<any>(`/api/cases/${caseId}/document-builders/${slotType}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        token,
      }),
    generate: (caseId: string, slotType: string, data: any, token: string) =>
      fetchAPI<any>(`/api/cases/${caseId}/document-builders/${slotType}/generate`, {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    publish: (caseId: string, slotType: string, token: string) =>
      fetchAPI<any>(`/api/cases/${caseId}/document-builders/${slotType}/publish`, {
        method: 'POST',
        token,
      }),
    suggestPrefill: (caseId: string, token: string, sourceDocumentIds?: string[]) =>
      fetchAPI<{ suggestions: Array<{ questionId: string; value: unknown; source: string; confidence?: string }>; message?: string }>(
        `/api/cases/${caseId}/document-builders/intake_questionnaire/suggest-prefill`,
        { method: 'POST', body: JSON.stringify({ sourceDocumentIds: sourceDocumentIds ?? [] }), token }
      ),
    configs: (caseId: string, token: string) =>
      fetchAPI<any[]>(`/api/cases/${caseId}/document-builders/configs`, { token }),
  },

  chat: {
    threads: (token: string) =>
      fetchAPI<any[]>('/api/chat/threads', { token }),
    createThread: (subject: string, token: string) =>
      fetchAPI<any>('/api/chat/threads', {
        method: 'POST',
        body: JSON.stringify({ subject }),
        token,
      }),
    getThread: (id: string, token: string) =>
      fetchAPI<any>(`/api/chat/threads/${id}`, { token }),
    sendMessage: (threadId: string, content: string, token: string) =>
      fetchAPI<any>(`/api/chat/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
        token,
      }),
  },

  eer: {
    list: (caseId: string, token: string) =>
      fetchAPI<any[]>(`/api/eer?caseId=${caseId}`, { token }),
    get: (id: string, token: string) =>
      fetchAPI<any>(`/api/eer/${id}`, { token }),
    generate: (caseId: string, claimedCriteria: string[], token: string) =>
      fetchAPI<any>('/api/eer/generate', {
        method: 'POST',
        body: JSON.stringify({ caseId, claimedCriteria }),
        token,
      }),
    reviewDocuments: (caseId: string, documentIds: string[], token: string) =>
      fetchAPI<{ reviews: Array<{ documentId: string; originalName: string; category?: string | null; review: any; reviewDocumentId?: string | null; reviewDocumentName?: string | null }> }>('/api/eer/review-documents', {
        method: 'POST',
        body: JSON.stringify({ caseId, documentIds }),
        token,
      }),
  },

  advisorChat: {
    ask: (
      caseId: string,
      message: string,
      token: string,
      documentIds?: string[],
      conversationHistory?: Array<{ role: string; content: string }>
    ) =>
      fetchAPI<{ answer: string; disclaimer: boolean; attachedDocuments: string[]; savedDocumentName?: string; usedAI?: boolean; aiMeta?: { model: string }; model?: string }>(
        '/api/advisor-chat/ask',
        {
          method: 'POST',
          body: JSON.stringify({
            caseId,
            message,
            documentIds: documentIds ?? [],
            conversationHistory: conversationHistory ?? [],
          }),
          token,
        }
      ),
  },

  packetReview: {
    latestCompile: (caseId: string, token: string) =>
      fetchAPI<{ compileJobId: string | null; compiledAt: string | null }>(
        `/api/cases/${caseId}/packet-review/latest-compile`,
        { token }
      ),
    run: (caseId: string, compileJobId: string, token: string) =>
      fetchAPI<{ report: any }>(`/api/cases/${caseId}/packet-review`, {
        method: 'POST',
        body: JSON.stringify({ compileJobId }),
        token,
      }),
    getSavedReport: (caseId: string, jobId: string, token: string) =>
      fetchAPI<{ report: any }>(`/api/cases/${caseId}/packet-review/${jobId}/report`, {
        token,
      }),
  },

  ai: {
    intake: (messages: any[], caseId: string, token: string) =>
      fetchAPI<any>('/api/ai/intake', {
        method: 'POST',
        body: JSON.stringify({ messages, caseId }),
        token,
      }),
    criteriaMapper: (caseId: string, documents: any[], caseAxis: string, token: string) =>
      fetchAPI<any>('/api/ai/criteria-mapper', {
        method: 'POST',
        body: JSON.stringify({ caseId, documents, caseAxis }),
        token,
      }),
  },

  admin: {
    dashboard: (token: string) =>
      fetchAPI<any>('/api/admin/dashboard', { token }),
    modules: {
      list: (token: string) =>
        fetchAPI<any[]>('/api/admin/modules', { token }),
      create: (data: any, token: string) =>
        fetchAPI<any>('/api/admin/modules', {
          method: 'POST',
          body: JSON.stringify(data),
          token,
        }),
      update: (id: string, data: any, token: string) =>
        fetchAPI<any>(`/api/admin/modules/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
          token,
        }),
      delete: (id: string, token: string) =>
        fetchAPI<any>(`/api/admin/modules/${id}`, { method: 'DELETE', token }),
    },
    lessons: {
      list: (token: string, moduleId?: string) =>
        fetchAPI<any[]>(`/api/admin/lessons${moduleId ? `?moduleId=${moduleId}` : ''}`, { token }),
      create: (data: any, token: string) =>
        fetchAPI<any>('/api/admin/lessons', {
          method: 'POST',
          body: JSON.stringify(data),
          token,
        }),
      update: (id: string, data: any, token: string) =>
        fetchAPI<any>(`/api/admin/lessons/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
          token,
        }),
      updateVideo: (id: string, videoUrl: string, videoEmbed: string, token: string) =>
        fetchAPI<any>(`/api/admin/lessons/${id}/video`, {
          method: 'PATCH',
          body: JSON.stringify({ videoUrl, videoEmbed }),
          token,
        }),
      delete: (id: string, token: string) =>
        fetchAPI<any>(`/api/admin/lessons/${id}`, { method: 'DELETE', token }),
    },
    users: {
      list: (token: string) =>
        fetchAPI<any[]>('/api/admin/users', { token }),
      updateRole: (id: string, role: string, token: string) =>
        fetchAPI<any>(`/api/admin/users/${id}/role`, {
          method: 'PATCH',
          body: JSON.stringify({ role }),
          token,
        }),
      updateUploadAccess: (id: string, uploadEnabled: boolean, token: string) =>
        fetchAPI<any>(`/api/admin/users/${id}/upload-access`, {
          method: 'PATCH',
          body: JSON.stringify({ uploadEnabled }),
          token,
        }),
      get: (id: string, token: string) =>
        fetchAPI<any>(`/api/admin/users/${id}`, { token }),
      suspend: (id: string, suspended: boolean, token: string) =>
        fetchAPI<any>(`/api/admin/users/${id}/suspend`, {
          method: 'PATCH',
          body: JSON.stringify({ suspended }),
          token,
        }),
      resetDevices: (id: string, token: string) =>
        fetchAPI<{ message: string }>(`/api/admin/users/${id}/reset-devices`, {
          method: 'POST',
          token,
        }),
      grantCourse: (id: string, token: string) =>
        fetchAPI<{ message: string }>(`/api/admin/users/${id}/grant-course`, {
          method: 'POST',
          token,
        }),
      setUltra: (id: string, billingCycle?: 'monthly' | 'annual', token?: string) =>
        fetchAPI<{ message: string; plan: string }>(`/api/admin/users/${id}/set-ultra`, {
          method: 'POST',
          body: JSON.stringify({ billingCycle: billingCycle ?? 'monthly' }),
          token: token!,
        }),
    },
    ultraRequests: {
      list: (token: string) =>
        fetchAPI<any[]>('/api/admin/ultra-requests', { token }),
      approve: (id: string, token: string) =>
        fetchAPI<{ message: string; userId: string }>(`/api/admin/ultra-requests/${id}/approve`, {
          method: 'PATCH',
          token,
        }),
      reject: (id: string, token: string) =>
        fetchAPI<{ message: string }>(`/api/admin/ultra-requests/${id}/reject`, {
          method: 'PATCH',
          token,
        }),
    },
  },
};
