import { supabase } from '@/lib/supabase/client';
import type { User, Subscription } from '@supabase/supabase-js';

/**
 * Authentication service wrapping Supabase auth.
 */
export class AuthService {
  /**
   * Signs in a user with Email & Password.
   */
  static async signInWithEmail(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Could not find user after login');
    }

    return data.user;
  }

  /**
   * Registers a new user with Email & Password.
   */
  static async signUpWithEmail(email: string, password: string): Promise<{ user: User | null; sessionExists: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      user: data.user,
      sessionExists: !!data.session,
    };
  }

  /**
   * Initiates Google OAuth sign-in.
   */
  static async signInWithGoogle(): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      throw new Error(`Failed to sign in with Google: ${error.message}`);
    }
  }

  /**
   * Signs out the current user.
   */
  static async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(`Failed to sign out: ${error.message}`);
    }
  }

  /**
   * Gets the currently authenticated user safely.
   */
  static async getCurrentUser(): Promise<User | null> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        return null;
      }

      const { data, error } = await supabase.auth.getUser();

      if (error) {
        return null;
      }

      return data.user;
    } catch {
      return null;
    }
  }

  /**
   * Subscribes to auth state changes.
   * @param callback Function to call when auth state changes
   * @returns Subscription to unsubscribe later
   */
  static onAuthStateChange(
    callback: (event: string, session: unknown) => void
  ): Subscription {
    const { data } = supabase.auth.onAuthStateChange(callback);
    return data.subscription;
  }
}
