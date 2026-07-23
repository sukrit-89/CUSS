import { createClient } from '@supabase/supabase-js';
import { getClientEnv } from '@/config/env';
import type { Database } from './database.types';

const env = getClientEnv();

/**
 * Supabase client singleton instance.
 * Typed with the Database schema for full type safety on queries.
 */
export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
);
