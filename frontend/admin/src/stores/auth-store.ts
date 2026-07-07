import { create } from 'zustand';
import {
  clearPersistedSession,
  getCurrentUser,
  getToken,
  persistSession,
  type AuthUser,
} from '@/shared/auth/session';

interface AuthState {
  sessionHydrated: boolean;
  token: string | null;
  user: AuthUser | null;
  hydrateSession: () => void;
  setSession: (token: string, user?: AuthUser) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  sessionHydrated: false,
  token: null,
  user: null,
  hydrateSession: () => set({
    sessionHydrated: true,
    token: getToken(),
    user: getCurrentUser(),
  }),
  setSession: (token, user) => {
    persistSession(token, user);
    set({ sessionHydrated: true, token, user: user ?? null });
  },
  clearSession: () => {
    clearPersistedSession();
    set({
      sessionHydrated: true,
      token: null,
      user: null,
    });
  },
}));
