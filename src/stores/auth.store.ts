import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { AuthService } from '@/features/auth/services/auth.service';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  initialize: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
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
        set({ user: newUser, isAuthenticated: !!newUser });
      });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  signIn: async () => {
    await AuthService.signInWithGoogle();
  },

  signOut: async () => {
    await AuthService.signOut();
    set({ user: null, isAuthenticated: false });
  },
}));