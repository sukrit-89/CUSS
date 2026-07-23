// ---------------------------------------------------------------------------
// ReRail — Type-safe environment variable access
// ---------------------------------------------------------------------------
// Fails fast on missing required vars. Server-side vars (FEE_PAYER_SECRET)
// are only accessed in Vercel serverless functions, never in the browser.
// ---------------------------------------------------------------------------

import { HORIZON_URL } from './constants';

export interface ClientEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly HORIZON_URL: string;
}

/**
 * Returns typed client-side environment config.
 * Throws immediately if required vars are missing — fail fast, not at runtime.
 */
export function getClientEnv(): ClientEnv {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
    | string
    | undefined;

  if (!supabaseUrl) {
    throw new Error(
      'Missing required env var: VITE_SUPABASE_URL. ' +
        'Copy .env.example to .env.local and fill in your Supabase project URL.'
    );
  }

  if (!supabaseKey) {
    throw new Error(
      'Missing required env var: VITE_SUPABASE_ANON_KEY. ' +
        'Copy .env.example to .env.local and fill in your Supabase anon key.'
    );
  }

  return {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseKey,
    HORIZON_URL:
      (import.meta.env.VITE_HORIZON_URL as string | undefined) ?? HORIZON_URL,
  };
}

/**
 * Server-side env config — only accessible in Vercel serverless functions.
 * Never import this in browser code.
 */
export interface ServerEnv {
  readonly FEE_PAYER_SECRET: string;
  readonly SUPABASE_URL: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
}

export function getServerEnv(): ServerEnv {
  const feePayerSecret = process.env.FEE_PAYER_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!feePayerSecret) {
    throw new Error('Missing server env: FEE_PAYER_SECRET');
  }
  if (!supabaseUrl) {
    throw new Error('Missing server env: SUPABASE_URL');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing server env: SUPABASE_SERVICE_ROLE_KEY');
  }

  return {
    FEE_PAYER_SECRET: feePayerSecret,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  };
}
