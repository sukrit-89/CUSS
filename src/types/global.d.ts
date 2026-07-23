/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_HORIZON_URL?: string;
  readonly VITE_NETWORK_PASSPHRASE?: string;
  readonly VITE_USDC_ISSUER?: string;
  readonly VITE_CLAIM_LINK_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
