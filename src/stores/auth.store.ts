import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { AuthService } from '@/features/auth/services/auth.service';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  initialize: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  initialize: async () => {
    try {
      const user = await AuthService.getCurrentUser();
      set({ user, isAuthenticated: !!user, isLoading: false });

      AuthService.onAuthStateChange((_event, session) => {
        const newUser = session
          ? (session as { user?: User }).user ?? null
          : null;
        const accessToken = session
          ? (session as { access_token?: string }).access_token ?? null
          : null;
        set({ user: newUser, accessToken, isAuthenticated: !!newUser });
      });
    } catch {
      set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
    }
  },

  signIn: async () => {
    await AuthService.signInWithGoogle();
  },

  signOut: async () => {
    await AuthService.signOut();
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
}));