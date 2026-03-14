import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'admin';
  uploadEnabled?: boolean;
  appAccessActive?: boolean;
  plan?: string;
  planStatus?: string;
  expiresAt?: string | null;
  maxCases?: number;
  caseCount?: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      clearAuth: () => set({ user: null, token: null }),
      isAuthenticated: () => !!get().token,
      isAdmin: () => get().user?.role === 'admin',
    }),
    {
      name: 'auth-storage',
    }
  )
);

interface CaseState {
  currentCaseId: string | null;
  setCurrentCase: (id: string | null) => void;
}

export const useCaseStore = create<CaseState>()(
  persist(
    (set) => ({
      currentCaseId: null,
      setCurrentCase: (id) => set({ currentCaseId: id }),
    }),
    {
      name: 'case-storage',
    }
  )
);
