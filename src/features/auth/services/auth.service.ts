import { supabase } from '@/lib/supabase/client';
import type { User, Subscription } from '@supabase/supabase-js';

/**
 * Authentication service wrapping Supabase auth.
 */
export class AuthService {
  /**
   * Initiates Google OAuth sign-in.
   */
  static async signInWithGoogle(): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google'
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
   * Gets the currently authenticated user.
   */
  static async getCurrentUser(): Promise<User | null> {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      if (!error.message.includes('Auth session missing')) {
        console.error('Error fetching current user:', error.message);
      }
      return null;
    }

    return data.user;
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
