// Use empty string for same-origin (proxied via Next.js rewrites) when no explicit API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

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

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      fetchAPI<{ user: any; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string, name: string) =>
      fetchAPI<{ user: any; token: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),
    me: (token: string) =>
      fetchAPI<any>('/api/auth/me', { token }),
  },

  cases: {
    list: (token: string) =>
      fetchAPI<any[]>('/api/cases', { token }),
    get: (id: string, token: string) =>
      fetchAPI<any>(`/api/cases/${id}`, { token }),
    create: (token: string) =>
      fetchAPI<any>('/api/cases', { method: 'POST', token }),
    update: (id: string, data: any, token: string) =>
      fetchAPI<any>(`/api/cases/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        token,
      }),
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
    upload: async (caseId: string, file: File, category: string, token: string) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('caseId', caseId);
      formData.append('category', category);

      const response = await fetch(`${API_URL}/api/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json();
    },
    delete: (id: string, token: string) =>
      fetchAPI<any>(`/api/documents/${id}`, { method: 'DELETE', token }),
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
    },
  },
};
